/**
 * Admin-only, read-only endpoints for reports and the audit trail.
 *
 *   GET /api/admin/reports/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   GET /api/admin/audit-logs?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Kept in their own file so they stay separate from the main index.ts.
 * Mounted in index.ts with: app.use("/api/admin", adminReportsRouter)
 */
import { Router, type Request, type Response } from "express";
import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

const MAX_RANGE_DAYS = 366;
const MAX_ROWS = 2000;

/** A real calendar date written as YYYY-MM-DD (rejects e.g. 2026-02-31). */
const isDate = (x: unknown): x is string =>
  typeof x === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  !Number.isNaN(Date.parse(`${x}T00:00:00Z`)) &&
  new Date(`${x}T00:00:00Z`).toISOString().startsWith(x);

/** Checks ?from and ?to; returns an error message or null. */
function checkRange(from: unknown, to: unknown): string | null {
  if (!isDate(from) || !isDate(to)) return "Choose a valid start and end date.";
  if (from > to) return "The start date must be on or before the end date.";
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (days > MAX_RANGE_DAYS) return "Reports can cover at most one year at a time.";
  return null;
}

/**
 * Display names for a list of account IDs, as a Map of user_id -> name.
 * Uses users.full_name, then users.email. For accounts with no usable row in
 * `users`, falls back to the sign-up name or email stored in Supabase Auth.
 */
async function namesFor(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id) => id && id !== "null" && id !== "undefined"))];
  const names = new Map<string, string>();
  if (!ids.length) return names;

  const { data, error } = await supabaseAdmin.from("users").select("user_id, full_name, email").in("user_id", ids);
  if (error) throw error;
  for (const u of data ?? []) {
    const name = String(u.full_name ?? "").trim() || String(u.email ?? "").trim();
    if (name) names.set(String(u.user_id), name);
  }

  // Look up the rest in Supabase Auth (capped so a large report stays fast).
  const missing = ids.filter((id) => !names.has(id)).slice(0, 50);
  await Promise.all(
    missing.map(async (id) => {
      const { data: auth } = await supabaseAdmin.auth.admin.getUserById(id);
      const meta = (auth?.user?.user_metadata ?? {}) as Record<string, unknown>;
      const name = String(meta.full_name ?? meta.name ?? "").trim() || String(auth?.user?.email ?? "").trim();
      if (name) names.set(id, name);
    }),
  );
  return names;
}

// ---------------------------------------------------------------------------
// Appointments report
// ---------------------------------------------------------------------------
router.get("/reports/appointments", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { from, to } = req.query;
  const rangeError = checkRange(from, to);
  if (rangeError) return res.status(400).json({ error: rangeError });

  try {
    const [appointmentsResult, settingsResult] = await Promise.all([
      supabaseAdmin
        .from("appointments")
        .select("appointment_id, customer_id, staff_id, service_id, appointment_date, start_time, end_time, status, payment_status, total_amount")
        .gte("appointment_date", from as string)
        .lte("appointment_date", to as string)
        .order("appointment_date")
        .order("start_time")
        .limit(MAX_ROWS + 1),
      supabaseAdmin.from("salon_settings").select("salon_name, location, phone, email").limit(1).maybeSingle(),
    ]);
    if (appointmentsResult.error) throw appointmentsResult.error;

    const rows = appointmentsResult.data ?? [];
    const truncated = rows.length > MAX_ROWS;
    const appointments = rows.slice(0, MAX_ROWS);

    // Staff rows link to accounts through user_id (staff_id is the staff record's own ID).
    const staffIds = [...new Set(appointments.map((a) => String(a.staff_id)))];
    const serviceIds = [...new Set(appointments.map((a) => String(a.service_id)))];
    const [staffResult, serviceResult] = await Promise.all([
      staffIds.length
        ? supabaseAdmin.from("staff").select("staff_id, user_id, staff_type").in("staff_id", staffIds)
        : Promise.resolve({ data: [], error: null }),
      serviceIds.length
        ? supabaseAdmin.from("services").select("service_id, service_name").in("service_id", serviceIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (staffResult.error) throw staffResult.error;
    if (serviceResult.error) throw serviceResult.error;

    const staffById = new Map((staffResult.data ?? []).map((s) => [String(s.staff_id), s]));
    const serviceNames = new Map((serviceResult.data ?? []).map((s) => [String(s.service_id), String(s.service_name)]));
    const names = await namesFor([
      ...appointments.map((a) => String(a.customer_id)),
      ...(staffResult.data ?? []).map((s) => String(s.user_id)),
    ]);

    res.json({
      from,
      to,
      generatedAt: new Date().toISOString(),
      truncated,
      salon: settingsResult.data ?? { salon_name: "Bookify", location: null, phone: null, email: null },
      appointments: appointments.map((a) => {
        const staff = staffById.get(String(a.staff_id));
        return {
          appointment_id: a.appointment_id,
          appointment_date: a.appointment_date,
          start_time: a.start_time,
          end_time: a.end_time,
          status: a.status,
          payment_status: a.payment_status,
          total_amount: Number(a.total_amount ?? 0),
          customer_name: names.get(String(a.customer_id)) || "Customer",
          staff_id: a.staff_id,
          staff_name: (staff && names.get(String(staff.user_id))) || "Team member",
          staff_type: staff?.staff_type ?? null,
          service_name: serviceNames.get(String(a.service_id)) || "Service",
        };
      }),
    });
  } catch (error) {
    console.error("Appointments report failed:", error);
    res.status(500).json({ error: "Unable to build the report. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------
router.get("/audit-logs", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { from, to } = req.query;
  const rangeError = checkRange(from, to);
  if (rangeError) return res.status(400).json({ error: rangeError });

  try {
    // Dates are inclusive and use Nairobi time (UTC+3).
    const start = `${from}T00:00:00+03:00`;
    const end = `${to}T23:59:59.999+03:00`;
    let { data, error } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS + 1);

    // 42703 = column does not exist. If the table's time column has another
    // name, fall back to loading the latest rows and filtering them here.
    if (error?.code === "42703") {
      const fallback = await supabaseAdmin.from("audit_logs").select("*").limit(5000);
      if (fallback.error) throw fallback.error;
      const timeOf = (row: Record<string, unknown>) => String(row.created_at ?? row.timestamp ?? row.logged_at ?? "");
      const lo = Date.parse(start), hi = Date.parse(end);
      data = ((fallback.data ?? []) as Record<string, unknown>[])
        .map((row) => ({ ...row, created_at: timeOf(row) }))
        .filter((row) => { const t = Date.parse(row.created_at); return t >= lo && t <= hi; })
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, MAX_ROWS + 1);
      error = null;
    }
    if (error) throw error;

    const rows = (data ?? []) as Record<string, unknown>[];
    const truncated = rows.length > MAX_ROWS;
    const logs = rows.slice(0, MAX_ROWS);
    const names = await namesFor(logs.map((l) => String(l.user_id ?? "")));

    res.json({
      truncated,
      logs: logs.map((l) => ({
        id: String(l.log_id ?? l.audit_id ?? l.id ?? `${l.created_at}-${l.action}-${l.entity_id}`),
        created_at: l.created_at,
        user_id: l.user_id,
        actor_name: names.get(String(l.user_id)) || "Unknown user",
        action: l.action,
        entity_type: l.entity_type,
        entity_id: l.entity_id,
        old_data: l.old_data ?? null,
        new_data: l.new_data ?? null,
      })),
    });
  } catch (error) {
    console.error("Audit log query failed:", error);
    res.status(500).json({ error: "Unable to load the audit trail. Please try again." });
  }
});

export default router;

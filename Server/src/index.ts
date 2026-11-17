import express from "express";

import { createCipheriv, createHash, createDecipheriv, randomBytes } from "node:crypto";

import { google } from "googleapis";

import cors from "cors";

import dotenv from "dotenv";

import { rateLimit } from "express-rate-limit";

import { supabaseAdmin } from "./config/supabaseAdmin.js";

import { requireAuth } from "./middleware/requireAuth.js";

import { requireAdmin } from "./middleware/requireAdmin.js";

import { requireStaff } from "./middleware/requireStaff.js";

import { writeAuditLog } from "./utils/auditLog.js";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT) || 5000;

const appointmentFields = "appointment_id, customer_id, staff_id, service_id, appointment_date, start_time, end_time, status, payment_status, total_amount, notes, created_at";

const activeStatuses = ["pending", "confirmed", "checked_in", "completed"];

const statuses = [...activeStatuses, "cancelled", "no_show"];

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

const isDate = (x: unknown): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);

const isTime = (x: unknown): x is string => typeof x === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(x);

const isMoney = (x: unknown) => typeof x === "number" && Number.isFinite(x) && x >= 0;

const serviceAuditData = (row: Record<string, unknown>) => ({ service_id: row.service_id, service_name: row.service_name, price: row.price, duration_minutes: row.duration_minutes });

const staffAuditData = (row: Record<string, unknown>) => ({ staff_id: row.staff_id, staff_type: row.staff_type, specialty: row.specialty, is_active: row.is_active });

const appointmentAuditData = (row: Record<string, unknown>) => ({ appointment_id: row.appointment_id, customer_id: row.customer_id, staff_id: row.staff_id, service_id: row.service_id, appointment_date: row.appointment_date, start_time: row.start_time, end_time: row.end_time, status: row.status, payment_status: row.payment_status, total_amount: row.total_amount });

const settingsAuditData = (row: Record<string, unknown>) => ({ setting_id: row.setting_id, salon_name: row.salon_name, location: row.location, opening_time: row.opening_time, closing_time: row.closing_time, currency: row.currency });

app.use(

  cors({

    origin: [

      "http://localhost:5173",

      "http://127.0.0.1:5173",

      "http://localhost:5174",

    ],

    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"],

    credentials: true,

  })

);

app.use(express.json());

type DecoratedAppointment = Record<string, unknown> & { customer: Record<string, unknown> | null; staff: Record<string, unknown> | null; service: Record<string, unknown> | null };

async function decorate(rows: Record<string, unknown>[]): Promise<DecoratedAppointment[]> {

  if (!rows.length) return [];

  const ids = (field: string) => [...new Set(rows.map((r) => String(r[field])))];

  const [customers, staff, services] = await Promise.all([

    supabaseAdmin.from("users").select("user_id, full_name, email").in("user_id", ids("customer_id")),

    supabaseAdmin.from("staff").select("staff_id, user_id").in("staff_id", ids("staff_id")),

    supabaseAdmin.from("services").select("service_id, service_name, duration_minutes, price").in("service_id", ids("service_id")),

  ]);

  if (customers.error || staff.error || services.error) throw new Error("Unable to load booking details");

  const map = <T extends { [key: string]: unknown }>(items: T[], key: string) => new Map(items.map((x) => [String(x[key]), x]));

  const customerMap = map((customers.data ?? []) as Record<string, unknown>[], "user_id");

  const staffLinks = (staff.data ?? []) as { staff_id: string; user_id: string }[];

  const { data: staffProfiles, error: staffProfileError } = staffLinks.length

    ? await supabaseAdmin.from("users").select("user_id, full_name, email").in("user_id", staffLinks.map((x) => x.user_id))

    : { data: [], error: null };

  if (staffProfileError) throw staffProfileError;

  const profileMap = map((staffProfiles ?? []) as Record<string, unknown>[], "user_id");

  const staffMap = new Map(staffLinks.map((x) => [String(x.staff_id), profileMap.get(String(x.user_id)) ?? null]));

  const serviceMap = map((services.data ?? []) as Record<string, unknown>[], "service_id");

  return rows.map((r) => ({ ...r, customer: customerMap.get(String(r.customer_id)) ?? null, staff: staffMap.get(String(r.staff_id)) ?? null, service: serviceMap.get(String(r.service_id)) ?? null }));

}

async function hasClash(staffId: string, date: string, start: string, end: string) {

  const { data, error } = await supabaseAdmin.from("appointments").select("appointment_id").eq("staff_id", staffId).eq("appointment_date", date).in("status", activeStatuses).lt("start_time", end).gt("end_time", start);

  if (error) throw error;

  return Boolean(data?.length);

}

app.get("/", (_req, res) => res.send("Bookify API is running."));

app.get("/api/health", (_req, res) => res.json({ success: true, message: "Bookify API connected" }));

const emailCheckLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, message: { success: false, message: "Too many requests. Please try again later." } });

app.post("/api/auth/check-email", emailCheckLimiter, async (req, res) => {

  const email = req.body?.email;

  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ success: false, message: "Please enter a valid email address." });

  const { data, error } = await supabaseAdmin.from("users").select("user_id").eq("email", email.trim().toLowerCase()).maybeSingle();

  if (error) return res.status(500).json({ success: false, message: "Unable to check email availability." });

  return res.json({ success: true, exists: Boolean(data), message: data ? "This email is already registered." : "Email is available." });

});

app.get("/api/services", async (_req, res) => {

  const { data, error } = await supabaseAdmin.from("services").select("service_id, service_name, price, duration_minutes").order("service_name");

  if (error) return res.status(500).json({ success: false, message: "Unable to fetch services." });

  res.json({ success: true, services: data, currency: "KES" });

});

// CUSTOMER ROUTES — used by Client/src/pages/Dashboard.tsx.

app.get("/api/barbers", async (_req, res) => {

  try {

    const { data: team, error } = await supabaseAdmin.from("staff")

      .select("staff_id, user_id, staff_type, specialty, is_active")

      .eq("is_active", true);

    if (error) throw error;

    const ids = (team ?? []).map((x) => x.user_id).filter(Boolean);

    const { data: profiles, error: profileError } = ids.length

      ? await supabaseAdmin.from("users").select("user_id, full_name").in("user_id", ids)

      : { data: [], error: null };

    if (profileError) throw profileError;

    const names = new Map((profiles ?? []).map((x) => [x.user_id, x.full_name]));

    res.json({ barbers: (team ?? []).map((x) => ({

      staff_id: x.staff_id, full_name: names.get(x.user_id) ?? "Professional",

      staff_type: x.staff_type, specialty: x.specialty,

    })) });

  } catch (error) { console.error("Barbers:", error); res.status(500).json({ error: "Unable to load professionals" }); }

});

app.get("/api/customer/dashboard", requireAuth, async (_req, res) => {

  try {

    const customerId = res.locals.user.id;

    const { data, error } = await supabaseAdmin.from("appointments")

      .select(appointmentFields).eq("customer_id", customerId)

      .order("appointment_date", { ascending: false }).order("start_time", { ascending: false }).limit(200);

    if (error) throw error;

    const appointments = await decorate((data ?? []) as Record<string, unknown>[]);

    const now = new Date();

    const date = today();

    const upcoming = [...appointments]

      .filter((x) => !["cancelled", "no_show", "completed"].includes(String(x.status)) &&

        `${String(x.appointment_date)}T${String(x.start_time)}` >= `${date}T${now.toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi", hour12: false })}`)

      .sort((a, b) => `${a.appointment_date} ${a.start_time}`.localeCompare(`${b.appointment_date} ${b.start_time}`))[0] ?? null;

    const year = date.slice(0, 4);

    const completed = appointments.filter((x) => x.status === "completed");

    const visitsThisYear = completed.filter((x) => String(x.appointment_date).startsWith(year)).length;

    const counts = new Map<string, { name: string; count: number }>();

    for (const item of completed) {

      const service = item.service as { service_name?: string } | null;

      if (!service?.service_name) continue;

      const old = counts.get(service.service_name);

      counts.set(service.service_name, { name: service.service_name, count: (old?.count ?? 0) + 1 });

    }

    const favouriteService = [...counts.values()].sort((a, b) => b.count - a.count)[0] ?? null;

    res.json({ appointments, upcoming, metrics: { visitsThisYear, favouriteService } });

  } catch (error) { console.error("Customer dashboard:", error); res.status(500).json({ error: "Unable to load customer dashboard" }); }

});

const toMinutes = (value: string): number => {

  const [h = 0, m = 0] = value.split(":").map(Number);

  return h * 60 + m;

};

const toClock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;

async function getAvailableSlots(staffId: string, serviceId: string, date: string) {

  const [{ data: staff, error: staffError }, { data: service, error: serviceError }, { data: settings, error: settingsError }] = await Promise.all([

    supabaseAdmin.from("staff").select("staff_id, is_active").eq("staff_id", staffId).maybeSingle(),

    supabaseAdmin.from("services").select("service_id, duration_minutes, price").eq("service_id", serviceId).maybeSingle(),

    supabaseAdmin.from("salon_settings").select("opening_time, closing_time").limit(1).maybeSingle(),

  ]);

  if (staffError || serviceError || settingsError) throw staffError ?? serviceError ?? settingsError;

  if (!staff?.is_active || !service) return { slots: [] as string[], service: null };

  const duration = Number(service.duration_minutes);

  if (!Number.isFinite(duration) || duration < 5) throw new Error("Invalid service duration");

  const open = toMinutes(String(settings?.opening_time ?? "09:00"));

  const close = toMinutes(String(settings?.closing_time ?? "18:00"));

  const { data: bookings, error: bookingsError } = await supabaseAdmin.from("appointments")

    .select("start_time, end_time").eq("staff_id", staffId).eq("appointment_date", date).in("status", activeStatuses);

  if (bookingsError) throw bookingsError;

  const nowLocal = new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi", hour12: false });

  const slots: string[] = [];

  for (let start = open; start + duration <= close; start += 30) {

    if (date === today() && start <= toMinutes(nowLocal)) continue;

    const end = start + duration;

    if ((bookings ?? []).some((b) => start < toMinutes(b.end_time) && end > toMinutes(b.start_time))) continue;

    slots.push(toClock(start));

  }

  return { slots, service };

}

app.get("/api/customer/availability", requireAuth, async (req, res) => {

  const { staffId, serviceId, date } = req.query;

  if (typeof staffId !== "string" || typeof serviceId !== "string" || !isDate(date) || date < today())

    return res.status(400).json({ error: "Valid professional, service and future date required" });

  try {

    const result = await getAvailableSlots(staffId, serviceId, date);

    res.json({ slots: result.slots });

  } catch (error) { console.error("Availability:", error); res.status(500).json({ error: "Unable to load availability" }); }

});

app.post("/api/customer/appointments", requireAuth, async (req, res) => {

  const { staffId, serviceId, appointmentDate, startTime } = req.body ?? {};

  if (typeof staffId !== "string" || typeof serviceId !== "string" || !isDate(appointmentDate) ||

      appointmentDate < today() || !isTime(startTime))

    return res.status(400).json({ error: "Valid booking details are required" });

  try {

    const { slots, service } = await getAvailableSlots(staffId, serviceId, appointmentDate);

    const normalizedTime = toClock(toMinutes(startTime));

    if (!service || !slots.includes(normalizedTime))

      return res.status(409).json({ error: "This time is no longer available. Please choose another slot." });

    const endTime = toClock(toMinutes(normalizedTime) + Number(service.duration_minutes));

    if (await hasClash(staffId, appointmentDate, normalizedTime, endTime))

      return res.status(409).json({ error: "The selected professional is already booked" });

    const { data, error } = await supabaseAdmin.from("appointments").insert({

      customer_id: res.locals.user.id, staff_id: staffId, service_id: serviceId,

      appointment_date: appointmentDate, start_time: normalizedTime, end_time: endTime,

      total_amount: service.price, status: "confirmed", payment_status: "unpaid",

    }).select(appointmentFields).single();
    if (error) throw error;

// Record the appointment in audit logs
try {
  await writeAuditLog({
    actorUserId: res.locals.user.id,
    action: "CREATE_APPOINTMENT",
    entityType: "appointments",
    entityId: String(data.appointment_id),
    newData: appointmentAuditData(data as Record<string, unknown>),
  });
} catch (auditError) {
  console.error("Booking audit failed:", auditError);
}

// Automatically synchronize the confirmed booking with Google Calendar
await trySyncAppointmentToGoogle(
  String(data.appointment_id)
);

// Return the confirmed appointment to the frontend
return res.status(201).json({
  appointment: (await decorate([data as Record<string, unknown>]))[0],
});

    

  } catch (error) {
    console.error("Create booking:", error);

    return res.status(500).json({
      error: "Unable to create appointment",
    });
  }
});

// Google Calendar sync: confirmed bookings only. Never fail the booking if Google fails.

// Requires appointments.google_calendar_event_id TEXT (see accompanying SQL).

async function syncAppointmentToGoogle(appointmentId: string): Promise<void> {

  const { data: appointment, error } = await supabaseAdmin.from("appointments")

    .select("appointment_id, customer_id, staff_id, service_id, appointment_date, start_time, end_time, status, google_calendar_event_id")

    .eq("appointment_id", appointmentId).maybeSingle();

  if (error) throw error;

  if (!appointment) return;

  const { data: connection, error: connectionError } = await supabaseAdmin.from("google_calendar_connections")

    .select("refresh_token").eq("user_id", appointment.customer_id).maybeSingle();

  if (connectionError) throw connectionError;

  if (!connection?.refresh_token) return; // Customer has not connected Google Calendar.

  const auth = googleClient();

  auth.setCredentials({ refresh_token: decryptToken(connection.refresh_token) });

  const calendar = google.calendar({ version: "v3", auth });

  const eventId = appointment.google_calendar_event_id as string | null;

  if (["cancelled", "no_show"].includes(appointment.status)) {

    if (eventId) {

      try { await calendar.events.delete({ calendarId: "primary", eventId }); }

      catch (e: any) { if (e?.code !== 404 && e?.response?.status !== 404) throw e; }

      const { error: clearError } = await supabaseAdmin.from("appointments")

        .update({ google_calendar_event_id: null }).eq("appointment_id", appointmentId);

      if (clearError) throw clearError;

    }

    return;

  }

  if (appointment.status !== "confirmed" && appointment.status !== "checked_in" && appointment.status !== "completed") return;

  const [{ data: service, error: serviceError }, { data: staff, error: staffError }] = await Promise.all([

    supabaseAdmin.from("services").select("service_name").eq("service_id", appointment.service_id).maybeSingle(),

    supabaseAdmin.from("staff").select("user_id").eq("staff_id", appointment.staff_id).maybeSingle(),

  ]);

  if (serviceError || staffError) throw serviceError ?? staffError;

  let staffName = "Your stylist";

  if (staff?.user_id) {

    const { data: profile } = await supabaseAdmin.from("users")

      .select("full_name").eq("user_id", staff.user_id).maybeSingle();

    staffName = profile?.full_name ?? staffName;

  }

  const date = String(appointment.appointment_date);

  const start = String(appointment.start_time).slice(0, 8);

  const end = String(appointment.end_time).slice(0, 8);

const event = {
  summary: `Bookify: ${service?.service_name ?? "Salon appointment"}`,

  description: `Appointment with ${staffName}. Booking ID: ${appointmentId}`,

  start: {
    dateTime: `${date}T${start}+03:00`,
    timeZone: "Africa/Nairobi",
  },

  end: {
    dateTime: `${date}T${end}+03:00`,
    timeZone: "Africa/Nairobi",
  },

  reminders: {
    useDefault: false,
    overrides: [
      {
        method: "popup",
        minutes: 1440, // 24 hours before
      },
      {
        method: "popup",
        minutes: 30, // 30 minutes before
      },
    ],
  },
};

  if (eventId) {

    try {

      await calendar.events.update({ calendarId: "primary", eventId, requestBody: event });

      return;

    } catch (e: any) {

      if (e?.code !== 404 && e?.response?.status !== 404) throw e;

    }

  }

  const result = await calendar.events.insert({ calendarId: "primary", requestBody: event });

  if (!result.data.id) throw new Error("Google Calendar did not return an event ID");

  const { error: saveError } = await supabaseAdmin.from("appointments")

    .update({ google_calendar_event_id: result.data.id }).eq("appointment_id", appointmentId);

  if (saveError) throw saveError;

}

async function trySyncAppointmentToGoogle(appointmentId: string): Promise<void> {

  try { await syncAppointmentToGoogle(appointmentId); }

  catch (error) { console.error(`Google Calendar sync failed for appointment ${appointmentId}:`, error); }

}

async function syncExistingConfirmedAppointments(userId: string): Promise<void> {

  const { data, error } = await supabaseAdmin.from("appointments")

    .select("appointment_id").eq("customer_id", userId)

    .in("status", ["confirmed", "checked_in"])

    .gte("appointment_date", today()).limit(100);

  if (error) throw error;

  for (const item of data ?? []) await trySyncAppointmentToGoogle(String(item.appointment_id));

}

app.get("/api/admin/dashboard", requireAuth, requireAdmin, async (_req, res) => {

  try {

    const date = today();

    const start = new Date(`${date}T00:00:00+03:00`); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

    const week = start.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

    const [day, weekly, team] = await Promise.all([

      supabaseAdmin.from("appointments").select(appointmentFields).eq("appointment_date", date).order("start_time"),

      supabaseAdmin.from("appointments").select("total_amount, status, payment_status").gte("appointment_date", week).lte("appointment_date", date),

      supabaseAdmin.from("staff").select("staff_id").eq("is_active", true),

    ]);

    if (day.error || weekly.error || team.error) {

      console.error("Dashboard queries failed", { day: day.error, weekly: weekly.error, team: team.error });

      return res.status(500).json({ error: day.error?.message ?? weekly.error?.message ?? team.error?.message ?? "Dashboard query failed" });

    }

    const appointments = await decorate((day.data ?? []) as Record<string, unknown>[]);

    const weeklyRevenue = (weekly.data ?? []).filter((x) => x.status === "completed" && x.payment_status === "paid").reduce((sum, x) => sum + Number(x.total_amount), 0);

    res.json({ date, currency: "KES", metrics: { todayAppointments: appointments.filter((x) => !["cancelled", "no_show"].includes(String(x.status))).length, weeklyRevenue, activeStaff: team.data?.length ?? 0, nextAppointment: appointments.find((x) => ["confirmed", "checked_in"].includes(String(x.status))) ?? null }, appointments });

  } catch (error) { console.error(error); res.status(500).json({ error: "Unable to load dashboard" }); }

});

app.get("/api/admin/appointments", requireAuth, requireAdmin, async (req, res) => {

  try {

    let query = supabaseAdmin.from("appointments").select(appointmentFields).order("appointment_date").order("start_time").limit(250);

    if (isDate(req.query.date)) query = query.eq("appointment_date", req.query.date);

    const { data, error } = await query; if (error) throw error;

    res.json({ appointments: await decorate((data ?? []) as Record<string, unknown>[]), currency: "KES" });

  } catch (error) { console.error(error); res.status(500).json({ error: "Unable to load appointments" }); }

});

app.post("/api/admin/appointments", requireAuth, requireAdmin, async (req, res) => {

  try {

    const { customerId, staffId, serviceId, appointmentDate, startTime, endTime, notes } = req.body ?? {};

    if (![customerId, staffId, serviceId].every((x) => typeof x === "string") || !isDate(appointmentDate) || !isTime(startTime) || !isTime(endTime) || startTime >= endTime) return res.status(400).json({ error: "Valid customer, staff, service, date and time are required" });

    const [{ data: staff }, { data: service }] = await Promise.all([supabaseAdmin.from("staff").select("staff_id").eq("staff_id", staffId).eq("is_active", true).maybeSingle(), supabaseAdmin.from("services").select("service_id, price").eq("service_id", serviceId).maybeSingle()]);

    if (!staff || !service) return res.status(400).json({ error: "Select an active staff member and valid service" });

    if (await hasClash(staffId, appointmentDate, startTime, endTime)) return res.status(409).json({ error: "This staff member is already booked at that time" });

    const { data, error } = await supabaseAdmin.from("appointments").insert({ customer_id: customerId, staff_id: staffId, service_id: serviceId, appointment_date: appointmentDate, start_time: startTime, end_time: endTime, notes: typeof notes === "string" ? notes.trim() || null : null, total_amount: service.price, status: "confirmed", payment_status: "unpaid" }).select(appointmentFields).single();

    if (error) throw error;

    await writeAuditLog({ actorUserId: res.locals.user.id, action: "CREATE_APPOINTMENT", entityType: "appointments", entityId: String(data.appointment_id), newData: appointmentAuditData(data as Record<string, unknown>) });

    await trySyncAppointmentToGoogle(String(data.appointment_id));

    res.status(201).json({ appointment: (await decorate([data as Record<string, unknown>]))[0] });

  } catch (error) { console.error(error); res.status(500).json({ error: "Unable to create appointment" }); }

});

app.patch("/api/admin/appointments/:id", requireAuth, requireAdmin, async (req, res) => {

  const { status, paymentStatus, notes } = req.body ?? {};

  if ((status !== undefined && !statuses.includes(status)) || (paymentStatus !== undefined && !["unpaid", "paid", "refunded"].includes(paymentStatus)) || (notes !== undefined && typeof notes !== "string")) return res.status(400).json({ error: "Invalid appointment update" });

  const update: Record<string, unknown> = {}; if (status !== undefined) update.status = status; if (paymentStatus !== undefined) update.payment_status = paymentStatus; if (notes !== undefined) update.notes = notes.trim() || null;

  if (!Object.keys(update).length) return res.status(400).json({ error: "Provide an appointment change" });

  const { data: previous, error: previousError } = await supabaseAdmin.from("appointments").select(appointmentFields).eq("appointment_id", req.params.id).maybeSingle();

  if (previousError) return res.status(500).json({ error: "Unable to load appointment" });

  if (!previous) return res.status(404).json({ error: "Appointment not found" });

  const { data, error } = await supabaseAdmin.from("appointments").update(update).eq("appointment_id", req.params.id).select(appointmentFields).maybeSingle();

  if (error) return res.status(500).json({ error: "Unable to update appointment" }); if (!data) return res.status(404).json({ error: "Appointment not found" });

  await writeAuditLog({ actorUserId: res.locals.user.id, action: "UPDATE_APPOINTMENT", entityType: "appointments", entityId: String(data.appointment_id), oldData: appointmentAuditData(previous as Record<string, unknown>), newData: appointmentAuditData(data as Record<string, unknown>) });

  await trySyncAppointmentToGoogle(String(data.appointment_id));

  res.json({ appointment: (await decorate([data as Record<string, unknown>]))[0] });

});

app.get("/api/admin/team", requireAuth, requireAdmin, async (_req, res) => {

  const { data: staff, error } = await supabaseAdmin.from("staff").select("staff_id, user_id, staff_type, specialty, is_active").order("staff_type");

  if (error) return res.status(500).json({ error: "Unable to load team" });

  const profileResult = staff?.length ? await supabaseAdmin.from("users").select("user_id, full_name, email").in("user_id", staff.map((x) => x.user_id)) : { data: [] };

  const profiles = new Map((profileResult.data ?? []).map((x) => [x.user_id, x]));

  res.json({ staff: (staff ?? []).map((x) => ({ ...x, profile: profiles.get(x.user_id) ?? null })) });

});

app.post("/api/admin/staff", requireAuth, requireAdmin, async (req, res) => {

  try {

    const { fullName, email, staffType, specialty } = req.body ?? {};

    if (typeof fullName !== "string" || !fullName.trim() || typeof email !== "string" || !email.trim() || !["barber", "stylist"].includes(staffType) || (specialty !== undefined && typeof specialty !== "string")) return res.status(400).json({ error: "Invalid staff details" });

    const normalized = email.trim().toLowerCase();

    const { data: existing } = await supabaseAdmin.from("users").select("user_id").eq("email", normalized).maybeSingle();

    if (existing) return res.status(409).json({ error: "An account with this email already exists" });

    const { data: invite, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(normalized, { data: { full_name: fullName.trim() }, redirectTo: "http://localhost:5173/auth/callback" });

    if (inviteError || !invite.user) return res.status(400).json({ error: inviteError?.message ?? "Unable to invite staff" });

    const userId = invite.user.id;

    // Some Supabase projects create a users profile in an auth trigger as soon

    // as an invitation is made. Upsert makes that trigger compatible with the

    // staff invite flow instead of failing on the users.email unique key.

    const { error: profileError } = await supabaseAdmin.from("users").upsert({ user_id: userId, full_name: fullName.trim(), email: normalized, role: "staff" }, { onConflict: "user_id" }); if (profileError) throw profileError;

    const { error: staffError } = await supabaseAdmin.from("staff").upsert({ staff_id: userId, user_id: userId, staff_type: staffType, specialty: specialty?.trim() || null, is_active: true }, { onConflict: "staff_id" }); if (staffError) throw staffError;

    await writeAuditLog({ actorUserId: res.locals.user.id, action: "CREATE_STAFF", entityType: "staff", entityId: userId, newData: { staff_id: userId, staff_type: staffType, specialty: specialty?.trim() || null, is_active: true } });

    res.status(201).json({ message: "Staff invitation sent successfully", staffId: userId });

  } catch (error) { console.error(error); res.status(500).json({ error: "Unable to create staff member" }); }

});

app.patch("/api/admin/staff/:id", requireAuth, requireAdmin, async (req, res) => {

  const { isActive, specialty, staffType } = req.body ?? {};

  if ((isActive !== undefined && typeof isActive !== "boolean") || (specialty !== undefined && typeof specialty !== "string") || (staffType !== undefined && !["barber", "stylist"].includes(staffType))) return res.status(400).json({ error: "Invalid staff update" });

  const update: Record<string, unknown> = {}; if (isActive !== undefined) update.is_active = isActive; if (specialty !== undefined) update.specialty = specialty.trim() || null; if (staffType !== undefined) update.staff_type = staffType;

  if (!Object.keys(update).length) return res.status(400).json({ error: "Provide a staff change" });

  const { data: previous, error: previousError } = await supabaseAdmin.from("staff").select("staff_id, staff_type, specialty, is_active").eq("staff_id", req.params.id).maybeSingle();

  if (previousError) return res.status(500).json({ error: "Unable to load staff member" });

  if (!previous) return res.status(404).json({ error: "Staff member not found" });

  const { data, error } = await supabaseAdmin.from("staff").update(update).eq("staff_id", req.params.id).select("staff_id, staff_type, specialty, is_active").maybeSingle();

  if (error) return res.status(500).json({ error: "Unable to update staff member" }); if (!data) return res.status(404).json({ error: "Staff member not found" });

  await writeAuditLog({ actorUserId: res.locals.user.id, action: "UPDATE_STAFF", entityType: "staff", entityId: String(data.staff_id), oldData: staffAuditData(previous as Record<string, unknown>), newData: staffAuditData(data as Record<string, unknown>) });

  res.json({ staff: data });

});

app.get("/api/admin/services", requireAuth, requireAdmin, async (_req, res) => { const { data, error } = await supabaseAdmin.from("services").select("service_id, service_name, price, duration_minutes").order("service_name"); if (error) return res.status(500).json({ error: "Unable to load services" }); res.json({ services: data, currency: "KES" }); });

app.post("/api/admin/services", requireAuth, requireAdmin, async (req, res) => { const { serviceName, price, durationMinutes } = req.body ?? {}; if (typeof serviceName !== "string" || !serviceName.trim() || !isMoney(price) || !Number.isInteger(durationMinutes) || durationMinutes < 5) return res.status(400).json({ error: "A name, KES price and duration are required" }); const { data, error } = await supabaseAdmin.from("services").insert({ service_name: serviceName.trim(), price, duration_minutes: durationMinutes }).select("service_id, service_name, price, duration_minutes").single(); if (error) return res.status(500).json({ error: "Unable to create service" }); await writeAuditLog({ actorUserId: res.locals.user.id, action: "CREATE_SERVICE", entityType: "services", entityId: String(data.service_id), newData: serviceAuditData(data as Record<string, unknown>) }); res.status(201).json({ service: data }); });

app.patch("/api/admin/services/:id", requireAuth, requireAdmin, async (req, res) => { const { serviceName, price, durationMinutes } = req.body ?? {}; if ((serviceName !== undefined && (typeof serviceName !== "string" || !serviceName.trim())) || (price !== undefined && !isMoney(price)) || (durationMinutes !== undefined && (!Number.isInteger(durationMinutes) || durationMinutes < 5))) return res.status(400).json({ error: "Invalid service update" }); const update: Record<string, unknown> = {}; if (serviceName !== undefined) update.service_name = serviceName.trim(); if (price !== undefined) update.price = price; if (durationMinutes !== undefined) update.duration_minutes = durationMinutes; if (!Object.keys(update).length) return res.status(400).json({ error: "Provide a service change" }); const { data: previous, error: previousError } = await supabaseAdmin.from("services").select("service_id, service_name, price, duration_minutes").eq("service_id", req.params.id).maybeSingle(); if (previousError) return res.status(500).json({ error: "Unable to load service" }); if (!previous) return res.status(404).json({ error: "Service not found" }); const { data, error } = await supabaseAdmin.from("services").update(update).eq("service_id", req.params.id).select("service_id, service_name, price, duration_minutes").maybeSingle(); if (error) return res.status(500).json({ error: "Unable to update service" }); if (!data) return res.status(404).json({ error: "Service not found" }); await writeAuditLog({ actorUserId: res.locals.user.id, action: "UPDATE_SERVICE", entityType: "services", entityId: String(data.service_id), oldData: serviceAuditData(previous as Record<string, unknown>), newData: serviceAuditData(data as Record<string, unknown>) }); res.json({ service: data }); });

app.delete("/api/admin/services/:id", requireAuth, requireAdmin, async (req, res) => { const { data: previous, error: previousError } = await supabaseAdmin.from("services").select("service_id, service_name, price, duration_minutes").eq("service_id", req.params.id).maybeSingle(); if (previousError) return res.status(500).json({ error: "Unable to load service" }); if (!previous) return res.status(404).json({ error: "Service not found" }); const { count, error: usageError } = await supabaseAdmin.from("appointments").select("appointment_id", { count: "exact", head: true }).eq("service_id", req.params.id); if (usageError) return res.status(500).json({ error: "Unable to check service bookings" }); if ((count ?? 0) > 0) return res.status(409).json({ error: "This service cannot be deleted because it has appointment history." }); const { data, error } = await supabaseAdmin.from("services").delete().eq("service_id", req.params.id).select("service_id").maybeSingle(); if (error) return res.status(500).json({ error: "Unable to delete service" }); if (!data) return res.status(404).json({ error: "Service not found" }); await writeAuditLog({ actorUserId: res.locals.user.id, action: "DELETE_SERVICE", entityType: "services", entityId: String(data.service_id), oldData: serviceAuditData(previous as Record<string, unknown>) }); res.json({ message: "Service deleted" }); });

app.get("/api/admin/settings", requireAuth, requireAdmin, async (_req, res) => { const { data, error } = await supabaseAdmin.from("salon_settings").select("setting_id, salon_name, location, phone, email, opening_time, closing_time, currency").limit(1).maybeSingle(); if (error) return res.status(500).json({ error: "Unable to load settings. Run database/schema.sql first." }); res.json({ settings: data }); });

app.patch("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => { const { salonName, location, phone, email, openingTime, closingTime } = req.body ?? {}; if ([salonName, location, phone, email, openingTime, closingTime].some((x) => x !== undefined && typeof x !== "string")) return res.status(400).json({ error: "Invalid settings update" }); const { data: current, error: currentError } = await supabaseAdmin.from("salon_settings").select("setting_id, salon_name, location, phone, email, opening_time, closing_time, currency").limit(1).maybeSingle(); if (currentError) return res.status(500).json({ error: "Unable to load settings" }); if (!current) return res.status(400).json({ error: "Salon settings are not initialized. Run database/schema.sql first." }); const update: Record<string, unknown> = {}; if (salonName !== undefined) update.salon_name = salonName.trim(); if (location !== undefined) update.location = location.trim(); if (phone !== undefined) update.phone = phone.trim() || null; if (email !== undefined) update.email = email.trim() || null; if (openingTime !== undefined) update.opening_time = openingTime; if (closingTime !== undefined) update.closing_time = closingTime; if (!Object.keys(update).length) return res.status(400).json({ error: "Provide a settings change" }); update.updated_at = new Date().toISOString(); const { data, error } = await supabaseAdmin.from("salon_settings").update(update).eq("setting_id", current.setting_id).select().single(); if (error) return res.status(500).json({ error: "Unable to save settings" }); await writeAuditLog({ actorUserId: res.locals.user.id, action: "UPDATE_SALON_SETTINGS", entityType: "salon_settings", entityId: String(data.setting_id), oldData: settingsAuditData(current as Record<string, unknown>), newData: settingsAuditData(data as Record<string, unknown>) }); res.json({ settings: data }); });

app.get("/api/staff/dashboard", requireAuth, requireStaff, async (req, res) => {

  try {

    const date = isDate(req.query.date) ? req.query.date : today();

    const { data, error } = await supabaseAdmin.from("appointments").select(appointmentFields).eq("staff_id", res.locals.staff.staff_id).eq("appointment_date", date).order("start_time"); if (error) throw error;

    const appointments = await decorate((data ?? []) as Record<string, unknown>[]);

    const completedRevenue = appointments.filter((x) => x.status === "completed" && x.payment_status === "paid").reduce((sum, x) => sum + Number(x.total_amount), 0);

    const bookedMinutes = appointments.filter((x) => !["cancelled", "no_show"].includes(String(x.status))).reduce((sum, x) => sum + ((Date.parse(`1970-01-01T${String(x.end_time)}`) - Date.parse(`1970-01-01T${String(x.start_time)}`)) / 60000), 0);

    res.json({ date, currency: "KES", staff: res.locals.staff, appointments, metrics: { appointments: appointments.filter((x) => !["cancelled", "no_show"].includes(String(x.status))).length, bookedMinutes, earnings: completedRevenue } });

  } catch (error) { console.error(error); res.status(500).json({ error: "Unable to load your schedule" }); }

});

app.patch("/api/staff/appointments/:id", requireAuth, requireStaff, async (req, res) => { const { status, paymentStatus } = req.body ?? {}; if ((status !== undefined && !["checked_in", "completed", "no_show"].includes(status)) || (paymentStatus !== undefined && !["paid", "unpaid"].includes(paymentStatus))) return res.status(400).json({ error: "This update is not allowed" }); const update: Record<string, unknown> = {}; if (status !== undefined) update.status = status; if (paymentStatus !== undefined) update.payment_status = paymentStatus; if (!Object.keys(update).length) return res.status(400).json({ error: "Provide an appointment change" }); const { data: previous, error: previousError } = await supabaseAdmin.from("appointments").select(appointmentFields).eq("appointment_id", req.params.id).eq("staff_id", res.locals.staff.staff_id).maybeSingle(); if (previousError) return res.status(500).json({ error: "Unable to load appointment" }); if (!previous) return res.status(404).json({ error: "Appointment not found" }); const { data, error } = await supabaseAdmin.from("appointments").update(update).eq("appointment_id", req.params.id).eq("staff_id", res.locals.staff.staff_id).select(appointmentFields).maybeSingle(); if (error) return res.status(500).json({ error: "Unable to update appointment" }); if (!data) return res.status(404).json({ error: "Appointment not found" }); await writeAuditLog({ actorUserId: res.locals.user.id, action: "UPDATE_APPOINTMENT", entityType: "appointments", entityId: String(data.appointment_id), oldData: appointmentAuditData(previous as Record<string, unknown>), newData: appointmentAuditData(data as Record<string, unknown>) }); await trySyncAppointmentToGoogle(String(data.appointment_id)); res.json({ appointment: (await decorate([data as Record<string, unknown>]))[0] }); });

// GOOGLE CALENDAR OAUTH — per-customer connection.
// OAuth state is persisted in Supabase and consumed exactly once.
// Refresh tokens are encrypted at rest using AES-256-GCM.
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:5000/api/google/callback";
const clientOrigin = process.env.CLIENT_URL ?? "http://localhost:5173";
const oauthStateLifetimeMs = 10 * 60 * 1000;
const hashOAuthState = (state: string) => createHash("sha256").update(state).digest("hex");

function googleClient() {

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {

    throw new Error("Google OAuth credentials are missing");

  }

  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, googleRedirectUri);

}

function encryptionKey(): Buffer {

  const key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;

  if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {

    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes)");

  }

  return Buffer.from(key, "hex");

}

function encryptToken(value: string): string {

  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);

  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);

  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");

}

function decryptToken(value: string): string {

  const [version, iv, tag, ciphertext] = value.split(".");

  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted Google token");

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));

  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");

}

app.post("/api/google/connect", requireAuth, async (_req, res) => {
  try {
    const userId = String(res.locals.user.id);
    const state = randomBytes(32).toString("base64url");
    const stateHash = hashOAuthState(state);
    const expiresAt = new Date(Date.now() + oauthStateLifetimeMs).toISOString();
    const { error } = await supabaseAdmin.from("google_oauth_states").insert({
      state_hash: stateHash, user_id: userId, expires_at: expiresAt,
    });
    if (error) throw error;
    const url = googleClient().generateAuthUrl({
      access_type: "offline", prompt: "consent",
      scope: ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/userinfo.email"],
      state,
    });
    return res.json({ url });
  } catch (error) {
    console.error("Google connect:", error);
    return res.status(500).json({ error: "Unable to start Google Calendar authorization" });
  }
});

app.get("/api/google/callback", async (req, res) => {
  const redirect = (result: string) => res.redirect(`${clientOrigin}/dashboard?google_calendar=${encodeURIComponent(result)}`);
  try {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (req.query.error) return redirect("denied");
    if (!state || !code) return redirect("missing_parameters");
    if (!/^[A-Za-z0-9_-]{43}$/.test(state)) return redirect("invalid_state");
    const { data, error } = await supabaseAdmin.rpc("consume_google_oauth_state", {
      p_state_hash: hashOAuthState(state),
    });
    if (error) throw error;
    if (!Array.isArray(data) || data.length !== 1 || typeof data[0]?.user_id !== "string") {
      return redirect("invalid_or_expired_state");
    }
    const userId: string = data[0].user_id;
    const client = googleClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const profile = await oauth2.userinfo.get();
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("google_calendar_connections").select("refresh_token").eq("user_id", userId).maybeSingle();
    if (existingError) throw existingError;
    const refreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : existing?.refresh_token;
    if (!refreshToken) return redirect("no_refresh_token");
    const { error: saveError } = await supabaseAdmin.from("google_calendar_connections").upsert({
      user_id: userId, google_email: profile.data.email ?? null,
      refresh_token: refreshToken, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (saveError) throw saveError;
    await syncExistingConfirmedAppointments(userId).catch((syncError) =>
      console.error("Existing calendar bookings sync failed:", syncError)
    );
    return redirect("connected");
  } catch (error) {
    console.error("Google callback:", error);
    return redirect("failed");
  }
});

app.get("/api/google/status", requireAuth, async (_req, res) => {

  try {

    const { data, error } = await supabaseAdmin.from("google_calendar_connections")

      .select("id, google_email").eq("user_id", res.locals.user.id).maybeSingle();

    if (error) throw error;

    return res.json({ connected: Boolean(data), googleEmail: data?.google_email ?? null });

  } catch (error) {

    console.error("Google status:", error);

    return res.status(500).json({ error: "Unable to check Google Calendar connection" });

  }

});

app.delete("/api/google/disconnect", requireAuth, async (_req, res) => {

  try {

    const userId = String(res.locals.user.id);

    const { data, error } = await supabaseAdmin.from("google_calendar_connections")

      .select("refresh_token").eq("user_id", userId).maybeSingle();

    if (error) throw error;

    if (data?.refresh_token) {

      try { await googleClient().revokeToken(decryptToken(data.refresh_token)); }

      catch (revokeError) { console.warn("Google token revocation failed; removing local connection:", revokeError); }

    }

    const { error: deleteError } = await supabaseAdmin.from("google_calendar_connections")

      .delete().eq("user_id", userId);

    if (deleteError) throw deleteError;

    const { error: clearEventsError } = await supabaseAdmin.from("appointments")

      .update({ google_calendar_event_id: null }).eq("customer_id", userId);

    if (clearEventsError) console.error("Unable to clear disconnected calendar event references:", clearEventsError);

    return res.json({ connected: false, message: "Google Calendar disconnected" });

  } catch (error) {

    console.error("Google disconnect:", error);

    return res.status(500).json({ error: "Unable to disconnect Google Calendar" });

  }

});

app.use((_req, res) => res.status(404).json({ success: false, message: "API endpoint not found." }));

app.listen(PORT, () => console.log(`Bookify API running on http://localhost:${PORT}`));

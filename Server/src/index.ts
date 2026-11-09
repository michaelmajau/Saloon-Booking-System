import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";
import { supabase } from "./config/supabase.js";
import { supabaseAdmin } from "./config/supabaseAdmin.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { requireAdmin } from "./middleware/requireAdmin.js";
import { requireStaff } from "./middleware/requireStaff.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

const appointmentFields =
  "appointment_id, customer_id, staff_id, service_id, appointment_date, start_time, end_time, status, payment_status, total_amount, notes, created_at";

const activeStatuses = ["pending", "confirmed", "checked_in", "completed"];
const statuses = [...activeStatuses, "cancelled", "no_show"];

const today = () =>
  new Date().toLocaleDateString("en-CA", {
    timeZone: "Africa/Nairobi",
  });

const isDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const isTime = (value: unknown): value is string =>
  typeof value === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(value);

const isMoney = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
    ],
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

type DecoratedAppointment = Record<string, unknown> & {
  customer: Record<string, unknown> | null;
  staff: Record<string, unknown> | null;
  service: Record<string, unknown> | null;
};

async function decorate(
  rows: Record<string, unknown>[],
): Promise<DecoratedAppointment[]> {
  if (!rows.length) return [];

  const customerIds = [
    ...new Set(rows.map((row) => String(row.customer_id))),
  ];

  const appointmentStaffIds = [
    ...new Set(rows.map((row) => String(row.staff_id))),
  ];

  const serviceIds = [
    ...new Set(rows.map((row) => String(row.service_id))),
  ];

  const [customers, staffRows, services] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("user_id, full_name, email")
      .in("user_id", customerIds),

    supabaseAdmin
      .from("staff")
      .select("staff_id, user_id")
      .in("staff_id", appointmentStaffIds),

    supabaseAdmin
      .from("services")
      .select("service_id, service_name, duration_minutes, price")
      .in("service_id", serviceIds),
  ]);

  if (customers.error || staffRows.error || services.error) {
    throw new Error("Unable to load booking details");
  }

  const staffUserIds = [
    ...new Set((staffRows.data ?? []).map((staff) => staff.user_id)),
  ];

  const { data: staffProfiles, error: staffProfilesError } =
    staffUserIds.length
      ? await supabaseAdmin
          .from("users")
          .select("user_id, full_name, email")
          .in("user_id", staffUserIds)
      : { data: [], error: null };

  if (staffProfilesError) {
    throw new Error("Unable to load staff profiles");
  }

  const customerMap = new Map(
    (customers.data ?? []).map((user) => [user.user_id, user]),
  );

  const staffUserMap = new Map(
    (staffRows.data ?? []).map((staff) => [staff.staff_id, staff.user_id]),
  );

  const staffProfileMap = new Map(
    (staffProfiles ?? []).map((user) => [user.user_id, user]),
  );

  const serviceMap = new Map(
    (services.data ?? []).map((service) => [
      service.service_id,
      service,
    ]),
  );

  return rows.map((row) => {
    const staffUserId = staffUserMap.get(String(row.staff_id));

    return {
      ...row,
      customer: customerMap.get(String(row.customer_id)) ?? null,
      staff: staffUserId
        ? staffProfileMap.get(staffUserId) ?? null
        : null,
      service: serviceMap.get(String(row.service_id)) ?? null,
    };
  });
}

async function hasClash(
  staffId: string,
  date: string,
  start: string,
  end: string,
) {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("appointment_id")
    .eq("staff_id", staffId)
    .eq("appointment_date", date)
    .in("status", activeStatuses)
    .lt("start_time", end)
    .gt("end_time", start);

  if (error) throw error;

  return Boolean(data?.length);
}

app.get("/", (_req, res) => {
  res.send("Bookify API is running.");
});

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Bookify API connected",
  });
});

const emailCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

app.post("/api/auth/check-email", emailCheckLimiter, async (req, res) => {
  const email = req.body?.email;

  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid email address.",
    });
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("user_id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to check email availability.",
    });
  }

  res.json({
    success: true,
    exists: Boolean(data),
    message: data
      ? "This email is already registered."
      : "Email is available.",
  });
});

app.get("/api/services", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("services")
    .select("service_id, service_name, price, duration_minutes")
    .order("service_name");

  if (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch services.",
    });
  }

  res.json({
    success: true,
    services: data,
    currency: "KES",
  });
});

app.get(
  "/api/admin/dashboard",
  requireAuth,
  requireAdmin,
  async (_req, res) => {
    try {
      const date = today();

      const start = new Date(`${date}T00:00:00+03:00`);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

      const week = start.toLocaleDateString("en-CA", {
        timeZone: "Africa/Nairobi",
      });

      const [day, weekly, team] = await Promise.all([
        supabaseAdmin
          .from("appointments")
          .select(appointmentFields)
          .eq("appointment_date", date)
          .order("start_time"),

        supabaseAdmin
          .from("appointments")
          .select("total_amount, status, payment_status")
          .gte("appointment_date", week)
          .lte("appointment_date", date),

        supabaseAdmin
          .from("staff")
          .select("staff_id")
          .eq("is_active", true),
      ]);

      if (day.error || weekly.error || team.error) {
        console.error("Dashboard query failed", {
          day: day.error,
          weekly: weekly.error,
          team: team.error,
        });

        return res.status(500).json({
          error: "Unable to load dashboard",
        });
      }

      const appointments = await decorate(
        (day.data ?? []) as Record<string, unknown>[],
      );

      const weeklyRevenue = (weekly.data ?? [])
        .filter(
          (row) =>
            row.status === "completed" &&
            row.payment_status === "paid",
        )
        .reduce(
          (sum, row) => sum + Number(row.total_amount),
          0,
        );

      res.json({
        date,
        currency: "KES",
        metrics: {
          todayAppointments: appointments.filter(
            (appointment) =>
              !["cancelled", "no_show"].includes(
                String(appointment.status),
              ),
          ).length,
          weeklyRevenue,
          activeStaff: team.data?.length ?? 0,
          nextAppointment:
            appointments.find((appointment) =>
              ["confirmed", "checked_in"].includes(
                String(appointment.status),
              ),
            ) ?? null,
        },
        appointments,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Unable to load dashboard",
      });
    }
  },
);

app.get(
  "/api/admin/appointments",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      let query = supabaseAdmin
        .from("appointments")
        .select(appointmentFields)
        .order("appointment_date")
        .order("start_time")
        .limit(250);

      if (isDate(req.query.date)) {
        query = query.eq("appointment_date", req.query.date);
      }

      const { data, error } = await query;

      if (error) throw error;

      res.json({
        appointments: await decorate(
          (data ?? []) as Record<string, unknown>[],
        ),
        currency: "KES",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Unable to load appointments",
      });
    }
  },
);

app.post(
  "/api/admin/appointments",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const {
        customerId,
        staffId,
        serviceId,
        appointmentDate,
        startTime,
        endTime,
        notes,
      } = req.body ?? {};

      if (
        ![customerId, staffId, serviceId].every(
          (value) => typeof value === "string",
        ) ||
        !isDate(appointmentDate) ||
        !isTime(startTime) ||
        !isTime(endTime) ||
        startTime >= endTime
      ) {
        return res.status(400).json({
          error: "Valid customer, staff, service, date and time are required",
        });
      }

      const [{ data: staff }, { data: service }] = await Promise.all([
        supabaseAdmin
          .from("staff")
          .select("staff_id")
          .eq("staff_id", staffId)
          .eq("is_active", true)
          .maybeSingle(),

        supabaseAdmin
          .from("services")
          .select("service_id, price")
          .eq("service_id", serviceId)
          .maybeSingle(),
      ]);

      if (!staff || !service) {
        return res.status(400).json({
          error: "Select an active staff member and valid service",
        });
      }

      if (await hasClash(staffId, appointmentDate, startTime, endTime)) {
        return res.status(409).json({
          error: "This staff member is already booked at that time",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("appointments")
        .insert({
          customer_id: customerId,
          staff_id: staffId,
          service_id: serviceId,
          appointment_date: appointmentDate,
          start_time: startTime,
          end_time: endTime,
          notes:
            typeof notes === "string" ? notes.trim() || null : null,
          total_amount: service.price,
          status: "confirmed",
          payment_status: "unpaid",
        })
        .select(appointmentFields)
        .single();

      if (error) throw error;

      res.status(201).json({
        appointment: (
          await decorate([data as Record<string, unknown>])
        )[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Unable to create appointment",
      });
    }
  },
);

app.patch(
  "/api/admin/appointments/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { status, paymentStatus, notes } = req.body ?? {};

    if (
      (status !== undefined && !statuses.includes(status)) ||
      (paymentStatus !== undefined &&
        !["unpaid", "paid", "refunded"].includes(paymentStatus)) ||
      (notes !== undefined && typeof notes !== "string")
    ) {
      return res.status(400).json({
        error: "Invalid appointment update",
      });
    }

    const update: Record<string, unknown> = {};

    if (status !== undefined) update.status = status;
    if (paymentStatus !== undefined) {
      update.payment_status = paymentStatus;
    }
    if (notes !== undefined) {
      update.notes = notes.trim() || null;
    }

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .update(update)
      .eq("appointment_id", req.params.id)
      .select(appointmentFields)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        error: "Unable to update appointment",
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "Appointment not found",
      });
    }

    res.json({
      appointment: (
        await decorate([data as Record<string, unknown>])
      )[0],
    });
  },
);

app.get(
  "/api/admin/team",
  requireAuth,
  requireAdmin,
  async (_req, res) => {
    const { data: staff, error } = await supabaseAdmin
      .from("staff")
      .select("staff_id, user_id, staff_type, specialty, is_active")
      .order("staff_type");

    if (error) {
      console.error(error);

      return res.status(500).json({
        error: "Unable to load team",
      });
    }

    const userIds = (staff ?? []).map((member) => member.user_id);

    const { data: profiles, error: profilesError } = userIds.length
      ? await supabaseAdmin
          .from("users")
          .select("user_id, full_name, email")
          .in("user_id", userIds)
      : { data: [], error: null };

    if (profilesError) {
      console.error(profilesError);

      return res.status(500).json({
        error: "Unable to load team profiles",
      });
    }

    const profileMap = new Map(
      (profiles ?? []).map((profile) => [profile.user_id, profile]),
    );

    res.json({
      staff: (staff ?? []).map((member) => ({
        ...member,
        profile: profileMap.get(member.user_id) ?? null,
      })),
    });
  },
);

app.post(
  "/api/admin/staff",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { fullName, email, staffType, specialty } = req.body ?? {};

      if (
        typeof fullName !== "string" ||
        !fullName.trim() ||
        typeof email !== "string" ||
        !email.trim() ||
        !["barber", "stylist"].includes(staffType) ||
        (specialty !== undefined && typeof specialty !== "string")
      ) {
        return res.status(400).json({
          error: "Invalid staff details",
        });
      }

      const normalized = email.trim().toLowerCase();

      const { data: existingUser, error: userLookupError } =
        await supabaseAdmin
          .from("users")
          .select("user_id")
          .eq("email", normalized)
          .maybeSingle();

      if (userLookupError) throw userLookupError;

      let userId = existingUser?.user_id;
      let invitationSent = false;

      if (!userId) {
        const { data: invite, error: inviteError } =
          await supabaseAdmin.auth.admin.inviteUserByEmail(normalized, {
            data: { full_name: fullName.trim() },
            redirectTo: "http://localhost:5173/auth/set-password",
          });

        if (inviteError || !invite.user) {
          return res.status(400).json({
            error: inviteError?.message ?? "Unable to invite staff",
          });
        }

        userId = invite.user.id;
        invitationSent = true;
      }

      if (!userId) {
        throw new Error("Unable to determine staff user ID");
      }

      const { error: profileError } = await supabaseAdmin
        .from("users")
        .upsert(
          {
            user_id: userId,
            full_name: fullName.trim(),
            email: normalized,
            role: "staff",
          },
          { onConflict: "user_id" },
        );

      if (profileError) throw profileError;

      const { data: existingStaff, error: staffLookupError } =
        await supabaseAdmin
          .from("staff")
          .select("staff_id")
          .eq("user_id", userId)
          .maybeSingle();

      if (staffLookupError) throw staffLookupError;

      const staffPayload = {
        user_id: userId,
        staff_type: staffType,
        specialty: specialty?.trim() || null,
        is_active: true,
      };

      const staffResult = existingStaff
        ? await supabaseAdmin
            .from("staff")
            .update(staffPayload)
            .eq("staff_id", existingStaff.staff_id)
            .select("staff_id")
            .single()
        : await supabaseAdmin
            .from("staff")
            .insert(staffPayload)
            .select("staff_id")
            .single();

      if (staffResult.error || !staffResult.data) {
        throw staffResult.error ?? new Error("Unable to create staff record");
      }

      res.status(201).json({
        message: invitationSent
          ? "Staff invitation sent successfully"
          : "Existing account added to the team successfully",
        staffId: staffResult.data.staff_id,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Unable to create staff member",
      });
    }
  },
);

app.patch(
  "/api/admin/staff/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { isActive, specialty, staffType } = req.body ?? {};

    if (
      (isActive !== undefined && typeof isActive !== "boolean") ||
      (specialty !== undefined && typeof specialty !== "string") ||
      (staffType !== undefined &&
        !["barber", "stylist"].includes(staffType))
    ) {
      return res.status(400).json({
        error: "Invalid staff update",
      });
    }

    const update: Record<string, unknown> = {};

    if (isActive !== undefined) update.is_active = isActive;
    if (specialty !== undefined) {
      update.specialty = specialty.trim() || null;
    }
    if (staffType !== undefined) update.staff_type = staffType;

    const { data, error } = await supabaseAdmin
      .from("staff")
      .update(update)
      .eq("staff_id", req.params.id)
      .select("staff_id, user_id, staff_type, specialty, is_active")
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        error: "Unable to update staff member",
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "Staff member not found",
      });
    }

    res.json({ staff: data });
  },
);

app.get(
  "/api/admin/services",
  requireAuth,
  requireAdmin,
  async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("services")
      .select("service_id, service_name, price, duration_minutes")
      .order("service_name");

    if (error) {
      return res.status(500).json({
        error: "Unable to load services",
      });
    }

    res.json({
      services: data,
      currency: "KES",
    });
  },
);

app.post(
  "/api/admin/services",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { serviceName, price, durationMinutes } = req.body ?? {};

    if (
      typeof serviceName !== "string" ||
      !serviceName.trim() ||
      !isMoney(price) ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 5
    ) {
      return res.status(400).json({
        error: "A name, KES price and duration are required",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("services")
      .insert({
        service_name: serviceName.trim(),
        price,
        duration_minutes: durationMinutes,
      })
      .select("service_id, service_name, price, duration_minutes")
      .single();

    if (error) {
      return res.status(500).json({
        error: "Unable to create service",
      });
    }

    res.status(201).json({ service: data });
  },
);

app.patch(
  "/api/admin/services/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { serviceName, price, durationMinutes } = req.body ?? {};

    if (
      (serviceName !== undefined &&
        (typeof serviceName !== "string" || !serviceName.trim())) ||
      (price !== undefined && !isMoney(price)) ||
      (durationMinutes !== undefined &&
        (!Number.isInteger(durationMinutes) || durationMinutes < 5))
    ) {
      return res.status(400).json({
        error: "Invalid service update",
      });
    }

    const update: Record<string, unknown> = {};

    if (serviceName !== undefined) {
      update.service_name = serviceName.trim();
    }
    if (price !== undefined) update.price = price;
    if (durationMinutes !== undefined) {
      update.duration_minutes = durationMinutes;
    }

    const { data, error } = await supabaseAdmin
      .from("services")
      .update(update)
      .eq("service_id", req.params.id)
      .select("service_id, service_name, price, duration_minutes")
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        error: "Unable to update service",
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "Service not found",
      });
    }

    res.json({ service: data });
  },
);

// Customer-facing list of active barbers and stylists.
app.get("/api/barbers", async (_req, res) => {
  try {
    const { data: staff, error: staffError } = await supabaseAdmin
      .from("staff")
      .select("staff_id, user_id, staff_type, specialty")
      .eq("is_active", true)
      .order("staff_type");

    if (staffError) {
      throw staffError;
    }

    const userIds = (staff ?? []).map((member) => member.user_id);

    if (userIds.length === 0) {
      return res.json({
        success: true,
        barbers: [],
      });
    }

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("users")
      .select("user_id, full_name")
      .in("user_id", userIds);

    if (profileError) {
      throw profileError;
    }

    const profileMap = new Map(
      (profiles ?? []).map((profile) => [
        profile.user_id,
        profile.full_name,
      ])
    );

    return res.json({
      success: true,
      barbers: (staff ?? []).map((member) => ({
        staff_id: member.staff_id,
        full_name: profileMap.get(member.user_id) ?? "Salon team member",
        staff_type: member.staff_type,
        specialty: member.specialty,
      })),
    });
  } catch (error) {
    console.error("Unable to fetch barbers:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch salon team.",
    });
  }
});
// Loads the signed-in customer's upcoming and previous appointments.
app.get("/api/customer/dashboard", requireAuth, async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select(appointmentFields)
      .eq("customer_id", res.locals.user.id)
      .order("appointment_date", { ascending: false })
      .order("start_time", { ascending: false });

    if (error) throw error;

    const appointments = await decorate(
      (data ?? []) as Record<string, unknown>[]
    );

    const currentDate = today();

    const upcomingAppointments = appointments
      .filter(
        (appointment) =>
          String(appointment.appointment_date) >= currentDate &&
          ["pending", "confirmed", "checked_in"].includes(
            String(appointment.status)
          )
      )
      .sort((first, second) =>
        `${first.appointment_date} ${first.start_time}`.localeCompare(
          `${second.appointment_date} ${second.start_time}`
        )
      );

    const completedAppointments = appointments.filter(
      (appointment) => appointment.status === "completed"
    );

    const visitsThisYear = completedAppointments.filter((appointment) =>
      String(appointment.appointment_date).startsWith(currentDate.slice(0, 4))
    ).length;

    const serviceCounts = new Map<string, number>();

    completedAppointments.forEach((appointment) => {
      const service = appointment.service as
        | { service_name?: string }
        | null;

      if (!service?.service_name) return;

      const currentCount = serviceCounts.get(service.service_name) ?? 0;
      serviceCounts.set(service.service_name, currentCount + 1);
    });

    const favouriteService = [...serviceCounts.entries()]
      .sort((first, second) => second[1] - first[1])
      .map(([name, count]) => ({ name, count }))[0] ?? null;

    return res.json({
      appointments,
      upcoming: upcomingAppointments[0] ?? null,
      metrics: {
        visitsThisYear,
        favouriteService,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Unable to load your customer dashboard.",
    });
  }
});

// Gives the customer only the available slots for their selected
// barber, service duration, and chosen date.
app.get("/api/customer/availability", requireAuth, async (req, res) => {
  try {
    const staffId = req.query.staffId;
    const serviceId = req.query.serviceId;
    const appointmentDate = req.query.date;

    if (
      typeof staffId !== "string" ||
      typeof serviceId !== "string" ||
      !isDate(appointmentDate)
    ) {
      return res.status(400).json({
        error: "A barber, service, and valid date are required.",
      });
    }

    if (appointmentDate < today()) {
      return res.status(400).json({
        error: "Please choose today or a future date.",
      });
    }

    const [{ data: staff }, { data: service }, { data: settings }] =
      await Promise.all([
        supabaseAdmin
          .from("staff")
          .select("staff_id")
          .eq("staff_id", staffId)
          .eq("is_active", true)
          .maybeSingle(),

        supabaseAdmin
          .from("services")
          .select("service_id, duration_minutes")
          .eq("service_id", serviceId)
          .maybeSingle(),

        supabaseAdmin
          .from("salon_settings")
          .select("opening_time, closing_time")
          .limit(1)
          .maybeSingle(),
      ]);

    if (!staff || !service) {
      return res.status(400).json({
        error: "The selected service or barber is unavailable.",
      });
    }

    const { data: appointments, error: appointmentsError } =
      await supabaseAdmin
        .from("appointments")
        .select("start_time, end_time")
        .eq("staff_id", staffId)
        .eq("appointment_date", appointmentDate)
        .in("status", activeStatuses);

    if (appointmentsError) throw appointmentsError;

    const openingTime = String(settings?.opening_time ?? "09:00").slice(0, 5);
    const closingTime = String(settings?.closing_time ?? "19:00").slice(0, 5);

    const toMinutes = (time: string) => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    };

    const toTime = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;

      return `${String(hours).padStart(2, "0")}:${String(
        remainingMinutes
      ).padStart(2, "0")}`;
    };

    const openingMinutes = toMinutes(openingTime);
    const closingMinutes = toMinutes(closingTime);
    const duration = Number(service.duration_minutes);

    const slots: string[] = [];

    // Create bookable slots every 30 minutes.
    for (
      let slotStart = openingMinutes;
      slotStart + duration <= closingMinutes;
      slotStart += 30
    ) {
      const slotEnd = slotStart + duration;

      const hasConflict = (appointments ?? []).some((appointment) => {
        const appointmentStart = toMinutes(String(appointment.start_time));
        const appointmentEnd = toMinutes(String(appointment.end_time));

        return slotStart < appointmentEnd && slotEnd > appointmentStart;
      });

      if (!hasConflict) {
        slots.push(toTime(slotStart));
      }
    }

    return res.json({
      date: appointmentDate,
      duration,
      slots,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Unable to load available appointment times.",
    });
  }
});

// Creates a confirmed booking for the signed-in customer.
app.post("/api/customer/appointments", requireAuth, async (req, res) => {
  try {
    const { serviceId, staffId, appointmentDate, startTime } = req.body ?? {};

    if (
      typeof serviceId !== "string" ||
      typeof staffId !== "string" ||
      !isDate(appointmentDate) ||
      !isTime(startTime)
    ) {
      return res.status(400).json({
        error: "Choose a service, barber, date, and time.",
      });
    }

    if (appointmentDate < today()) {
      return res.status(400).json({
        error: "Please choose a future appointment date.",
      });
    }

    const [{ data: staff }, { data: service }] = await Promise.all([
      supabaseAdmin
        .from("staff")
        .select("staff_id")
        .eq("staff_id", staffId)
        .eq("is_active", true)
        .maybeSingle(),

      supabaseAdmin
        .from("services")
        .select("service_id, price, duration_minutes")
        .eq("service_id", serviceId)
        .maybeSingle(),
    ]);

    if (!staff || !service) {
      return res.status(400).json({
        error: "The selected service or barber is no longer available.",
      });
    }

    const [hours, minutes] = startTime.slice(0, 5).split(":").map(Number);

    const endMinutes =
      hours * 60 + minutes + Number(service.duration_minutes);

    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(
      2,
      "0"
    )}:${String(endMinutes % 60).padStart(2, "0")}`;

    if (await hasClash(staffId, appointmentDate, startTime, endTime)) {
      return res.status(409).json({
        error:
          "That time was just booked. Please choose another available time.",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .insert({
        customer_id: res.locals.user.id,
        staff_id: staffId,
        service_id: serviceId,
        appointment_date: appointmentDate,
        start_time: startTime,
        end_time: endTime,
        total_amount: service.price,
        status: "confirmed",
        payment_status: "unpaid",
      })
      .select(appointmentFields)
      .single();

    if (error) throw error;

    const appointment = (
      await decorate([data as Record<string, unknown>])
    )[0];

    return res.status(201).json({ appointment });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Unable to create your appointment.",
    });
  }
});
app.get(
  "/api/admin/settings",
  requireAuth,
  requireAdmin,
  async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("salon_settings")
      .select(
        "setting_id, salon_name, location, phone, email, opening_time, closing_time, currency",
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        error: "Unable to load settings. Run database/schema.sql first.",
      });
    }

    res.json({ settings: data });
  },
);

app.patch(
  "/api/admin/settings",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const {
      salonName,
      location,
      phone,
      email,
      openingTime,
      closingTime,
    } = req.body ?? {};

    if (
      [salonName, location, phone, email, openingTime, closingTime].some(
        (value) => value !== undefined && typeof value !== "string",
      )
    ) {
      return res.status(400).json({
        error: "Invalid settings update",
      });
    }

    const { data: current, error: currentError } = await supabaseAdmin
      .from("salon_settings")
      .select("setting_id")
      .limit(1)
      .maybeSingle();

    if (currentError || !current) {
      return res.status(400).json({
        error: "Salon settings are not initialized. Run database/schema.sql first.",
      });
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (salonName !== undefined) update.salon_name = salonName.trim();
    if (location !== undefined) update.location = location.trim();
    if (phone !== undefined) update.phone = phone.trim() || null;
    if (email !== undefined) update.email = email.trim() || null;
    if (openingTime !== undefined) update.opening_time = openingTime;
    if (closingTime !== undefined) update.closing_time = closingTime;

    const { data, error } = await supabaseAdmin
      .from("salon_settings")
      .update(update)
      .eq("setting_id", current.setting_id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: "Unable to save settings",
      });
    }

    res.json({ settings: data });
  },
);

app.get(
  "/api/staff/dashboard",
  requireAuth,
  requireStaff,
  async (req, res) => {
    try {
      const date = isDate(req.query.date) ? req.query.date : today();
      const staffId = res.locals.staff.staff_id;

      const { data, error } = await supabaseAdmin
        .from("appointments")
        .select(appointmentFields)
        .eq("staff_id", staffId)
        .eq("appointment_date", date)
        .order("start_time");

      if (error) throw error;

      const appointments = await decorate(
        (data ?? []) as Record<string, unknown>[],
      );

      const completedRevenue = appointments
        .filter(
          (appointment) =>
            appointment.status === "completed" &&
            appointment.payment_status === "paid",
        )
        .reduce(
          (sum, appointment) => sum + Number(appointment.total_amount),
          0,
        );

      const bookedMinutes = appointments
        .filter(
          (appointment) =>
            !["cancelled", "no_show"].includes(
              String(appointment.status),
            ),
        )
        .reduce((sum, appointment) => {
          const start = Date.parse(
            `1970-01-01T${String(appointment.start_time)}`,
          );

          const end = Date.parse(
            `1970-01-01T${String(appointment.end_time)}`,
          );

          return sum + (end - start) / 60000;
        }, 0);

      res.json({
        date,
        currency: "KES",
        staff: res.locals.staff,
        appointments,
        metrics: {
          appointments: appointments.filter(
            (appointment) =>
              !["cancelled", "no_show"].includes(
                String(appointment.status),
              ),
          ).length,
          bookedMinutes,
          earnings: completedRevenue,
        },
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Unable to load your schedule",
      });
    }
  },
);

app.patch(
  "/api/staff/appointments/:id",
  requireAuth,
  requireStaff,
  async (req, res) => {
    const { status, paymentStatus } = req.body ?? {};

    if (
      (status !== undefined &&
        !["checked_in", "completed", "no_show"].includes(status)) ||
      (paymentStatus !== undefined &&
        !["paid", "unpaid"].includes(paymentStatus))
    ) {
      return res.status(400).json({
        error: "This update is not allowed",
      });
    }

    const update: Record<string, unknown> = {};

    if (status !== undefined) update.status = status;
    if (paymentStatus !== undefined) {
      update.payment_status = paymentStatus;
    }

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .update(update)
      .eq("appointment_id", req.params.id)
      .eq("staff_id", res.locals.staff.staff_id)
      .select(appointmentFields)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        error: "Unable to update appointment",
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "Appointment not found",
      });
    }

    res.json({
      appointment: (
        await decorate([data as Record<string, unknown>])
      )[0],
    });
  },
);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found.",
  });
});

app.listen(PORT, () => {
  console.log(`Bookify API running on http://localhost:${PORT}`);
});
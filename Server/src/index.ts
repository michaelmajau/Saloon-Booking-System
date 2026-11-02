
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";

import { supabase } from "./config/supabase.js";
import { supabaseAdmin } from "./config/supabaseAdmin.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { requireAdmin } from "./middleware/requireAdmin.js";


dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// 1. CORS - must be registered before API routes
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 2. Parse JSON requests
app.use(express.json());

// 3. Basic health routes
app.get("/", (_req, res) => {
  res.send("Salon Booking Backend is running!");
});

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Backend connected successfully",
  });
});

// staff endpoint

app.post(
  "/api/admin/staff",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { fullName, email, staffType, specialty } = req.body;

      // Validate input
      if (
        typeof fullName !== "string" ||
        !fullName.trim() ||
        typeof email !== "string" ||
        !email.trim() ||
        !["barber", "stylist"].includes(staffType) ||
        (specialty !== undefined && typeof specialty !== "string")
      ) {
        res.status(400).json({
          error: "Invalid staff details",
        });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

          const { data: existingProfile, error: lookupError } =
      await supabaseAdmin
        .from("users")
        .select("user_id")
        .eq("email", normalizedEmail)
        .maybeSingle();

    if (lookupError) {
      console.error("Staff email lookup failed:", lookupError.message);

      res.status(500).json({
        error: "Unable to check staff email",
      });
      return;
    }

    if (existingProfile) {
      res.status(409).json({
        error: "An account with this email already exists",
      });
      return;
    }

      // Invite staff using Supabase Auth
      const { data: inviteData, error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(
          normalizedEmail,
          {
            data: { full_name: fullName.trim() },
            redirectTo: "http://localhost:5173/auth/callback",
          }
        );

      if (inviteError || !inviteData.user) {
        res.status(400).json({
          error: inviteError?.message ?? "Unable to invite staff",
        });
        return;
      }

      const userId = inviteData.user.id;

      // Create user profile
      const { error: profileError } = await supabaseAdmin
        .from("users")
          .insert({
            user_id: userId,
            full_name: fullName.trim(),
            email: normalizedEmail,
            role: "staff",
          });

      if (profileError) {
        console.error("Profile creation failed:", profileError);
        res.status(500).json({
          error: "Staff invitation sent, but profile setup failed",
        });
        return;
      }

      // Create staff-specific profile
      const { error: staffError } = await supabaseAdmin
        .from("staff")
        .insert({
          staff_id: userId,
          staff_type: staffType,
          specialty: specialty?.trim() || null,
        }
        );

      if (staffError) {
        console.error("Staff creation failed:", staffError);
        res.status(500).json({
          error: "Invitation sent, but staff setup failed",
        });
        return;
      }

      res.status(201).json({
        message: "Staff invitation sent successfully",
        staffId: userId,
      });
    } catch (error) {
      console.error("Create staff failed:", error);
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

// 4. Rate limiter for email checks
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
app.get("/api/test-auth", requireAuth, (req, res) => {
  res.json({
    message: "You are authenticated",
    email: res.locals.user.email,
  });
});

app.get(
  "/api/test-admin",
  requireAuth,
  requireAdmin,
  (_req, res) => {
    res.json({
      message: "Welcome Admin!",
      email: res.locals.user.email,
    });
  }
);

// 5. Check whether an email is already registered
app.post(
  "/api/auth/check-email",
  emailCheckLimiter,
  async (req, res) => {
    try {
      const { email } = req.body ?? {};

      // Validate the email
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

      const normalizedEmail = email.trim().toLowerCase();

      let page = 1;
      const perPage = 100;
      let exists = false;

      // Search registered Supabase Auth users
      while (true) {
        const { data, error } =
          await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage,
          });

        if (error) {
          throw error;
        }

        exists = data.users.some(
          (user) =>
            user.email?.toLowerCase() === normalizedEmail
        );

        if (exists || data.users.length < perPage) {
          break;
        }

        page++;
      }

      return res.json({
        success: true,
        exists,
        message: exists
          ? "This email is already registered."
          : "Email is available.",
      });
    } catch (error) {
      console.error("Email check error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to check email availability.",
      });
    }
  }
);

// 6. Fetch salon services
app.get("/api/services", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("services")
      .select(
        "service_id, service_name, price, duration_minutes"
      );

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      services: data,
    });
  } catch (error) {
    console.error("Services error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch services.",
    });
  }
});

// 7. Handle unknown routes
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found.",
  });
});

// 8. Start Express server
app.listen(PORT, () => {
  console.log(
    `Salon Booking Backend running on http://localhost:${PORT}`
  );
});

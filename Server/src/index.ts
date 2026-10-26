
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";

import { supabase } from "./config/supabase.js";
import { supabaseAdmin } from "./config/supabaseAdmin.js";

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

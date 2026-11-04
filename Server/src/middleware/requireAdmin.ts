import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabaseAdmin.js";

export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get the authenticated user from requireAuth
    const user = res.locals.user;

    if (!user) {
      res.status(401).json({
        error: "Authentication required",
      });
      return;
    }

    // Look up the user's role in Supabase
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("Role lookup failed:", error.message);
      res.status(500).json({
        error: "Unable to verify permissions",
      });
      return;
    }

    // Check whether the user is an Admin
    if (data?.role !== "admin") {
      res.status(403).json({
        error: "Admin access required",
      });
      return;
    }

    // User is an Admin; continue to the route
    next();
  } catch (error) {
    console.error("Admin authorization failed:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};
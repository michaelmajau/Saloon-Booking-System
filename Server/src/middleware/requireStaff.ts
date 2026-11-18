import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabaseAdmin.js";

export async function requireStaff(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = res.locals.user;

  if (!user) {
    res.status(401).json({
      error: "Authentication required",
    });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("staff")
    .select("staff_id, user_id, staff_type, specialty, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Staff lookup failed:", error);

    res.status(500).json({
      error: "Unable to verify staff access",
    });
    return;
  }

  if (!data || !data.is_active) {
    res.status(403).json({
      error: "Active staff access required",
    });
    return;
  }

  res.locals.staff = data;
  next();
}
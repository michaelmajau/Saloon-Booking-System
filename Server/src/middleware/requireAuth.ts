import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabaseAdmin";

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Authentication required",
    });
    return;
  }

  const token = authHeader.slice(7);

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({
      error: "Invalid or expired token",
    });
    return;
  }

  res.locals.user = data.user;

  next();
};
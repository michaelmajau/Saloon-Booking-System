import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabase";

/** Keeps customer and administrator accounts out of the staff workspace. */
export default function StaffRoute() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const verifyStaff = async () => {
      const { data: userResult } = await supabase.auth.getUser();
      if (!userResult.user) { if (mounted) setAllowed(false); return; }
      const { data: profile, error } = await supabase.from("users").select("role").eq("user_id", userResult.user.id).maybeSingle();
      if (mounted) setAllowed(!error && profile?.role === "staff");
    };
    void verifyStaff();
    return () => { mounted = false; };
  }, []);

  if (allowed === null) return <main className="grid min-h-screen place-items-center bg-[#F7F5F1] text-[#48342a]">Checking staff access…</main>;
  return allowed ? <Outlet /> : <Navigate to="/team/login" replace />;
}

import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";import { supabase } from "../lib/supabase";
type AccessState = "checking" | "allowed" | "denied";

/** Guards the entire administrator area using the role stored in Supabase. */
export default function AdminRoute() {
  const [access, setAccess] = useState<AccessState>("checking");

  useEffect(() => {
    let mounted = true;
    const verifyAdmin = async () => {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError || !userResult.user) {
        if (mounted) setAccess("denied");
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("users").select("role").eq("user_id", userResult.user.id).maybeSingle();
      if (mounted) setAccess(!profileError && profile?.role === "admin" ? "allowed" : "denied");
    };
    void verifyAdmin();
    return () => { mounted = false; };
  }, []);

  if (access === "checking") return <main className="grid min-h-screen place-items-center bg-[#efe8de] text-[#48342a]">Checking administrator access…</main>;
  return access === "allowed" ? <Outlet /> : <Navigate to="/team/login" replace />;
}

import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabase";

/** Restricts the barber workspace to signed-in, active barber accounts. */
export default function BarberRoute() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    const verifyBarber = async () => {
      const { data: userResult } = await supabase.auth.getUser();
      if (!userResult.user) {
        if (mounted) setAllowed(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("role")
        .eq("user_id", userResult.user.id)
        .maybeSingle();

      if (profileError || profile?.role !== "staff") {
        if (mounted) setAllowed(false);
        return;
      }

      const { data: staff, error: staffError } = await supabase
        .from("staff")
        .select("staff_type, is_active")
        .eq("user_id", userResult.user.id)
        .maybeSingle();

      if (mounted) {
        setAllowed(!staffError && staff?.is_active === true && staff.staff_type === "barber");
      }
    };

    void verifyBarber();
    return () => {
      mounted = false;
    };
  }, []);

  if (allowed === null) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F7F5F1] text-[#48342a]">
        Checking barber access…
      </main>
    );
  }

  return allowed ? <Outlet /> : <Navigate to="/team/login" replace />;
}

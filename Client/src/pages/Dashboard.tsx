
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    let active = true;

    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (!error && data.user?.email_confirmed_at) {
        setAuthenticated(true);
        setFullName(
          data.user.user_metadata?.full_name || "Customer"
        );
      }

      setLoading(false);
    };

    void loadUser();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="p-10">Loading dashboard...</p>;
  }

  if (!authenticated) {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <main className="min-h-screen bg-[#F7F5F1] px-8 py-16">
      <h1 className="text-3xl font-semibold text-[#29221F]">
        Welcome, {fullName}!
      </h1>

      <p className="mt-4 text-[#82766E]">
        Welcome to your The Chair & Co. dashboard.
      </p>
    </main>
  );
}

export default Dashboard;

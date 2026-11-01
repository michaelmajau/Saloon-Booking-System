
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [fullName, setFullName] = useState("");


const navigate = useNavigate();

const handleSignout = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Sign out failed:", error.message);
    return;
  }

  navigate("/sign-in", { replace: true });
};

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
      <button
        type="button"
        onClick={handleSignout}
        className="rounded-md bg-[#70263E] px-5 py-3 text-white hover:bg-[#5C1E32]"
      >
        Sign Out
      </button>
    </main>
  );
}

export default Dashboard;

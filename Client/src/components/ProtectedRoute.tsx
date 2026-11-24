
import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabase";

function ProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getUser();

      setAuthenticated(!error && !!data.user);
      setLoading(false);
    };

    checkSession();

    const { data: listener } =
      supabase.auth.onAuthStateChange((_event, session) => {
        setAuthenticated(!!session?.user);
        setLoading(false);
      });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <p>Checking authentication...</p>;
  }

  if (!authenticated) {
    return <Navigate to="/sign-in" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;

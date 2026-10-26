
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function AuthCallback() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const handleConfirmation = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!active) return;

        if (error) {
          throw error;
        }

        if (data.session) {
          navigate("/dashboard", { replace: true });
          return;
        }

        setErrorMessage(
          "We couldn't find an active session. Please sign in."
        );
      } catch (error) {
        if (!active) return;

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Email confirmation could not be completed."
        );
      }
    };

    void handleConfirmation();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#F7F5F1] px-6 text-center">
      {errorMessage ? (
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#29221F]">
            Confirmation status
          </h1>

          <p className="mt-4 text-[#82766E]">
            {errorMessage}
          </p>

          <Link
            to="/sign-in"
            className="mt-6 inline-block rounded-lg bg-[#70263E] px-6 py-3 text-white"
          >
            Go to Sign In
          </Link>
        </div>
      ) : (
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#29221F]">
            Verifying your account...
          </h1>

          <p className="mt-3 text-[#82766E]">
            Please wait while we redirect you to your dashboard.
          </p>
        </div>
      )}
    </main>
  );
}

export default AuthCallback;

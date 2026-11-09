import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function AuthCallback() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const handleConfirmation = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error || !data.session) {
        setErrorMessage(
          "We could not confirm your account. Please sign in or request a new confirmation link.",
        );
        return;
      }

      navigate("/dashboard", { replace: true });
    };

    void handleConfirmation();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F5F1] px-6 text-center">
      {errorMessage ? (
        <section>
          <h1 className="text-2xl font-semibold text-[#29221F]">
            Confirmation status
          </h1>

          <p className="mt-4 text-[#82766E]">{errorMessage}</p>

          <Link
            to="/sign-in"
            className="mt-6 inline-block bg-[#70263E] px-6 py-3 text-white"
          >
            Go to Sign In
          </Link>
        </section>
      ) : (
        <section>
          <h1 className="text-2xl font-semibold text-[#29221F]">
            Confirming your account…
          </h1>

          <p className="mt-3 text-[#82766E]">
            Please wait while we redirect you.
          </p>
        </section>
      )}
    </main>
  );
}

export default AuthCallback;
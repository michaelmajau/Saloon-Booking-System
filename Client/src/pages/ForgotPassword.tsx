import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

// Supabase only allows one reset email per address every 60 seconds.
const RESEND_SECONDS = 60;

/**
 * Step 1 of resetting a password: the user enters their email and
 * Supabase sends them a link to /reset-password.
 * Works for customers and team members (open with ?from=team from the Team Portal).
 */
function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const fromTeam = searchParams.get("from") === "team";
  const backLink = fromTeam ? "/team/login" : "/sign-in";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Count down so the user can't request another email too soon.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || cooldown > 0) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      // Rate limits are worth explaining; other errors get a general message.
      if (error.status === 429 || /seconds|rate limit/i.test(error.message)) {
        setErrorMessage("Too many reset requests. Please wait a minute and try again.");
      } else {
        setErrorMessage("We couldn't send the reset email. Please try again.");
      }
      return;
    }

    // Same message whether or not the email has an account, so the page
    // can't be used to find out who is registered.
    setSent(true);
    setCooldown(RESEND_SECONDS);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F5F1] px-6 py-12">
      <div className="w-full max-w-md">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#70263E]">
          {fromTeam ? "Team portal" : "Account help"}
        </p>

        <h1 className="mt-3 font-serif text-4xl text-[#29221F]">Forgot your password?</h1>

        <p className="mt-3 text-[#82766E]">
          Enter the email you use to sign in and we'll send you a link to choose a new password.
        </p>

        {sent && (
          <div role="status" className="mt-6 border-l-4 border-[#638062] bg-[#EEF3EC] p-4 text-sm text-[#3E5A3D]">
            If an account exists for <b>{email.trim().toLowerCase()}</b>, a reset link is on its way.
            Check your inbox and spam folder. The link works once and expires after a short time.
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
          <div>
            <label htmlFor="forgot-email" className="mb-2 block text-sm font-medium text-[#29221F]">
              Email address
            </label>
            <input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrorMessage("");
              }}
              className="w-full rounded-md border border-[#DDD5CC] bg-white px-4 py-3 outline-none focus:border-[#70263E]"
            />
          </div>

          {errorMessage && (
            <p role="alert" className="text-sm text-red-600">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || cooldown > 0}
            className="w-full rounded-md bg-[#70263E] py-3 font-semibold text-white hover:bg-[#5C1E32] disabled:opacity-60"
          >
            {loading
              ? "Sending..."
              : cooldown > 0
                ? `Send again in ${cooldown}s`
                : sent
                  ? "Send again"
                  : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#82766E]">
          Remembered it?{" "}
          <Link to={backLink} className="font-semibold text-[#70263E] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default ForgotPassword;

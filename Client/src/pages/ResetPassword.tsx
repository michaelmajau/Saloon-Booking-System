import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

// Remember the link's address before Supabase tidies it up, so we can
// tell an expired link apart from someone opening this page directly.
const openedUrl = typeof window !== "undefined" ? window.location.href : "";

/** Supabase puts link errors (e.g. an expired link) in the address after # or ?. */
function linkErrorFrom(url: string): string | null {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  parsed.searchParams.forEach((value, key) => params.set(key, value));
  if (!params.get("error") && !params.get("error_code")) return null;
  return params.get("error_code") === "otp_expired"
    ? "This reset link has expired or has already been used."
    : params.get("error_description")?.replace(/\+/g, " ") ?? "This reset link is not valid.";
}

type Stage = "checking" | "ready" | "invalid" | "done";

/**
 * Step 2 of resetting a password: the emailed link opens this page with a
 * temporary recovery session, and the user chooses a new password.
 */
function ResetPassword() {
  const [stage, setStage] = useState<Stage>("checking");
  const [invalidReason, setInvalidReason] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [signInPath, setSignInPath] = useState("/sign-in");

  useEffect(() => {
    let active = true;

    const linkError = linkErrorFrom(openedUrl);
    if (linkError) {
      setInvalidReason(linkError);
      setStage("invalid");
      return;
    }

    // Supabase fires PASSWORD_RECOVERY once it has read the link.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) setStage((s) => (s === "checking" ? "ready" : s));
    });

    // getSession waits until Supabase has finished reading the link.
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setStage((s) => (s === "checking" ? "ready" : s));
      } else {
        setInvalidReason("This reset link is not valid. Please request a new one.");
        setStage((s) => (s === "checking" ? "invalid" : s));
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (password.length < 8) {
      setErrorMessage("Password must contain at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.auth.updateUser({ password });

    if (error) {
      setSaving(false);
      setErrorMessage(
        /different from the old password/i.test(error.message)
          ? "Your new password must be different from your old one."
          : error.message,
      );
      return;
    }

    // Send team members back to the Team Portal and customers to the customer sign-in.
    if (data.user) {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (profile?.role === "admin" || profile?.role === "staff") setSignInPath("/team/login");
    }

    // Sign out so they sign in again with the new password.
    await supabase.auth.signOut();
    setSaving(false);
    setStage("done");
  };

  const inputClass =
    "w-full rounded-md border border-[#DDD5CC] bg-white px-4 py-3 outline-none focus:border-[#70263E]";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F5F1] px-6 py-12">
      <div className="w-full max-w-md">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#70263E]">Account help</p>

        {stage === "checking" && (
          <>
            <h1 className="mt-3 font-serif text-4xl text-[#29221F]">Checking your link…</h1>
            <p className="mt-3 text-[#82766E]">One moment.</p>
          </>
        )}

        {stage === "invalid" && (
          <>
            <h1 className="mt-3 font-serif text-4xl text-[#29221F]">Link not valid</h1>
            <p role="alert" className="mt-4 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {invalidReason} Reset links work once and expire after a short time.
            </p>
            <Link
              to="/forgot-password"
              className="mt-6 block w-full rounded-md bg-[#70263E] py-3 text-center font-semibold text-white hover:bg-[#5C1E32]"
            >
              Request a new link
            </Link>
          </>
        )}

        {stage === "ready" && (
          <>
            <h1 className="mt-3 font-serif text-4xl text-[#29221F]">Choose a new password</h1>
            <p className="mt-3 text-[#82766E]">Use at least 8 characters.</p>

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
              <div>
                <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-[#29221F]">
                  New password
                </label>
                <input
                  id="new-password"
                  type={showPasswords ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-[#29221F]">
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  type={showPasswords ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-[#82766E]">
                <input
                  type="checkbox"
                  checked={showPasswords}
                  onChange={(e) => setShowPasswords(e.target.checked)}
                  className="accent-[#70263E]"
                />
                Show passwords
              </label>

              {errorMessage && (
                <p role="alert" className="text-sm text-red-600">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-md bg-[#70263E] py-3 font-semibold text-white hover:bg-[#5C1E32] disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save new password"}
              </button>
            </form>
          </>
        )}

        {stage === "done" && (
          <>
            <h1 className="mt-3 font-serif text-4xl text-[#29221F]">Password updated</h1>
            <p role="status" className="mt-4 border-l-4 border-[#638062] bg-[#EEF3EC] p-4 text-sm text-[#3E5A3D]">
              Your password has been changed. Sign in with your new password.
            </p>
            <Link
              to={signInPath}
              className="mt-6 block w-full rounded-md bg-[#70263E] py-3 text-center font-semibold text-white hover:bg-[#5C1E32]"
            >
              Go to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export default ResetPassword;

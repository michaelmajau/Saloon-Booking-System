import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function SetStaffPassword() {
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const checkInvitationSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        setErrorMessage(
          "This invitation link is invalid or expired. Ask your administrator to send a new invitation.",
        );
        return;
      }

      setReady(true);
    };

    void checkInvitationSession();
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

    const { error } = await supabase.auth.updateUser({ password });

    setSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    navigate("/team/login", { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F5F1] px-6">
      <section className="w-full max-w-md bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#70263E]">
          Bookify team access
        </p>

        <h1 className="mt-3 font-serif text-4xl text-[#34251F]">
          Create your password
        </h1>

        <p className="mt-3 text-sm text-[#82766E]">
          Create a password to activate your staff account.
        </p>

        {errorMessage && (
          <p className="mt-5 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        {ready && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="password"
              required
              minLength={8}
              placeholder="New password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full border border-[#D7CABC] p-3"
            />

            <input
              type="password"
              required
              minLength={8}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full border border-[#D7CABC] p-3"
            />

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[#70263E] p-3 font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving password…" : "Set password"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

export default SetStaffPassword;
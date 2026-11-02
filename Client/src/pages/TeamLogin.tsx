
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Welcome from "../assets/signup.avif";

type TeamRole = "admin" | "barber" | "stylist";

const TeamLogin = () => {
  const navigate = useNavigate();

  // Form states
  const [selectedRole, setSelectedRole] = useState<TeamRole>("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  // Authentication states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setErrorMessage("");

    try {
      // 1. Sign in using Supabase Authentication
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error || !data.user) {
        setErrorMessage(error?.message ?? "Unable to sign in.");
        return;
      }

      // 2. Retrieve the user's actual database role
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("role")
        .eq("user_id", data.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setErrorMessage("Unable to verify your account role.");
        return;
      }

      // 3. Handle administrator login
      if (profile.role === "admin") {
        if (selectedRole !== "admin") {
          await supabase.auth.signOut();
          setErrorMessage("Please select the Admin workspace.");
          return;
        }

        navigate("/admin/dashboard", { replace: true });
        return;
      }

      // 4. Handle barber and stylist login
      if (profile.role === "staff") {
        const { data: staff, error: staffError } = await supabase
          .from("staff")
          .select("staff_type, is_active")
          .eq("staff_id", data.user.id)
          .single();

        if (staffError || !staff) {
          await supabase.auth.signOut();
          setErrorMessage("Unable to verify your staff account.");
          return;
        }

        if (!staff.is_active) {
          await supabase.auth.signOut();
          setErrorMessage(
            "Your staff account is inactive. Contact your administrator."
          );
          return;
        }

        if (selectedRole !== staff.staff_type) {
          await supabase.auth.signOut();
          setErrorMessage(
            `Please select the ${staff.staff_type} workspace.`
          );
          return;
        }

        navigate("/staff/dashboard", { replace: true });
        return;
      }

      // 5. Customers cannot use the Team Portal
      await supabase.auth.signOut();
      setErrorMessage(
        "This portal is only available to salon team members."
      );
    } catch (err) {
      console.error("Team login error:", err);

      // Avoid leaving an authenticated session after an error
      await supabase.auth.signOut();

      setErrorMessage(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex w-full flex-col lg:flex-row">

      {/* LEFT SIDE - IMAGE */}
      <div className="w-full lg:w-1/2">
        <img
          src={Welcome}
          alt="Salon interior"
          className="block h-auto w-full"
        />
      </div>

      {/* RIGHT SIDE - LOGIN FORM */}
      <div className="flex w-full items-center justify-center bg-[#F7F2EA] px-6 py-8 lg:w-1/2 lg:px-10">

        <div className="w-full max-w-[490px]">

          {/* HEADING */}
          <h1 className="font-serif text-[28px] text-[#33241D] md:text-[34px]">
            Welcome back.
          </h1>

          <p className="mt-3 text-sm text-[#82766E]">
            Choose your workspace and sign in.
          </p>

          {/* ROLE SELECTION */}
          <div className="mt-6 grid grid-cols-3 border border-[#DDD2C6]">
            {(["admin", "barber", "stylist"] as TeamRole[]).map(
              (role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setSelectedRole(role);
                    setErrorMessage("");
                  }}
                  aria-pressed={selectedRole === role}
                  className={`h-11 text-[13px] capitalize transition-colors ${
                    selectedRole === role
                      ? "bg-[#70263E] text-white"
                      : "bg-transparent text-[#29221F] hover:bg-[#EEE6DC]"
                  }`}
                >
                  {role}
                </button>
              )
            )}
          </div>

          {/* LOGIN FORM */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">

            {/* EMAIL ADDRESS */}
            <div>
              <label
                htmlFor="team-email"
                className="mb-2 block text-[13px] font-medium text-[#29221F]"
              >
                Email address
              </label>

              <input
                id="team-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                className="h-11 w-full border border-[#DDD2C6] bg-white px-4 text-[13px] text-[#29221F] outline-none focus:border-[#70263E]"
              />
            </div>

            {/* PASSWORD */}
            <div>
              <label
                htmlFor="team-password"
                className="mb-2 block text-[13px] font-medium text-[#29221F]"
              >
                Password
              </label>

              <input
                id="team-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="h-11 w-full border border-[#DDD2C6] bg-white px-4 text-[13px] text-[#29221F] outline-none focus:border-[#70263E]"
              />
            </div>

            {/* REMEMBER ME AND FORGOT PASSWORD */}
            <div className="flex items-center justify-between gap-3">

              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#82766E]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="accent-[#70263E]"
                />
                Remember me
              </label>

              <span className="text-[13px] text-[#82766E]">
                Forgot password?
              </span>

            </div>

            {/* ERROR MESSAGE */}
            {errorMessage && (
              <p
                role="alert"
                className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600"
              >
                {errorMessage}
              </p>
            )}

            {/* SIGN IN BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full bg-[#70263E] text-[13px] font-semibold text-white transition-colors hover:bg-[#5C1E32] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Signing in..."
                : `Sign in as ${selectedRole}`}
            </button>

          </form>

          {/* FOOTER */}
          <p className="mt-5 text-center text-xs text-[#82766E]">
            Staff accounts are created by the salon administrator.
          </p>

        </div>
      </div>
    </main>
  );
};

export default TeamLogin;

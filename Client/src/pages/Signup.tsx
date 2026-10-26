
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";
import SignupImage from "../assets/signup1.avif";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSignup = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setMessage("");
    setSuccess(false);

    // Validate form inputs
    if (!fullName.trim()) {
      setMessage("Please enter your full name.");
      return;
    }

    if (!email.trim()) {
      setMessage("Please enter your email address.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // STEP 1: Ask Express whether the email exists
      const response = await fetch(
        `${API_URL}/api/auth/check-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to check email availability. Please try again."
        );
      }

      const result: {
        success: boolean;
        exists: boolean;
      } = await response.json();

      if (!result.success) {
        throw new Error("Email availability check failed.");
      }

      // STEP 2: Stop signup if email already exists
      if (result.exists) {
        setMessage(
          "This email is already registered. Please sign in instead."
        );
        setSuccess(false);
        return;
      }

      // STEP 3: Register new customer using Supabase
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo:
            `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        if (
          error.code === "user_already_exists" ||
          error.message.toLowerCase().includes("already registered")
        ) {
          throw new Error(
            "This email is already registered. Please sign in instead."
          );
        }

        throw error;
      }

      if (!data.user) {
        throw new Error(
          "Signup could not be completed. Please try again."
        );
      }

      // STEP 4: Display confirmation message
      setSuccess(true);

      if (data.session) {
        setMessage(
          "Account created successfully! You can now access your account."
        );
      } else {
        setMessage(
          "Please check your email for a verification link. After confirming, you'll be redirected to your dashboard."
        );
      }

      // Clear password fields
      setPassword("");
      setConfirmPassword("");

    } catch (error) {
      setSuccess(false);

      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const inputStyle =
    "w-full rounded-md border border-[#DDD5CC] bg-white px-4 py-3 text-sm text-[#29221F] outline-none transition focus:border-[#70263E] focus:ring-1 focus:ring-[#70263E]";

  return (
    <main className="min-h-screen bg-[#F7F5F1]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">

        {/* LEFT: SIGNUP FORM */}
        <section className="flex items-center justify-center px-6 py-16 sm:px-12 lg:px-16">
          <div className="w-full max-w-md">

            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#70263E]">
              Client Account
            </p>

            <h1 className="mb-3 font-serif text-4xl text-[#29221F] sm:text-5xl">
              Your chair is waiting.
            </h1>

            <p className="mb-8 text-sm leading-6 text-[#82766E]">
              Create an account to book appointments,
              manage your visits, and enjoy a personalized
              grooming experience.
            </p>

            <form
              onSubmit={handleSignup}
              className="space-y-5"
            >

              {/* FULL NAME */}
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-2 block text-sm font-medium text-[#29221F]"
                >
                  Full Name
                </label>

                <input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) =>
                    setFullName(e.target.value)
                  }
                  className={inputStyle}
                  autoComplete="name"
                  required
                />
              </div>

              {/* EMAIL */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-[#29221F]"
                >
                  Email Address
                </label>

                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  className={inputStyle}
                  autoComplete="email"
                  required
                />
              </div>

              {/* PASSWORD */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-[#29221F]"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={
                      showPassword ? "text" : "password"
                    }
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    className={`${inputStyle} pr-12`}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#82766E] hover:text-[#70263E]"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              {/* CONFIRM PASSWORD */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-medium text-[#29221F]"
                >
                  Confirm Password
                </label>

                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                    className={`${inputStyle} pr-12`}
                    autoComplete="new-password"
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(
                        !showConfirmPassword
                      )
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#82766E] hover:text-[#70263E]"
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirmation password"
                        : "Show confirmation password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              {/* STATUS MESSAGE */}
              {message && (
                <div
                  role="status"
                  className={`rounded-md border px-4 py-3 text-sm leading-6 ${
                    success
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {message}
                </div>
              )}

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-[#70263E] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#5C1E32] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Creating Account..."
                  : "Create Account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[#82766E]">
              Already have an account?{" "}
              <Link
                to="/sign-in"
                className="font-semibold text-[#70263E] hover:underline"
              >
                Sign In
              </Link>
            </p>

            <div className="mt-12 border-t border-[#DDD5CC] pt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#70263E]">
                Working Hours
              </p>

              <p className="text-sm leading-7 text-[#82766E]">
                Book your next grooming appointment
                at a time that works for you.
              </p>
            </div>
          </div>
        </section>

        {/* RIGHT: IMAGE */}
        <section className="relative hidden min-h-screen lg:block">
          <img
            src={SignupImage}
            alt="The Chair & Co. salon interior"
            className="absolute inset-0 h-full w-full object-cover grayscale"
          />

          <div className="absolute inset-0 bg-black/20" />

          <div className="absolute bottom-16 left-12 right-12 text-white">
            <p className="mb-3 text-xs uppercase tracking-[0.3em]">
              The Chair & Co.
            </p>

            <h2 className="max-w-lg font-serif text-4xl leading-tight">
              A better grooming experience starts here.
            </h2>
          </div>
        </section>

      </div>
    </main>
  );
}

export default Signup;

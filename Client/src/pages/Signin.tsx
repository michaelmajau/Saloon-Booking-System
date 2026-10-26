
import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

function Signin() {
  // State variables
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Sign-in function
  const handleSignin = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (error) {
        throw error;
      }

      if (data.user) {
        navigate("/dashboard");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F7F5F1] flex items-center justify-center px-6">
      <div className="w-full max-w-md">

        <h1 className="mb-3 text-4xl font-serif text-[#29221F]">
          Welcome Back
        </h1>

        <p className="mb-8 text-[#82766E]">
          Sign in to manage your appointments.
        </p>

        <form onSubmit={handleSignin} className="space-y-5">

          {/* Email input */}
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium"
            >
              Email Address
            </label>

            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-md border border-[#DDD5CC] bg-white px-4 py-3 outline-none focus:border-[#70263E]"
            />
          </div>

          {/* Password input */}
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-[#DDD5CC] bg-white px-4 py-3 outline-none focus:border-[#70263E]"
            />
          </div>

          {/* Error message */}
          {message && (
            <p role="alert" className="text-sm text-red-600">
              {message}
            </p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#70263E] py-3 text-white font-semibold hover:bg-[#5C1E32] disabled:opacity-60"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>

        </form>

        <p className="mt-6 text-center text-sm text-[#82766E]">
          Don't have an account?{" "}
          <Link
            to="/sign-up"
            className="font-semibold text-[#70263E] hover:underline"
          >
            Create Account
          </Link>
        </p>

      </div>
    </main>
  );
}

export default Signin;

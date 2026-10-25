
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import SignupImage from "../assets/signup.avif"

function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    setSuccess(false);

    if (!fullName.trim()) {
      setMessage("Please enter your full name.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: window.location.origin + "/",
        },
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setSuccess(true);

      if (data.session) {
        setMessage("Your account has been created successfully!");
      } else {
        setMessage(
          "Registration submitted. Check your email for a confirmation link if required."
        );
      }
    } catch {
      setMessage("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
  
  <div className="flex w-full min-h-screen">

      <div className="w-1/2 min-h-screen bg-[#F7F5EF] p-6 pt-16">
        <h1 className="text-xs text-bold">CLIENT ACCOUNT</h1>
        <p>Join us and book your next salon appointment.</p>

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <label htmlFor="fullName">Full Name</label>
          <input
            id="fullName"
            type="text"
            placeholder="Enter your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            required
          />

          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />

          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        {message && (
          <p role="status" className={success ? "success" : "error"}>
            {message}
          </p>
        )}

        <p className="login-link">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>

{/* RIGHT SIDE - IMAGE */}
      <div className="w-1/2 min-h-screen overflow-hidden">
        <img
          src={SignupImage}
          alt="Salon interior"
          className="w-full h-full object-cover block"
        />
      </div>

    </div> 
   
  );
}

export default Signup;

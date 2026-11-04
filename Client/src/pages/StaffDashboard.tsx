import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function StaffDashboard() {
  const signOut = async () => { await supabase.auth.signOut(); };
  return (
    <main className="min-h-screen bg-[#F7F5F1] px-6 py-12 sm:px-12">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#70263E]">The Chair &amp; Co. · team workspace</p>
        <h1 className="mt-5 font-serif text-5xl text-[#34251F]">Welcome back.</h1>
        <section className="mt-10 border-l-4 border-[#70263E] bg-white p-7 shadow-sm"><h2 className="font-serif text-3xl text-[#34251F]">Your schedule will appear here</h2><p className="mt-3 max-w-2xl leading-7 text-[#70655d]">Staff authentication and role separation are active. The supplied server has no staff-schedule endpoint, so this view does not invent appointments.</p></section>
        <div className="mt-8 flex gap-4"><Link className="border border-[#B9A796] px-5 py-3 text-sm font-semibold text-[#34251F] hover:bg-[#EFE8DE]" to="/">Return home</Link><button onClick={signOut} className="bg-[#70263E] px-5 py-3 text-sm font-semibold text-white hover:bg-[#5C1E32]">Sign out</button></div>
      </div>
    </main>
  );
}

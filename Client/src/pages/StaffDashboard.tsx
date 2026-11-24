import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { api, kes } from "../lib/api";

type Appointment = { appointment_id: string; start_time: string; status: string; payment_status: string; total_amount: number; customer: { full_name: string } | null; service: { service_name: string; duration_minutes: number } | null };
type DashboardData = { date: string; staff: { staff_type: string; specialty: string | null }; appointments: Appointment[]; metrics: { appointments: number; bookedMinutes: number; earnings: number } };

/** Today's date in Nairobi as YYYY-MM-DD (the same "today" the server uses). */
const todayInNairobi = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

/** Moves a YYYY-MM-DD date by a number of days. */
const shiftDate = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** e.g. "Wednesday, 18 November 2026" */
const longDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export default function StaffDashboard() {
  const navigate = useNavigate();
  const today = todayInNairobi();
  const [date, setDate] = useState(today);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      setData(await api<DashboardData>(`/staff/dashboard?date=${date}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load your schedule");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { void load(); }, [load]);

  const update = async (id: string, payload: Record<string, string>) => {
    setBusy(id);
    try {
      await api(`/staff/appointments/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update appointment");
    } finally {
      setBusy(null);
    }
  };

  // Sign out and go back to the Team portal (not the customer sign-in page).
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/team/login", { replace: true });
  };

  const isToday = date === today;
  const dayWord = isToday ? "Today's" : "This day's";
  const next = isToday ? data?.appointments.find((x) => ["confirmed", "checked_in"].includes(x.status)) : undefined;

  return <main className="min-h-screen bg-[#F7F5F1] px-5 py-8 text-[#34251F] sm:px-10 lg:px-16">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-start justify-between gap-5 border-b border-[#ded4c9] pb-7">
        <div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#70263E]">Bookify · {data?.staff.staff_type ?? "team"} workspace</p><h1 className="mt-3 font-serif text-4xl sm:text-5xl">Your day, in hand.</h1><p className="mt-3 text-[#756960]">{data?.staff.specialty ?? "Your appointments and client service notes."}</p></div>
        <div className="flex gap-3"><Link className="border border-[#B9A796] px-4 py-3 text-sm font-semibold" to="/">Bookify home</Link><button onClick={signOut} className="bg-[#70263E] px-4 py-3 text-sm font-semibold text-white">Sign out</button></div>
      </header>

      {/* Choose which day to look at */}
      <nav aria-label="Choose a day" className="mt-6 flex flex-wrap items-center gap-2">
        <button onClick={() => setDate(shiftDate(date, -1))} className="border border-[#B9A796] bg-white px-3 py-2 text-sm font-semibold" aria-label="Previous day">← Previous</button>
        <button onClick={() => setDate(today)} disabled={isToday} className="border border-[#B9A796] bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">Today</button>
        <button onClick={() => setDate(shiftDate(date, 1))} className="border border-[#B9A796] bg-white px-3 py-2 text-sm font-semibold" aria-label="Next day">Next →</button>
        <label className="ml-1 flex items-center gap-2 text-sm text-[#756960]">
          <span className="sr-only">Pick a date</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="border border-[#B9A796] bg-white px-3 py-2 text-[#34251F]" />
        </label>
        <p className="ml-auto text-sm font-semibold">{longDate(date)}</p>
      </nav>

      {error && <p role="alert" className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {[[`${dayWord} appointments`, data?.metrics.appointments ?? "—"], ["Booked hours", data ? `${(data.metrics.bookedMinutes / 60).toFixed(1)} hrs` : "—"], ["Completed earnings", data ? kes(data.metrics.earnings) : "—"]].map(([label, value]) => <article key={label} className="border-t-4 border-[#70263E] bg-white p-6"><p className="text-sm text-[#756960]">{label}</p><p className="mt-6 font-serif text-4xl">{value}</p><p className="mt-3 text-xs text-[#638062]">KES · {isToday ? "live daily total" : "total for this day"}</p></article>)}
      </section>

      <section className="mt-8 bg-white p-5 sm:p-8">
        <div className="flex items-end justify-between border-b border-[#e7ded3] pb-5"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#70263E]">Schedule</p><h2 className="mt-2 font-serif text-3xl">{dayWord} appointments</h2></div>{next && <p className="text-sm text-[#756960]">Up next: <b>{next.start_time.slice(0, 5)}</b></p>}</div>
        {loading && !data && <p className="py-10 text-[#756960]">Loading your schedule…</p>}
        {!loading && data?.appointments.length === 0 && <p className="py-10 text-[#756960]">Nothing is booked for {isToday ? "today" : "this day"}.</p>}
        <div className={`divide-y divide-[#e7ded3] ${loading ? "opacity-60" : ""}`}>{data?.appointments.map((a) => {
          const disabled = busy === a.appointment_id;
          return <article key={a.appointment_id} className="grid gap-4 py-5 md:grid-cols-[90px_1fr_auto] md:items-center">
            <p className="font-serif text-2xl">{a.start_time.slice(0, 5)}</p>
            <div><p className="font-semibold">{a.customer?.full_name || "Client"}</p><p className="mt-1 text-sm text-[#756960]">{a.service?.service_name ?? "Service"} · {a.service?.duration_minutes ?? "—"} min · {kes(a.total_amount)}</p><p className="mt-1 text-xs uppercase tracking-wider text-[#70263E]">{STATUS_LABELS[a.status] ?? a.status} · {a.payment_status}</p></div>
            <div className="flex flex-wrap gap-2">
              {a.status === "pending" && <button disabled={disabled} onClick={() => void update(a.appointment_id, { status: "confirmed" })} className="bg-[#70263E] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Confirm</button>}
              {a.status === "confirmed" && <button disabled={disabled} onClick={() => void update(a.appointment_id, { status: "checked_in" })} className="border border-[#70263E] px-3 py-2 text-xs font-bold text-[#70263E] disabled:opacity-50">Check in</button>}
              {a.status === "checked_in" && <button disabled={disabled} onClick={() => void update(a.appointment_id, { status: "completed", paymentStatus: "paid" })} className="bg-[#70263E] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Complete & paid</button>}
              {["pending", "confirmed", "checked_in"].includes(a.status) && <button disabled={disabled} onClick={() => { if (window.confirm("Mark this client as a no-show?")) void update(a.appointment_id, { status: "no_show" }); }} className="border border-[#B9A796] px-3 py-2 text-xs disabled:opacity-50">No-show</button>}
            </div>
          </article>;
        })}</div>
      </section>
    </div>
  </main>;
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, kes } from "../../lib/api";

type Appointment = { appointment_id: string; start_time: string; status: string; total_amount: number; customer: { full_name: string } | null; staff: { full_name: string } | null; service: { service_name: string } | null };
type Data = { date: string; metrics: { todayAppointments: number; weeklyRevenue: number; activeStaff: number; nextAppointment: Appointment | null }; appointments: Appointment[] };

export default function AdminDashboard() {
  const [data, setData] = useState<Data | null>(null); const [error, setError] = useState("");
  useEffect(() => { void api<Data>("/admin/dashboard").then(setData).catch((e: unknown) => setError(e instanceof Error ? e.message : "Unable to load dashboard")); }, []);
  const cards = [["Today's appointments", data?.metrics.todayAppointments ?? "—", "Live bookings"], ["Weekly revenue", data ? kes(data.metrics.weeklyRevenue) : "—", "Paid completed appointments"], ["Active team", data?.metrics.activeStaff ?? "—", "Available barbers & stylists"], ["Next appointment", data?.metrics.nextAppointment?.start_time.slice(0, 5) ?? "—", data?.metrics.nextAppointment?.customer?.full_name ?? "No upcoming appointment"]];
  return <section className="mx-auto max-w-[1400px]">
    <div className="flex flex-wrap items-end justify-between gap-6"><div><p className="text-xs font-semibold uppercase tracking-[.25em] text-[#70263E]">Bookify admin · {data?.date ?? "today"}</p><h1 className="mt-5 font-serif text-5xl leading-none text-[#34251F] sm:text-6xl">Studio overview</h1><p className="mt-5 text-[#82766E]">Live bookings, KSh revenue and team performance.</p></div><Link to="/admin/appointments" className="bg-[#70263E] px-6 py-4 text-sm font-semibold text-white">Manage appointments</Link></div>
    {error && <p role="alert" className="mt-7 border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
    <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value,note], index) => <article key={label} className={`min-h-48 border-t-4 p-7 ${index === 3 ? "border-[#34251F] bg-[#34251F] text-white" : index === 1 ? "border-[#E8DDCD] bg-[#E8DDCD]" : "border-[#70263E] bg-[#FFFCF8]"}`}><p className="text-sm opacity-70">{label}</p><p className="mt-8 font-serif text-4xl">{value}</p><p className="mt-4 text-sm opacity-70">{note}</p></article>)}</div>
    <section className="mt-10 bg-[#FFFCF8] p-6 sm:p-10"><div className="flex items-end justify-between border-b border-[#e7ded3] pb-5"><div><p className="text-xs font-semibold uppercase tracking-[.24em] text-[#70263E]">Today</p><h2 className="mt-3 font-serif text-3xl">Appointments</h2></div><Link to="/admin/appointments" className="text-sm text-[#70263E]">View all →</Link></div>{!data && !error && <p className="py-10 text-[#82766E]">Loading live data…</p>}<div className="divide-y divide-[#e7ded3]">{data?.appointments.map((a) => <div key={a.appointment_id} className="grid grid-cols-[75px_1fr_auto] gap-4 py-5 text-sm"><b>{a.start_time.slice(0,5)}</b><div><p className="font-semibold">{a.customer?.full_name ?? "Client"}</p><p className="mt-1 text-[#82766E]">{a.service?.service_name ?? "Service"} · {a.staff?.full_name ?? "Staff"}</p></div><p className="text-[#70263E]">{a.status.replace("_"," ")}</p></div>)}</div>{data?.appointments.length === 0 && <p className="py-8 text-[#82766E]">No bookings for today.</p>}</section>
  </section>;
}

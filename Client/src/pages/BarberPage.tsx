import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { supabase } from "../lib/supabase";
import { api, kes } from "../lib/api";

type Section = "overview" | "appointments" | "schedule" | "clients" | "settings";
type Appointment = { appointment_id: string; start_time: string; end_time: string; status: string; payment_status: string; total_amount: number; customer: { full_name: string } | null; service: { service_name: string; duration_minutes: number } | null };
type BarberData = { date: string; staff: { staff_type: string; specialty: string | null }; appointments: Appointment[]; metrics: { appointments: number; bookedMinutes: number; earnings: number; tipsThisWeek: number } };
type Client = { name: string; appointments: number; lastVisit: string | null; totalSpent: number };
type WeeklySchedule = { schedule_id: string; days_of_week: number; start_time: string; end_time: string };
type StaffBreak = { break_id: string; start_time: string; end_time: string; note: string | null };
type Profile = { full_name: string; email: string | null; phone: string | null; specialty: string | null };

const navItems: { id: Section; label: string }[] = [
  { id: "overview", label: "Overview" }, { id: "appointments", label: "Appointments" },
  { id: "schedule", label: "My schedule" }, { id: "clients", label: "Clients" }, { id: "settings", label: "Settings" },
];

const time = (value: string) => value.slice(0, 5);
const status = (value: string) => value.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const toMinutes = (value: string) => { const [hours, minutes] = value.slice(0, 5).split(":").map(Number); return hours * 60 + minutes; };
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export default function BarberPage() {
  const [section, setSection] = useState<Section>("overview");
  const [data, setData] = useState<BarberData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [clientHistory, setClientHistory] = useState<Client[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule[]>([]);
  const [breaks, setBreaks] = useState<StaffBreak[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      const [dashboard, clientsResult, scheduleResult, breaksResult, profileResult] = await Promise.all([
        api<BarberData>("/staff/dashboard"), api<{ clients: Client[] }>("/staff/clients"),
        api<{ schedules: WeeklySchedule[] }>("/staff/schedule"), api<{ breaks: StaffBreak[] }>("/staff/breaks"),
        api<{ profile: Profile }>("/staff/profile"),
      ]);
      setData(dashboard); setClientHistory(clientsResult.clients); setWeeklySchedule(scheduleResult.schedules);
      setBreaks(breaksResult.breaks); setProfile(profileResult.profile);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load your appointments."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const update = async (id: string, payload: Record<string, string>) => {
    setBusy(id);
    try { await api(`/staff/appointments/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update this appointment."); }
    finally { setBusy(null); }
  };

  const activeAppointments = useMemo(() => (data?.appointments ?? []).filter((appointment) => !["cancelled", "no_show", "completed"].includes(appointment.status)), [data]);
  const nextAppointment = activeAppointments[0] ?? null;
  const opening = useMemo(() => {
    const appointments = activeAppointments.slice().sort((a, b) => a.start_time.localeCompare(b.start_time));
    let gapStart = 9 * 60;
    for (const appointment of appointments) {
      const appointmentStart = toMinutes(appointment.start_time);
      if (appointmentStart - gapStart >= 30) return { start: gapStart, end: appointmentStart };
      gapStart = Math.max(gapStart, toMinutes(appointment.end_time));
    }
    return 19 * 60 - gapStart >= 30 ? { start: gapStart, end: 19 * 60 } : null;
  }, [activeAppointments]);

  const signOut = async () => { await supabase.auth.signOut(); window.location.assign("/team/login"); };

  const appointmentRows = (actions: boolean) => <div className="divide-y divide-[#e6ded4]">{data?.appointments.map((appointment) => <article key={appointment.appointment_id} className="grid grid-cols-[74px_48px_minmax(140px,1fr)_minmax(140px,1fr)_28px] items-center gap-2 py-5 text-sm"><p className="text-[#75695f]">{time(appointment.start_time)}</p><div className="grid h-11 w-11 place-items-center rounded-full bg-[#f1e4e8] text-[#79243f]">{(appointment.customer?.full_name ?? "C").slice(0, 1)}</div><div><p className="font-semibold text-[#211a16]">{appointment.customer?.full_name ?? "Client"}</p><p className="mt-1 text-xs text-[#816f63]">{status(appointment.status)}</p></div><div><p className="font-semibold text-[#211a16]">{appointment.service?.service_name ?? "Service"}</p><p className="mt-1 text-xs text-[#816f63]">{status(appointment.status)}</p></div>{actions ? <AppointmentAction appointment={appointment} busy={busy === appointment.appointment_id} update={update} /> : <button type="button" onClick={() => setSection("appointments")} aria-label={`Open ${appointment.customer?.full_name ?? "appointment"}`} className="text-[#211a16]"><MoreHorizontal size={20} /></button>}</article>)}{!loading && data?.appointments.length === 0 && <p className="py-10 text-center text-sm text-[#816f63]">No appointments are booked for today.</p>}</div>;

  const overview = <>
    <header className="flex flex-wrap items-end justify-between gap-6">
      <div><p className="text-xs font-bold uppercase tracking-[.23em] text-[#79243f]">Barber dashboard</p><h1 className="mt-7 font-serif text-5xl leading-none tracking-tight text-[#28201b] sm:text-6xl">Good morning.</h1><p className="mt-6 text-lg text-[#7d6d60]">Your chair is ready. Here is today’s run.</p></div>
      <button type="button" onClick={() => setSection("appointments")} className="bg-[#79243f] px-8 py-5 text-sm font-bold text-white">+ New appointment</button>
    </header>
    <section className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Today’s appointments" value={String(data?.metrics.appointments ?? 0)} detail="Your day at a glance" />
      <SummaryCard label="Booked hours" value={`${((data?.metrics.bookedMinutes ?? 0) / 60).toFixed(1)} hrs`} detail="On track for this week" />
      <SummaryCard label="Next appointment" value={nextAppointment ? time(nextAppointment.start_time) : "—"} detail={nextAppointment?.customer?.full_name ?? "No upcoming appointment"} />
      <SummaryCard label="Tips this week" value={kes(data?.metrics.tipsThisWeek ?? 0)} detail="Completed appointments" />
    </section>
    <section className="mt-14 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
      <article className="border border-[#ded5ca] bg-white px-8 py-9"><div className="flex items-end justify-between border-b border-[#e6ded4] pb-4"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#79243f]">Today</p><h2 className="mt-4 font-serif text-3xl text-[#28201b]">Appointments</h2></div><button type="button" onClick={() => setSection("appointments")} className="text-sm text-[#79243f]">View calendar →</button></div>{appointmentRows(false)}</article>
      <aside className="space-y-6"><article className="border border-[#ded5ca] bg-white p-8"><p className="text-xs font-bold uppercase tracking-[.22em] text-[#79243f]">Up next</p>{nextAppointment ? <><h2 className="mt-7 font-serif text-3xl text-[#28201b]">{nextAppointment.customer?.full_name ?? "Client"}</h2><p className="mt-3 text-sm text-[#816f63]">{nextAppointment.service?.service_name ?? "Service"} · {nextAppointment.service?.duration_minutes ?? "—"} min</p><button type="button" onClick={() => setSection("appointments")} className="mt-8 w-full border border-[#bfb2a6] px-5 py-4 text-sm font-bold text-[#211a16]">View appointment</button></> : <p className="mt-7 text-[#816f63]">No appointment is coming up today.</p>}</article><article className="border border-[#ded5ca] bg-white p-8"><p className="text-xs font-bold uppercase tracking-[.22em] text-[#79243f]">A moment between visits</p><h2 className="mt-7 font-serif text-3xl text-[#28201b]">{opening ? "Your next opening" : "Fully booked"}</h2>{opening ? <><p className="mt-6 font-serif text-3xl text-[#28201b]">{clock(opening.start)}–{clock(opening.end)}</p><p className="mt-2 text-sm text-[#816f63]">Perfect for a break or a walk-in.</p></> : <p className="mt-4 text-sm text-[#816f63]">There are no 30-minute gaps left today.</p>}</article></aside>
    </section>
  </>;

  const detailPage = (title: string, eyebrow: string, children: ReactNode) => <section><p className="text-xs font-bold uppercase tracking-[.22em] text-[#79243f]">{eyebrow}</p><h1 className="mt-5 font-serif text-5xl text-[#28201b]">{title}</h1><div className="mt-12">{children}</div></section>;
  const content = loading && !data ? <p className="text-[#816f63]">Loading your workspace…</p> : section === "overview" ? overview : section === "appointments" ? detailPage("Appointments", "Today’s diary", <article className="border border-[#ded5ca] bg-white px-8">{appointmentRows(true)}</article>) : section === "schedule" ? detailPage("My schedule", "Workday", <div className="space-y-6"><div className="grid gap-4 md:grid-cols-2"><SummaryCard label="Your booked time" value={`${((data?.metrics.bookedMinutes ?? 0) / 60).toFixed(1)} hrs`} detail={`${data?.metrics.appointments ?? 0} appointments today`} /><SummaryCard label="Breaks today" value={String(breaks.length)} detail={breaks.length ? breaks.map((item) => `${time(item.start_time)}–${time(item.end_time)}`).join(", ") : "No breaks planned"} /></div><article className="border border-[#ded5ca] bg-white p-7"><p className="text-xs font-bold uppercase tracking-[.22em] text-[#79243f]">Weekly hours</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{weeklySchedule.map((item) => <p key={item.schedule_id} className="text-sm text-[#75695f]">{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][item.days_of_week]} · {time(item.start_time)}–{time(item.end_time)}</p>)}{weeklySchedule.length === 0 && <p className="text-sm text-[#75695f]">No weekly schedule has been set yet.</p>}</div></article></div>) : section === "clients" ? detailPage("Clients", "Client history", <div className="grid gap-4 md:grid-cols-2">{clientHistory.map((client) => <article key={client.name} className="border border-[#ded5ca] bg-white p-6"><p className="font-serif text-2xl text-[#28201b]">{client.name}</p><p className="mt-2 text-sm text-[#816f63]">{client.appointments} visits · Last visit {client.lastVisit ?? "—"}</p><p className="mt-4 text-sm font-semibold text-[#79243f]">{kes(client.totalSpent)} spent</p></article>)}{clientHistory.length === 0 && <p className="text-[#75695f]">No client history yet.</p>}</div>) : detailPage("Settings", "Workspace", <article className="border border-[#ded5ca] bg-white p-7"><p className="text-sm text-[#816f63]">Barber</p><p className="mt-2 font-serif text-2xl text-[#28201b]">{profile?.full_name ?? "Barber"}</p><p className="mt-6 text-sm text-[#816f63]">Email</p><p className="mt-2 text-[#28201b]">{profile?.email ?? "—"}</p><p className="mt-6 text-sm text-[#816f63]">Specialty</p><p className="mt-2 text-[#28201b]">{profile?.specialty ?? "No specialty added yet."}</p></article>);

  return <main className="min-h-screen bg-[#f8f6f1] text-[#28201b]"><div className="flex min-h-screen"><aside className="hidden w-[324px] shrink-0 flex-col border-r border-[#ded5ca] bg-white px-6 py-10 lg:flex"><div><p className="font-serif text-[30px] leading-none text-[#79243f]">The Chair & Co.</p><p className="mt-3 text-xs uppercase tracking-[.17em] text-[#755d50]">Barber workspace</p></div><nav className="mt-14 space-y-2">{navItems.map((item) => <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`w-full px-5 py-5 text-left text-[15px] ${section === item.id ? "bg-[#f4e9ed] text-[#79243f]" : "text-[#78675b] hover:bg-[#faf7f4]"}`}>{item.label}</button>)}</nav><button type="button" onClick={() => void signOut()} className="mt-auto px-2 py-3 text-left text-sm text-[#79243f]">Sign out</button></aside><div className="min-w-0 flex-1"><header className="border-b border-[#ded5ca] bg-white px-5 py-5 lg:hidden"><p className="font-serif text-2xl text-[#79243f]">The Chair & Co.</p><nav className="mt-5 flex gap-2 overflow-x-auto">{navItems.map((item) => <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`whitespace-nowrap px-3 py-2 text-sm ${section === item.id ? "bg-[#f4e9ed] text-[#79243f]" : "text-[#78675b]"}`}>{item.label}</button>)}</nav></header><div className="px-6 py-12 sm:px-10 lg:px-[68px] lg:py-[60px]">{error && <p role="alert" className="mb-8 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}{content}</div></div></div></main>;
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <article className="min-h-[208px] border border-[#ded5ca] bg-white p-7"><p className="text-sm text-[#75695f]">{label}</p><p className="mt-8 font-serif text-[42px] leading-none text-[#17110e]">{value}</p><p className="mt-8 text-sm text-[#847367]">{detail}</p></article>; }

function AppointmentAction({ appointment, busy, update }: { appointment: Appointment; busy: boolean; update: (id: string, payload: Record<string, string>) => Promise<void> }) { if (appointment.status === "pending") return <button disabled={busy} onClick={() => void update(appointment.appointment_id, { status: "confirmed" })} className="border border-[#bfb2a6] px-3 py-2 text-xs font-bold disabled:opacity-50">Confirm</button>; if (appointment.status === "confirmed") return <button disabled={busy} onClick={() => void update(appointment.appointment_id, { status: "checked_in" })} className="border border-[#bfb2a6] px-3 py-2 text-xs font-bold disabled:opacity-50">Check in</button>; if (appointment.status === "checked_in") return <button disabled={busy} onClick={() => void update(appointment.appointment_id, { status: "completed", paymentStatus: "paid" })} className="border border-[#bfb2a6] px-3 py-2 text-xs font-bold disabled:opacity-50">Complete</button>; return <span className="text-xs text-[#816f63]">{status(appointment.status)}</span>; }

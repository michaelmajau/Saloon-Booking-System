import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { api } from "../../lib/api";
import type { WorkspaceContext } from "./AdminLayout";
import { AdminError } from "./components/AdminUI";
import AppointmentCalendar from "./components/AppointmentCalendar";
import { displayDate, salonDate, visibleBooking, weekDates } from "./dashboardData";
import type { Appointment, TeamMember } from "./dashboardData";

export default function AdminCalendar() {
  const { openBooking, revision } = useOutletContext<WorkspaceContext>();
  const [date, setDate] = useState(salonDate);
  const [weekly, setWeekly] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [result, setResult] = useState<{ key: string; rows: Appointment[]; error: boolean }>();
  const [retry, setRetry] = useState(0);
  const [service, setService] = useState("");
  const key = [date, weekly, revision, retry].join("/");
  const current = result?.key === key ? result : undefined;

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) };
    const first = weekly ? weekDates(date)[0] : date;
    const last = weekly ? weekDates(date)[6] : date;
    const query = weekly ? `from=${first}&to=${last}` : `date=${date}`;
    api<{ appointments: Appointment[] }>(`/admin/appointments?${query}`, options)
      .then(({ appointments }) => setResult({ key, rows: appointments.filter(visibleBooking), error: false }))
      .catch(() => { if (!controller.signal.aborted) setResult({ key, rows: [], error: true }); });
    api<{ staff: TeamMember[] }>("/admin/team", options).then(({ staff }) => setTeam(staff)).catch(() => {});
    return () => controller.abort();
  }, [date, key, weekly]);

  function move(direction: number) {
    const next = new Date(date + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + direction * (weekly ? 7 : 1));
    setDate(next.toISOString().slice(0, 10));
    setService("");
  }

  const services = [...new Set((current?.rows ?? []).map((row) => row.service?.service_name).filter(Boolean))];
  const rows = (current?.rows ?? []).filter((row) => !service || row.service?.service_name === service);
  return <>
    <header className="bk-page-heading"><div><h1>Calendar</h1><p>Coordinate your team, services and availability.</p></div><button type="button" className="admin-primary" onClick={() => openBooking(date)}><Plus size={17} />New appointment</button></header>
    <section className="bk-card bk-panel bk-calendar-page">
      <div className="bk-panel-header"><div className="bk-actions"><button type="button" className="admin-secondary" onClick={() => { setDate(salonDate()); setService(""); }}>Today</button><button type="button" className="admin-secondary" aria-label="Previous period" onClick={() => move(-1)}><ArrowLeft size={17} /></button><button type="button" className="admin-secondary" aria-label="Next period" onClick={() => move(1)}><ArrowRight size={17} /></button><h2>{displayDate(weekly ? weekDates(date)[0] : date, { weekday: "long", day: "numeric", month: "long" })}</h2></div>
      <div className="bk-segment" role="group" aria-label="Calendar view"><button type="button" aria-pressed={!weekly} onClick={() => { setWeekly(false); setService(""); }}>Day</button><button type="button" aria-pressed={weekly} onClick={() => { setWeekly(true); setService(""); }}>Week</button></div></div>
      <div className="bk-calendar-filters"><strong>{team.filter((member) => member.is_active).length} team members</strong><select aria-label="Filter by service" className="bk-field" value={service} onChange={(event) => setService(event.target.value)}><option value="">All services</option>{services.map((name) => <option key={name}>{name}</option>)}</select></div>
      {current?.error && <AdminError message="Unable to load appointments." onRetry={() => setRetry((value) => value + 1)} />}
      <AppointmentCalendar rows={rows} team={team} weekly={weekly && !!current && !current.error} message={!current ? "Loading appointments…" : current.error ? "Appointments unavailable." : !rows.length ? "No appointments scheduled." : undefined} />
    </section>
  </>;
}

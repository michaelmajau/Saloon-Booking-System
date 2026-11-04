import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHead } from "../components/StylistLayout";
import { AppointmentRow, useAppointmentActions } from "../components/appointments";
import { fmt, long, relative, today } from "../lib/dates";
import { appointments, getClient, getService, isActive } from "../lib/selectors";
import type { Appointment, Status } from "../lib/types";
import { STATUS_LABELS } from "../lib/types";
import { useStore } from "../store/StoreProvider";

type Range = "today" | "upcoming" | "past" | "all";
const RANGES: [Range, string][] = [["today", "Today"], ["upcoming", "Upcoming"], ["past", "Past"], ["all", "All"]];

export function AppointmentsPage() {
  const { db } = useStore();
  const [params] = useSearchParams();
  const initialRange = params.get("range"); // e.g. /staff/appointments?range=past
  const { openBooking } = useAppointmentActions();
  const [range, setRange] = useState<Range>(
    RANGES.some(([r]) => r === initialRange) ? (initialRange as Range) : "upcoming");
  const [status, setStatus] = useState<Status | "">("");
  const [query, setQuery] = useState("");

  const t = today();
  const q = query.trim().toLowerCase();
  let list = appointments(db, (a) => {
    if (range === "today" && a.date !== t) return false;
    if (range === "upcoming" && a.date < t) return false;
    if (range === "past" && a.date >= t) return false;
    if (status && a.status !== status) return false;
    if (q && !`${getClient(db, a.clientId).name} ${getService(db, a.serviceId).name}`.toLowerCase().includes(q)) return false;
    return true;
  });
  if (range === "past") list = list.reverse(); // most recent first

  const groups = new Map<string, Appointment[]>();
  for (const a of list) groups.set(a.date, [...(groups.get(a.date) ?? []), a]);

  const upcomingCount = appointments(db, (a) => a.date >= t && isActive(a)).length;

  return (
    <>
      <PageHead
        eyebrow="Appointments"
        title="Your bookings."
        lede={`${upcomingCount} upcoming booking${upcomingCount === 1 ? "" : "s"} on your books.`}
        actions={<button type="button" className="btn btn-primary" onClick={() => openBooking()}>+ New appointment</button>}
      />

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Show">
          {RANGES.map(([r, label]) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>{label}</button>
          ))}
        </div>
        <label className="sr-only" htmlFor="status">Status</label>
        <select className="input" id="status" style={{ width: "auto", minHeight: 46 }} value={status}
          onChange={(e) => setStatus(e.target.value as Status | "")}>
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABELS) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <div className="grow">
          <label className="sr-only" htmlFor="search">Search by client or service</label>
          <input className="input" id="search" type="search" placeholder="Search client or service" style={{ minHeight: 46 }}
            value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="card">
        {groups.size === 0 ? (
          <div className="empty"><strong>Nothing here</strong>No appointments match these filters.</div>
        ) : (
          [...groups].map(([date, items]) => (
            <section className="date-group" key={date} aria-label={long(date)}>
              <h3>
                {relative(date)}{" "}
                <span className="count">{fmt(date, { day: "numeric", month: "short" })} · {items.length} booking{items.length === 1 ? "" : "s"}</span>
              </h3>
              <ul className="appt-list">{items.map((a) => <AppointmentRow key={a.id} appt={a} />)}</ul>
            </section>
          ))
        )}
      </div>
    </>
  );
}

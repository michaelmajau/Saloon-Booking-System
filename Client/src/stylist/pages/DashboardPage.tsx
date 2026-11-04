import { PageHead } from "../components/StylistLayout";
import { AppointmentRow, useAppointmentActions } from "../components/appointments";
import { addDays, DAY_NAMES, nowMin, startOfWeek, toMin, toTime, today, weekday } from "../lib/dates";
import { mins, money } from "../lib/format";
import { appointments, dayAppts, gaps, getClient, getService, hoursFor, isActive } from "../lib/selectors";
import type { Appointment } from "../lib/types";
import { Link } from "react-router-dom";
import { useStore } from "../store/StoreProvider";
import { useNow } from "../lib/useNow";
import { useStylistFirstName } from "../components/StylistLayout";

function Stat({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      <span className="note">{note}</span>
    </div>
  );
}

export function DashboardPage() {
  const { db } = useStore();
  const { openDetails, openBooking } = useAppointmentActions();
  const firstName = useStylistFirstName();
  useNow(); // re-render every minute so "next opening" stays current

  const t = today();
  const todayAll = dayAppts(db, t, true);
  const todays = todayAll.filter(isActive);
  // The next client still to be seen today.
  const next: Appointment | undefined =
    todays.find((a) => a.status === "in-progress") ?? todays.find((a) => a.status === "confirmed" || a.status === "arrived");

  /* Greeting */
  const h = new Date().getHours();
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";

  /* Today's count vs the last day with bookings */
  let prevDate: string | null = null, prevCount = 0;
  for (let i = 1; i <= 14; i++) {
    const d = addDays(t, -i);
    const n = appointments(db, (a) => a.date === d && a.status !== "cancelled").length;
    if (n) { prevDate = d; prevCount = n; break; }
  }
  const diff = todays.length - prevCount;
  const dayWord = prevDate === addDays(t, -1) ? "yesterday" : prevDate ? DAY_NAMES[weekday(prevDate)] : "";
  const countNote = !prevDate ? "Your first booked day"
    : diff > 0 ? `${diff} more than ${dayWord}` : diff < 0 ? `${-diff} fewer than ${dayWord}` : `Same as ${dayWord}`;

  /* Booked hours today + how full the week is */
  const minutes = todays.reduce((sum, a) => sum + getService(db, a.serviceId).duration, 0);
  const hrs = minutes / 60;
  const hoursText = `${Number.isInteger(hrs) ? hrs : hrs.toFixed(1)} ${hrs === 1 ? "hr" : "hrs"}`;
  const ws = startOfWeek(t);
  let weekBooked = 0, weekOpen = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    const wh = hoursFor(db, d);
    if (wh) weekOpen += toMin(wh.end) - toMin(wh.start);
    weekBooked += dayAppts(db, d).reduce((sum, a) => sum + getService(db, a.serviceId).duration, 0);
  }
  const util = weekOpen ? weekBooked / weekOpen : 0;
  const hoursNote = util >= 0.5 ? "On track for this week" : util >= 0.25 ? "Room for walk-ins this week" : "A quiet week so far";

  /* Tips over the last 7 days */
  const from = addDays(t, -6);
  const tips = appointments(db, (a) => a.status === "completed" && a.date >= from && a.date <= t)
    .reduce((sum, a) => sum + (a.tip || 0), 0);
  const tipNote = tips >= 80 ? "Excellent" : tips >= 40 ? "Looking good" : tips > 0 ? "Building nicely" : "None yet this week";

  /* Next free gap (at least an hour if possible) */
  const now = Math.ceil(nowMin() / 15) * 15;
  const free = gaps(db, t).map(([s, e]) => [Math.max(s, now), e] as [number, number]).filter(([s, e]) => e - s >= 30);
  const gap = free.find(([s, e]) => e - s >= 60) ?? free[0];

  return (
    <>
      <PageHead
        eyebrow="Stylist dashboard"
        title={firstName ? `Good ${part}, ${firstName}.` : `Good ${part}.`}
        lede="A considered schedule for a beautiful day."
        actions={<button type="button" className="btn btn-primary" onClick={() => openBooking()}>+ New appointment</button>}
      />

      <section className="stats" aria-label="Today at a glance">
        <Stat label="Today’s appointments" value={todays.length} note={countNote} />
        <Stat label="Booked hours" value={hoursText} note={hoursNote} />
        <Stat label="Next appointment" value={next ? next.start : "—"} note={next ? getClient(db, next.clientId).name : "All done for today"} />
        <Stat label="Tips this week" value={money(tips)} note={tipNote} />
      </section>

      <section className="grid-2">
        <div className="card">
          <p className="eyebrow">Today</p>
          <div className="card-title-row">
            <h2>Appointments</h2>
            <Link className="link" to="/staff/schedule">View calendar &rarr;</Link>
          </div>
          <ul className="appt-list">
            {todayAll.length
              ? todayAll.map((a) => <AppointmentRow key={a.id} appt={a} highlight={next?.id === a.id} />)
              : <li className="empty"><strong>No appointments today</strong>Enjoy the space — or add a walk-in.</li>}
          </ul>
        </div>

        <div className="stack">
          <div className="card up-next">
            {next ? <>
              <p className="eyebrow">{next.status === "in-progress" ? "In the chair" : "Up next"}</p>
              <h3 className="card-heading">{getClient(db, next.clientId).name}</h3>
              <p className="meta">{getService(db, next.serviceId).name} · {mins(getService(db, next.serviceId).duration)} · {next.start}</p>
              <button type="button" className="btn btn-outline btn-block" onClick={() => openDetails(next.id)}>View appointment</button>
            </> : <>
              <p className="eyebrow">Up next</p>
              <h3 className="card-heading">You’re all done.</h3>
              <p className="meta">No more clients today.</p>
              <Link className="btn btn-outline btn-block" to="/staff/appointments">See upcoming</Link>
            </>}
          </div>

          <div className="card opening">
            <p className="eyebrow">A moment between visits</p>
            {gap ? <>
              <h3>Your next opening</h3>
              <p className="range">{toTime(gap[0])}–{toTime(gap[1])}</p>
              <p className="muted">Perfect for a break or a walk-in.</p>
              <button type="button" className="btn btn-ghost" style={{ margin: "14px 0 0 -12px" }}
                onClick={() => openBooking({ start: toTime(gap[0]) })}>+ Book a walk-in</button>
            </> : <>
              <h3>Fully booked</h3>
              <p className="muted">No free time left today — well done.</p>
            </>}
          </div>
        </div>
      </section>
    </>
  );
}

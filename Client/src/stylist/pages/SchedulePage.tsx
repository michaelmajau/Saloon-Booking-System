import { useState, type FormEvent, type MouseEvent } from "react";
import { PageHead } from "../components/StylistLayout";
import { Modal } from "../components/Modal";
import { useAppointmentActions } from "../components/appointments";
import { addDays, fmt, long, nowMin, startOfWeek, toMin, toTime, today } from "../lib/dates";
import { apptEnd, dayAppts, getClient, getService, hoursFor } from "../lib/selectors";
import { STATUS_LABELS, type Block } from "../lib/types";
import { useNow } from "../lib/useNow";
import { useStore } from "../store/StoreProvider";
import { useUI } from "../store/UIProvider";

const DAY_START = 8 * 60; // calendar starts 08:00
const DAY_END = 20 * 60; // and ends 20:00
const PX_PER_MIN = 1; // 60px per hour
const HEIGHT = (DAY_END - DAY_START) * PX_PER_MIN;
const y = (min: number) => (min - DAY_START) * PX_PER_MIN;
const QUARTERS = Array.from({ length: (DAY_END - DAY_START) / 15 + 1 }, (_, i) => toTime(DAY_START + i * 15));

export function SchedulePage() {
  const store = useStore();
  const { db } = store;
  const ui = useUI();
  const { openDetails, openBooking } = useAppointmentActions();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today()));
  useNow(); // keep the "now" line moving

  const t = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const upcomingBlocks = db.blocks.filter((b) => b.date >= t).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

  function onColumnClick(e: MouseEvent<HTMLDivElement>, date: string) {
    if ((e.target as HTMLElement).closest(".cal-event")) return;
    if (date < t) return ui.toast("That day has passed — pick a day from today onwards.");
    const rect = e.currentTarget.getBoundingClientRect();
    const min = Math.floor((e.clientY - rect.top) / PX_PER_MIN / 15) * 15 + DAY_START;
    openBooking({ date, start: toTime(Math.min(min, DAY_END - 30)) });
  }

  async function removeBlock(b: Block) {
    if (await ui.confirm(`Remove “${b.reason}” on ${fmt(b.date)} (${b.start}–${b.end})?`, { title: "Remove blocked time", ok: "Remove", danger: true })) {
      store.removeBlock(b.id);
      ui.toast("Blocked time removed.", () => store.addBlock(b));
    }
  }

  const openBlockForm = () =>
    ui.openModal((close) => <BlockForm close={close} onSaved={(date) => setWeekStart(startOfWeek(date))} />);

  return (
    <>
      <PageHead
        eyebrow="My schedule"
        title="Your week."
        lede="Click an empty slot to book it, or an appointment to open it."
        actions={<>
          <button type="button" className="btn btn-outline" onClick={openBlockForm}>Block time</button>
          <button type="button" className="btn btn-primary" onClick={() => openBooking()}>+ New appointment</button>
        </>}
      />

      <div className="week-head">
        <h2>{fmt(weekStart, { day: "numeric", month: "short" })} – {fmt(days[6], { day: "numeric", month: "short", year: "numeric" })}</h2>
        <div className="week-nav">
          <button type="button" className="btn btn-outline" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}>&larr;</button>
          <button type="button" className="btn btn-outline" onClick={() => setWeekStart(startOfWeek(t))}>This week</button>
          <button type="button" className="btn btn-outline" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}>&rarr;</button>
        </div>
      </div>

      <div className="calendar">
        <div className="cal-grid">
          <div className="cal-corner" />
          {days.map((d) => {
            const h = hoursFor(db, d);
            return (
              <div key={d} className={`cal-day-head${d === t ? " is-today" : ""}`}>
                <div className="dow">{fmt(d, { weekday: "short" })}</div>
                <div className="dnum">{fmt(d, { day: "numeric" })}</div>
                <div className="hours">{h ? `${h.start}–${h.end}` : "Day off"}</div>
              </div>
            );
          })}

          <div className="cal-times" style={{ height: HEIGHT }}>
            {Array.from({ length: (DAY_END - DAY_START) / 60 - 1 }, (_, i) => DAY_START + (i + 1) * 60).map((m) => (
              <span key={m} style={{ top: y(m) }}>{toTime(m)}</span>
            ))}
          </div>

          {days.map((d) => {
            const h = hoursFor(db, d);
            const s = h ? toMin(h.start) : 0, e = h ? toMin(h.end) : 0;
            return (
              <div key={d} className={`cal-col${d === t ? " is-today" : ""}`} style={{ height: HEIGHT }}
                title="Click to book" onClick={(ev) => onColumnClick(ev, d)}>
                {!h && <div className="off" style={{ top: 0, height: HEIGHT }} />}
                {h && s > DAY_START && <div className="off" style={{ top: 0, height: y(s) }} />}
                {h && e < DAY_END && <div className="off" style={{ top: y(e), height: HEIGHT - y(e) }} />}
                {d === t && nowMin() > DAY_START && nowMin() < DAY_END && <div className="cal-now" style={{ top: y(nowMin()) }} />}

                {dayAppts(db, d).map((a) => {
                  const c = getClient(db, a.clientId), sv = getService(db, a.serviceId);
                  return (
                    <button key={a.id} type="button" className={`cal-event ${a.status}${sv.duration < 45 ? " short" : ""}`}
                      style={{ top: y(toMin(a.start)), height: sv.duration * PX_PER_MIN - 2 }}
                      aria-label={`${c.name}, ${sv.name}, ${a.start} to ${apptEnd(db, a)}, ${STATUS_LABELS[a.status]}`}
                      onClick={() => openDetails(a.id)}>
                      <strong>{c.name}</strong><span>{a.start} · {sv.name}</span>
                    </button>
                  );
                })}

                {db.blocks.filter((b) => b.date === d).map((b) => (
                  <button key={b.id} type="button" className="cal-event block"
                    style={{ top: y(toMin(b.start)), height: (toMin(b.end) - toMin(b.start)) * PX_PER_MIN - 2 }}
                    aria-label={`Blocked: ${b.reason}, ${b.start} to ${b.end}`} onClick={() => removeBlock(b)}>
                    <strong>{b.reason}</strong><span>{b.start}–{b.end}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="legend" aria-hidden="true">
        <span><i style={{ borderColor: "var(--burgundy)", background: "var(--blush)" }} />Confirmed</span>
        <span><i style={{ borderColor: "var(--warn)", background: "var(--warn-bg)" }} />Arrived</span>
        <span><i style={{ borderColor: "var(--info)", background: "var(--info-bg)" }} />In chair</span>
        <span><i style={{ borderColor: "var(--ok)", background: "var(--ok-bg)" }} />Completed</span>
        <span><i style={{ borderColor: "var(--soft)", background: "#ece8e2" }} />Blocked</span>
      </div>

      <div className="card" style={{ marginTop: 40 }}>
        <p className="eyebrow">Time away</p>
        <div className="card-title-row"><h2>Blocked time</h2></div>
        <ul className="block-list">
          {upcomingBlocks.length ? upcomingBlocks.map((b) => (
            <li key={b.id}>
              <div><strong>{b.reason}</strong><div className="muted small">{long(b.date)} · {b.start}–{b.end}</div></div>
              <button type="button" className="btn btn-ghost" onClick={() => removeBlock(b)}>Remove</button>
            </li>
          )) : <li className="muted">No time blocked out. Use “Block time” for breaks, training or holidays.</li>}
        </ul>
      </div>
    </>
  );
}

function BlockForm({ close, onSaved }: { close: () => void; onSaved: (date: string) => void }) {
  const store = useStore();
  const ui = useUI();
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(today());
  const [start, setStart] = useState("13:00");
  const [end, setEnd] = useState("14:00");
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!date) return setError("Pick a date.");
    if (toMin(end) <= toMin(start)) return setError("The end time must be after the start time.");
    const clash = dayAppts(store.db, date).find((a) => toMin(a.start) < toMin(end) && toMin(apptEnd(store.db, a)) > toMin(start));
    if (clash) return setError(`${getClient(store.db, clash.clientId).name} is booked at ${clash.start}. Move that appointment first.`);
    const label = reason.trim() || "Blocked";
    store.addBlock({ date, start, end, reason: label });
    onSaved(date);
    close();
    ui.toast(`${label} blocked on ${fmt(date)}.`);
  }

  return (
    <Modal title="Block time" onClose={close} footer={<>
      <button type="button" className="btn btn-outline" onClick={close}>Cancel</button>
      <button type="submit" form="block-form" className="btn btn-primary">Block time</button>
    </>}>
      <form id="block-form" noValidate onSubmit={submit}>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="field">
          <label htmlFor="bl-reason">Reason</label>
          <input className="input" id="bl-reason" placeholder="Lunch, training, appointment…" maxLength={60}
            value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="bl-date">Date</label>
          <input className="input" id="bl-date" type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="bl-start">From</label>
            <select className="input" id="bl-start" value={start} onChange={(e) => setStart(e.target.value)}>
              {QUARTERS.map((q) => <option key={q}>{q}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="bl-end">To</label>
            <select className="input" id="bl-end" value={end} onChange={(e) => setEnd(e.target.value)}>
              {QUARTERS.map((q) => <option key={q}>{q}</option>)}
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
}

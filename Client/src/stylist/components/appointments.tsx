/**
 * Everything to do with a single appointment: status pill, row, ••• menu,
 * details dialog, booking form, complete-and-tip form and the status actions.
 */
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useStore } from "../store/StoreProvider";
import { useUI } from "../store/UIProvider";
import { Modal } from "./Modal";
import { DAY_NAMES, fmt, long, nowMin, toMin, toTime, today, weekday } from "../lib/dates";
import { initial, mins, money } from "../lib/format";
import { apptEnd, conflict, getClient, getService, hoursFor, isActive } from "../lib/selectors";
import { STATUS_LABELS, type Appointment, type Database, type Status } from "../lib/types";

/* ---------- Status actions ---------- */
type ActionKey = "arrive" | "start" | "complete" | "reschedule" | "restore" | "noshow" | "cancel";

const ACTIONS: Record<ActionKey, { label: string; from: Status[]; danger?: boolean }> = {
  arrive: { label: "Mark as arrived", from: ["confirmed"] },
  start: { label: "Start service", from: ["arrived"] },
  complete: { label: "Complete & add tip", from: ["arrived", "in-progress"] },
  reschedule: { label: "Edit / reschedule", from: ["confirmed", "arrived"] },
  restore: { label: "Rebook this slot", from: ["cancelled", "no-show"] },
  noshow: { label: "Mark as no-show", from: ["confirmed"], danger: true },
  cancel: { label: "Cancel appointment", from: ["confirmed", "arrived"], danger: true },
};

export const allowedActions = (a: Appointment) =>
  (Object.keys(ACTIONS) as ActionKey[]).filter((k) => ACTIONS[k].from.includes(a.status));

export function StatusPill({ status }: { status: Status }) {
  return <span className={`pill ${status}`}>{STATUS_LABELS[status]}</span>;
}

export interface BookingOptions { apptId?: string; date?: string; start?: string; clientId?: string }

/** Hook that opens the appointment dialogs and runs status changes. */
export function useAppointmentActions() {
  const store = useStore();
  const ui = useUI();
  const { db } = store;

  const openDetails = (id: string) => ui.openModal((close) => <AppointmentDetails id={id} close={close} />);
  const openBooking = (opts: BookingOptions = {}) => ui.openModal((close) => <BookingForm {...opts} close={close} />);
  const openComplete = (id: string) => ui.openModal((close) => <CompleteForm id={id} close={close} />);

  function setStatus(a: Appointment, status: Status, message: string) {
    const before = a.status;
    store.updateAppt(a.id, { status });
    ui.toast(message, () => store.updateAppt(a.id, { status: before }));
  }

  async function run(action: ActionKey, id: string) {
    const a = db.appointments.find((x) => x.id === id);
    if (!a) return;
    const c = getClient(db, a.clientId);
    switch (action) {
      case "arrive": return setStatus(a, "arrived", `${c.name} has arrived.`);
      case "start": return setStatus(a, "in-progress", `${c.name} is in the chair.`);
      case "complete": return openComplete(id);
      case "reschedule": return openBooking({ apptId: id });
      case "restore":
        if (conflict(db, a.date, a.start, getService(db, a.serviceId).duration, a.id)) {
          ui.toast("That slot has been taken — pick a new time.");
          return openBooking({ apptId: id });
        }
        return setStatus(a, "confirmed", `${c.name}'s booking is back on.`);
      case "noshow":
        if (await ui.confirm(`Mark ${c.name} as a no-show for ${a.start}?`, { title: "Mark no-show", ok: "Mark no-show", danger: true }))
          setStatus(a, "no-show", `${c.name} marked as no-show.`);
        return;
      case "cancel":
        if (await ui.confirm(`This frees up ${a.start}–${apptEnd(db, a)} on ${a.date === today() ? "today" : fmt(a.date)}.`,
          { title: `Cancel ${c.name}'s appointment?`, ok: "Cancel appointment", danger: true }))
          setStatus(a, "cancelled", "Appointment cancelled.");
        return;
    }
  }

  return { run, openDetails, openBooking };
}

/* ---------- ••• menu ---------- */
function ActionMenu({ appt, clientName }: { appt: Appointment; clientName: string }) {
  const { run, openDetails } = useAppointmentActions();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current || !menu.current) return;
    const r = btn.current.getBoundingClientRect();
    const w = menu.current.offsetWidth, h = menu.current.offsetHeight;
    const top = r.bottom + h + 12 > window.innerHeight ? r.top - h - 6 : r.bottom + 6;
    setPos({ top, left: Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) });
    menu.current.querySelector("button")?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); btn.current?.focus(); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = [...(menu.current?.querySelectorAll("button") ?? [])];
        const i = items.indexOf(document.activeElement as HTMLButtonElement);
        items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
        e.preventDefault();
      }
    };
    const shut = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", shut);
    window.addEventListener("scroll", shut, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", shut);
      window.removeEventListener("scroll", shut, true);
    };
  }, [open]);

  const acts = allowedActions(appt);
  const normal = acts.filter((k) => !ACTIONS[k].danger);
  const danger = acts.filter((k) => ACTIONS[k].danger);
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };

  return (
    <>
      <button ref={btn} type="button" className="icon-btn menu-btn" aria-haspopup="menu" aria-expanded={open}
        aria-label={`Actions for ${clientName} at ${appt.start}`} onClick={() => setOpen((o) => !o)}>
        &middot;&middot;&middot;
      </button>
      {open && (
        <div ref={menu} className="menu" role="menu" style={{ position: "fixed", top: pos.top, left: pos.left }}>
          <button type="button" role="menuitem" onClick={pick(() => openDetails(appt.id))}>View details</button>
          {normal.map((k) => (
            <button key={k} type="button" role="menuitem" onClick={pick(() => run(k, appt.id))}>{ACTIONS[k].label}</button>
          ))}
          {danger.length > 0 && <hr />}
          {danger.map((k) => (
            <button key={k} type="button" role="menuitem" className="danger" onClick={pick(() => run(k, appt.id))}>{ACTIONS[k].label}</button>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- Row ---------- */
export function AppointmentRow({ appt, highlight }: { appt: Appointment; highlight?: boolean }) {
  const { db } = useStore();
  const { openDetails } = useAppointmentActions();
  const c = getClient(db, appt.clientId);
  const s = getService(db, appt.serviceId);
  return (
    <li className={`appt-row${isActive(appt) ? "" : " is-dim"}${highlight ? " is-next" : ""}`}>
      <span className="time">{appt.start}</span>
      <span className="avatar" aria-hidden="true">{initial(c.name)}</span>
      <div className="who">
        <button type="button" className="name" onClick={() => openDetails(appt.id)}>{c.name}</button>
        <div className="sub"><StatusPill status={appt.status} /></div>
      </div>
      <div className="what">
        <div className="appt-service">{s.name}</div>
        <div className="sub">{mins(s.duration)} · {appt.start}–{apptEnd(db, appt)}</div>
      </div>
      <ActionMenu appt={appt} clientName={c.name} />
    </li>
  );
}

/* ---------- Details dialog ---------- */
function AppointmentDetails({ id, close }: { id: string; close: () => void }) {
  const { db } = useStore();
  const { run } = useAppointmentActions();
  const a = db.appointments.find((x) => x.id === id);
  if (!a) return null;
  const c = getClient(db, a.clientId), s = getService(db, a.serviceId);
  const acts = allowedActions(a);
  const primary = (["arrive", "start", "complete", "restore"] as ActionKey[]).find((k) => acts.includes(k));
  const secondary = acts.filter((k) => k !== primary);
  const go = (k: ActionKey) => () => { close(); run(k, id); };

  return (
    <Modal title="Appointment" onClose={close} width={600} footer={<>
      {secondary.map((k) => (
        <button key={k} type="button" className={`btn ${ACTIONS[k].danger ? "btn-danger" : "btn-outline"}`} onClick={go(k)}>{ACTIONS[k].label}</button>
      ))}
      {primary
        ? <button type="button" className="btn btn-primary" onClick={go(primary)}>{ACTIONS[primary].label}</button>
        : <button type="button" className="btn btn-primary" onClick={close}>Done</button>}
    </>}>
      <div className="detail-head">
        <span className="avatar lg" aria-hidden="true">{initial(c.name)}</span>
        <div>
          <h3>{c.name}</h3>
          <div className="muted small">{c.phone}{c.email ? ` · ${c.email}` : ""}</div>
        </div>
      </div>
      <dl className="detail-list">
        <dt>Status</dt><dd><StatusPill status={a.status} /></dd>
        <dt>Service</dt><dd>{s.name} · {money(s.price)}</dd>
        <dt>When</dt><dd>{long(a.date)}<br />{a.start}–{apptEnd(db, a)} ({mins(s.duration)})</dd>
        {a.status === "completed" && <><dt>Tip</dt><dd>{a.tip ? money(a.tip) : "None"}</dd></>}
        <dt>Booking notes</dt><dd>{a.notes || <span className="muted">—</span>}</dd>
        <dt>Client notes</dt><dd>{c.notes || <span className="muted">—</span>}</dd>
      </dl>
    </Modal>
  );
}

/* ---------- Complete + tip ---------- */
function CompleteForm({ id, close }: { id: string; close: () => void }) {
  const store = useStore();
  const ui = useUI();
  const a = store.db.appointments.find((x) => x.id === id)!;
  const c = getClient(store.db, a.clientId), s = getService(store.db, a.serviceId);
  const [tip, setTip] = useState("");
  const [notes, setNotes] = useState(c.notes);
  const [bad, setBad] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = tip === "" ? 0 : Number(tip);
    if (!(value >= 0)) return setBad(true);
    store.updateClient(c.id, { notes: notes.trim() });
    store.updateAppt(id, { status: "completed", tip: value });
    close();
    ui.toast(`${c.name} completed${value ? ` · ${money(value)} tip` : ""}.`);
  }

  return (
    <Modal title="Complete appointment" onClose={close} footer={<>
      <button type="button" className="btn btn-outline" onClick={close}>Not yet</button>
      <button type="submit" form="complete-form" className="btn btn-primary">Mark completed</button>
    </>}>
      <p className="muted" style={{ marginBottom: 20 }}>{c.name} · {s.name} · {money(s.price)}</p>
      <form id="complete-form" noValidate onSubmit={submit}>
        <div className="field">
          <label htmlFor="tip">Tip received (£)</label>
          <input className="input" id="tip" type="number" min="0" step="0.5" inputMode="decimal" placeholder="0"
            value={tip} aria-invalid={bad || undefined} onChange={(e) => { setTip(e.target.value); setBad(false); }} />
          <span className="hint">Leave empty if there was no tip.</span>
        </div>
        <div className="field">
          <label htmlFor="cnotes">Update client notes</label>
          <textarea className="input" id="cnotes" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Formula, products used, what to try next time" />
        </div>
      </form>
    </Modal>
  );
}

/* ---------- New / edit appointment ---------- */
const TIME_OPTIONS = Array.from({ length: (20 * 60 - 8 * 60) / 15 + 1 }, (_, i) => toTime(8 * 60 + i * 15));

/** First free 15-minute slot on a date (from now, if it's today). */
function nextFreeTime(db: Database, date: string) {
  const h = hoursFor(db, date) ?? { start: "09:00", end: "19:00" };
  let m = toMin(h.start);
  if (date === today()) m = Math.max(m, Math.ceil(nowMin() / 15) * 15);
  for (; m + 30 <= toMin(h.end); m += 15) if (!conflict(db, date, toTime(m), 30)) return toTime(m);
  return h.start;
}

function BookingForm({ apptId, date, start, clientId, close }: BookingOptions & { close: () => void }) {
  const store = useStore();
  const ui = useUI();
  const { db } = store;
  const editing = apptId ? db.appointments.find((a) => a.id === apptId) : undefined;
  const initialDate = editing?.date ?? date ?? today();

  const [client, setClient] = useState(editing?.clientId ?? clientId ?? "");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [serviceId, setServiceId] = useState(editing?.serviceId ?? "s4");
  const [day, setDay] = useState(initialDate);
  const [time, setTime] = useState(() => editing?.start ?? start ?? nextFreeTime(db, initialDate));
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [error, setError] = useState<{ field: string; text: string } | null>(null);
  const [warning, setWarning] = useState("");

  const service = getService(db, serviceId);
  const end = toTime(toMin(time) + service.duration);
  const clients = [...db.clients].sort((a, b) => a.name.localeCompare(b.name));
  const clearMessages = () => { setError(null); setWarning(""); };

  useEffect(() => {
    if (error) document.getElementById(error.field)?.focus();
  }, [error]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const fail = (field: string, text: string) => { setWarning(""); setError({ field, text }); };

    if (!client) return fail("b-client", "Choose a client.");
    if (client === "__new" && !newName.trim()) return fail("b-name", "Enter the new client's name.");
    if (!day) return fail("b-date", "Pick a date.");
    if (!editing && day < today()) return fail("b-date", "That date has already passed.");

    // Double booking is never allowed.
    const clash = conflict(db, day, time, service.duration, editing?.id);
    if (clash) {
      const what = clash.type === "appointment"
        ? `${getClient(db, clash.item.clientId).name} (${clash.item.start}–${apptEnd(db, clash.item)})`
        : `blocked time: ${clash.item.reason} (${clash.item.start}–${clash.item.end})`;
      return fail("b-time", `That overlaps with ${what}.`);
    }

    // Outside working hours is allowed, but warn first.
    const hrs = hoursFor(db, day);
    const s = toMin(time), e2 = s + service.duration;
    const outside = !hrs || s < toMin(hrs.start) || e2 > toMin(hrs.end);
    if (outside && !warning) {
      setError(null);
      setWarning(hrs ? `This runs outside your hours (${hrs.start}–${hrs.end}). Book it anyway?`
        : `${DAY_NAMES[weekday(day)]} is your day off. Book it anyway?`);
      return;
    }

    let cid = client;
    let clientName: string;
    if (client === "__new") {
      const c = store.addClient({ name: newName.trim(), phone: newPhone.trim() });
      cid = c.id;
      clientName = c.name;
    } else {
      clientName = getClient(db, client).name;
    }

    const data = { clientId: cid, serviceId, date: day, start: time, notes: notes.trim() };
    if (editing) {
      store.updateAppt(editing.id, { ...data, status: isActive(editing) ? editing.status : "confirmed" });
      ui.toast(`${clientName} moved to ${fmt(day)}, ${time}.`);
    } else {
      const a = store.addAppt(data);
      ui.toast(`${clientName} booked for ${fmt(day)}, ${time}.`, () => store.updateAppt(a.id, { status: "cancelled" }));
    }
    close();
  }

  return (
    <Modal title={editing ? "Edit appointment" : "New appointment"} onClose={close} width={600} footer={<>
      <button type="button" className="btn btn-outline" onClick={close}>Cancel</button>
      <button type="submit" form="booking-form" className="btn btn-primary">
        {warning ? "Book anyway" : editing ? "Save changes" : "Book appointment"}
      </button>
    </>}>
      <form id="booking-form" noValidate onSubmit={submit}>
        {error && <div className="form-error" role="alert">{error.text}</div>}
        {warning && <div className="form-warn" role="alert">{warning}</div>}

        <div className="field">
          <label htmlFor="b-client">Client</label>
          <select className="input" id="b-client" value={client} disabled={!!editing}
            aria-invalid={error?.field === "b-client" || undefined}
            onChange={(e) => { setClient(e.target.value); clearMessages(); }}>
            <option value="" disabled>Choose a client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="__new">+ New client</option>
          </select>
        </div>

        {client === "__new" && (
          <div className="field-row">
            <div className="field">
              <label htmlFor="b-name">Client name</label>
              <input className="input" id="b-name" autoComplete="off" autoFocus value={newName}
                aria-invalid={error?.field === "b-name" || undefined} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="b-phone">Phone</label>
              <input className="input" id="b-phone" type="tel" autoComplete="off" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="b-service">Service</label>
          <select className="input" id="b-service" value={serviceId} onChange={(e) => { setServiceId(e.target.value); clearMessages(); }}>
            {db.services.map((s) => <option key={s.id} value={s.id}>{s.name} — {mins(s.duration)}, {money(s.price)}</option>)}
          </select>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="b-date">Date</label>
            <input className="input" id="b-date" type="date" value={day} min={editing ? undefined : today()}
              aria-invalid={error?.field === "b-date" || undefined} onChange={(e) => { setDay(e.target.value); clearMessages(); }} />
          </div>
          <div className="field">
            <label htmlFor="b-time">Start time</label>
            <select className="input" id="b-time" value={time} aria-invalid={error?.field === "b-time" || undefined}
              onChange={(e) => { setTime(e.target.value); clearMessages(); }}>
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="summary-line">
          <span>{day ? fmt(day) : "—"} · {time}–{end}</span>
          <strong>{money(service.price)}</strong>
        </div>

        <div className="field">
          <label htmlFor="b-notes">Notes <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <textarea className="input" id="b-notes" placeholder="Anything to prepare?" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </form>
    </Modal>
  );
}


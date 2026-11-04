import { useState, type FormEvent } from "react";
import { PageHead } from "../components/StylistLayout";
import { DAY_NAMES, toMin, toTime } from "../lib/dates";
import { isEmail } from "../lib/format";
import type { Prefs, WeekHours } from "../lib/types";
import { supabase } from "../../lib/supabase";
import { useStore } from "../store/StoreProvider";
import { useUI } from "../store/UIProvider";

const ORDER = ["1", "2", "3", "4", "5", "6", "0"]; // Monday first
const HALF_HOURS = Array.from({ length: 33 }, (_, i) => toTime(6 * 60 + i * 30)); // 06:00–22:00

const PREFS: [keyof Prefs, string, string][] = [
  ["newBooking", "New bookings", "When a client books with you online."],
  ["cancellations", "Cancellations", "When a client cancels or moves a booking."],
  ["reminders", "Morning reminder", "Your first appointment, 30 minutes before."],
  ["dailySummary", "Daily summary", "Tomorrow's bookings, sent at 6pm."],
];

export function SettingsPage() {
  const store = useStore();
  const ui = useUI();
  const [version, setVersion] = useState(0); // bumps after a reset so the forms reload

  async function reset() {
    if (await ui.confirm("All clients, appointments and settings go back to the sample data.", { title: "Reset sample data?", ok: "Reset", danger: true })) {
      store.reset();
      setVersion((v) => v + 1);
      ui.toast("Sample data restored.");
    }
  }

  return (
    <>
      <PageHead eyebrow="Settings" title="Your workspace." lede="Profile, working hours and how we keep you posted." />
      <div className="settings-grid" key={version}>
        <ProfileForm />
        <HoursForm />
        <Notifications />
        <PasswordForm />
        <div className="card">
          <h2>Demo data</h2>
          <p className="muted">Put back the original sample clients and appointments. Your changes will be lost.</p>
          <button type="button" className="btn btn-danger" onClick={reset}>Reset sample data</button>
        </div>
      </div>
    </>
  );
}

function ProfileForm() {
  const store = useStore();
  const ui = useUI();
  const s = store.db.stylist;
  const [form, setForm] = useState({ firstName: s.firstName, lastName: s.lastName, email: s.email, phone: s.phone, bio: s.bio });
  const [error, setError] = useState<{ field: string; text: string } | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim()) { setError({ field: "p-first", text: "Enter your first name." }); return document.getElementById("p-first")?.focus(); }
    if (!isEmail(form.email)) { setError({ field: "p-email", text: "Enter a valid email address." }); return document.getElementById("p-email")?.focus(); }
    setError(null);
    store.updateStylist({
      firstName: form.firstName.trim(), lastName: form.lastName.trim(),
      email: form.email.trim(), phone: form.phone.trim(), bio: form.bio.trim(),
    });
    ui.toast("Profile saved.");
  }

  return (
    <form className="card" noValidate onSubmit={submit}>
      <h2>Profile</h2>
      <p className="muted">Clients see your first name and bio when they book. (Saved on this device until the API is connected.)</p>
      {error && <div className="form-error" role="alert">{error.text}</div>}
      <div className="field-row">
        <div className="field"><label htmlFor="p-first">First name</label>
          <input className="input" id="p-first" autoComplete="given-name" value={form.firstName} onChange={set("firstName")}
            aria-invalid={error?.field === "p-first" || undefined} /></div>
        <div className="field"><label htmlFor="p-last">Last name</label>
          <input className="input" id="p-last" autoComplete="family-name" value={form.lastName} onChange={set("lastName")} /></div>
      </div>
      <div className="field-row">
        <div className="field"><label htmlFor="p-email">Email</label>
          <input className="input" id="p-email" type="email" autoComplete="email" value={form.email} onChange={set("email")}
            aria-invalid={error?.field === "p-email" || undefined} /></div>
        <div className="field"><label htmlFor="p-phone">Phone</label>
          <input className="input" id="p-phone" type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} /></div>
      </div>
      <div className="field"><label htmlFor="p-bio">Bio</label>
        <textarea className="input" id="p-bio" maxLength={200} value={form.bio} onChange={set("bio")} />
        <span className="hint">{form.bio.length}/200</span></div>
      <button type="submit" className="btn btn-primary">Save profile</button>
    </form>
  );
}

function HoursForm() {
  const store = useStore();
  const ui = useUI();
  // Keep each day's times even while the day is switched off.
  const [rows, setRows] = useState(() => Object.fromEntries(ORDER.map((d) => {
    const h = store.db.hours[d];
    return [d, { on: !!h, start: h?.start ?? "09:00", end: h?.end ?? "17:00" }];
  })));
  const [error, setError] = useState("");
  const update = (d: string, patch: Partial<(typeof rows)[string]>) => setRows({ ...rows, [d]: { ...rows[d], ...patch } });

  function submit(e: FormEvent) {
    e.preventDefault();
    const hours: WeekHours = {};
    for (const d of ORDER) {
      const r = rows[d];
      if (r.on && toMin(r.end) <= toMin(r.start)) return setError(`${DAY_NAMES[Number(d)]}: finish time must be after start time.`);
      hours[d] = r.on ? { start: r.start, end: r.end } : null;
    }
    setError("");
    store.setHours(hours);
    ui.toast("Working hours saved.");
  }

  return (
    <form className="card" noValidate onSubmit={submit}>
      <h2>Working hours</h2>
      <p className="muted">Used to shade your calendar and warn before booking outside your hours.</p>
      {error && <div className="form-error" role="alert">{error}</div>}
      <table className="hours-table">
        <tbody>
          {ORDER.map((d) => {
            const r = rows[d], name = DAY_NAMES[Number(d)];
            return (
              <tr key={d}>
                <td>
                  <label className="switch">
                    <input type="checkbox" checked={r.on} aria-label={`Working on ${name}`} onChange={(e) => update(d, { on: e.target.checked })} />
                    <span className="track" /><span>{name}</span>
                  </label>
                </td>
                <td>
                  <label className="sr-only" htmlFor={`hs-${d}`}>{name} start</label>
                  <select className="input" id={`hs-${d}`} disabled={!r.on} value={r.start} onChange={(e) => update(d, { start: e.target.value })}>
                    {HALF_HOURS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </td>
                <td>
                  <label className="sr-only" htmlFor={`he-${d}`}>{name} end</label>
                  <select className="input" id={`he-${d}`} disabled={!r.on} value={r.end} onChange={(e) => update(d, { end: e.target.value })}>
                    {HALF_HOURS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button type="submit" className="btn btn-primary" style={{ marginTop: 20 }}>Save hours</button>
    </form>
  );
}

function Notifications() {
  const store = useStore();
  const ui = useUI();
  return (
    <div className="card">
      <h2>Notifications</h2>
      <p className="muted">Choose what you hear about by email.</p>
      <div className="toggle-list">
        {PREFS.map(([key, label, help]) => (
          <div className="row" key={key}>
            <div><strong>{label}</strong><p>{help}</p></div>
            <label className="switch">
              <input type="checkbox" checked={store.db.prefs[key]}
                onChange={(e) => { store.setPrefs({ [key]: e.target.checked }); ui.toast(`${label} ${e.target.checked ? "on" : "off"}.`); }} />
              <span className="track" /><span className="sr-only">{label}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Changes the password on the stylist's Supabase account. */
function PasswordForm() {
  const ui = useUI();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setError("The new password needs at least 8 characters.");
    if (next !== confirm) return setError("The new passwords don't match.");
    setSaving(true);
    const { error: authError } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (authError) return setError(authError.message);
    setNext(""); setConfirm(""); setError("");
    ui.toast("Password changed.");
  }

  return (
    <form className="card" noValidate onSubmit={submit}>
      <h2>Password</h2>
      <p className="muted">At least 8 characters.</p>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="field-row">
        <div className="field"><label htmlFor="pw-new">New password</label>
          <input className="input" id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></div>
        <div className="field"><label htmlFor="pw-confirm">Confirm new password</label>
          <input className="input" id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
      </div>
      <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Change password"}</button>
    </form>
  );
}

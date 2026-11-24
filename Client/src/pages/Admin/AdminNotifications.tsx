import { useState } from "react";
import { api } from "../../lib/api";
import { messageFor, useBusinessData } from "./businessData";
import { AdminError } from "./components/AdminUI";
import { BusinessHeading } from "./components/BusinessUI";

const options = [
  ["newBookingAlerts", "New booking alerts"], ["cancellationAlerts", "Cancellation alerts"],
  ["dailyScheduleSummary", "Daily schedule summary"], ["lowStockAlerts", "Low-stock alerts"],
  ["customerEmailConfirmations", "Customer email confirmations"], ["appointmentReminders", "Appointment reminders"],
] as const;
type Preferences = Record<(typeof options)[number][0], boolean>;

export default function AdminNotifications() {
  const result = useBusinessData<{ preferences: Preferences }>("/admin/notification-preferences");
  const [draft, setDraft] = useState<Preferences>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const preferences = draft ?? result.data?.preferences;

  async function save() {
    if (!draft) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/admin/notification-preferences", { method: "PUT", body: JSON.stringify({ preferences: draft }) });
      setDraft(undefined); result.reload(); setNotice("Preferences saved.");
    } catch (error) {
      setError(messageFor(error));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <BusinessHeading title="Notifications" description="Choose the notifications you want to receive when delivery is configured."
      action={<button type="button" className="admin-primary" disabled={!draft || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save changes"}</button>} />
    {result.error && <AdminError message={result.error} onRetry={result.reload} />}
    {error && <p className="admin-error" role="alert">{error}</p>}
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    <section className="bk-card bk-panel" aria-busy={result.loading}>
      {result.loading ? <p role="status">Loading preferences…</p> : preferences && options.map(([key, label]) => <label className="bk-notification" key={key}>
        <span>{label}</span><input type="checkbox" role="switch" disabled={busy} checked={preferences[key]} onChange={(event) => { setDraft({ ...preferences, [key]: event.target.checked }); setNotice(""); }} />
      </label>)}
    </section>
    <p className="bk-muted bk-notification-note">Preferences are saved to your account. Delivery requires a notification worker.</p>
  </>;
}

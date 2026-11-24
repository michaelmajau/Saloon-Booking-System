import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import { api } from "../../lib/api";
import type { WorkspaceContext } from "./AdminLayout";
import { messageFor, useBusinessData } from "./businessData";
import { AdminError } from "./components/AdminUI";
import { BusinessHeading } from "./components/BusinessUI";

type Settings = {
  salon_name: string; location: string; phone: string | null; email: string | null;
  opening_time: string; closing_time: string;
};

function SettingsSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <details className="bk-settings-row">
    <summary><span><strong>{title}</strong><small>{description}</small></span><ChevronRight aria-hidden="true" size={18} /></summary>
    <div className="bk-settings-fields">{children}</div>
  </details>;
}

export default function AdminSettings() {
  const result = useBusinessData<{ settings: Settings | null }>("/admin/settings");
  const { updateStudio } = useOutletContext<WorkspaceContext>();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const settings = result.data?.settings;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const fields = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { settings } = await api<{ settings: Settings }>("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(Object.fromEntries(fields)),
      });
      updateStudio({ name: settings.salon_name, location: settings.location });
      setNotice("Business settings saved.");
    } catch (error) {
      setError(messageFor(error));
    } finally {
      setSaving(false);
    }
  }

  return <>
    <BusinessHeading title="Business Settings" description="Configure your profile, contact details and opening hours."
      action={<button className="admin-primary" form="business-settings" type="submit" disabled={!settings || saving}>{saving ? "Saving…" : "Save changes"}</button>} />
    {result.error && <AdminError message={result.error} onRetry={result.reload} />}
    {error && <p className="admin-error" role="alert">{error}</p>}
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    {result.loading && <p role="status">Loading business settings…</p>}
    {result.data && !settings && <p className="bk-card bk-panel">Run <code>Server/database/schema.sql</code> in Supabase to initialize Bookify settings.</p>}
    {settings && <form id="business-settings" className="bk-card bk-panel bk-settings-card" onSubmit={save}
      onInvalidCapture={(event) => { if (event.target instanceof HTMLInputElement) { const section = event.target.closest("details"); if (section) section.open = true; } }}>
      <fieldset disabled={saving}>
        <SettingsSection title="Business profile" description="Name and location shown in your workspace.">
          <label>Salon name<input className="bk-field" name="salonName" defaultValue={settings.salon_name} /></label>
          <label>Location<input className="bk-field" name="location" defaultValue={settings.location} /></label>
        </SettingsSection>
        <SettingsSection title="Contact information" description="Phone number and email for your business.">
          <label>Phone<input className="bk-field" type="tel" name="phone" defaultValue={settings.phone ?? ""} /></label>
          <label>Email<input className="bk-field" type="email" name="email" defaultValue={settings.email ?? ""} /></label>
        </SettingsSection>
        <SettingsSection title="Opening hours" description="Set the hours used to calculate appointment availability.">
          <label>Opening time<input className="bk-field" type="time" name="openingTime" required defaultValue={settings.opening_time.slice(0, 5)} /></label>
          <label>Closing time<input className="bk-field" type="time" name="closingTime" required defaultValue={settings.closing_time.slice(0, 5)} /></label>
        </SettingsSection>
        <SettingsSection title="Booking preferences" description="Review the booking page your customers use.">
          <Link className="admin-secondary" to="/book">Open booking page</Link>
        </SettingsSection>
        <SettingsSection title="Cancellation policies" description="Manage cancellations through Appointments.">
          <Link className="admin-secondary" to="/admin/appointments">Manage appointments</Link>
        </SettingsSection>
        <SettingsSection title="Payment preferences" description="View the currency used for bookings and checkout.">
          <p>Currency <strong>Kenyan shilling (KES)</strong></p>
          <Link className="admin-secondary" to="/admin/pos">Open Point of Sale</Link>
        </SettingsSection>
      </fieldset>
    </form>}
  </>;
}

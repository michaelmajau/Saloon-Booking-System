import { useState } from "react";
import type { FormEvent } from "react";
import { api, kes } from "../../../lib/api";
import type { Appointment, Service, TeamMember } from "../dashboardData";
import { minutes, staffName } from "../dashboardData";
import { AdminModal } from "./AdminUI";

export default function BookingModal({ date, team, services, appointments, onClose, onBooked }: {
  date: string; team: TeamMember[]; services: Service[]; appointments: Appointment[];
  onClose: () => void; onBooked: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const customers = new Map(appointments.filter((row) => row.customer).map((row) => [row.customer_id, row.customer]));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startTime = String(form.get("startTime"));
    const serviceId = String(form.get("serviceId"));
    const service = services.find((item) => item.service_id === serviceId);
    if (!service) return;
    const end = minutes(startTime) + service.duration_minutes;
    if (end >= 1440) {
      setError("Choose a start time that lets the service finish before midnight.");
      return;
    }
    const endTime = [Math.floor(end / 60), end % 60].map((value) => String(value).padStart(2, "0")).join(":");
    setError("");
    setSaving(true);
    try {
      await api("/admin/appointments", {
        method: "POST",
        body: JSON.stringify({
          customerId: String(form.get("customerId")).trim(),
          staffId: form.get("staffId"),
          serviceId,
          appointmentDate: form.get("appointmentDate"),
          startTime,
          endTime,
          notes: form.get("notes"),
        }),
      });
      onBooked();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create the appointment.");
      setSaving(false);
    }
  }

  return (
    <AdminModal drawer title="Create appointment" onClose={onClose} busy={saving}>
      <form className="admin-booking-form" onSubmit={submit}>
        <fieldset disabled={saving}>
          <label>Customer ID<input name="customerId" list="admin-known-customers" required placeholder="Select a known customer or enter their ID" /></label>
          <datalist id="admin-known-customers">{[...customers].map(([id, customer]) => <option key={id} value={id} label={customer?.full_name || customer?.email} />)}</datalist>
          <label>Staff member<select name="staffId" defaultValue="" required><option value="" disabled>Select staff</option>{team.filter((member) => member.is_active).map((member) => <option key={member.staff_id} value={member.staff_id}>{staffName(member)}</option>)}</select></label>
          <label>Service<select name="serviceId" defaultValue="" required><option value="" disabled>Select service</option>{services.map((service) => <option key={service.service_id} value={service.service_id}>{service.service_name} · {kes(service.price)}</option>)}</select></label>
          <div className="admin-form-row"><label>Date<input type="date" name="appointmentDate" defaultValue={date} required /></label><label>Start time<input type="time" name="startTime" required /></label></div>
          <label>Notes <small>(optional)</small><textarea name="notes" rows={4} /></label>
        </fieldset>
        {error && <p role="alert" className="admin-error">{error}</p>}
        <button className="admin-primary" disabled={saving}>{saving ? "Saving…" : "Create booking"}</button>
      </form>
    </AdminModal>
  );
}

import { Link } from "react-router-dom";
import { displayDate, minutes, shortTime, staffName } from "../dashboardData";
import type { Appointment, TeamMember } from "../dashboardData";
import { AdminTable } from "./AdminUI";

type StaffColumn = { id: string; name: string };

export function AppointmentAgenda({ rows, weekly = false }: { rows: Appointment[]; weekly?: boolean }) {
  if (!rows.length) return <p className="admin-empty">No appointments scheduled.</p>;
  return (
    <AdminTable className="admin-agenda">
      <thead><tr><th scope="col">{weekly ? "Date and time" : "Time"}</th><th scope="col">Client and service</th><th scope="col">Staff</th></tr></thead>
      <tbody>{rows.map((row) => (
        <tr key={row.appointment_id}>
          <td>{weekly && <>{displayDate(row.appointment_date, { weekday: "short", day: "numeric", month: "short" })} <br /></>}{shortTime(row.start_time)}</td>
          <td><strong>{row.customer?.full_name || "Client"}</strong><small>{row.service?.service_name || "Service"}</small></td>
          <td>{row.staff?.full_name || "Staff member"}</td>
        </tr>
      ))}</tbody>
    </AdminTable>
  );
}

export default function AppointmentCalendar({ rows, team, weekly, message }: { rows: Appointment[]; team: TeamMember[]; weekly: boolean; message?: string }) {
  if (weekly) return <AppointmentAgenda rows={rows} weekly />;
  const columns = new Map<string, StaffColumn>(team.filter((member) => member.is_active).map((member) => [member.staff_id, { id: member.staff_id, name: staffName(member) }]));
  for (const row of rows) {
    if (!columns.has(row.staff_id)) columns.set(row.staff_id, { id: row.staff_id, name: row.staff?.full_name || "Staff member" });
  }
  if (columns.size === 0) {
    for (const name of ["Staff 1", "Staff 2", "Staff 3"]) columns.set(name, { id: name, name: "" });
  }
  const first = Math.min(9, ...rows.map((row) => Math.floor(minutes(row.start_time) / 60)));
  const last = Math.max(14, ...rows.map((row) => Math.ceil(minutes(row.end_time) / 60)));
  const hours = Array.from({ length: last - first }, (_, index) => first + index);
  const rowHeight = 58;
  return (
    <>
      <div className="admin-calendar" aria-label="Staff appointment calendar">
        {message && <p className="admin-calendar-message" role="status">{message}</p>}
        <div className="admin-calendar-grid" style={{ gridTemplateColumns: `60px repeat(${columns.size}, minmax(104px, 1fr))` }}>
          <div><div className="admin-calendar-heading">Time</div>{hours.map((hour) => <div className="admin-calendar-hour" key={hour} style={{ height: rowHeight }}>{hour}:00</div>)}</div>
          {[...columns.values()].map((column) => (
            <div className="admin-calendar-column" key={column.id}>
              <div className="admin-calendar-heading">{column.name}</div>
              <div className="admin-calendar-lane" style={{ height: hours.length * rowHeight, backgroundSize: `100% ${rowHeight}px` }}>
                {rows.filter((row) => row.staff_id === column.id).map((row) => {
                  const duration = minutes(row.end_time) - minutes(row.start_time);
                  const customer = row.customer?.full_name || "Client";
                  const service = row.service?.service_name || "Service";
                  return (
                    <Link key={row.appointment_id} className="admin-calendar-booking" data-status={row.status}
                      to="/admin/appointments" title={`${shortTime(row.start_time)} · ${customer} · ${service}`}
                      style={{ top: (minutes(row.start_time) / 60 - first) * rowHeight + 2, height: Math.max(10, duration / 60 * rowHeight - 4) }}>
                      <strong>{service}</strong>{duration >= 35 && <small>{customer} · {duration} min</small>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="admin-mobile-agenda">{message ? <p className="admin-empty" role="status">{message}</p> : <AppointmentAgenda rows={rows} />}</div>
    </>
  );
}

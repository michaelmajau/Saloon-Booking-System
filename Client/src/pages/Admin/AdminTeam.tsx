import { useState } from "react";
import { CalendarDays, Ellipsis, Plus, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { initials } from "./adminNavigation";
import { dateQuery, money, useBusinessData } from "./businessData";
import { displayDate, minutes, salonDate, shortTime, staffName, visibleBooking, weekDates } from "./dashboardData";
import type { TeamMember } from "./dashboardData";
import { AdminError, AdminTable } from "./components/AdminUI";
import { BusinessHeading, RecordDrawer } from "./components/BusinessUI";

type Member = TeamMember & { staff_type: string; specialty: string | null };
type Shift = { staff_id: string; days_of_week: number; start_time: string; end_time: string };
type Booking = { staff_id: string; appointment_date: string; start_time: string; end_time: string; status: string; payment_status: string; total_amount: number };
type Interval = { start_time: string; end_time: string };
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function markMinutes(intervals: Interval[]) {
  const result = new Set<number>();
  for (const { start_time, end_time } of intervals) {
    const end = minutes(end_time);
    for (let minute = minutes(start_time); minute < end; minute++) result.add(minute);
  }
  return result;
}

function performance(bookings: Booking[], shifts: Shift[], dates: string[]) {
  const booked = bookings.filter(visibleBooking);
  let available = 0;
  let occupied = 0;
  dates.forEach((date, day) => {
    const scheduledMinutes = markMinutes(shifts.filter((shift) => shift.days_of_week === (day + 1) % 7));
    const bookingMinutes = markMinutes(booked.filter((booking) => booking.appointment_date === date));
    available += scheduledMinutes.size;
    for (const minute of bookingMinutes) if (scheduledMinutes.has(minute)) occupied++;
  });
  return {
    appointments: booked.length,
    revenue: booked.reduce((sum, row) => sum + (row.status === "completed" && row.payment_status === "paid" ? Number(row.total_amount) : 0), 0),
    utilization: available ? Math.round(100 * occupied / available) : null,
  };
}

function MemberCard({ member, stats, scheduleAvailable, onProfile }: {
  member: Member; stats?: ReturnType<typeof performance>; scheduleAvailable: boolean; onProfile: () => void;
}) {
  const name = staffName(member);
  const utilization = scheduleAvailable ? stats?.utilization : null;
  return <article className="bk-card bk-team-card">
    <button type="button" className="bk-team-more" aria-label={`Manage ${name}`} onClick={onProfile}><Ellipsis size={20} /></button>
    <span className="bk-avatar" aria-hidden="true">{initials(name)}</span>
    <h2>{name}</h2>
    <p className="bk-team-role">{member.staff_type}{!member.is_active && " · Inactive"}</p>
    <p className="bk-muted">{member.specialty || "General services"}</p>
    <dl className="bk-team-metrics">
      <div><dt>Appointments</dt><dd>{stats?.appointments ?? "—"}</dd></div>
      <div><dt>Revenue</dt><dd>{stats ? money(stats.revenue) : "—"}</dd></div>
    </dl>
    <div className="bk-progress bk-team-utilization">
      <div><span>Utilization</span><strong>{utilization == null ? "—" : utilization + "%"}</strong></div>
      {utilization == null ? <span className="bk-team-empty-track" aria-hidden="true" />
        : <progress aria-label={`Weekly utilization for ${name}`} value={utilization} max={100} />}
    </div>
    <button type="button" className="admin-secondary bk-team-profile" onClick={onProfile}>View profile<span className="sr-only"> for {name}</span></button>
  </article>;
}

export default function AdminTeam() {
  const [date] = useState(salonDate);
  const [invite, setInvite] = useState<"invite" | "add">();
  const [profile, setProfile] = useState<Member>();
  const [notice, setNotice] = useState("");
  const dates = weekDates(date);
  const team = useBusinessData<{ staff: Member[] }>("/admin/team");
  const schedule = useBusinessData<{ shifts: Shift[] }>("/admin/team/schedule");
  const report = useBusinessData<{ appointments: Booking[]; truncated: boolean }>(`/admin/reports/appointments?${dateQuery(dates[0], dates[6])}`);
  const members = team.data?.staff ?? [];
  const activeMembers = members.filter((member) => member.is_active);
  const shifts = schedule.data?.shifts ?? [];
  const reportRows = report.data && !report.data.truncated ? report.data.appointments : undefined;

  function onSaved(message: string) {
    setNotice(message);
    team.reload();
    schedule.reload();
  }

  return <div className="bk-team">
    <BusinessHeading title="Team Management" description="Schedules, services, performance and permissions." action={<div className="bk-actions bk-team-actions">
      <button type="button" className="admin-secondary" onClick={() => { setNotice(""); setInvite("invite"); }}><Send size={17} />Invite</button>
      <button type="button" className="admin-primary" onClick={() => { setNotice(""); setInvite("add"); }}><Plus size={17} />Add team member</button>
    </div>} />
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    {team.error && <AdminError message={team.error} onRetry={team.reload} />}
    {report.error && <AdminError message="Unable to load weekly performance." onRetry={report.reload} />}
    {report.data?.truncated && <p className="admin-error" role="status">This week exceeds the report limit. Performance figures are unavailable.</p>}
    {team.loading && <p className="bk-card bk-panel" role="status">Loading team members…</p>}
    {team.data && !members.length && <p className="bk-card bk-panel">Invite a team member to get started.</p>}
    <div className="bk-team-cards">{members.map((member) => <MemberCard key={member.staff_id} member={member}
      stats={reportRows && performance(reportRows.filter((row) => row.staff_id === member.staff_id), shifts.filter((shift) => shift.staff_id === member.staff_id), dates)}
      scheduleAvailable={!!schedule.data} onProfile={() => { setNotice(""); setProfile(member); }} />)}</div>
    <section className="bk-card bk-panel bk-team-schedule">
      <header className="bk-panel-header">
        <div><p className="bk-eyebrow">This week</p><h2>Team schedule</h2><p>{displayDate(dates[0], { day: "numeric", month: "short" })} – {displayDate(dates[6], { day: "numeric", month: "short" })} · Nairobi time</p></div>
        <Link to="/admin/calendar" className="admin-secondary" title="Manage bookings in Calendar"><CalendarDays size={17} />Manage schedule</Link>
      </header>
      {schedule.error && <AdminError message="Unable to load staff schedules." onRetry={schedule.reload} />}
      {schedule.loading && <p className="bk-muted" role="status">Loading schedules…</p>}
      {!!schedule.data && (activeMembers.length ? <AdminTable className="bk-team-week" aria-label="Recurring weekly schedules for active staff">
        <tbody>{activeMembers.map((member) => <tr key={member.staff_id}>
          <th scope="row">{staffName(member)}</th>
          {days.map((day, index) => {
            const hours = shifts.filter((shift) => shift.staff_id === member.staff_id && shift.days_of_week === (index + 1) % 7);
            return <td key={day} className={!hours.length ? "bk-team-off" : undefined}><strong>{day}</strong>
              {hours.length ? hours.map((shift, index) => <span key={index}>{shortTime(shift.start_time)}–{shortTime(shift.end_time)}</span>) : <span>{shifts.some((shift) => shift.staff_id === member.staff_id) ? "Off" : "Not set"}</span>}
            </td>;
          })}
        </tr>)}</tbody>
      </AdminTable> : team.data && <p className="bk-muted">No active team members to schedule.</p>)}
    </section>
    {invite && <RecordDrawer title={invite === "invite" ? "Invite team member" : "Add team member"} submitLabel="Send invitation" onClose={() => setInvite(undefined)} onSave={async (fields) => {
      await api("/admin/staff", { method: "POST", body: JSON.stringify(Object.fromEntries(fields)) });
      onSaved("Invitation sent.");
    }}>
      <label>Full name<input required name="fullName" placeholder="Enter the team member’s name" autoComplete="name" /></label>
      <label>Email address<input required type="email" name="email" placeholder="name@example.com" autoComplete="email" /></label>
      <label>Role<select name="staffType"><option value="barber">Barber</option><option value="stylist">Stylist</option></select></label>
      <label>Specialty <small>(optional)</small><textarea name="specialty" rows={3} placeholder="e.g. Natural hair and braiding" /></label>
      <p className="bk-muted bk-team-drawer-note">An email invitation lets the team member set their password.</p>
    </RecordDrawer>}
    {profile && <RecordDrawer title={staffName(profile)} submitLabel="Save changes" onClose={() => setProfile(undefined)} onSave={async (fields) => {
      await api(`/admin/staff/${profile.staff_id}`, { method: "PATCH", body: JSON.stringify({ staffType: fields.get("staffType") ?? undefined, specialty: fields.get("specialty"), isActive: fields.get("status") === "active" }) });
      onSaved("Team member updated.");
    }}>
      <p className="bk-muted">{profile.profile?.email || "No email on file"}</p>
      <label>Role<select name="staffType" defaultValue={profile.staff_type}>{!["barber", "stylist"].includes(profile.staff_type) && <option value={profile.staff_type} disabled>{profile.staff_type}</option>}<option value="barber">Barber</option><option value="stylist">Stylist</option></select></label>
      <label>Specialty<textarea name="specialty" rows={3} defaultValue={profile.specialty ?? ""} /></label>
      <label>Status<select name="status" defaultValue={profile.is_active ? "active" : "inactive"}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
    </RecordDrawer>}
  </div>;
}

import { useEffect, useState } from "react";
import { ArrowDownRight, CalendarDays, CircleCheck, Clock3, Download, Plus, Sparkles, UserRound, UsersRound, Wallet } from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import { api } from "../../lib/api";
import { dateQuery, dayOffset as shift, money, useBusinessData } from "./businessData";
import type { FinanceSummary } from "./businessData";
import type { WorkspaceContext } from "./AdminLayout";
import { AdminError, AdminTable } from "./components/AdminUI";
import { LaunchChecklist, MetricCard, Trend } from "./components/OverviewPanels";
import { displayDate, salonDate, salonTime, shortTime, visibleBooking } from "./dashboardData";
import type { DashboardData } from "./dashboardData";

type ReportRow = { appointment_date: string; status: string; payment_status: string; total_amount: number };
type Activity = { id: string; created_at: string; action: string; actor_name: string; entity_type: string | null };
type Overview = DashboardData & { setup?: { profile: boolean; service: boolean; team: boolean; hours: boolean; appointment: boolean }; customerCounts?: { new: number; returning: number }; utilization?: number | null };
const revenue = (rows: ReportRow[]) => rows.reduce((sum, row) => sum + (row.payment_status === "paid" && row.status === "completed" ? Number(row.total_amount) : 0), 0);
const label = (value: string) => value.replaceAll("_", " ").toLowerCase();

export default function AdminDashboard() {
  const { studio, name, openBooking, revision } = useOutletContext<WorkspaceContext>();
  const [data, setData] = useState<Overview>();
  const [report, setReport] = useState<{ appointments: ReportRow[]; truncated: boolean }>();
  const [activity, setActivity] = useState<Activity[]>();
  const [errors, setErrors] = useState<string[]>([]);
  const [retry, setRetry] = useState(0);
  const [checklist, setChecklist] = useState(true);
  const [range, setRange] = useState(1);
  const [period, setPeriod] = useState(7);
  const [filter, setFilter] = useState("all");
  const [date] = useState(salonDate);
  const finance = useBusinessData<{ summary: FinanceSummary }>(`/admin/finance/summary?${dateQuery(shift(date, 1 - period), date)}`);
  const rangeFinance = useBusinessData<{ summary: FinanceSummary }>(range === period ? "" : `/admin/finance/summary?${dateQuery(shift(date, 1 - range), date)}`);
  const revenueTotal = (range === period ? finance : rangeFinance).data?.summary.gross_revenue;

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) };
    const fail = (message: string) => () => { if (!controller.signal.aborted) setErrors((items) => [...items, message]); };
    api<Overview>("/admin/dashboard", options).then(setData).catch(fail("Overview"));
    api<{ appointments: ReportRow[]; truncated: boolean }>(`/admin/reports/appointments?from=${shift(date, -59)}&to=${date}`, options).then(setReport).catch(fail("Revenue and trends"));
    api<{ logs: Activity[] }>(`/admin/audit-logs?from=${date}&to=${date}`, options).then(({ logs }) => setActivity(logs)).catch(fail("Recent activity"));
    return () => controller.abort();
  }, [date, retry, revision]);

  const rows = data?.appointments ?? [];
  const appointments = rows.filter(visibleBooking);
  const upcoming = appointments.filter((row) => row.status === "checked_in" || (row.status === "confirmed" && shortTime(row.start_time) >= salonTime())).length;
  const completed = appointments.filter(({ status }) => status === "completed").length;
  const pending = appointments.filter(({ status }) => status === "pending").length;
  const historical = report && !report.truncated ? report.appointments : undefined;
  const perDay = (day: string) => historical?.filter((row) => row.appointment_date === day) ?? [];
  const series = (length: number, offset: number, measure: (rows: ReportRow[]) => number) =>
    historical ? Array.from({ length }, (_, index) => measure(perDay(shift(date, index - length + 1 - offset)))) : [];
  const rate = (items: ReportRow[]) => items.length ? items.filter(({ status }) => status === "cancelled").length / items.length * 100 : 0;
  const count = (items: ReportRow[]) => items.filter(({ status }) => !["cancelled", "no_show"].includes(status)).length;
  const current = series(period, 0, revenue);
  const previous = series(period, period, revenue);
  const setup = data?.setup;
  const steps = [
    { label: "Complete business profile", done: !!setup?.profile, href: "/admin/settings" },
    { label: "Add your first service", done: !!setup?.service, href: "/admin/services" },
    { label: "Add team members", done: !!setup?.team, href: "/admin/team" },
    { label: "Configure working hours", done: !!setup?.hours, href: "/admin/settings" },
    { label: "Preview booking page", done: false, href: "/book" },
    { label: "Open your booking link", done: false, href: "/book" },
    { label: "Receive your first appointment", done: !!setup?.appointment, href: "/admin/appointments" },
  ];
  const format = (value: number | undefined) => value === undefined ? "—" : String(value);
  const metrics = [
    { label: "Total revenue", value: revenueTotal == null ? "—" : money(revenueTotal), icon: Wallet, series: series(7, 0, revenue), detail: "Recorded appointment and point-of-sale payments. Trend shows appointments." },
    { label: "Today’s appointments", value: format(data?.metrics.todayAppointments), icon: CalendarDays, series: series(7, 0, count), detail: "Today’s bookings excluding cancellations and no-shows" },
    { label: "Upcoming", value: format(data ? upcoming : undefined), icon: Clock3, series: [], detail: "Confirmed appointments still ahead today, plus checked-in customers" },
    { label: "Completed", value: format(data ? completed : undefined), icon: CircleCheck, series: series(7, 0, (items) => items.filter(({ status }) => status === "completed").length), detail: "Completed appointments today" },
    { label: "New customers", value: format(data?.customerCounts?.new), icon: UserRound, series: [], detail: "Customers with a completed visit today and no prior completed visits" },
    { label: "Returning customers", value: format(data?.customerCounts?.returning), icon: UsersRound, series: [], detail: "Customers with a completed visit today and a prior completed visit" },
    { label: "Staff utilization", value: data?.utilization == null ? "—" : `${data.utilization}%`, icon: Sparkles, series: [], detail: "Share of active team’s scheduled time booked today" },
    { label: "Cancellation rate", value: data ? `${rate(rows).toFixed(1)}%` : "—", icon: ArrowDownRight, series: series(7, 0, rate), detail: "Cancelled appointments as a share of today’s bookings", green: true },
  ];
  const visible = rows.filter((row) => filter === "all" || row.status === filter);
  const hour = Number(salonTime().slice(0, 2));
  return <div className="bk-overview">
    <header className="bk-page-heading"><div><p className="bk-eyebrow">{displayDate(date, { dateStyle: "full" })} · Main branch</p><h1>Good {hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}, {name.split(" ")[0]}.</h1><p>Here’s what’s happening at {studio} today.</p></div>
      <label className="bk-date-select"><CalendarDays size={17} /><select aria-label="Revenue date range" value={range} onChange={(event) => setRange(Number(event.target.value))}><option value={1}>Today</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></select></label>
    </header>
    {errors.length > 0 && <AdminError message={`Unable to load ${errors.join(", ")}.`} onRetry={() => { setErrors([]); setRetry((value) => value + 1); }} />}
    {checklist && <LaunchChecklist studio={studio} steps={steps} onDismiss={() => setChecklist(false)} />}
    <div className="bk-metrics">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</div>
    <div className="bk-performance">
      <section className="bk-card bk-panel"><header className="bk-panel-header"><div><p className="bk-eyebrow">Performance</p><h2>Revenue analytics</h2><p>Chart shows appointment revenue · Main branch</p></div>
        <div className="bk-segment" aria-label="Revenue period" role="group">{[[1, "Daily"], [7, "Weekly"], [30, "Monthly"]].map(([value, text]) => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(Number(value))}>{text}</button>)}</div></header>
        {finance.error && <AdminError message={finance.error} onRetry={finance.reload} />}
        {rangeFinance.error && <AdminError message={rangeFinance.error} onRetry={rangeFinance.reload} />}
        <div className="bk-revenue-totals" aria-busy={finance.loading}>
          <div><p>Gross revenue</p><strong>{finance.data ? money(finance.data.summary.gross_revenue) : "—"}</strong><small>Recorded payments</small></div>
          <div><p>Net income</p><strong>{finance.data ? money(finance.data.summary.net_income) : "—"}</strong><small>Revenue minus recorded expenses</small></div>
        </div>
        <Trend values={current} previous={previous} />
        <div className="bk-chart-labels">{current.length > 1 && current.map((_, index) => (current.length <= 7 || index % 5 === 0 || index === current.length - 1) && <span key={index}>{displayDate(shift(date, index - period + 1), period === 7 ? { weekday: "short" } : { day: "numeric", month: "short" })}</span>)}</div>
        <footer className="bk-chart-footer"><span><i />Current period</span><span><i />Previous period</span><Link to="/admin/reports"><Download size={16} />Export report</Link></footer>
        {report?.truncated && <small>The report exceeds the available row limit. Choose a smaller range in Reports.</small>}
      </section>
      <section className="bk-card bk-panel bk-pulse"><p className="bk-eyebrow">Activity</p><h2>Today’s pulse</h2><ul>{activity?.slice(0, 4).map((item) => <li key={item.id}><i /><time>{new Date(item.created_at).toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit" })}</time><div><strong>{label(item.action)}</strong><small>{item.actor_name}{item.entity_type ? " · " + label(item.entity_type) : ""}</small></div></li>)}</ul>
        {!activity?.length && <p>{activity ? "No activity recorded today." : errors.includes("Recent activity") ? "Activity unavailable." : "Loading activity…"}</p>}
        <Link to="/admin/audit-logs">View all activity →</Link>
      </section>
    </div>
    <section className="bk-card bk-panel"><header className="bk-panel-header"><div><p className="bk-eyebrow">{displayDate(date, { weekday: "long", day: "numeric", month: "long" })}</p><h2>Today’s appointments</h2><p>{data ? `${upcoming} upcoming · ${completed} completed · ${pending} pending` : errors.includes("Overview") ? "Appointments unavailable." : "Loading appointments…"}</p></div>
      <div className="bk-actions"><select className="bk-field" aria-label="Filter appointments by status" value={filter} onChange={(event) => setFilter(event.target.value)}>{["all", "pending", "confirmed", "checked_in", "completed", "cancelled", "no_show"].map((status) => <option key={status} value={status}>{status === "all" ? "All statuses" : label(status)}</option>)}</select><button type="button" className="admin-primary" onClick={() => openBooking(date)}><Plus size={16} />New appointment</button></div></header>
      <AdminTable className="bk-table"><thead><tr>{["Customer", "Service", "Team member", "Time", "Payment", "Status"].map((title) => <th scope="col" key={title}>{title}</th>)}</tr></thead><tbody>{visible.map((row) => <tr key={row.appointment_id}>
        <td><strong>{row.customer?.full_name || "Customer"}</strong></td><td>{row.service?.service_name || "Service"}</td><td>{row.staff?.full_name || "Team member"}</td><td>{shortTime(row.start_time)}–{shortTime(row.end_time)}</td><td><span className="bk-pill" data-status={row.payment_status}>{label(row.payment_status)}</span></td><td><span className="bk-pill" data-status={row.status}>{label(row.status)}</span></td>
      </tr>)}{data && !visible.length && <tr><td colSpan={6}>No appointments match this view.</td></tr>}</tbody></AdminTable>
      <Link className="bk-panel-link" to="/admin/appointments">Manage appointments →</Link>
    </section>
  </div>;
}

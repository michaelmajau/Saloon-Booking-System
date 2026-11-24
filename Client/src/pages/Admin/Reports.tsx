import { BarChart } from "./components/BarChart";
import { AdminTable } from "./components/AdminUI";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Printer, Download, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { api, kes } from "../../lib/api";

/**
 * Admin → Reports
 * Appointments report for a chosen period, with filters, search, sortable
 * columns, totals and a print-ready layout (company name, logo and date).
 * "Print / Save as PDF" uses the browser's print dialog.
 */

type Row = {
  appointment_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  total_amount: number;
  customer_name: string;
  staff_id: string;
  staff_name: string;
  staff_type: string | null;
  service_name: string;
};

type ReportData = {
  from: string;
  to: string;
  generatedAt: string;
  truncated: boolean;
  salon: { salon_name: string | null; location: string | null; phone: string | null; email: string | null };
  appointments: Row[];
};

type SortKey = "appointment_date" | "customer_name" | "staff_name" | "service_name" | "status" | "payment_status" | "total_amount";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "appointment_date", label: "Date & time" },
  { key: "customer_name", label: "Customer" },
  { key: "service_name", label: "Service" },
  { key: "staff_name", label: "Professional" },
  { key: "status", label: "Status" },
  { key: "payment_status", label: "Payment" },
  { key: "total_amount", label: "Amount", align: "right" },
];

/** YYYY-MM-DD in Nairobi time. */
const isoDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
const firstOfMonth = () => `${isoDate(new Date()).slice(0, 8)}01`;

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const label = (status: string) => STATUS_LABELS[status] ?? status.replace(/_/g, " ");

export default function Reports() {
  // Period (sent to the server)
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(() => isoDate(new Date()));

  // Filters and sorting (applied in the browser)
  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("all");
  const [staffId, setStaffId] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "appointment_date", dir: "asc" });

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    if (!from || !to) return setError("Choose a start and end date.");
    if (from > to) return setError("The start date must be on or before the end date.");
    setLoading(true);
    setError("");
    try {
      setData(await api<ReportData>(`/admin/reports/appointments?from=${from}&to=${to}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to build the report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Build the report for this month when the page opens.
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void load();
  };

  // Professionals that appear in this period, for the filter dropdown.
  const staffOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of data?.appointments ?? []) seen.set(row.staff_id, row.staff_name);
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = (data?.appointments ?? []).filter((row) =>
      (status === "all" || row.status === status) &&
      (payment === "all" || row.payment_status === payment) &&
      (staffId === "all" || row.staff_id === staffId) &&
      (!q || `${row.customer_name} ${row.service_name} ${row.staff_name}`.toLowerCase().includes(q)),
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.key === "total_amount") return (a.total_amount - b.total_amount) * dir;
      const av = sort.key === "appointment_date" ? `${a.appointment_date} ${a.start_time}` : String(a[sort.key]);
      const bv = sort.key === "appointment_date" ? `${b.appointment_date} ${b.start_time}` : String(b[sort.key]);
      return av.localeCompare(bv) * dir;
    });
  }, [data, status, payment, staffId, query, sort]);

  const totals = useMemo(() => {
    const count = (s: string) => rows.filter((r) => r.status === s).length;
    const paid = rows.filter((r) => r.payment_status === "paid").reduce((sum, r) => sum + r.total_amount, 0);
    const unpaid = rows
      .filter((r) => r.payment_status === "unpaid" && !["cancelled", "no_show"].includes(r.status))
      .reduce((sum, r) => sum + r.total_amount, 0);
    return {
      bookings: rows.length,
      completed: count("completed"),
      lost: count("cancelled") + count("no_show"),
      paid,
      unpaid,
      value: rows.reduce((sum, r) => sum + r.total_amount, 0),
    };
  }, [rows]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const filtersApplied = [
    status !== "all" && `Status: ${label(status)}`,
    payment !== "all" && `Payment: ${payment}`,
    staffId !== "all" && `Professional: ${staffOptions.find(([id]) => id === staffId)?.[1] ?? ""}`,
    query.trim() && `Search: "${query.trim()}"`,
  ].filter(Boolean) as string[];

  const exportCsv = () => {
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = ["Date", "Start", "End", "Customer", "Service", "Professional", "Status", "Payment", "Amount (KES)"];
    const lines = rows.map((r) =>
      [r.appointment_date, r.start_time.slice(0, 5), r.end_time.slice(0, 5), r.customer_name, r.service_name, r.staff_name, label(r.status), r.payment_status, r.total_amount]
        .map(cell)
        .join(","),
    );
    const blob = new Blob([[header.map(cell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `bookify-appointments-${from}-to-${to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const salonName = data?.salon.salon_name || "Bookify";
  const salonDetails = [data?.salon.location, data?.salon.phone, data?.salon.email].filter(Boolean).join(" · ");
  const inputClass = "h-11 w-full border border-[#D7CABC] bg-white px-3 text-sm text-[#34251F] outline-none focus:border-[#70263E]";

  return (
    <section className="bk-operations">
      {/* When printing, show only the report itself. */}
      <style>{`.print-only { display: none; }
      @media print {
        @page { size: A4 landscape; margin: 12mm; }
        aside, .no-print { display: none !important; }
        .print-only { display: inline !important; }
        main { padding: 0 !important; overflow: visible !important; }
        div:has(> aside) { display: block !important; }   /* lets the table flow across pages */
        body, main, .report-sheet { background: #fff !important; }
        .report-sheet { box-shadow: none !important; padding: 0 !important; }
        .report-sheet .overflow-x-auto { overflow: visible !important; }
        .report-sheet thead { display: table-header-group; }   /* repeat column headings on every page */
        .report-sheet tfoot { display: table-row-group; }      /* print the total once, at the end */
        .report-sheet td { padding-top: 5px !important; padding-bottom: 5px !important; }
        .report-sheet table { font-size: 11px; }
        tr { break-inside: avoid; }
      }`}</style>

      {/* Page heading */}
      <div className="no-print flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.25em] text-[#70263E]">Bookify admin · Reports</p>
          <h1 className="mt-5 font-serif text-5xl leading-none text-[#34251F] sm:text-6xl">Reports & Analytics</h1>
          <p className="mt-5 text-[#82766E]">Choose a period, filter and sort, then print or save it as a PDF.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!rows.length}
            className="inline-flex items-center gap-2 border border-[#70263E] px-5 py-3 text-sm font-semibold text-[#70263E] disabled:opacity-50"
          >
            <Download size={16} /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!data}
            className="inline-flex items-center gap-2 bg-[#70263E] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Printer size={16} /> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={onSubmit} className="no-print mt-8 grid gap-4 bg-[#FFFCF8] p-6 sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-xs font-semibold text-[#5F5047]">
          From
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={`mt-2 ${inputClass}`} required />
        </label>
        <label className="text-xs font-semibold text-[#5F5047]">
          To
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={`mt-2 ${inputClass}`} required />
        </label>
        <label className="text-xs font-semibold text-[#5F5047]">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`mt-2 ${inputClass}`}>
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-[#5F5047]">
          Payment
          <select value={payment} onChange={(e) => setPayment(e.target.value)} className={`mt-2 ${inputClass}`}>
            <option value="all">All payments</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-[#5F5047]">
          Professional
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={`mt-2 ${inputClass}`}>
            <option value="all">Everyone</option>
            {staffOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={loading} className="h-11 w-full bg-[#34251F] text-sm font-semibold text-white disabled:opacity-60">
            {loading ? "Building…" : "Update period"}
          </button>
        </div>
        <label className="relative text-xs font-semibold text-[#5F5047] sm:col-span-2 lg:col-span-6">
          <span className="sr-only">Search</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8B80]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by customer, service or professional"
            className={`${inputClass} pl-9`}
          />
        </label>
      </form>

      {error && (
        <p role="alert" className="no-print mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}

      {data && rows.length > 0 && (
        <div className="no-print mt-6">
          <BarChart title="Appointments by outcome" items={[
            { label: "Completed", value: totals.completed, formatted: String(totals.completed) },
            { label: "Cancelled or no-show", value: totals.lost, formatted: String(totals.lost) },
            { label: "Other", value: totals.bookings - totals.completed - totals.lost, formatted: String(totals.bookings - totals.completed - totals.lost) },
          ]} />
        </div>
      )}
      {/* The report (this is what gets printed) */}
      <article className="report-sheet mt-8 bg-white p-6 shadow-sm sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-[#34251F] pb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#70263E] font-serif text-2xl text-[#70263E]" aria-hidden="true">
              {salonName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-serif text-3xl text-[#34251F]">{salonName}</p>
              {salonDetails && <p className="mt-1 text-xs text-[#82766E]">{salonDetails}</p>}
            </div>
          </div>
          <div className="text-right text-sm text-[#5F5047]">
            <p className="font-serif text-xl text-[#34251F]">Appointments report</p>
            <p className="mt-1">Period: {data ? `${prettyDate(data.from)} – ${prettyDate(data.to)}` : "—"}</p>
            <p>Generated: {data ? new Date(data.generatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—"}</p>
          </div>
        </header>

        {filtersApplied.length > 0 && (
          <p className="mt-4 text-xs text-[#82766E]">Filters: {filtersApplied.join(" · ")}</p>
        )}

        {/* Summary */}
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Bookings", String(totals.bookings)],
            ["Completed", String(totals.completed)],
            ["Cancelled / no-show", String(totals.lost)],
            ["Paid", kes(totals.paid)],
            ["Unpaid (open)", kes(totals.unpaid)],
          ].map(([term, value]) => (
            <div key={term} className="border border-[#E7DED3] p-4">
              <dt className="text-xs text-[#82766E]">{term}</dt>
              <dd className="mt-2 font-serif text-2xl text-[#34251F]">{value}</dd>
            </div>
          ))}
        </dl>

        {/* Table */}
        <div className="mt-6 overflow-x-auto">
          <AdminTable className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#34251F] text-left text-xs uppercase tracking-wider text-[#5F5047]">
                {COLUMNS.map((col) => {
                  const active = sort.key === col.key;
                  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={`py-3 pr-4 font-semibold ${col.align === "right" ? "text-right" : ""}`}
                    >
                      {/* Sort button on screen; plain text when printed (so headings repeat on every page). */}
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={`no-print inline-flex items-center gap-1 uppercase hover:text-[#70263E] ${active ? "text-[#70263E]" : ""}`}
                      >
                        {col.label}
                        <Icon size={13} />
                      </button>
                      <span className="print-only">{col.label}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE7DD]">
              {rows.map((r) => (
                <tr key={r.appointment_id}>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {prettyDate(r.appointment_date)}
                    <span className="block text-xs text-[#82766E]">{r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}</span>
                  </td>
                  <td className="py-3 pr-4">{r.customer_name}</td>
                  <td className="py-3 pr-4">{r.service_name}</td>
                  <td className="py-3 pr-4">
                    {r.staff_name}
                    {r.staff_type && <span className="block text-xs capitalize text-[#82766E]">{r.staff_type}</span>}
                  </td>
                  <td className="py-3 pr-4">{label(r.status)}</td>
                  <td className="py-3 pr-4 capitalize">{r.payment_status}</td>
                  <td className="py-3 text-right whitespace-nowrap">{kes(r.total_amount)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#34251F] font-semibold">
                  <td className="py-3 pr-4" colSpan={6}>Total ({totals.bookings} bookings)</td>
                  <td className="py-3 text-right whitespace-nowrap">{kes(totals.value)}</td>
                </tr>
              </tfoot>
            )}
          </AdminTable>
        </div>

        {loading && !data && <p className="py-10 text-center text-[#82766E]">Building the report…</p>}
        {data && rows.length === 0 && (
          <p className="py-10 text-center text-[#82766E]">
            No appointments match this period and these filters. Try a wider date range or clear the filters.
          </p>
        )}
        {data?.truncated && (
          <p className="mt-4 text-xs text-[#9A6A2E]">Only the first 2,000 appointments are shown. Choose a shorter period to see everything.</p>
        )}

        <footer className="mt-8 border-t border-[#E7DED3] pt-4 text-xs text-[#9A8B80]">
          {salonName} · Confidential — for internal use · Amounts in Kenyan shillings (KES)
        </footer>
      </article>
    </section>
  );
}

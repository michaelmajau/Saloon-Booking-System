import { AdminTable } from "./components/AdminUI";
import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { api } from "../../lib/api";

/**
 * Admin → Audit trail
 * Shows who changed what and when (bookings, staff, services, settings),
 * read from the audit_logs table that the server writes to.
 */

type Log = {
  id: string;
  created_at: string;
  user_id: string | null;
  actor_name: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

type AuditData = { truncated: boolean; logs: Log[] };

/** Plain-English names for the actions the server records. */
const ACTION_LABELS: Record<string, string> = {
  CREATE_APPOINTMENT: "Created a booking",
  UPDATE_APPOINTMENT: "Updated a booking",
  CREATE_STAFF: "Invited a team member",
  UPDATE_STAFF: "Updated a team member",
  CREATE_SERVICE: "Added a service",
  UPDATE_SERVICE: "Updated a service",
  DELETE_SERVICE: "Deleted a service",
  UPDATE_SALON_SETTINGS: "Changed salon settings",
  CANCEL_APPOINTMENT: "Cancelled a booking",
};

const actionLabel = (action: string) =>
  ACTION_LABELS[action] ?? action.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const actionTone = (action: string) =>
  action.startsWith("DELETE")
    ? "bg-red-50 text-red-700"
    : action.startsWith("CREATE")
      ? "bg-[#EEF3EC] text-[#3E5A3D]"
      : "bg-[#F3ECE3] text-[#5F5047]";

const isoDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return isoDate(d); };

const show = (value: unknown) =>
  value === null || value === undefined || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);

/** Fields whose value changed between the old and new record. */
function changes(log: Log) {
  const keys = [...new Set([...Object.keys(log.old_data ?? {}), ...Object.keys(log.new_data ?? {})])];
  return keys
    .map((key) => ({ key, before: log.old_data?.[key], after: log.new_data?.[key] }))
    .filter(({ before, after }) => !log.old_data || !log.new_data || show(before) !== show(after));
}

export default function AuditLogs() {
  const [from, setFrom] = useState(() => daysAgo(6));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [action, setAction] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    if (!from || !to) return setError("Choose a start and end date.");
    if (from > to) return setError("The start date must be on or before the end date.");
    setLoading(true);
    setError("");
    try {
      setData(await api<AuditData>(`/admin/audit-logs?from=${from}&to=${to}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load the audit trail. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void load();
  };

  const actions = useMemo(() => [...new Set((data?.logs ?? []).map((l) => l.action))].sort(), [data]);

  const logs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.logs ?? []).filter((l) =>
      (action === "all" || l.action === action) &&
      (!q || `${l.actor_name} ${actionLabel(l.action)} ${l.entity_type ?? ""} ${l.entity_id ?? ""} ${JSON.stringify(l.new_data ?? {})}`.toLowerCase().includes(q)),
    );
  }, [data, action, query]);

  const inputClass = "h-11 w-full border border-[#D7CABC] bg-white px-3 text-sm text-[#34251F] outline-none focus:border-[#70263E]";

  return (
    <section className="bk-operations">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.25em] text-[#70263E]">Bookify admin · Security</p>
        <h1 className="mt-5 font-serif text-5xl leading-none text-[#34251F] sm:text-6xl">Security & Audit Logs</h1>
        <p className="mt-5 max-w-2xl text-[#82766E]">
          A record of every change made by admins, staff and customers: who did it, what changed and when. Entries can't be edited or deleted from here.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 grid gap-4 bg-[#FFFCF8] p-6 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-[#5F5047]">
          From
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={`mt-2 ${inputClass}`} required />
        </label>
        <label className="text-xs font-semibold text-[#5F5047]">
          To
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={`mt-2 ${inputClass}`} required />
        </label>
        <label className="text-xs font-semibold text-[#5F5047]">
          Action
          <select value={action} onChange={(e) => setAction(e.target.value)} className={`mt-2 ${inputClass}`}>
            <option value="all">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={loading} className="h-11 w-full bg-[#34251F] text-sm font-semibold text-white disabled:opacity-60">
            {loading ? "Loading…" : "Show entries"}
          </button>
        </div>
        <label className="relative sm:col-span-2 lg:col-span-4">
          <span className="sr-only">Search</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8B80]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by person, action or record"
            className={`${inputClass} pl-9`}
          />
        </label>
      </form>

      {error && <p role="alert" className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <div className="mt-8 overflow-x-auto bg-white p-4 shadow-sm sm:p-8">
        <p className="mb-4 text-sm text-[#82766E]">
          {data ? `${logs.length} ${logs.length === 1 ? "entry" : "entries"}` : loading ? "Loading…" : ""}
        </p>
        <AdminTable className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#34251F] text-left text-xs uppercase tracking-wider text-[#5F5047]">
              <th scope="col" className="w-8 py-3" />
              <th scope="col" className="py-3 pr-4">When</th>
              <th scope="col" className="py-3 pr-4">Who</th>
              <th scope="col" className="py-3 pr-4">What</th>
              <th scope="col" className="py-3 pr-4">Record</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => {
              const expanded = open === l.id;
              const diff = changes(l);
              return (
                <Fragment key={l.id}>
                  <tr className="border-b border-[#EFE7DD] align-top">
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : l.id)}
                        aria-expanded={expanded}
                        aria-label={expanded ? "Hide details" : "Show details"}
                        className="text-[#70263E]"
                      >
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="py-3 pr-4">{l.actor_name}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block px-2 py-1 text-xs font-semibold ${actionTone(l.action)}`}>{actionLabel(l.action)}</span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-[#82766E]">
                      <span className="capitalize">{(l.entity_type ?? "").replace(/_/g, " ")}</span>
                      {l.entity_id && <span className="block font-mono">{l.entity_id.slice(0, 8)}…</span>}
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-[#EFE7DD] bg-[#FBF8F4]">
                      <td />
                      <td colSpan={4} className="py-4 pr-4">
                        {diff.length === 0 ? (
                          <p className="text-xs text-[#82766E]">No field details were recorded for this entry.</p>
                        ) : (
                          <table className="text-xs">
                            <thead>
                              <tr className="text-left text-[#5F5047]">
                                <th className="pb-2 pr-6">Field</th>
                                {l.old_data && <th className="pb-2 pr-6">Before</th>}
                                {l.new_data && <th className="pb-2">{l.old_data ? "After" : "Value"}</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {diff.map(({ key, before, after }) => (
                                <tr key={key}>
                                  <td className="py-1 pr-6 font-semibold">{key.replace(/_/g, " ")}</td>
                                  {l.old_data && <td className="py-1 pr-6 text-red-700">{show(before)}</td>}
                                  {l.new_data && <td className="py-1 text-[#3E5A3D]">{show(after)}</td>}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </AdminTable>
        {data && logs.length === 0 && (
          <p className="py-10 text-center text-[#82766E]">No changes were recorded for this period and filter. Try a wider date range.</p>
        )}
        {data?.truncated && (
          <p className="mt-4 text-xs text-[#9A6A2E]">Only the latest 2,000 entries are shown. Choose a shorter period to see everything.</p>
        )}
      </div>
    </section>
  );
}

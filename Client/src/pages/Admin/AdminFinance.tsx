import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { api } from "../../lib/api";
import { salonDate } from "./dashboardData";
import { dateQuery, exportCsv, money, useBusinessData } from "./businessData";
import type { FinanceSummary } from "./businessData";
import { BusinessHeading, BusinessTable, Pagination, RecordDrawer } from "./components/BusinessUI";
import { AdminError, StatCard } from "./components/AdminUI";

type Transaction = { reference: string; source: string; transaction_date: string; amount: number; payment_method: string | null; payment_status: string };
type Expense = { expense_id: string; category: string; description: string; amount: number; expense_date: string };
const transactionColumns = ["Reference", "Source", "Amount", "Method", "Date", "Status"];
const expenseColumns = ["Reference", "Category", "Description", "Amount", "Date"];
const methods: Record<string, string> = { cash: "Cash", mpesa: "M-Pesa", card: "Card", bank: "Bank" };

export default function AdminFinance({ mode }: { mode: "transactions" | "expenses" }) {
  const [today] = useState(salonDate);
  const [from, setFrom] = useState(() => today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [expenseId, setExpenseId] = useState<string>();
  const expenses = mode === "expenses";
  const valid = !!from && !!to && from <= to && Date.parse(to) - Date.parse(from) <= 366 * 86400000;
  const query = dateQuery(from, to);
  const list = useBusinessData<{ transactions?: Transaction[]; expenses?: Expense[] }>(valid ? `/admin/${mode}?${query}&offset=${offset}` : "");
  const finance = useBusinessData<{ summary: FinanceSummary }>(valid ? `/admin/finance/summary?${query}` : "");
  const columns = expenses ? expenseColumns : transactionColumns;
  const all = expenses ? (list.data?.expenses ?? []).map((row) => [row.expense_id, row.category, row.description, money(row.amount), row.expense_date])
    : (list.data?.transactions ?? []).map((row) => [row.reference, row.source === "pos" ? "Point of sale" : "Appointment", money(row.amount), row.payment_method ? methods[row.payment_method] ?? row.payment_method : "—", row.transaction_date, row.payment_status]);
  const rows = all.filter((row) => row.some((cell) => cell.toLowerCase().includes(search.trim().toLowerCase())));
  const summary = finance.data?.summary;
  const totals = [
    ["Total revenue", summary?.gross_revenue], ["Total expenses", summary?.total_expenses],
    ["Net income", summary?.net_income], ["Outstanding", summary?.outstanding],
  ] as const;

  return <>
    <BusinessHeading title={expenses ? "Expenses" : "Transactions"} description={expenses ? "Record and categorize operating costs." : "Review payments, refunds and outstanding balances."}
      action={expenses ? <button type="button" className="admin-primary" onClick={() => setExpenseId(crypto.randomUUID())}><Plus size={17} />Record expense</button> : undefined} />
    <div className="bk-finance-stats">{totals.map(([label, value]) => <StatCard key={label} label={label} value={value == null ? "—" : money(value)} detail={finance.loading ? "Loading…" : "Selected date range"} />)}</div>
    {finance.error && <AdminError message={finance.error} onRetry={finance.reload} />}
    <section className="bk-card bk-panel">
      <div className="bk-business-toolbar">
        <input className="bk-field" aria-label="Search this page" placeholder="Search this page…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <label>From <input className="bk-field" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setOffset(0); }} /></label>
        <label>To <input className="bk-field" type="date" value={to} onChange={(event) => { setTo(event.target.value); setOffset(0); }} /></label>
        <button type="button" className="admin-secondary" disabled={!rows.length} onClick={() => exportCsv(mode + "-page", [columns, ...rows])}><Download size={16} />Export page</button>
      </div>
      {!valid ? <p role="alert" className="admin-error">Choose a valid date range of up to one year.</p> : <>
        <BusinessTable {...list} columns={columns} empty={!rows.length}>{rows.map((row) => <tr key={row[0] + row[1]}>{row.map((cell, index) => <td key={columns[index]}>
          {!expenses && index === 5 ? <span className="bk-pill" data-status={cell}>{cell}</span> : index === 0 ? <span title={cell}>{cell.slice(0, 8).toUpperCase()}</span> : cell}
        </td>)}</tr>)}</BusinessTable>
        <Pagination offset={offset} count={all.length} onChange={setOffset} />
      </>}
    </section>
    {expenseId && <RecordDrawer title="Record expense" onClose={() => setExpenseId(undefined)} onSave={async (form) => {
      const expenseDate = String(form.get("expenseDate"));
      await api("/admin/expenses", { method: "POST", body: JSON.stringify({ expenseId, category: form.get("category"), description: form.get("description"), amount: Number(form.get("amount")), expenseDate }) });
      if (!valid || expenseDate < from || expenseDate > to) { setFrom(expenseDate.slice(0, 8) + "01"); setTo(expenseDate); }
      setOffset(0); setSearch(""); list.reload(); finance.reload();
    }}>
      <label>Category<input name="category" required maxLength={100} /></label>
      <label>Description<textarea name="description" required maxLength={300} rows={3} /></label>
      <label>Amount (KES)<input name="amount" type="number" min=".01" max="9999999999.99" step=".01" required /></label>
      <label>Date<input name="expenseDate" type="date" defaultValue={today} required /></label>
    </RecordDrawer>}
  </>;
}

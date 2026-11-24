import { useState } from "react";
import { Plus, Search, ShoppingCart, X } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { messageFor, money, useBusinessData } from "./businessData";
import type { Customer, Product } from "./businessData";
import type { Service } from "./dashboardData";
import { AdminError } from "./components/AdminUI";
import { BusinessHeading, Pagination } from "./components/BusinessUI";

type Item = { id: string; kind: "service" | "product"; name: string; price: number; detail: string; stock?: number };
type Line = Item & { quantity: number };
type Sale = { sale_id: string; total: number };
const methods = [["cash", "Cash"], ["mpesa", "M-Pesa"], ["card", "Card"], ["bank", "Bank"]] as const;

export default function AdminPOS() {
  const [tab, setTab] = useState<"service" | "product">("service");
  const [offset, setOffset] = useState(0);
  const [customerOffset, setCustomerOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer>();
  const [cart, setCart] = useState<Line[]>([]);
  const [method, setMethod] = useState<(typeof methods)[number][0]>("cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string>();
  const [receipt, setReceipt] = useState<Sale>();
  const services = useBusinessData<{ services: Service[] }>("/admin/services");
  const products = useBusinessData<{ products: Product[] }>(`/admin/inventory?offset=${offset}`);
  const customers = useBusinessData<{ customers: Customer[] }>(`/admin/customers?offset=${customerOffset}`);
  const customerRows = customers.data?.customers ?? [];
  const source = tab === "service" ? services : products;
  const catalogue: Item[] = tab === "service"
    ? (services.data?.services ?? []).map((row) => ({ kind: "service", id: row.service_id, name: row.service_name, price: row.price, detail: row.duration_minutes + " min" }))
    : (products.data?.products ?? []).filter((row) => row.is_active && row.selling_price !== null).map((row) => ({
        kind: "product", id: row.product_id, name: row.name, price: Number(row.selling_price), detail: row.stock + " in stock", stock: row.stock,
      }));
  const visible = catalogue.filter((row) => row.name.toLowerCase().includes(search.trim().toLowerCase()));
  const key = (item: Item) => item.kind + ":" + item.id;
  const total = cart.reduce((sum, row) => sum + row.price * row.quantity, 0);
  const locked = busy || !!pendingId;

  function add(item: Item) {
    setReceipt(undefined);
    setCart((current) => {
      const line = current.find((candidate) => key(item) === key(candidate));
      return line ? current.map((candidate) => candidate === line ? { ...candidate, quantity: line.quantity + 1 } : candidate)
        : [...current, { ...item, quantity: 1 }];
    });
  }

  function complete(sale: Sale) {
    setReceipt(sale);
    setPendingId(undefined);
    setCart([]);
    setSelected(undefined);
    setError("");
    products.reload();
  }

  async function record() {
    const saleId = pendingId ?? crypto.randomUUID();
    setPendingId(saleId);
    setBusy(true);
    setError("");
    try {
      const { sale } = await api<{ sale: Sale }>("/admin/pos/sales", {
        method: "POST", signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          saleId, method, customerId: selected?.customer_id, customerKind: selected?.kind,
          items: cart.map(({ id, kind, quantity }) => ({ id, kind, quantity })),
        }),
      });
      complete(sale);
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 409) {
        if (!pendingId) setPendingId(undefined);
        setError(messageFor(error));
      } else {
        try {
          const { sale } = await api<{ sale: Sale }>(`/admin/pos/sales/${saleId}`, { signal: AbortSignal.timeout(10000) });
          complete(sale);
        } catch (lookupError) {
          if (error instanceof ApiError && error.status === 409 && lookupError instanceof ApiError && lookupError.status === 404) {
            setPendingId(undefined);
            products.reload();
            setError(messageFor(error));
          } else {
            setError(`Could not confirm sale ${saleId}. Retry to check the same sale reference.`);
          }
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return <>
    <BusinessHeading title="Point of Sale" description="Record in-person services, products and payments." />
    <div className="bk-pos-grid">
      <section className="bk-card bk-panel">
        <label className="bk-business-search"><Search size={17} /><input aria-label="Search catalogue" placeholder="Search services or products…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="bk-business-tabs">
          <button type="button" aria-pressed={tab === "service"} onClick={() => { setTab("service"); setSearch(""); }}>Services</button>
          <button type="button" aria-pressed={tab === "product"} onClick={() => { setTab("product"); setSearch(""); }}>Products</button>
        </div>
        {source.error && <AdminError message={source.error} onRetry={source.reload} />}
        {source.loading && <p role="status">Loading catalogue…</p>}
        {!source.loading && !source.error && !visible.length && <p className="bk-muted">No items to display.</p>}
        <div className="bk-pos-catalogue">{visible.map((item) => {
          const quantity = cart.find((line) => key(line) === key(item))?.quantity ?? 0;
          const unavailable = quantity >= Math.min(item.stock ?? 1000, 1000) || (!quantity && cart.length >= 50);
          return <button type="button" className="bk-pos-item" key={key(item)} disabled={locked || unavailable} onClick={() => add(item)}>
            <span><strong>{item.name}</strong><small>{item.detail}</small></span><strong>{money(item.price)}</strong><Plus size={16} />
          </button>;
        })}</div>
        {tab === "product" && <Pagination offset={offset} count={products.data?.products.length ?? 0} onChange={setOffset} />}
      </section>
      <section className="bk-card bk-panel bk-pos-checkout">
        <header className="bk-panel-header"><div><p className="bk-eyebrow">Current sale</p><h2>Checkout</h2></div><ShoppingCart size={24} /></header>
        <label className="bk-pos-customer">Customer
          <select className="bk-field" value={selected ? selected.kind + ":" + selected.customer_id : ""} disabled={locked} onChange={(event) => setSelected(customerRows.find((row) => row.kind + ":" + row.customer_id === event.target.value))}>
            <option value="">Guest checkout</option>
            {selected && !customerRows.some((row) => row.kind === selected.kind && row.customer_id === selected.customer_id) && <option value={selected.kind + ":" + selected.customer_id}>{selected.full_name}</option>}
            {customerRows.map((row) => <option key={row.kind + row.customer_id} value={row.kind + ":" + row.customer_id}>{row.full_name || row.email || row.customer_id}{row.email ? " · " + row.email : ""}</option>)}
          </select>
        </label>
        {customers.error && <AdminError message={customers.error} onRetry={customers.reload} />}
        {(customerOffset > 0 || customerRows.length === 100) && !locked && <Pagination offset={customerOffset} count={customerRows.length} onChange={setCustomerOffset} />}
        <ul className="bk-pos-lines">{cart.map((line) => <li key={key(line)}><span><strong>{line.name}</strong><small>Qty {line.quantity}</small></span>
          <strong>{money(line.price * line.quantity)}</strong><button type="button" aria-label={"Remove " + line.name} disabled={locked} onClick={() => setCart((current) => current.filter((item) => key(item) !== key(line)))}><X size={16} /></button></li>)}</ul>
        {!cart.length && <p className="bk-muted">Add a service or product to start a sale.</p>}
        <div className="bk-pos-total"><span>Estimated total</span><strong>{money(total)}</strong></div>
        <div className="bk-payment-methods" role="group" aria-label="Payment method">{methods.map(([value, label]) => <button className="admin-secondary" type="button" aria-pressed={method === value} key={value} disabled={locked} onClick={() => setMethod(value)}>{label}</button>)}</div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {receipt && <p className="admin-notice" role="status">Recorded {money(receipt.total)}. Sale reference {receipt.sale_id}.</p>}
        <button type="button" className="admin-primary bk-pos-record" disabled={busy || !cart.length} onClick={() => void record()}>
          {busy ? "Recording…" : pendingId ? "Retry recording payment" : `Record ${methods.find(([value]) => value === method)?.[1]} payment · ${money(total)}`}
        </button>
        <p className="bk-muted">Use this after receiving payment. Checkout records the sale at current catalogue prices.</p>
      </section>
    </div>
  </>;
}

import { useState } from "react";
import { AdminModal } from "./components/AdminUI";
import { Download, Plus, Search } from "lucide-react";
import { api } from "../../lib/api";
import { exportCsv, money, useBusinessData } from "./businessData";
import type { Customer, Product } from "./businessData";
import { BusinessHeading, BusinessTable, Pagination, RecordDrawer } from "./components/BusinessUI";

const customerColumns = ["Customer", "Phone", "Email", "Visits", "Lifetime value", "Type"];
const productColumns = ["Product", "Category", "Stock", "Purchase", "Selling", "Supplier", "Status", "Actions"];
const stockStatus = (item: Product) => !item.is_active ? "Inactive" : item.stock === 0 ? "Out of stock" : item.stock <= item.low_stock_threshold ? "Low stock" : "Healthy";

export function CustomersPage() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [adding, setAdding] = useState(false);
  const page = useBusinessData<{ customers: Customer[] }>(`/admin/customers?offset=${offset}`);
  const customers = page.data?.customers ?? [];
  const visible = customers.filter((row) => (kind === "all" || row.kind === kind) &&
    [row.full_name, row.email, row.phone].some((value) => value?.toLowerCase().includes(search.trim().toLowerCase())));
  const cells = (row: Customer) => [row.full_name || "Customer", row.phone, row.email, row.visits, money(row.lifetime_value), row.kind === "registered" ? "Registered" : "Walk-in"];

  return <>
    <BusinessHeading title="Customers" description="Build stronger relationships with every visit." action={<button className="admin-primary" onClick={() => setAdding(true)}><Plus size={17} />Add customer</button>} />
    <section className="bk-card bk-panel">
      <div className="bk-business-tabs">{[["all", "All customers"], ["registered", "Registered"], ["walk_in", "Walk-ins"]].map(([value, label]) => <button type="button" key={value} aria-pressed={kind === value} onClick={() => setKind(value)}>{label}</button>)}</div>
      <div className="bk-business-toolbar">
        <label className="bk-business-search"><Search size={17} /><input placeholder="Search this page…" aria-label="Search customers on this page" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <button type="button" className="admin-secondary" disabled={!visible.length} onClick={() => exportCsv("customers-page", [customerColumns, ...visible.map(cells)])}><Download size={16} />Export page</button>
      </div>
      <BusinessTable {...page} columns={customerColumns} empty={!visible.length}>{visible.map((row) => <tr key={row.kind + row.customer_id}>
        {cells(row).map((cell, index) => <td key={customerColumns[index]}>{index === 0 ? <strong>{cell}</strong> : index === 5 ? <span className="bk-pill">{cell}</span> : cell ?? "—"}</td>)}
      </tr>)}</BusinessTable>
      <Pagination offset={offset} count={customers.length} onChange={setOffset} />
    </section>
    {adding && <RecordDrawer title="Add customer" onClose={() => setAdding(false)} onSave={async (form) => {
      await api("/admin/customers", { method: "POST", body: JSON.stringify({ fullName: form.get("fullName"), email: form.get("email") || null, phone: form.get("phone") || null }) });
      setSearch(""); setKind("all"); setOffset(0); page.reload();
    }}>
      <label>Customer name<input required name="fullName" maxLength={150} /></label>
      <label>Email<input type="email" name="email" maxLength={254} /></label>
      <label>Phone<input type="tel" name="phone" maxLength={40} /></label>
    </RecordDrawer>}
  </>;
}

type Movement = { movement_id: string; quantity: number; reason: string; created_at: string };
function StockHistory({ product, onClose }: { product: Product; onClose: () => void }) {
  const [offset, setOffset] = useState(0);
  const page = useBusinessData<{ movements: Movement[] }>(`/admin/inventory/${product.product_id}/movements?offset=${offset}`);
  const rows = page.data?.movements ?? [];
  return <AdminModal drawer title={product.name + " stock history"} onClose={onClose}><div className="bk-stock-history">
    <BusinessTable {...page} columns={["Date", "Change", "Reason"]} empty={!rows.length}>{rows.map((row) => <tr key={row.movement_id}><td>{new Date(row.created_at).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi" })}</td><td>{row.quantity > 0 ? "+" : ""}{row.quantity}</td><td>{row.reason}</td></tr>)}</BusinessTable>
    <Pagination offset={offset} count={rows.length} onChange={setOffset} />
  </div></AdminModal>;
}


export function InventoryPage() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [adjusting, setAdjusting] = useState<Product>();
  const [history, setHistory] = useState<Product>();
  const page = useBusinessData<{ products: Product[] }>(`/admin/inventory?offset=${offset}`);
  const products = page.data?.products ?? [];
  const visible = products.filter((row) => [row.name, row.category, row.supplier].some((value) => value?.toLowerCase().includes(search.trim().toLowerCase())));
  const cells = (row: Product) => [row.name, row.category, row.stock, money(row.purchase_price), row.selling_price == null ? null : money(row.selling_price), row.supplier, stockStatus(row)];

  return <>
    <BusinessHeading title="Inventory" description="Track products, suppliers and stock movements." action={<button className="admin-primary" onClick={() => setAdding(true)}><Plus size={17} />Add product</button>} />
    <section className="bk-card bk-panel">
      <div className="bk-business-toolbar">
        <label className="bk-business-search"><Search size={17} /><input placeholder="Search this page…" aria-label="Search inventory on this page" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <button type="button" className="admin-secondary" disabled={!visible.length} onClick={() => exportCsv("inventory-page", [productColumns.slice(0, -1), ...visible.map(cells)])}><Download size={16} />Export page</button>
      </div>
      <BusinessTable {...page} columns={productColumns} empty={!visible.length}>{visible.map((row) => <tr key={row.product_id}>
        {cells(row).map((cell, index) => <td key={productColumns[index]}>{index === 0 ? <strong>{cell}</strong> : index === 6 ? <span className="bk-pill" data-status={cell === "Healthy" ? "paid" : cell === "Low stock" ? "pending" : undefined}>{cell}</span> : cell ?? "—"}</td>)}
        <td><div className="bk-actions"><button type="button" className="admin-secondary" onClick={() => setAdjusting(row)}>Adjust stock</button><button type="button" className="admin-secondary" onClick={() => setHistory(row)}>History</button></div></td>
      </tr>)}</BusinessTable>
      <Pagination offset={offset} count={products.length} onChange={setOffset} />
    </section>
    {adding && <RecordDrawer title="Add product" onClose={() => setAdding(false)} onSave={async (form) => {
      await api("/admin/inventory", { method: "POST", body: JSON.stringify({
        name: form.get("name"), category: form.get("category") || null, supplier: form.get("supplier") || null,
        purchasePrice: Number(form.get("purchasePrice")), sellingPrice: form.get("sellingPrice") === "" ? null : Number(form.get("sellingPrice")),
        lowStockThreshold: Number(form.get("lowStockThreshold")),
      }) });
      setOffset(0); setSearch(""); page.reload();
    }}>
      <label>Product name<input required name="name" maxLength={150} /></label>
      <label>Category<input name="category" maxLength={100} /></label>
      <label>Supplier<input name="supplier" maxLength={150} /></label>
      <div className="admin-form-row"><label>Purchase price (KES)<input type="number" min="0" step=".01" required name="purchasePrice" /></label><label>Selling price (KES)<input type="number" min="0" step=".01" name="sellingPrice" /></label></div>
      <label>Low-stock threshold<input type="number" min="0" max="1000000" defaultValue="5" required name="lowStockThreshold" /></label>
      <p className="bk-muted">Products start with zero stock. Use Adjust stock to record the opening quantity.</p>
    </RecordDrawer>}
    {adjusting && <RecordDrawer title={"Adjust stock · " + adjusting.name} onClose={() => setAdjusting(undefined)} onSave={async (form) => {
      await api(`/admin/inventory/${adjusting.product_id}/adjustments`, { method: "POST", body: JSON.stringify({ quantity: Number(form.get("quantity")), reason: form.get("reason") }) });
      page.reload();
    }}>
      <label>Quantity change<input type="number" min={-Math.min(adjusting.stock, 1000000)} max="1000000" required name="quantity" /></label>
      <p className="bk-muted">Use a negative number to remove stock.</p>
      <label>Reason<input required name="reason" maxLength={200} /></label>
    </RecordDrawer>}
    {history && <StockHistory product={history} onClose={() => setHistory(undefined)} />}
  </>;
}

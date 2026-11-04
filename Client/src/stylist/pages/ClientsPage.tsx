import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHead } from "../components/StylistLayout";
import { Modal } from "../components/Modal";
import { StatusPill, useAppointmentActions } from "../components/appointments";
import { fmt, today } from "../lib/dates";
import { initial, isEmail, money } from "../lib/format";
import { appointments, getService, isActive } from "../lib/selectors";
import type { Appointment, Client } from "../lib/types";
import { useStore } from "../store/StoreProvider";
import { useUI } from "../store/UIProvider";

export function ClientsPage() {
  const { db } = useStore();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("id"); // /staff/clients?id=c3 opens that client
  const ui = useUI();
  const [query, setQuery] = useState("");
  const t = today();

  const q = query.trim().toLowerCase();
  const list = [...db.clients]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")));
  const selected = db.clients.find((c) => c.id === selectedId) ?? list[0];

  const select = (id: string) => {
    setParams({ id }, { replace: true });
    if (window.innerWidth < 1080) document.getElementById("client-detail")?.scrollIntoView({ behavior: "smooth" });
  };

  const openForm = (existing?: Client) =>
    ui.openModal((close) => <ClientForm existing={existing} close={close} onAdded={(c) => select(c.id)} />);

  return (
    <>
      <PageHead
        eyebrow="Clients"
        title="Your regulars."
        lede="Notes, history and the details that make each visit feel personal."
        actions={<button type="button" className="btn btn-primary" onClick={() => openForm()}>+ Add client</button>}
      />

      <div className="clients-layout">
        <div className="card" style={{ padding: 20 }}>
          <label className="sr-only" htmlFor="client-search">Search clients</label>
          <input className="input" id="client-search" type="search" placeholder="Search by name or phone" style={{ marginBottom: 8 }}
            value={query} onChange={(e) => setQuery(e.target.value)} />
          <ul className="client-list">
            {list.length ? list.map((c) => {
              const next = appointments(db, (a) => a.clientId === c.id && a.date >= t && isActive(a))[0];
              return (
                <li key={c.id}>
                  <button type="button" aria-current={c.id === selected?.id ? "true" : undefined} onClick={() => select(c.id)}>
                    <span className="avatar" aria-hidden="true">{initial(c.name)}</span>
                    <span>
                      <span className="cname">{c.name}</span><br />
                      <span className="csub">{next ? `Next: ${fmt(next.date)}, ${next.start}` : c.phone || "No phone"}</span>
                    </span>
                  </button>
                </li>
              );
            }) : <li className="empty">No clients match “{query}”.</li>}
          </ul>
        </div>

        <div className="card" id="client-detail">
          {selected
            ? <ClientDetail key={selected.id} client={selected} onEdit={() => openForm(selected)} />
            : <div className="empty"><strong>No client selected</strong>Choose someone from the list.</div>}
        </div>
      </div>
    </>
  );
}

function ClientDetail({ client: c, onEdit }: { client: Client; onEdit: () => void }) {
  const store = useStore();
  const { db } = store;
  const ui = useUI();
  const { openDetails, openBooking } = useAppointmentActions();
  const [notes, setNotes] = useState(c.notes);
  useEffect(() => setNotes(c.notes), [c.notes]);

  const t = today();
  const visits = appointments(db, (a) => a.clientId === c.id);
  const done = visits.filter((a) => a.status === "completed");
  const upcoming = visits.filter((a) => a.date >= t && isActive(a) && a.status !== "completed");
  const history = visits.filter((a) => !upcoming.includes(a)).reverse();
  const spend = done.reduce((sum, a) => sum + getService(db, a.serviceId).price + (a.tip || 0), 0);
  const last = done[done.length - 1];

  const Row = ({ a }: { a: Appointment }) => (
    <li>
      <span className="hdate">{fmt(a.date, { day: "numeric", month: "short", year: "numeric" })}</span>
      <span>
        <button type="button" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", fontWeight: 600 }}
          onClick={() => openDetails(a.id)}>{getService(db, a.serviceId).name}</button>
        <span className="muted small"> · {a.start}</span>
      </span>
      <StatusPill status={a.status} />
    </li>
  );

  function saveNotes(e: FormEvent) {
    e.preventDefault();
    store.updateClient(c.id, { notes: notes.trim() });
    ui.toast("Notes saved.");
  }

  return (
    <>
      <div className="detail-head" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <span className="avatar lg" aria-hidden="true">{initial(c.name)}</span>
          <div>
            <h3>{c.name}</h3>
            <div className="muted small">
              {c.phone ? <a href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a> : "No phone"}
              {c.email && <> · <a href={`mailto:${c.email}`}>{c.email}</a></>}
            </div>
            <div className="muted small">Client since {fmt(c.since, { month: "long", year: "numeric" })}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-outline" onClick={onEdit}>Edit details</button>
          <button type="button" className="btn btn-primary" onClick={() => openBooking({ clientId: c.id })}>Book</button>
        </div>
      </div>

      <div className="client-stats">
        <div><div className="v">{done.length}</div><div className="l">Visits</div></div>
        <div><div className="v">{last ? fmt(last.date, { day: "numeric", month: "short" }) : "—"}</div><div className="l">Last visit</div></div>
        <div><div className="v">{money(spend)}</div><div className="l">Spent incl. tips</div></div>
      </div>

      <form className="field" onSubmit={saveNotes}>
        <label htmlFor="client-notes">Notes</label>
        <textarea className="input" id="client-notes" placeholder="Hair type, colour formulas, preferences…"
          value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div><button type="submit" className="btn btn-outline" disabled={notes.trim() === c.notes}>Save notes</button></div>
      </form>

      {upcoming.length > 0 && <>
        <p className="eyebrow" style={{ marginTop: 28 }}>Upcoming</p>
        <ul className="history">{upcoming.map((a) => <Row key={a.id} a={a} />)}</ul>
      </>}
      <p className="eyebrow" style={{ marginTop: 28 }}>History</p>
      <ul className="history">
        {history.length ? history.map((a) => <Row key={a.id} a={a} />) : <li className="muted">No past visits yet.</li>}
      </ul>
    </>
  );
}

function ClientForm({ existing, close, onAdded }: { existing?: Client; close: () => void; onAdded: (c: Client) => void }) {
  const store = useStore();
  const ui = useUI();
  const [name, setName] = useState(existing?.name ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<{ field: string; text: string } | null>(null);

  useEffect(() => { if (error) document.getElementById(error.field)?.focus(); }, [error]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError({ field: "cf-name", text: "Enter the client's name." });
    if (email && !isEmail(email)) return setError({ field: "cf-email", text: "That email doesn't look right." });
    const data = { name: name.trim(), phone: phone.trim(), email: email.trim() };
    if (existing) {
      store.updateClient(existing.id, data);
      ui.toast("Client updated.");
    } else {
      const c = store.addClient({ ...data, notes: notes.trim() });
      onAdded(c);
      ui.toast(`${c.name} added.`);
    }
    close();
  }

  return (
    <Modal title={existing ? "Edit client" : "Add client"} onClose={close} footer={<>
      <button type="button" className="btn btn-outline" onClick={close}>Cancel</button>
      <button type="submit" form="client-form" className="btn btn-primary">{existing ? "Save" : "Add client"}</button>
    </>}>
      <form id="client-form" noValidate onSubmit={submit}>
        {error && <div className="form-error" role="alert">{error.text}</div>}
        <div className="field">
          <label htmlFor="cf-name">Full name</label>
          <input className="input" id="cf-name" autoComplete="off" value={name}
            aria-invalid={error?.field === "cf-name" || undefined} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="cf-phone">Phone</label>
            <input className="input" id="cf-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cf-email">Email</label>
            <input className="input" id="cf-email" type="email" value={email}
              aria-invalid={error?.field === "cf-email" || undefined} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        {!existing && (
          <div className="field">
            <label htmlFor="cf-notes">Notes</label>
            <textarea className="input" id="cf-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        )}
      </form>
    </Modal>
  );
}

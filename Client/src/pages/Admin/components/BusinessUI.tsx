import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AdminError, AdminModal, AdminTable } from "./AdminUI";
import { messageFor } from "../businessData";

export function BusinessHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="bk-page-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

export function BusinessTable({ columns, children, loading, error, reload, empty }: {
  columns: string[]; children: ReactNode; loading: boolean; error?: string; reload: () => void; empty: boolean;
}) {
  return <>
    {error && <AdminError message={error} onRetry={reload} />}
    <AdminTable className="bk-table bk-business-table" aria-busy={loading}>
      <thead><tr>{columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
      <tbody>{loading || empty || error ? <tr><td colSpan={columns.length} className="bk-muted">{loading ? "Loading records…" : error ? "Records unavailable." : "No records to display."}</td></tr> : children}</tbody>
    </AdminTable>
  </>;
}

export function Pagination({ offset, count, onChange }: { offset: number; count: number; onChange: (offset: number) => void }) {
  return <div className="bk-actions bk-pagination">
    <button className="admin-secondary" type="button" disabled={!offset} onClick={() => onChange(Math.max(0, offset - 100))}>Previous</button>
    <span>Page {offset / 100 + 1}</span>
    <button className="admin-secondary" type="button" disabled={count < 100} onClick={() => onChange(offset + 100)}>Next</button>
  </div>;
}

export function RecordDrawer({ title, children, onClose, onSave, submitLabel = "Save" }: {
  title: string; children: ReactNode; onClose: () => void; onSave: (data: FormData) => Promise<void>; submitLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(new FormData(event.currentTarget));
      onClose();
    } catch (error) {
      setError(messageFor(error));
      setBusy(false);
    }
  }

  return <AdminModal drawer title={title} busy={busy} onClose={onClose}>
    <form className="admin-booking-form" onSubmit={submit}>
      <fieldset disabled={busy}>{children}</fieldset>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <button className="admin-primary" type="submit" disabled={busy}>{busy ? "Saving…" : submitLabel}</button>
    </form>
  </AdminModal>;
}

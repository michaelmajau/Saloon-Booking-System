import { useEffect, useId, useRef } from "react";
import type { ReactNode, TableHTMLAttributes } from "react";
import { X } from "lucide-react";

export function AdminNavbar({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="admin-navbar">
      <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      {action}
    </header>
  );
}

export function StatCard({ label, value, detail }: { label: string; value: ReactNode; detail: string }) {
  return <article className="admin-stat"><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>;
}

export function AdminTable(props: TableHTMLAttributes<HTMLTableElement>) {
  return <div className="admin-table-scroll"><table {...props} /></div>;
}

export function AdminModal({ title, children, onClose, busy = false, drawer = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean; drawer?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog ref={dialog} className={drawer ? "admin-dialog bk-drawer" : "admin-dialog"} aria-labelledby={id} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <header><div>{drawer && <p className="bk-eyebrow">Quick add</p>}<h2 id={id}>{title}</h2></div><button type="button" className="admin-secondary" aria-label="Close" onClick={onClose} disabled={busy}><X size={18} /></button></header>
      {children}
    </dialog>
  );
}

export function AdminError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="admin-error" role="alert"><p>{message}</p><button type="button" className="admin-secondary" onClick={onRetry}>Retry</button></div>;
}

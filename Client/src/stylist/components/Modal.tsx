import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

/** Accessible dialog: Escape closes, focus stays inside, clicking the backdrop closes. */
export function Modal({ title, onClose, children, footer, width }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const first = el.querySelector<HTMLElement>(".modal-body input, .modal-body select, .modal-body textarea")
      ?? el.querySelector<HTMLElement>(".modal-foot .btn-primary")
      ?? el.querySelector<HTMLElement>("[data-close]");
    first?.focus();
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const f = el.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input, select, textarea");
        if (!f.length) return;
        const a = f[0], b = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { b.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === b) { a.focus(); e.preventDefault(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"
        style={width ? { width: `min(${width}px, 100%)` } : undefined}>
        <header className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-btn" data-close aria-label="Close" onClick={onClose}>&times;</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

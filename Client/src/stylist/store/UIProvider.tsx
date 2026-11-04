/** Toasts, modals and confirm dialogs, available anywhere through useUI(). */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal } from "../components/Modal";

type ModalRender = (close: () => void) => ReactNode;
interface ToastItem { id: number; message: string; undo?: () => void }
interface ModalItem { id: number; render: ModalRender; onClosed?: () => void }

interface ConfirmOptions { title?: string; ok?: string; danger?: boolean }

interface UIApi {
  toast: (message: string, undo?: () => void) => void;
  openModal: (render: ModalRender, onClosed?: () => void) => () => void;
  confirm: (message: string, opts?: ConfirmOptions) => Promise<boolean>;
}

const UIContext = createContext<UIApi | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [modals, setModals] = useState<ModalItem[]>([]);
  const nextId = useRef(1);

  const dismissToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  const toast = useCallback((message: string, undo?: () => void) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, undo }]);
    setTimeout(() => dismissToast(id), undo ? 6000 : 3200);
  }, []);

  const openModal = useCallback((render: ModalRender, onClosed?: () => void) => {
    const id = nextId.current++;
    setModals((m) => [...m, { id, render, onClosed }]);
    return () => setModals((m) => m.filter((x) => x.id !== id));
  }, []);

  const confirm = useCallback(
    (message: string, { title = "Are you sure?", ok = "Confirm", danger = false }: ConfirmOptions = {}) =>
      new Promise<boolean>((resolve) => {
        let answered = false;
        openModal(
          (close) => (
            <Modal title={title} onClose={close} footer={<>
              <button type="button" className="btn btn-outline" onClick={close}>Keep it</button>
              <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
                onClick={() => { answered = true; resolve(true); close(); }}>{ok}</button>
            </>}>
              <p className="muted">{message}</p>
            </Modal>
          ),
          () => { if (!answered) resolve(false); },
        );
      }),
    [openModal],
  );

  const api = useMemo(() => ({ toast, openModal, confirm }), [toast, openModal, confirm]);

  return (
    <UIContext.Provider value={api}>
      {children}
      {modals.map((m) => {
        const close = () => { setModals((all) => all.filter((x) => x.id !== m.id)); m.onClosed?.(); };
        return <div key={m.id}>{m.render(close)}</div>;
      })}
      <div className="toast-wrap" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <span>{t.message}</span>
            {t.undo && (
              <button type="button" onClick={() => { t.undo!(); dismissToast(t.id); }}>Undo</button>
            )}
          </div>
        ))}
      </div>
    </UIContext.Provider>
  );
}

export function useUI(): UIApi {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside <UIProvider>");
  return ctx;
}

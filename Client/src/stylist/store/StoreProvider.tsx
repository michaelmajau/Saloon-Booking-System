/**
 * Stylist data: the sample database, saved to localStorage for now.
 * Sign-in is handled by Supabase (see StylistLayout and TeamPortalPage).
 *
 * STEP 2: when the Express API is ready, replace the bodies of these
 * functions with fetch() calls — pages only use what useStore() returns.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { seed } from "../lib/seed";
import type { Appointment, Block, Client, Database, Prefs, Stylist, WeekHours } from "../lib/types";
import { today } from "../lib/dates";

const STORAGE_KEY = "chairco.stylist.v1";

function load(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Database;
  } catch {
    /* storage blocked — use fresh data */
  }
  return seed();
}

let counter = 1;
const newId = (prefix: string) => prefix + Date.now().toString(36) + (counter++).toString(36);

interface StoreApi {
  db: Database;
  updateStylist: (patch: Partial<Stylist>) => void;
  setHours: (hours: WeekHours) => void;
  setPrefs: (patch: Partial<Prefs>) => void;
  addClient: (data: Partial<Client> & { name: string }) => Client;
  updateClient: (id: string, patch: Partial<Client>) => void;
  addAppt: (data: Omit<Appointment, "id" | "status" | "tip"> & Partial<Appointment>) => Appointment;
  updateAppt: (id: string, patch: Partial<Appointment>) => void;
  addBlock: (data: Omit<Block, "id"> & Partial<Block>) => Block;
  removeBlock: (id: string) => void;
  reset: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(load);

  /** Apply a change to a copy of the database, then save it. */
  const change = useCallback((fn: (draft: Database) => void) => {
    setDb((prev) => {
      const next: Database = structuredClone(prev);
      fn(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const api = useMemo<StoreApi>(
    () => ({
      db,
      updateStylist: (patch) => change((d) => void Object.assign(d.stylist, patch)),
      setHours: (hours) => change((d) => void (d.hours = hours)),
      setPrefs: (patch) => change((d) => void Object.assign(d.prefs, patch)),

      addClient(data) {
        const c: Client = { id: newId("c"), phone: "", email: "", notes: "", since: today(), ...data };
        change((d) => void d.clients.push(c));
        return c;
      },
      updateClient: (id, patch) => change((d) => void Object.assign(d.clients.find((c) => c.id === id)!, patch)),

      addAppt(data) {
        const a: Appointment = { id: newId("a"), status: "confirmed", tip: 0, ...data };
        change((d) => void d.appointments.push(a));
        return a;
      },
      updateAppt: (id, patch) => change((d) => void Object.assign(d.appointments.find((a) => a.id === id)!, patch)),

      addBlock(data) {
        const b: Block = { id: newId("b"), ...data };
        change((d) => void d.blocks.push(b));
        return b;
      },
      removeBlock: (id) => change((d) => void (d.blocks = d.blocks.filter((b) => b.id !== id))),

      reset() {
        const fresh = seed();
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        } catch {
          /* ignore */
        }
        setDb(fresh);
      },
    }),
    [db, change],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

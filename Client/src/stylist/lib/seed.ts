/**
 * Builds the sample database from the JSON files in src/data.
 * Appointments are generated relative to today so the demo always has a "today".
 */
import clientsJson from "../data/clients.json";
import hoursJson from "../data/hours.json";
import prefsJson from "../data/prefs.json";
import servicesJson from "../data/services.json";
import stylistJson from "../data/stylist.json";
import todaysJson from "../data/todaysAppointments.json";
import { addDays, today, toMin, weekday } from "./dates";
import type { Appointment, Client, Database, Prefs, Service, Status, Stylist, WeekHours } from "./types";

const services = servicesJson as Service[];
const hours = hoursJson as WeekHours;

// Small deterministic random generator so the sample data is the same every time.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export function seed(): Database {
  const t = today();
  const clients: Client[] = (clientsJson as Omit<Client, "since">[]).map((c, i) => ({
    ...c,
    since: addDays(t, -400 + i * 31),
  }));

  const appts: Appointment[] = [];
  let n = 1;
  const add = (date: string, start: string, clientId: string, serviceId: string, status: Status, extra: Partial<Appointment> = {}) =>
    appts.push({ id: `a${n++}`, date, start, clientId, serviceId, status, notes: "", tip: 0, ...extra });

  // Today — matches the Figma prototype.
  for (const a of todaysJson as { start: string; clientId: string; serviceId: string; status: Status; notes: string }[])
    add(t, a.start, a.clientId, a.serviceId, a.status, { notes: a.notes });

  // Yesterday — three, so the dashboard can say "2 more than yesterday".
  const y = addDays(t, -1);
  add(y, "09:30", "c6", "s4", "completed", { tip: 10 });
  add(y, "11:00", "c9", "s6", "completed", { tip: 5 });
  add(y, "14:00", "c7", "s3", "completed", { tip: 12 });

  // Three weeks back and two weeks ahead on working days.
  const slots = ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00"];
  const tips = [0, 5, 8, 10, 10, 12, 15];
  for (let off = -21; off <= 14; off++) {
    if (off === 0 || off === -1) continue;
    const date = addDays(t, off);
    const wd = weekday(date);
    if (!hours[String(wd)]) continue;
    const r = rng(off + 1000);
    const count = 2 + Math.floor(r() * 3);
    const picked = slots.slice().sort(() => r() - 0.5).slice(0, count).sort();
    for (const start of picked) {
      if (wd === 6 && toMin(start) >= toMin("16:00")) continue; // Saturday ends at 17:00
      const client = clients[Math.floor(r() * clients.length)];
      const service = services[Math.floor(r() * 6)]; // skip Balayage in random data
      let status: Status = "confirmed";
      let tip = 0;
      if (off < 0) {
        const roll = r();
        status = roll < 0.08 ? "no-show" : roll < 0.14 ? "cancelled" : "completed";
        if (status === "completed") tip = tips[Math.floor(r() * tips.length)];
      }
      add(date, start, client.id, service.id, status, { tip });
    }
  }

  return {
    version: 1,
    stylist: { ...(stylistJson as Stylist) },
    hours: { ...hours },
    prefs: { ...(prefsJson as Prefs) },
    services,
    clients,
    appointments: appts,
    blocks: [{ id: "b1", date: addDays(t, 3), start: "13:00", end: "14:00", reason: "Product training" }],
  };
}

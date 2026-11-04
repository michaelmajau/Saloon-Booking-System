/** Read-only helpers that look things up in the database. */
import { toMin, toTime, weekday } from "./dates";
import { INACTIVE, type Appointment, type Block, type Client, type Database, type DayHours, type Service } from "./types";

export const byStart = <T extends { date: string; start: string }>(a: T, b: T) =>
  (a.date + a.start).localeCompare(b.date + b.start);

export const getService = (db: Database, id: string): Service => db.services.find((s) => s.id === id)!;
export const getClient = (db: Database, id: string): Client => db.clients.find((c) => c.id === id)!;

export const apptEnd = (db: Database, a: Appointment) => toTime(toMin(a.start) + getService(db, a.serviceId).duration);

export const isActive = (a: Appointment) => !INACTIVE.includes(a.status);

export const appointments = (db: Database, filter: (a: Appointment) => boolean = () => true) =>
  db.appointments.filter(filter).sort(byStart);

export const dayAppts = (db: Database, date: string, includeInactive = false) =>
  appointments(db, (a) => a.date === date && (includeInactive || isActive(a)));

export const hoursFor = (db: Database, date: string): DayHours | null => db.hours[String(weekday(date))] ?? null;

export type Conflict = { type: "appointment"; item: Appointment } | { type: "block"; item: Block } | null;

/** What already occupies [start, start + duration) on a date, or null if the slot is free. */
export function conflict(db: Database, date: string, start: string, duration: number, ignoreId?: string): Conflict {
  const s = toMin(start);
  const e = s + duration;
  const hit = dayAppts(db, date).find(
    (a) => a.id !== ignoreId && toMin(a.start) < e && toMin(apptEnd(db, a)) > s,
  );
  if (hit) return { type: "appointment", item: hit };
  const blk = db.blocks.find((b) => b.date === date && toMin(b.start) < e && toMin(b.end) > s);
  if (blk) return { type: "block", item: blk };
  return null;
}

/** Free [start, end] minute ranges inside working hours on a date. */
export function gaps(db: Database, date: string): [number, number][] {
  const h = hoursFor(db, date) ?? { start: "09:00", end: "19:00" };
  const busy: [number, number][] = [
    ...dayAppts(db, date).map((a) => [toMin(a.start), toMin(apptEnd(db, a))] as [number, number]),
    ...db.blocks.filter((b) => b.date === date).map((b) => [toMin(b.start), toMin(b.end)] as [number, number]),
  ].sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  let cursor = toMin(h.start);
  for (const [s, e] of busy) {
    if (s > cursor) out.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (toMin(h.end) > cursor) out.push([cursor, toMin(h.end)]);
  return out;
}

/** Date helpers. Dates are "YYYY-MM-DD" strings, times are "HH:MM" strings. */
const pad = (n: number) => String(n).padStart(2, "0");

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => iso(new Date());

export function parse(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(isoDate: string, n: number): string {
  const d = parse(isoDate);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const toTime = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
export const weekday = (isoDate: string) => parse(isoDate).getDay(); // 0 = Sunday
export const startOfWeek = (isoDate: string) => addDays(isoDate, -((weekday(isoDate) + 6) % 7)); // Monday
export const nowMin = () => {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
};

export const fmt = (isoDate: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  parse(isoDate).toLocaleDateString("en-GB", opts);

export const long = (isoDate: string) =>
  fmt(isoDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export function relative(isoDate: string): string {
  const t = today();
  if (isoDate === t) return "Today";
  if (isoDate === addDays(t, 1)) return "Tomorrow";
  if (isoDate === addDays(t, -1)) return "Yesterday";
  return fmt(isoDate, { weekday: "long", day: "numeric", month: "long" });
}

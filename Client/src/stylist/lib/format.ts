export const money = (n: number) =>
  "£" + (Math.round(n * 100) / 100).toLocaleString("en-GB", { maximumFractionDigits: 2 });

export const mins = (m: number) =>
  m >= 60 ? `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`;

export const initial = (name: string) => (name.trim()[0] || "?").toUpperCase();

export const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s.trim());

import { supabase } from "./supabase";

// VITE_API_URL is the server address, e.g. http://localhost:5000 (as in .env.example).
// A trailing /api is also accepted, so both formats work. /api is added here.
const serverUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:5000").replace(/\/+$/, "").replace(/\/api$/, "");
const apiBase = `${serverUrl}/api`;

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}), ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? body.message ?? "Request failed");
  return body as T;
}

export const kes = (amount: unknown) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(Number(amount ?? 0));

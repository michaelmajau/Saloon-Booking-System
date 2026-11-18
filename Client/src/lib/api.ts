import { supabase } from "./supabase";

// Backend URL from environment variables.
// Defaults to localhost:5000 during local development.
const serverUrl = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
)
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

const apiBase = `${serverUrl}/api`;

console.log("BOOKIFY API BASE URL:", apiBase);

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { data } = await supabase.auth.getSession();

  const url = `${apiBase}${path}`;

  console.log("BOOKIFY API REQUEST:", {
    method: options.method ?? "GET",
    url,
  });

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(data.session
        ? {
            Authorization: `Bearer ${data.session.access_token}`,
          }
        : {}),
      ...(options.headers ?? {}),
    },
  });

  const body = await response.json().catch(() => ({}));

  console.log("BOOKIFY API RESPONSE:", {
    url,
    status: response.status,
    body,
  });

  if (!response.ok) {
    throw new Error(
      body.error ?? body.message ?? "Request failed"
    );
  }

  return body as T;
}

export const kes = (amount: unknown) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(Number(amount ?? 0));
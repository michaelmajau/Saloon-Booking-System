import { supabase } from "./supabase";

// Backend URL from environment variables.
// Defaults to localhost:5000 during local development.
const serverUrl = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
)
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

const apiBase = `${serverUrl}/api`;

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { data } = await supabase.auth.getSession();

  const url = `${apiBase}${path}`;

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

  if (!response.ok) {
    throw new ApiError(body.error ?? body.message ?? "Request failed", response.status);
  }

  return body as T;
}

export const kes = (amount: unknown) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(Number(amount ?? 0));
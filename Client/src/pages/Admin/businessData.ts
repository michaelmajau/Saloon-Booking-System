import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export type Product = {
  product_id: string; name: string; category: string | null; supplier: string | null;
  purchase_price: number; selling_price: number | null; stock: number; low_stock_threshold: number; is_active: boolean;
};
export type Customer = {
  customer_id: string; kind: "registered" | "walk_in"; full_name: string; phone: string | null;
  email: string | null; visits: number; lifetime_value: number;
};
export type FinanceSummary = { gross_revenue: number; total_expenses: number; net_income: number; outstanding: number };
export const money = (value: number) => `KSh ${new Intl.NumberFormat("en-KE", { maximumFractionDigits: 2 }).format(value)}`;
export const dayOffset = (date: string, offset: number) => new Date(Date.parse(date + "T00:00:00Z") + offset * 86400000).toISOString().slice(0, 10);
export const dateQuery = (from: string, to: string) => new URLSearchParams({ from, to }).toString();
export const messageFor = (error: unknown) => error instanceof Error ? error.message : "The request failed. Please try again.";

export function useBusinessData<T>(path: string) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>();
  const key = path + ":" + revision;

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    api<T>(path, { signal })
      .then((data) => setResult({ key, data }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key, error: messageFor(error) });
      });
    return () => controller.abort();
  }, [key, path]);

  const current = result?.key === key ? result : undefined;
  return { data: current?.data, error: current?.error, loading: !!path && !current, reload: () => setRevision((value) => value + 1) };
}

export function exportCsv(name: string, rows: (string | number | null)[][]) {
  const encode = (value: string | number | null) => {
    const input = String(value ?? "");
    const safe = typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(input) ? "'" + input : input;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map((row) => row.map(encode).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name + ".csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

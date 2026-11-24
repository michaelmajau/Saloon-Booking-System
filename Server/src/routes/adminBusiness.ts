import { Router } from "express";
import type { Request, Response } from "express";
import { supabaseAdmin as db } from "../config/supabaseAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { writeAuditLog } from "../utils/auditLog.js";

const router = Router();
const admin = [requireAuth, requireAdmin];
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const text = (value: unknown, max: number): value is string => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
const integer = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
const money = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 9999999999.99 && Number(value.toFixed(2)) === value;
const date = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(value + "T00:00:00Z");
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value;
};
const methods = ["cash", "mpesa", "card", "bank"];
const notificationKeys = ["newBookingAlerts", "cancellationAlerts", "dailyScheduleSummary", "lowStockAlerts", "customerEmailConfirmations", "appointmentReminders"];
const emptyPreferences = Object.fromEntries(notificationKeys.map((key) => [key, false]));
const actor = (res: Response): string => res.locals.user.id;
const invalid = (res: Response, error: string) => res.status(400).json({ error });
const pagination = (req: Request) => {
  const offset = Number(req.query.offset ?? 0);
  return integer(offset, 0, 1000000) ? offset : null;
};
function range(req: Request) {
  const { from, to } = req.query;
  return date(from) && date(to) && from <= to && Date.parse(to) - Date.parse(from) <= 366 * 86400000 ? { from, to } : null;
}
function failure(res: Response, operation: string, error: { code?: string }) {
  if (error.code === "23505") return res.status(409).json({ error: "This reference was already recorded." });
  if (error.code === "23503" || error.code === "P0001") return res.status(409).json({ error: "A referenced record is unavailable or the stock is insufficient." });
  console.error("Admin business request failed", { operation, code: error.code });
  return res.status(500).json({ error: `Unable to ${operation}.` });
}

router.get("/inventory", ...admin, async (req, res) => {
  const offset = pagination(req);
  if (offset === null) return invalid(res, "Invalid offset.");
  const { data, error } = await db.from("inventory_products").select("*").order("name").order("product_id").range(offset, offset + 99);
  if (error) return failure(res, "load inventory", error);
  res.json({ products: data, currency: "KES" });
});

router.post("/inventory", ...admin, async (req, res) => {
  const { name, category, supplier, purchasePrice, sellingPrice, lowStockThreshold = 5 } = req.body ?? {};
  if (!text(name, 150) || !money(purchasePrice) || (sellingPrice != null && !money(sellingPrice))
    || !integer(lowStockThreshold, 0, 1000000) || (category != null && !text(category, 100)) || (supplier != null && !text(supplier, 150))) {
    return invalid(res, "Provide a product name, valid KES prices, and an optional stock threshold.");
  }
  const { data, error } = await db.from("inventory_products").insert({
    name: name.trim(), category: category?.trim() ?? null, supplier: supplier?.trim() ?? null,
    purchase_price: purchasePrice, selling_price: sellingPrice ?? null, low_stock_threshold: lowStockThreshold,
  }).select().single();
  if (error) return failure(res, "create product", error);
  await writeAuditLog({ actorUserId: actor(res), action: "CREATE_PRODUCT", entityType: "inventory_products", entityId: data.product_id });
  res.status(201).json({ product: data });
});

router.get("/inventory/:id/movements", ...admin, async (req, res) => {
  const offset = pagination(req);
  if (!uuid(req.params.id) || offset === null) return invalid(res, "Invalid product or offset.");
  const { data, error } = await db.from("inventory_movements").select("*").eq("product_id", req.params.id)
    .order("created_at", { ascending: false }).order("movement_id").range(offset, offset + 99);
  if (error) return failure(res, "load stock movements", error);
  res.json({ movements: data });
});

router.post("/inventory/:id/adjustments", ...admin, async (req, res) => {
  const { quantity, reason } = req.body ?? {};
  if (!uuid(req.params.id) || !integer(quantity, -1000000, 1000000) || quantity === 0 || !text(reason, 200)) {
    return invalid(res, "Provide a nonzero stock adjustment and a reason.");
  }
  const { data, error } = await db.rpc("adjust_inventory", {
    p_product: req.params.id, p_quantity: quantity, p_reason: reason.trim(), p_actor: actor(res),
  });
  if (error) return failure(res, "adjust stock", error);
  res.json({ product: data });
});

router.get("/customers", ...admin, async (req, res) => {
  const offset = pagination(req);
  if (offset === null) return invalid(res, "Invalid offset.");
  const { data, error } = await db.from("admin_customer_directory").select("*")
    .order("full_name").order("kind").order("customer_id").range(offset, offset + 99);
  if (error) return failure(res, "load customers", error);
  res.json({ customers: data, currency: "KES" });
});

router.post("/customers", ...admin, async (req, res) => {
  const { fullName, email, phone } = req.body ?? {};
  if (!text(fullName, 150) || (email != null && (!text(email, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())))
    || (phone != null && !text(phone, 40))) return invalid(res, "Provide a name and valid contact details.");
  const { data, error } = await db.from("walk_in_customers")
    .insert({ full_name: fullName.trim(), email: email?.trim().toLowerCase() ?? null, phone: phone?.trim() ?? null }).select().single();
  if (error) return failure(res, "add customer", error);
  await writeAuditLog({ actorUserId: actor(res), action: "CREATE_WALK_IN_CUSTOMER", entityType: "walk_in_customers", entityId: data.customer_id });
  res.status(201).json({ customer: { ...data, kind: "walk_in", visits: 0, lifetime_value: 0 } });
});

router.get("/pos/sales/:id", ...admin, async (req, res) => {
  if (!uuid(req.params.id)) return invalid(res, "Invalid sale reference.");
  const { data, error } = await db.from("pos_sales").select("*, pos_sale_items(*)").eq("sale_id", req.params.id).maybeSingle();
  if (error) return failure(res, "load sale", error);
  if (!data) return res.status(404).json({ error: "Sale not found." });
  res.json({ sale: data, currency: "KES" });
});

router.post("/pos/sales", ...admin, async (req, res) => {
  const { saleId, customerId, customerKind, method, items } = req.body ?? {};
  if (!uuid(saleId) || !methods.includes(method) || !Array.isArray(items) || items.length < 1 || items.length > 50
    || (customerId != null && (!uuid(customerId) || !["registered", "walk_in"].includes(customerKind)))) {
    return invalid(res, "Provide a sale reference, one payment method, and 1–50 items.");
  }
  const unique = new Set<string>();
  const lines = [];
  for (const item of items) {
    if (!item || !["service", "product"].includes(item.kind) || !uuid(item.id) || !integer(item.quantity, 1, 1000)) {
      return invalid(res, "Each item needs a valid type, ID, and quantity.");
    }
    const key = item.kind + ":" + item.id.toLowerCase();
    if (unique.has(key)) return invalid(res, "Combine duplicate items into one line.");
    unique.add(key);
    lines.push({ kind: item.kind, id: item.id, quantity: item.quantity });
  }
  const { data, error } = await db.rpc("record_pos_sale", {
    p_id: saleId, p_registered: customerKind === "registered" ? customerId ?? null : null,
    p_walk_in: customerKind === "walk_in" ? customerId ?? null : null, p_method: method, p_actor: actor(res), p_items: lines,
  });
  if (error) return failure(res, "record sale", error);
  await writeAuditLog({ actorUserId: actor(res), action: "RECORD_POS_SALE", entityType: "pos_sales", entityId: saleId });
  res.status(201).json({ sale: data, currency: "KES" });
});

router.get("/expenses", ...admin, async (req, res) => {
  const dates = range(req);
  const offset = pagination(req);
  if (!dates || offset === null) return invalid(res, "Provide a valid from/to range and offset.");
  const { data, error } = await db.from("business_expenses").select("*").gte("expense_date", dates.from).lte("expense_date", dates.to)
    .order("expense_date", { ascending: false }).order("expense_id").range(offset, offset + 99);
  if (error) return failure(res, "load expenses", error);
  res.json({ expenses: data, currency: "KES" });
});

router.post("/expenses", ...admin, async (req, res) => {
  const { expenseId, category, description, amount, expenseDate } = req.body ?? {};
  if (!uuid(expenseId) || !text(category, 100) || !text(description, 300) || !money(amount) || amount === 0 || !date(expenseDate)) {
    return invalid(res, "Provide an expense reference, category, description, positive KES amount, and date.");
  }
  const { data, error } = await db.from("business_expenses").insert({
    expense_id: expenseId, category: category.trim(), description: description.trim(), amount,
    expense_date: expenseDate, recorded_by: actor(res),
  }).select().single();
  if (error) return failure(res, "record expense", error);
  await writeAuditLog({ actorUserId: actor(res), action: "RECORD_EXPENSE", entityType: "business_expenses", entityId: expenseId });
  res.status(201).json({ expense: data, currency: "KES" });
});

router.get("/transactions", ...admin, async (req, res) => {
  const dates = range(req);
  const offset = pagination(req);
  if (!dates || offset === null) return invalid(res, "Provide a valid from/to range and offset.");
  const { data, error } = await db.from("admin_transaction_ledger").select("*")
    .gte("transaction_date", dates.from).lte("transaction_date", dates.to)
    .order("transaction_date", { ascending: false }).order("source").order("reference").range(offset, offset + 99);
  if (error) return failure(res, "load transactions", error);
  res.json({ transactions: data, currency: "KES" });
});

router.get("/finance/summary", ...admin, async (req, res) => {
  const dates = range(req);
  if (!dates) return invalid(res, "Provide a valid from/to date range.");
  const { data, error } = await db.rpc("admin_finance_summary", { p_from: dates.from, p_to: dates.to }).single();
  if (error) return failure(res, "load finance summary", error);
  res.json({ summary: data, currency: "KES" });
});

router.get("/notification-preferences", ...admin, async (_req, res) => {
  const { data, error } = await db.from("admin_notification_preferences").select("preferences").eq("user_id", actor(res)).maybeSingle();
  if (error) return failure(res, "load notification preferences", error);
  res.json({ preferences: { ...emptyPreferences, ...data?.preferences } });
});

router.put("/notification-preferences", ...admin, async (req, res) => {
  const { preferences } = req.body ?? {};
  if (!preferences || Object.keys(preferences).length !== notificationKeys.length
    || notificationKeys.some((key) => typeof preferences[key] !== "boolean")) {
    return invalid(res, "Provide all six notification preferences as booleans.");
  }
  const { error } = await db.from("admin_notification_preferences").upsert({
    user_id: actor(res), preferences, updated_at: new Date().toISOString(),
  });
  if (error) return failure(res, "save notification preferences", error);
  res.json({ preferences });
});

export default router;

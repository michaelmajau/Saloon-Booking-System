import { supabaseAdmin } from "../config/supabaseAdmin.js";

type AuditData = Record<string, unknown>;

type AuditEntry = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldData?: AuditData | null;
  newData?: AuditData | null;
};

const sensitiveKeys = new Set([
  "password", "password_hash", "access_token", "refresh_token", "token",
  "authorization", "secret", "service_role_key", "api_key",
]);

function removeSensitiveValues(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeSensitiveValues);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !sensitiveKeys.has(key.toLowerCase()))
        .map(([key, child]) => [key, removeSensitiveValues(child)]),
    );
  }
  return value;
}

/**
 * Writes a best-effort server-side audit record. Callers should supply only
 * purposefully selected fields; this function additionally removes secret-like
 * keys as a safety net.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    user_id: entry.actorUserId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    old_data: entry.oldData ? removeSensitiveValues(entry.oldData) : null,
    new_data: entry.newData ? removeSensitiveValues(entry.newData) : null,
  });

  if (error) {
    // Do not include request data or Supabase credentials in server logs.
    console.error("Audit log write failed", { action: entry.action, entityType: entry.entityType, code: error.code });
  }
}

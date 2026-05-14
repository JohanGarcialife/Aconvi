/**
 * offlineQueue.ts
 *
 * Persistent offline queue for provider job completions using expo-sqlite.
 *
 * Schema:
 *   pending_uploads(
 *     id TEXT PRIMARY KEY,
 *     incident_id TEXT NOT NULL,
 *     photo_uri TEXT,
 *     notes TEXT,
 *     tenant_id TEXT NOT NULL,
 *     provider_id TEXT NOT NULL,
 *     status TEXT DEFAULT 'pending',   -- 'pending' | 'uploading' | 'done' | 'failed'
 *     created_at INTEGER NOT NULL
 *   )
 */

import * as SQLite from "expo-sqlite";

export interface PendingUpload {
  id: string;
  incidentId: string;
  photoUri: string | null;
  notes: string;
  tenantId: string;
  providerId: string;
  status: "pending" | "uploading" | "done" | "failed";
  createdAt: number;
}

// ─── DB singleton ──────────────────────────────────────────────────────────────
let _db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync("aconvi_offline.db");

  // Create table if it doesn't exist (idempotent)
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_uploads (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      photo_uri TEXT,
      notes TEXT NOT NULL DEFAULT '',
      tenant_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );
  `);

  return _db;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/** Enqueue a pending upload. Persists even if the app is killed. */
export async function enqueueUpload(
  payload: Omit<PendingUpload, "status" | "createdAt">
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO pending_uploads
      (id, incident_id, photo_uri, notes, tenant_id, provider_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      payload.id,
      payload.incidentId,
      payload.photoUri ?? null,
      payload.notes,
      payload.tenantId,
      payload.providerId,
      Date.now(),
    ]
  );
}

/** Get all pending uploads (status = 'pending') */
export async function getPendingUploads(): Promise<PendingUpload[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    incident_id: string;
    photo_uri: string | null;
    notes: string;
    tenant_id: string;
    provider_id: string;
    status: string;
    created_at: number;
  }>("SELECT * FROM pending_uploads WHERE status = 'pending' ORDER BY created_at ASC");

  return rows.map((r) => ({
    id: r.id,
    incidentId: r.incident_id,
    photoUri: r.photo_uri,
    notes: r.notes,
    tenantId: r.tenant_id,
    providerId: r.provider_id,
    status: r.status as PendingUpload["status"],
    createdAt: r.created_at,
  }));
}

/** Count of all pending uploads (for badge display) */
export async function countPendingUploads(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM pending_uploads WHERE status = 'pending'"
  );
  return row?.count ?? 0;
}

/** Mark an upload as done and remove it from the queue */
export async function markUploadDone(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM pending_uploads WHERE id = ?", [id]);
}

/** Mark an upload as failed (retryable) */
export async function markUploadFailed(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE pending_uploads SET status = 'failed' WHERE id = ?", [id]);
}

/** Reset failed uploads back to pending so they can be retried */
export async function resetFailed(): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE pending_uploads SET status = 'pending' WHERE status = 'failed'");
}

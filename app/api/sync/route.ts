/**
 * Recepción de sincronización desde Arca Desktop.
 *
 * Ruta AISLADA y ADITIVA. NO escribe en las tablas de negocio: valida la firma
 * del "offline grant" (HMAC con AUTH_SECRET), y persiste cada operación en una
 * bandeja de entrada idempotente (`desktop_sync_inbox`). La empresa se toma del
 * grant VERIFICADO, nunca de lo que declare el cliente (a prueba de suplantación
 * de tenant). Aplicar la bandeja a las tablas vivas (con reconciliación de IDs
 * locales → reales) es un paso server-side posterior y deliberado.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { dbSuperAdmin } from "@/lib/db";
import { firmarGrantCanonico } from "@/app/api/desktop/login/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const authSchema = z.object({
  userId: z.string().uuid(),
  empresaId: z.string().uuid(),
  sucursalIds: z.array(z.string()).default([]),
  deviceId: z.string().min(1),
  issuedAt: z.string(),
  expiresAt: z.string(),
  signature: z.string().min(1),
});

const operationSchema = z.object({
  id: z.string().min(1),
  entityType: z.string().min(1).max(80),
  entityId: z.string().min(1).max(120).optional().nullable(),
  operation: z.string().min(1).max(40),
  payload: z.record(z.unknown()).default({}),
  createdAt: z.string().optional(),
  idempotencyKey: z.string().min(1).max(200),
  priority: z.number().int().min(0).max(100).default(50),
});

const bodySchema = z.object({
  protocolVersion: z.number().optional(),
  deviceId: z.string().optional(),
  pushedAt: z.string().optional(),
  auth: authSchema,
  operations: z.array(operationSchema).max(500).default([]),
});

let inboxReady: Promise<void> | null = null;

function asegurarInbox(): Promise<void> {
  if (!inboxReady) {
    inboxReady = dbSuperAdmin(async (tx) => {
      await tx.execute(sql`
        CREATE TABLE IF NOT EXISTS desktop_sync_inbox (
          idempotency_key text PRIMARY KEY,
          operation_id text NOT NULL,
          empresa_id uuid NOT NULL,
          user_id uuid,
          device_id text,
          entity_type text NOT NULL,
          entity_id text,
          operation text NOT NULL,
          payload jsonb NOT NULL,
          priority integer NOT NULL DEFAULT 50,
          client_created_at timestamptz,
          received_at timestamptz NOT NULL DEFAULT now(),
          status text NOT NULL DEFAULT 'received',
          applied_at timestamptz
        )
      `);
      await tx.execute(sql`
        CREATE INDEX IF NOT EXISTS desktop_sync_inbox_empresa_status_idx
          ON desktop_sync_inbox(empresa_id, status)
      `);
    }).catch((err) => {
      inboxReady = null; // permite reintentar la creación en la próxima petición
      throw err;
    });
  }
  return inboxReady;
}

function grantValido(secret: string, a: z.infer<typeof authSchema>): boolean {
  const esperado = firmarGrantCanonico(secret, {
    userId: a.userId,
    empresaId: a.empresaId,
    sucursalIds: a.sucursalIds,
    deviceId: a.deviceId,
    issuedAt: a.issuedAt,
    expiresAt: a.expiresAt,
  });
  const bufEsperado = Buffer.from(esperado, "hex");
  const bufRecibido = Buffer.from(a.signature, "hex");
  if (bufEsperado.length !== bufRecibido.length) return false;
  if (!timingSafeEqual(bufEsperado, bufRecibido)) return false;
  return new Date(a.expiresAt).getTime() > Date.now();
}

export async function POST(request: Request) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: "Servidor sin AUTH_SECRET" }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Cuerpo invalido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Solicitud invalida" }, { status: 400 });
  }
  const { auth, operations } = parsed.data;

  if (!grantValido(secret, auth)) {
    return Response.json({ ok: false, error: "Grant invalido o vencido" }, { status: 401 });
  }

  try {
    await asegurarInbox();
  } catch {
    return Response.json({ ok: false, error: "No se pudo preparar la recepcion" }, { status: 503 });
  }

  const accepted: { id: string }[] = [];
  const errors: { id: string; error: string; retryable: boolean }[] = [];

  await dbSuperAdmin(async (tx) => {
    for (const op of operations) {
      try {
        await tx.execute(sql`
          INSERT INTO desktop_sync_inbox
            (idempotency_key, operation_id, empresa_id, user_id, device_id,
             entity_type, entity_id, operation, payload, priority, client_created_at)
          VALUES (
            ${op.idempotencyKey}, ${op.id}, ${auth.empresaId}::uuid, ${auth.userId}::uuid, ${auth.deviceId},
            ${op.entityType}, ${op.entityId ?? null}, ${op.operation},
            ${JSON.stringify(op.payload)}::jsonb, ${op.priority}, ${op.createdAt ?? null}
          )
          ON CONFLICT (idempotency_key) DO NOTHING
        `);
        accepted.push({ id: op.id });
      } catch (err) {
        errors.push({
          id: op.id,
          error: err instanceof Error ? err.message : "Error al recibir",
          retryable: true,
        });
      }
    }
  });

  return Response.json({ ok: true, accepted, conflicts: [], errors });
}

import { AsyncLocalStorage } from "node:async_hooks";
import type { SessionUser } from "./actions/session-helpers";
import type { Tx } from "./db";

export type BusinessContext = {
  user: SessionUser;
  tx: Tx;
  invalidations: Set<string>;
  /** Only the authenticated sync adapter may supply offline identities. */
  identity?: { type: string; id: string };
  localIds?: Record<string, string[]>;
  sucursalIds?: string[];
  eventDate?: Date;
  effects?: { stockPairs: Array<{ productoId: string; almacenId: string }> };
};

const storage = new AsyncLocalStorage<BusinessContext>();
export function currentBusinessContext() { return storage.getStore(); }
export function inBusinessContext<T>(context: BusinessContext, action: () => T): T { return storage.run(context, action); }
export function businessEntityId(type: string): string | undefined {
  const identity = storage.getStore()?.identity;
  return identity?.type === type ? identity.id : undefined;
}
export function businessChildId(type: string, index: number): string | undefined {
  return storage.getStore()?.localIds?.[type]?.[index];
}
export function businessEventDate() { return storage.getStore()?.eventDate ?? new Date(); }

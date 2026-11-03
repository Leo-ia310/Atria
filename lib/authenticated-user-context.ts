import { AsyncLocalStorage } from "node:async_hooks";
import type { SessionUser } from "./actions/session-helpers";
/** Authenticated HTTP adapters can reuse session services without holding a DB transaction during external I/O. */
const users = new AsyncLocalStorage<SessionUser>();
export const currentAuthenticatedUser = () => users.getStore();
export function inAuthenticatedUserContext<T>(
  user: SessionUser,
  action: () => T,
): T {
  return users.run(user, action);
}

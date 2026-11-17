"use client";

import { SessionProvider as NextSessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import {WebAttemptRecovery} from './WebAttemptRecovery';

export function SessionProvider({ children }: { children: ReactNode }) {
  return <NextSessionProvider><WebAttemptRecovery/>{children}</NextSessionProvider>;
}

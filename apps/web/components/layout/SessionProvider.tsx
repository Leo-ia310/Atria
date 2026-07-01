"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { me, logout as logoutCall, type SessionUser } from "@/lib/auth-client";
import { ApiDisabledError } from "@/lib/api-client";

type Ctx = {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}

export function SessionProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser?: SessionUser | null;
}) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(initialUser ?? null);
  const [loading, setLoading] = useState(initialUser === undefined);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const u = await me();
      setUser(u);
    } catch (err) {
      if (err instanceof ApiDisabledError) {
        // En modo API_ENABLED=false, asumimos invitado.
        setUser(null);
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutCall();
    setUser(null);
    router.push("/login");
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (initialUser === undefined) {
      void refresh();
    }
  }, [initialUser, refresh]);

  return (
    <SessionContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

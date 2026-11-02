"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChangeRefreshController } from "@/lib/client/change-refresh";
export function CloudChangesRefresh({
  initialCursor,
}: {
  initialCursor: string;
}) {
  const router = useRouter(),
    initial = useRef(initialCursor);
  useEffect(() => {
    let active = true,
      timer: ReturnType<typeof setTimeout> | undefined,
      flushTimer: ReturnType<typeof setTimeout> | undefined,
      request: AbortController | undefined;
    const controller = new ChangeRefreshController({
      cursor: initial.current,
      visible: () => document.visibilityState === "visible",
      busy: () =>
        Boolean(
          document.querySelector(
            '[role="dialog"],[aria-modal="true"],form:not([method="get" i])',
          ) ||
          document.activeElement?.matches(
            'input,textarea,select,[contenteditable="true"]',
          ),
        ),
      refresh: () => router.refresh(),
      check: async (cursor) => {
        request = new AbortController();
        const timeout = setTimeout(() => request?.abort(), 8000);
        try {
          const response = await fetch("/api/app/changes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cursor }),
            cache: "no-store",
            signal: request.signal,
          });
          if (!response.ok) throw Error("Change check unavailable");
          const result = await response.json();
          if (
            typeof result.cursor !== "string" ||
            typeof result.changed !== "boolean"
          )
            throw Error("Invalid change response");
          return result;
        } finally {
          clearTimeout(timeout);
        }
      },
    });
    const schedule = (delay: number) => {
      if (!active) return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const delay = await controller.poll();
        schedule(delay);
      }, delay);
    };
    const wake = () => schedule(0),
      flush = () => {
        clearTimeout(flushTimer);
        flushTimer = setTimeout(() => controller.flush(), 250);
      };
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    document.addEventListener("click", flush);
    schedule(0);
    return () => {
      active = false;
      controller.stop();
      request?.abort();
      clearTimeout(timer);
      clearTimeout(flushTimer);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
      document.removeEventListener("click", flush);
    };
  }, [router]);
  return null;
}

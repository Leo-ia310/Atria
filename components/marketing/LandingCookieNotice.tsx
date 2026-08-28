"use client";

import { useSyncExternalStore } from "react";
import { X } from "lucide-react";

const COOKIE_CONSENT_KEY = "arca_cookie_consent";
const COOKIE_CONSENT_EVENT = "arca_cookie_consent_change";

function cookieNoticeSnapshot() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(COOKIE_CONSENT_KEY) !== "accepted";
}

function subscribeCookieNotice(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === COOKIE_CONSENT_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(COOKIE_CONSENT_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(COOKIE_CONSENT_EVENT, onStoreChange);
  };
}

function aceptarCookies() {
  window.localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
}

export function LandingCookieNotice() {
  const visible = useSyncExternalStore(subscribeCookieNotice, cookieNoticeSnapshot, () => false);
  if (!visible) return null;

  return (
    <dialog
      open
      aria-label="Aviso de cookies"
      className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-5xl rounded-[12px] border border-white/12 bg-[#160827]/95 p-4 text-white shadow-[0_20px_60px_rgba(9,4,20,0.5)] backdrop-blur-md"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <p className="text-[14px] font-semibold">Cookies en ARCA</p>
          <p className="mt-1 text-[13px] leading-relaxed text-white/60">
            Usamos cookies necesarias para que el sitio funcione y medición básica para
            entender qué información ayuda mejor a los negocios que nos visitan.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={aceptarCookies}
            className="arca-btn border-white/20 bg-white/10 text-white hover:bg-white/16"
          >
            Solo necesarias
          </button>
          <button
            type="button"
            onClick={aceptarCookies}
            className="arca-btn bg-white text-[#160827] hover:bg-[#efe7ff]"
          >
            Aceptar
          </button>
          <button
            type="button"
            onClick={aceptarCookies}
            className="arca-btn p-2 text-white/60 hover:bg-white/10"
            aria-label="Cerrar aviso de cookies"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </dialog>
  );
}

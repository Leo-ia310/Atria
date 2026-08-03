"use client";

import { useEffect } from "react";

const COOKIE = "atria_referral_code";
const STORAGE = "atria_referral_code";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const PARAMS = ["ref", "referido", "codigo", "vendedor"];

export function ReferralTracker() {
  useEffect(() => {
    const current = readStoredCode();
    const incoming = readIncomingCode();

    if (incoming) {
      persistCode(incoming);
      return;
    }

    if (current) persistCode(current);
  }, []);

  return null;
}

function readIncomingCode() {
  const params = new URLSearchParams(window.location.search);
  for (const key of PARAMS) {
    const code = normalizeCode(params.get(key));
    if (code) return code;
  }
  return "";
}

function readStoredCode() {
  return normalizeCode(window.localStorage.getItem(STORAGE)) || normalizeCode(readCookie(COOKIE));
}

function persistCode(code: string) {
  window.localStorage.setItem(STORAGE, code);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${encodeURIComponent(code)}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

function readCookie(name: string) {
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length) ?? "";
}

function normalizeCode(value: string | null | undefined) {
  return decodeURIComponent(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 80);
}

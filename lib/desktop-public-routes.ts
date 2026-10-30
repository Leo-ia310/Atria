/** These endpoints authenticate credentials or signed grants themselves. */
export function esApiDesktopSinCookie(pathname: string): boolean {
  return pathname === "/api/desktop/login" || pathname === "/api/sync";
}

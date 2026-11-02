import assert from "node:assert/strict";
import test from "node:test";
import { esApiDesktopSinCookie } from "../../lib/desktop-public-routes";

test("desktop credentials and signed-grant endpoints do not require a web cookie", () => {
  assert.equal(esApiDesktopSinCookie("/api/desktop/login"), true);
  assert.equal(esApiDesktopSinCookie("/api/desktop/health"), true);
  assert.equal(esApiDesktopSinCookie("/api/sync"), true);
});

test("other API routes and similarly named paths remain protected", () => {
  for (const path of ["/api/desktop", "/api/desktop/admin", "/api/desktop/health/extra", "/api/desktop/login/extra", "/api/sync-admin", "/api/sync/extra", "/api/ventas", "/dashboard"]) {
    assert.equal(esApiDesktopSinCookie(path), false, path);
  }
});

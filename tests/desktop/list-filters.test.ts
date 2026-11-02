import test from "node:test";
import assert from "node:assert/strict";
import {
  hasListFilters,
  listPageHref,
  parseListFilters,
} from "../../lib/list-filters";
test("validates untrusted dates, amounts, enums and page parameters", () => {
  const f = parseListFilters(
    {
      q: ["x", "y"],
      desde: "2026-02-30",
      hasta: "2026-02-28",
      minimo: "Infinity",
      maximo: "1e99",
      estado: "' OR 1=1",
      pagina: "NaN",
    },
    "compras",
  );
  assert.equal(f.q, "");
  assert.equal(f.desde, "");
  assert.equal(f.hasta, "2026-02-28");
  assert.equal(f.minimo, "");
  assert.equal(f.maximo, "");
  assert.equal(f.estado, "");
  assert.equal(f.pagina, 1);
  assert.equal(
    parseListFilters({ desde: "2024-02-29", minimo: "20.5555" }, "compras")
      .desde,
    "2024-02-29",
  );
  assert.equal(
    parseListFilters({ pagina: "9999999999999999" }, "clientes").pagina,
    1,
  );
});
test("pagination preserves filters and safely encodes search text", () => {
  const f = parseListFilters(
    { q: " A&B %_ ", desde: "2026-08-10", credito: "credito", pagina: "2" },
    "compras",
  );
  assert.ok(hasListFilters(f));
  const params = new URL(listPageHref("/compras", f, 3), "https://test.invalid")
    .searchParams;
  assert.equal(params.get("q"), "A&B %_");
  assert.equal(params.get("desde"), "2026-08-10");
  assert.equal(params.get("credito"), "credito");
  assert.equal(params.get("pagina"), "3");
  assert.equal(
    hasListFilters(parseListFilters({ pagina: "5" }, "clientes")),
    false,
  );
  assert.equal(
    listPageHref("/clientes", parseListFilters({}, "clientes"), 1),
    "/clientes",
  );
});

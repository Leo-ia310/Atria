import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const ROOT = process.cwd();

describe("marketing calculator interface contract", () => {
  const calculator = readFileSync(
    join(ROOT, "components", "marketing", "SavingsCalculator.tsx"),
    "utf8",
  );
  const modules = readFileSync(
    join(ROOT, "components", "marketing", "ModulesSection.tsx"),
    "utf8",
  );
  const landing = readFileSync(join(ROOT, "app", "(marketing)", "page.tsx"), "utf8");

  it("mantiene checkbox accesible y resumen anunciado", () => {
    assert.match(calculator, /role="checkbox"/);
    assert.match(calculator, /aria-checked=\{selected\}/);
    assert.match(calculator, /aria-live="polite"/);
    assert.match(calculator, /aria-label="Resumen de ahorro"/);
  });

  it("usa controles de usuario semanticos y navegables por teclado", () => {
    assert.match(calculator, /<label[\s\S]+htmlFor="arca-users"/);
    assert.match(calculator, /type="number"/);
    assert.match(calculator, /aria-label="Restar usuario"/);
    assert.match(calculator, /aria-label="Sumar usuario"/);
    assert.match(calculator, /focus-visible:outline/);
  });

  it("incluye responsive y movimiento reducido", () => {
    assert.match(calculator, /lg:grid-cols-\[/);
    assert.match(calculator, /md:grid-cols-2/);
    assert.match(calculator, /motion-reduce:transition-none/);
    assert.match(landing, /prefers-reduced-motion: reduce/);
  });

  it("integra modulos y calculadora sin reemplazar secciones principales", () => {
    assert.match(landing, /<ModulesSection \/>/);
    assert.match(landing, /<SavingsCalculator \/>/);
    assert.match(landing, /<Nav \/>/);
    assert.match(landing, /<footer/);
  });

  it("expone modulos como tabs accesibles", () => {
    assert.match(modules, /role="tablist"/);
    assert.match(modules, /role="tab"/);
    assert.match(modules, /aria-selected=\{active\}/);
    assert.match(modules, /role="tabpanel"/);
  });
});

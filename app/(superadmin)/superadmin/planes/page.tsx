import Link from "next/link";
import { PLANES_ARRAY } from "@/lib/pricing";

export default function PlanesAdminPage() {
  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl">Planes y feature flags</h1>
          <p className="mt-1 text-small text-white/60">
            Configuración global de planes. Refleja `lib/pricing.ts`.
          </p>
        </div>
        <Link href="/superadmin" className="text-small text-white/60 hover:text-white">
          ← Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PLANES_ARRAY.map((p) => (
          <div
            key={p.id}
            className="rounded-lg border border-white/10 bg-white/[0.03] p-5"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-white">{p.nombre}</h2>
              {p.destacado && (
                <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-[10px] uppercase text-yellow-400">
                  Popular
                </span>
              )}
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-white">
                ${p.precioMensual.toFixed(2)}
                <span className="text-small font-normal text-white/50">/mes</span>
              </div>
              <div className="text-[12px] text-white/40">
                Anual: ${p.precioAnualMensualizado.toFixed(2)}/mes
              </div>
            </div>

            <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-small">
              <Fila label="Sucursales" valor={p.maxSucursales ?? "∞"} />
              <Fila label="Usuarios incluidos" valor={p.maxUsuarios ?? "∞"} />
              <Fila label="Productos" valor={p.maxProductos ?? "∞"} />
              <Fila label="Transacciones / mes" valor={p.maxTransaccionesMes ?? "∞"} />
              <Fila label="$/usuario extra" valor={p.precioUsuarioExtra ?? "—"} />
              <Fila label="$/sucursal extra" valor={p.precioSucursalExtra ?? "—"} />
            </div>

            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Features activas
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                {Object.entries(p.features)
                  .filter(([_, v]) => v)
                  .map(([k]) => (
                    <span
                      key={k}
                      className="rounded bg-white/5 px-2 py-0.5 text-white/70"
                    >
                      {k.replace(/_/g, " ")}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Fila({ label, valor }: { label: string; valor: number | string }) {
  return (
    <div className="flex justify-between text-white/70">
      <span>{label}</span>
      <span className="font-medium text-white">{valor}</span>
    </div>
  );
}

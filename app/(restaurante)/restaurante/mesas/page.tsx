import { and, asc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { dbConEmpresa } from "@/lib/db";
import {
  restauranteAreas,
  restauranteMesas,
  restauranteOrdenes,
  sucursales,
  usuarios,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { tienePermiso } from "@/lib/access-control";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import {
  actualizarEstadoMesaRestauranteForm,
  crearAreaRestauranteForm,
  crearMesaRestauranteForm,
  crearOrdenRestauranteForm,
  solicitarCuentaRestauranteForm,
} from "@/lib/actions/restaurante-vertical";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { FloorPlan } from "@/components/restaurante/mesas/FloorPlan";
import type { PaisCodigo } from "@/lib/paises";

export const metadata: Metadata = {
  title: "Mesas Restaurante | ARCA",
  description: "Floor plan operativo de salon, mesas y cuentas de restaurante en ARCA.",
};

const ESTADOS = [
  "disponible",
  "ocupada",
  "reservada",
  "por_limpiar",
  "cuenta_solicitada",
  "deshabilitada",
] as const;

export default async function RestauranteMesasPage() {
  const user = await requireSession();
  const access = await requireModulo(user, "restaurante-mesas");
  const [scope, empresa] = await Promise.all([
    getSucursalScope(user),
    getEmpresaMetadata(user.empresaId),
  ]);
  const visibles = selectedSucursalIds(scope);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const puedeEditar = tienePermiso(access, "restaurante.mesas.editar");
  const puedeAbrirOrden = tienePermiso(access, "restaurante.ordenes.crear");

  const [sucursalesList, areas, mesas, ordenesActivas] = await dbConEmpresa(user.empresaId, (tx) =>
    Promise.all([
      tx
        .select({ id: sucursales.id, nombre: sucursales.nombre })
        .from(sucursales)
        .where(
          and(
            eq(sucursales.empresaId, user.empresaId),
            visibles ? inArray(sucursales.id, visibles) : undefined,
          ),
        )
        .orderBy(asc(sucursales.nombre)),
      tx
        .select()
        .from(restauranteAreas)
        .where(
          and(
            eq(restauranteAreas.empresaId, user.empresaId),
            visibles ? inArray(restauranteAreas.sucursalId, visibles) : undefined,
          ),
        )
        .orderBy(asc(restauranteAreas.orden), asc(restauranteAreas.nombre)),
      tx
        .select()
        .from(restauranteMesas)
        .where(
          and(
            eq(restauranteMesas.empresaId, user.empresaId),
            visibles ? inArray(restauranteMesas.sucursalId, visibles) : undefined,
          ),
        )
        .orderBy(asc(restauranteMesas.nombre)),
      tx
        .select({
          id: restauranteOrdenes.id,
          numero: restauranteOrdenes.numero,
          mesaId: restauranteOrdenes.mesaId,
          estado: restauranteOrdenes.estado,
          personas: restauranteOrdenes.personas,
          total: restauranteOrdenes.total,
          abiertoEn: restauranteOrdenes.abiertoEn,
          mesero: usuarios.nombre,
        })
        .from(restauranteOrdenes)
        .leftJoin(usuarios, eq(usuarios.id, restauranteOrdenes.abiertoPor))
        .where(
          and(
            eq(restauranteOrdenes.empresaId, user.empresaId),
            inArray(restauranteOrdenes.estado, [
              "abierta",
              "borrador",
              "en_cocina",
              "cuenta_solicitada",
            ]),
            visibles ? inArray(restauranteOrdenes.sucursalId, visibles) : undefined,
          ),
        )
        .orderBy(asc(restauranteOrdenes.abiertoEn)),
    ]),
  );

  const ordenActivaPorMesa = new Map(
    ordenesActivas.flatMap((orden) => (orden.mesaId ? [[orden.mesaId, orden]] : [])),
  );
  const mesasPlano = mesas.map((mesa) => {
    const ordenActiva = ordenActivaPorMesa.get(mesa.id);
    return {
      id: mesa.id,
      nombre: mesa.nombre,
      sucursalId: mesa.sucursalId,
      areaId: mesa.areaId,
      capacidad: mesa.capacidad,
      posX: mesa.posX,
      posY: mesa.posY,
      ancho: mesa.ancho,
      alto: mesa.alto,
      rotacion: mesa.rotacion,
      forma: mesa.forma,
      estado: mesa.estado,
      estadoOverrideManual: mesa.estadoOverrideManual,
      estadoOverrideMotivo: mesa.estadoOverrideMotivo,
      estadoDerivado: mesa.estadoOverrideManual ? mesa.estado : ordenActiva?.estado ?? mesa.estado,
      ordenActiva: ordenActiva ?? undefined,
    };
  });
  const disponibles = mesasPlano.filter((mesa) => mesa.estadoDerivado === "disponible").length;
  const ocupadas = mesasPlano.filter((mesa) =>
    ["ocupada", "abierta", "borrador", "en_cocina"].includes(mesa.estadoDerivado),
  ).length;
  const cuentaSolicitada = mesasPlano.filter((mesa) => mesa.estadoDerivado === "cuenta_solicitada").length;
  const limpieza = mesasPlano.filter((mesa) => mesa.estadoDerivado === "por_limpiar").length;
  const sucursalDefault = sucursalesList[0];

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-label">{scope.visible ? scope.etiqueta : "Salon completo"}</p>
          <h1 className="mt-1 text-xl">Mesas</h1>
          <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
            Mapa por areas convertido en floor plan operativo conectado a las mismas mesas y ordenes del POS.
          </p>
        </div>
        {puedeEditar && (
          <form action={crearAreaRestauranteForm} className="flex flex-wrap gap-2">
            <input type="hidden" name="sucursalId" value={sucursalDefault?.id ?? ""} />
            <input name="nombre" aria-label="Nombre de nueva area" placeholder="Nueva area" className="arca-input h-9 w-40" />
            <button type="submit" disabled={!sucursalDefault} className="arca-btn arca-btn-secondary arca-btn-sm">
              Crear area
            </button>
          </form>
        )}
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <MesaResumen label="Disponibles" value={disponibles} tone="success" />
        <MesaResumen label="Ocupadas" value={ocupadas} tone="warning" />
        <MesaResumen label="En cuenta" value={cuentaSolicitada} tone="info" />
        <MesaResumen label="Limpieza" value={limpieza} tone="error" />
      </section>

      <FloorPlan
        mesas={mesasPlano}
        areas={areas.map((area) => ({
          id: area.id,
          nombre: area.nombre,
          sucursalId: area.sucursalId,
        }))}
        puedeEditar={puedeEditar}
        puedeAbrirOrden={puedeAbrirOrden}
        pais={pais}
        crearMesaAction={crearMesaRestauranteForm}
        crearOrdenAction={crearOrdenRestauranteForm}
        solicitarCuentaAction={solicitarCuentaRestauranteForm}
      />

      <section className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
        <h2 className="text-base font-semibold">Ajuste manual de estado</h2>
        <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
          Usa override manual solo para excepciones operativas; las ordenes vuelven a derivar estado al limpiar override.
        </p>
        <form
          action={actualizarEstadoMesaRestauranteForm}
          className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_minmax(0,1.2fr)_auto_auto] md:items-end"
        >
          <FormField label="Mesa">
            <select name="mesaId" className="arca-input">
              {mesas.map((mesa) => (
                <option key={mesa.id} value={mesa.id}>
                  {mesa.nombre}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Estado">
            <select name="estado" className="arca-input">
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {labelEstadoMesa(estado)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Motivo">
            <input name="motivo" aria-label="Motivo del ajuste manual" placeholder="Ej. reservada por llamada" className="arca-input" />
          </FormField>
          <label className="flex min-h-10 items-center gap-2 text-small">
            <input type="checkbox" name="limpiarOverride" />
            Limpiar override
          </label>
          <button type="submit" disabled={mesas.length === 0} className="arca-btn arca-btn-primary">
            Guardar
          </button>
        </form>
      </section>
    </div>
  );
}

function MesaResumen({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "info" | "error";
}) {
  return (
    <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <Badge variant={tone}>{label}</Badge>
      <div className="mt-3 text-2xl font-semibold text-[color:var(--color-text-primary)]">{value}</div>
    </div>
  );
}

function labelEstadoMesa(estado: string): string {
  const labels: Record<string, string> = {
    disponible: "Disponible",
    ocupada: "Ocupada",
    reservada: "Reservada",
    por_limpiar: "Limpieza",
    cuenta_solicitada: "Cuenta solicitada",
    deshabilitada: "Deshabilitada",
  };
  return labels[estado] ?? estado;
}

"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight } from "lucide-react";
import { productoSchema, type ProductoInput } from "@/lib/validations/productos";
import {
  crearProducto,
  actualizarProducto,
  crearMarca,
  crearCategoria,
} from "@/lib/actions/productos";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { SelectConAgregar } from "@/components/productos/SelectConAgregar";
import { prefijoSkuCategoria } from "@/lib/sku";
import { cn } from "@/lib/utils";

type OpcionRef = { value: string; label: string };

function valoresInicialesProducto(defaults?: Partial<ProductoInput>): Partial<ProductoInput> {
  return {
    sku: defaults?.sku ?? "",
    codigoBarras: defaults?.codigoBarras ?? "",
    nombre: defaults?.nombre ?? "",
    descripcion: defaults?.descripcion ?? "",
    tipo: defaults?.tipo ?? "simple",
    categoriaId: defaults?.categoriaId ?? "",
    marcaId: defaults?.marcaId ?? "",
    unidadBaseId: defaults?.unidadBaseId ?? "",
    impuestoId: defaults?.impuestoId ?? "",
    productoFiscalCodigo: defaults?.productoFiscalCodigo ?? "GENERAL_TAXABLE",
    precioBase: defaults?.precioBase ?? 0,
    costoPromedio: defaults?.costoPromedio ?? 0,
    stockMinimo: defaults?.stockMinimo ?? 0,
    stockMaximo: defaults?.stockMaximo ?? undefined,
    metodoCosteo: defaults?.metodoCosteo ?? "promedio",
    manejaLotes: defaults?.manejaLotes ?? false,
    manejaSeries: defaults?.manejaSeries ?? false,
    fechaVencimiento: defaults?.fechaVencimiento ?? "",
  };
}

export function ProductoForm({
  productoId,
  defaults,
  categorias,
  marcas,
  unidades,
  impuestos,
  codigosFiscales,
}: {
  productoId?: string;
  defaults?: Partial<ProductoInput>;
  categorias: OpcionRef[];
  marcas: OpcionRef[];
  unidades: OpcionRef[];
  impuestos: OpcionRef[];
  codigosFiscales: OpcionRef[];
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);
  const [seccionesAbiertas, setSeccionesAbiertas] = useState({
    basica: true,
    precios: true,
    inventario: true,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductoInput>({
    resolver: zodResolver(productoSchema),
    defaultValues: valoresInicialesProducto(defaults),
  });

  const categoriaId = watch("categoriaId") ?? "";
  const marcaId = watch("marcaId") ?? "";
  const tipo = watch("tipo") ?? "simple";
  const esNuevo = !productoId;
  const prefijoSku = useMemo(() => {
    const categoria = categorias.find((c) => c.value === categoriaId);
    return prefijoSkuCategoria(categoria?.label, tipo);
  }, [categoriaId, categorias, tipo]);

  async function onSubmit(values: ProductoInput) {
    setEnviando(true);
    const res = productoId
      ? await actualizarProducto(productoId, values)
      : await crearProducto(values);
    setEnviando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    mostrar("success", productoId ? "Producto actualizado" : "Producto creado");
    router.push("/inventario");
    router.refresh();
  }

  function toggleSeccion(seccion: keyof typeof seccionesAbiertas) {
    setSeccionesAbiertas((prev) => ({ ...prev, [seccion]: !prev[seccion] }));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <SeccionProducto
        title="Información básica"
        abierta={seccionesAbiertas.basica}
        onToggle={() => toggleSeccion("basica")}
      >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={esNuevo ? "SKU automatico" : "SKU"}
              error={errors.sku?.message}
              {...register("sku")}
              placeholder={esNuevo ? `${prefijoSku}-0001` : "LIM-0001"}
              readOnly={esNuevo}
              hint={esNuevo ? `Se asignara como ${prefijoSku}-0001, ${prefijoSku}-0002...` : "Usa el prefijo de la categoria cuando lo cambies."}
            />
            <Input
              label="Código de barras (opcional)"
              {...register("codigoBarras")}
              placeholder="7501234567890"
            />
          </div>
          <Input label="Nombre" error={errors.nombre?.message} {...register("nombre")} />
          <Input label="Descripción (opcional)" {...register("descripcion")} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Tipo"
              {...register("tipo")}
              options={[
                { value: "simple", label: "Producto simple" },
                { value: "servicio", label: "Servicio" },
                { value: "kit", label: "Kit / combo" },
              ]}
            />
            <Select
              label="Unidad de medida"
              placeholder="Selecciona..."
              {...register("unidadBaseId")}
              options={unidades}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectConAgregar
              label="Categoría"
              tituloModal="Agregar categoría"
              value={categoriaId}
              onChange={(v) => {
                setValue("categoriaId", v);
                if (esNuevo) setValue("sku", "");
              }}
              options={[{ value: "", label: "Sin categoría" }, ...categorias]}
              onCrear={(nombre) => crearCategoria({ nombre })}
            />
            <SelectConAgregar
              label="Marca"
              tituloModal="Agregar marca"
              value={marcaId}
              onChange={(v) => setValue("marcaId", v)}
              options={[{ value: "", label: "Sin marca" }, ...marcas]}
              onCrear={(nombre) => crearMarca({ nombre })}
            />
          </div>
          <Input
            label="Fecha de vencimiento"
            type="date"
            error={errors.fechaVencimiento?.message}
            {...register("fechaVencimiento")}
            hint="Déjalo vacío si el producto no vence"
          />
      </SeccionProducto>

      <SeccionProducto
        title="Precios e impuesto"
        abierta={seccionesAbiertas.precios}
        onToggle={() => toggleSeccion("precios")}
      >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Precio base"
              type="number"
              step="0.0001"
              min="0"
              error={errors.precioBase?.message}
              {...register("precioBase")}
            />
            <Input
              label="Costo promedio"
              type="number"
              step="0.0001"
              min="0"
              error={errors.costoPromedio?.message}
              {...register("costoPromedio")}
              hint="Se recalcula con cada compra"
            />
            <Select
              label="Impuesto aplicable"
              placeholder="Sin impuesto"
              {...register("impuestoId")}
              options={impuestos}
            />
            <Select
              label="Código fiscal"
              {...register("productoFiscalCodigo")}
              options={codigosFiscales}
            />
          </div>
      </SeccionProducto>

      <SeccionProducto
        title="Inventario"
        abierta={seccionesAbiertas.inventario}
        onToggle={() => toggleSeccion("inventario")}
      >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Stock mínimo"
              type="number"
              step="0.0001"
              min="0"
              error={errors.stockMinimo?.message}
              {...register("stockMinimo")}
              hint="Alerta al bajar de este nivel"
            />
            <Input
              label="Stock máximo (opcional)"
              type="number"
              step="0.0001"
              min="0"
              error={errors.stockMaximo?.message}
              {...register("stockMaximo")}
            />
            <Select
              label="Método de costeo"
              {...register("metodoCosteo")}
              options={[
                { value: "promedio", label: "Promedio ponderado" },
                { value: "fifo", label: "FIFO (primero en entrar, primero en salir)" },
              ]}
            />
          </div>
          <div className="flex flex-wrap gap-5 text-small">
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register("manejaLotes")} className="rounded" />
              Maneja lotes
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register("manejaSeries")} className="rounded" />
              Maneja números de serie
            </label>
          </div>
      </SeccionProducto>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={enviando}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={enviando}>
          {productoId ? "Guardar cambios" : "Crear producto"}
        </Button>
      </div>
    </form>
  );
}

function SeccionProducto({
  title,
  abierta,
  onToggle,
  children,
}: {
  title: string;
  abierta: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 border-b border-[color:var(--color-border)] px-4 py-4 text-left sm:px-5"
        aria-expanded={abierta}
      >
        <h2 className="text-base font-semibold text-[color:var(--color-text-primary)]">
          {title}
        </h2>
        <ChevronRight
          size={17}
          className={cn(
            "shrink-0 text-[color:var(--color-text-muted)] transition-transform",
            abierta && "rotate-90",
          )}
        />
      </button>
      {abierta && <CardBody className="space-y-4">{children}</CardBody>}
    </Card>
  );
}

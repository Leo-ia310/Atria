"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productoSchema, type ProductoInput } from "@/lib/validations/productos";
import { crearProducto, actualizarProducto } from "@/lib/actions/productos";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

type OpcionRef = { value: string; label: string };

export function ProductoForm({
  productoId,
  defaults,
  categorias,
  marcas,
  unidades,
  impuestos,
}: {
  productoId?: string;
  defaults?: Partial<ProductoInput>;
  categorias: OpcionRef[];
  marcas: OpcionRef[];
  unidades: OpcionRef[];
  impuestos: OpcionRef[];
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductoInput>({
    resolver: zodResolver(productoSchema),
    defaultValues: {
      sku: defaults?.sku ?? "",
      codigoBarras: defaults?.codigoBarras ?? "",
      nombre: defaults?.nombre ?? "",
      descripcion: defaults?.descripcion ?? "",
      tipo: defaults?.tipo ?? "simple",
      categoriaId: defaults?.categoriaId ?? "",
      marcaId: defaults?.marcaId ?? "",
      unidadBaseId: defaults?.unidadBaseId ?? "",
      impuestoId: defaults?.impuestoId ?? "",
      precioBase: defaults?.precioBase ?? 0,
      costoPromedio: defaults?.costoPromedio ?? 0,
      stockMinimo: defaults?.stockMinimo ?? 0,
      stockMaximo: defaults?.stockMaximo ?? undefined,
      metodoCosteo: defaults?.metodoCosteo ?? "promedio",
      manejaLotes: defaults?.manejaLotes ?? false,
      manejaSeries: defaults?.manejaSeries ?? false,
    },
  });

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Card>
        <CardHeader title="Información básica" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="SKU" error={errors.sku?.message} {...register("sku")} placeholder="ITM-001" />
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
            <Select
              label="Categoría (opcional)"
              placeholder="Sin categoría"
              {...register("categoriaId")}
              options={categorias}
            />
            <Select
              label="Marca (opcional)"
              placeholder="Sin marca"
              {...register("marcaId")}
              options={marcas}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Precios e impuesto" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Precio base"
              type="number"
              step="0.0001"
              error={errors.precioBase?.message}
              {...register("precioBase")}
            />
            <Input
              label="Costo promedio"
              type="number"
              step="0.0001"
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
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Inventario" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Stock mínimo"
              type="number"
              step="0.0001"
              {...register("stockMinimo")}
              hint="Alerta al bajar de este nivel"
            />
            <Input
              label="Stock máximo (opcional)"
              type="number"
              step="0.0001"
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
        </CardBody>
      </Card>

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

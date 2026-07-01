"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient, ApiError, ApiDisabledError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const schema = z.object({
  sku: z.string().min(1).max(50),
  barcode: z.string().optional().or(z.literal("")),
  name: z.string().min(2).max(200),
  unit: z.string().min(1, "Unidad requerida").default("UND"),
  categoryName: z.string().optional().or(z.literal("")),
  brandName: z.string().optional().or(z.literal("")),
  supplierName: z.string().optional().or(z.literal("")),
  salePrice: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0),
  minStock: z.coerce.number().min(0).default(0),
  isTrackSerial: z.boolean().default(false),
  isTrackExpiration: z.boolean().default(false),
});

type Form = z.infer<typeof schema>;

export default function NuevoProductoPage() {
  const router = useRouter();
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: "",
      barcode: "",
      name: "",
      unit: "UND",
      categoryName: "",
      brandName: "",
      supplierName: "",
      salePrice: 0,
      costPrice: 0,
      minStock: 0,
      isTrackSerial: false,
      isTrackExpiration: false,
    },
  });

  async function onSubmit(values: Form) {
    setEnviando(true);
    try {
      await apiClient.post("/inventory/products", values);
      mostrar("success", "Producto creado");
      router.push("/app/inventario");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiDisabledError) {
        mostrar("error", "API deshabilitada");
      } else if (err instanceof ApiError) {
        mostrar("error", err.message);
      } else {
        mostrar("error", "No pudimos crear el producto");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nuevo producto" subtitle="Agrega un SKU al catálogo" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <CardHeader title="Información básica" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="SKU" placeholder="ITM-001" error={errors.sku?.message} {...register("sku")} />
              <Input label="Código de barras" placeholder="7501..." {...register("barcode")} />
            </div>
            <Input label="Nombre" error={errors.name?.message} {...register("name")} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input label="Unidad" placeholder="UND, KG, LT..." {...register("unit")} />
              <Input label="Categoría" placeholder="Opcional" {...register("categoryName")} />
              <Input label="Marca" placeholder="Opcional" {...register("brandName")} />
            </div>
            <Input label="Proveedor preferido" placeholder="Opcional" {...register("supplierName")} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Precios e inventario" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="Precio de venta"
                type="number"
                step="0.01"
                error={errors.salePrice?.message}
                {...register("salePrice")}
              />
              <Input
                label="Costo"
                type="number"
                step="0.01"
                hint="Costo de adquisición"
                error={errors.costPrice?.message}
                {...register("costPrice")}
              />
              <Input
                label="Stock mínimo"
                type="number"
                step="1"
                hint="Para alertas"
                {...register("minStock")}
              />
            </div>
            <div className="flex flex-wrap gap-5 text-small">
              <label className="flex items-center gap-2">
                <input type="checkbox" {...register("isTrackSerial")} />
                Seguimiento por número de serie
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" {...register("isTrackExpiration")} />
                Maneja fechas de vencimiento
              </label>
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" loading={enviando}>
            Crear producto
          </Button>
        </div>
      </form>
    </div>
  );
}

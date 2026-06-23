import { PageHeader } from "@/components/layout/PageHeader";
import { ProveedorForm } from "@/components/proveedores/ProveedorForm";

export default function NuevoProveedorPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nuevo proveedor" subtitle="Datos para órdenes de compra y CxP" />
      <ProveedorForm />
    </div>
  );
}

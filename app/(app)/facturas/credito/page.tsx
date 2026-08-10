import {
  FacturasLista,
  type FacturasSearchParams,
} from "@/components/facturas/FacturasLista";

export default async function FacturasCreditoPage({
  searchParams,
}: {
  searchParams: Promise<FacturasSearchParams>;
}) {
  const sp = await searchParams;
  return <FacturasLista modo="credito" searchParams={sp} />;
}

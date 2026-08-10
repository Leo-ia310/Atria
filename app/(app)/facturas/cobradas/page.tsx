import {
  FacturasLista,
  type FacturasSearchParams,
} from "@/components/facturas/FacturasLista";

export default async function FacturasCobradasPage({
  searchParams,
}: {
  searchParams: Promise<FacturasSearchParams>;
}) {
  const sp = await searchParams;
  return <FacturasLista modo="cobradas" searchParams={sp} />;
}

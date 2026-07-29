import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { ClienteForm } from "@/components/clientes/ClienteForm";
import { desdeDecimal } from "@/lib/utils";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user] = await Promise.all([params, requireSession()]);

  const [cliente] = await db
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      identificacionFiscal: clientes.identificacionFiscal,
      email: clientes.email,
      telefono: clientes.telefono,
      direccion: clientes.direccion,
      limiteCredito: clientes.limiteCredito,
      diasCredito: clientes.diasCredito,
      esConsumidorFinal: clientes.esConsumidorFinal,
      notas: clientes.notas,
    })
    .from(clientes)
    .where(
      and(
        eq(clientes.id, id),
        eq(clientes.empresaId, user.empresaId),
        isNull(clientes.eliminadoEn),
      ),
    )
    .limit(1);

  if (!cliente) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={cliente.nombre} subtitle={cliente.identificacionFiscal ?? "Sin ID fiscal"} />
      <ClienteForm
        clienteId={cliente.id}
        defaults={{
          nombre: cliente.nombre,
          identificacionFiscal: cliente.identificacionFiscal ?? "",
          email: cliente.email ?? "",
          telefono: cliente.telefono ?? "",
          direccion: cliente.direccion ?? "",
          limiteCredito: desdeDecimal(cliente.limiteCredito),
          diasCredito: cliente.diasCredito,
          esConsumidorFinal: cliente.esConsumidorFinal,
          notas: cliente.notas ?? "",
        }}
      />
    </div>
  );
}

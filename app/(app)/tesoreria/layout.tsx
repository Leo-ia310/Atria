import { requireSession } from "@/lib/actions/session-helpers";
import { procesarGastosRecurrentesPendientes } from "@/lib/tesoreria/gastos-recurrentes";
import { TesoreriaNav } from "@/components/tesoreria/TesoreriaNav";

export default async function TesoreriaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const resultado = await procesarGastosRecurrentesPendientes({ empresaId: user.empresaId });
  if (resultado.errores > 0) {
    console.error(`[tesoreria] ${resultado.errores} gastos recurrentes no pudieron procesarse`);
  }

  return (
    <div>
      <TesoreriaNav />
      {children}
    </div>
  );
}

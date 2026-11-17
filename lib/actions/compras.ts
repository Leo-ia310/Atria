"use server";
import {executeWebAttempt} from '@/lib/web-operation-attempt';
import {executeBusinessAction} from '@/lib/business-action';
import {procesarCompraSchema} from '@/lib/validations/compras';
import {requireSession} from '@/lib/actions/session-helpers';
import {validarAccion} from '@/lib/server-access';
import {procesarCompraBusiness} from '@/lib/purchase-business';
type Resultado =
  | { ok: true; compraId: string; asientoId: string }
  | { ok: false; error: string };

export async function procesarCompra(input: unknown, attemptKey?: string): Promise<Resultado> {
  const user = await requireSession();
  return executeBusinessAction(user, async () => {
    const acceso = await validarAccion(user, { modulo: "compras", permisos: "compras.crear" });
    if (!acceso.ok) return acceso;
    const parsed = procesarCompraSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
    return executeWebAttempt(user, "compra", attemptKey, parsed.data,
      () => procesarCompraBusiness(parsed.data, user));
  });
}



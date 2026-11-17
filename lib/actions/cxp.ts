"use server";
import {executeBusinessAction} from '@/lib/business-action';
import {requireSession} from '@/lib/actions/session-helpers';
import {validarAccion} from '@/lib/server-access';
import {registrarPagoBusiness} from '@/lib/payable-business';
export async function registrarPago(
  input: unknown,
): Promise<{ ok: true; pagoId: string } | { ok: false; error: string }> {
  const user=await requireSession();return executeBusinessAction(user,async()=>{const access=await validarAccion(user,{modulo:'cxp',permisos:'compras.crear'});return access.ok?registrarPagoBusiness(input,user):access;});
}


import { sql } from "drizzle-orm";
import { dbConEmpresa } from "../db";

/** Read model only: never adds the stored opening amount to posted journals. */
export function cuentasConSaldoContableQuery(empresaId:string,branches?:string[]) {
  const scope=branches?sql`and (cf.sucursal_id is null or cf.sucursal_id=any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(branches)}::jsonb)::uuid)))`:sql``;
  return sql`select cf.id,cf.empresa_id,cf.sucursal_id,cf.nombre,cf.tipo,cf.banco,cf.numero_cuenta,
    cf.moneda,cf.cuenta_contable_id,cf.saldo_actual,cf.saldo_actual as saldo_inicial,cf.activa,cf.activa as activo,e.moneda as moneda_contable,
    case when c.id is null or not c.permite_movimiento then 'sin_vincular'
      when (select count(*) from cuentas_financieras sibling where sibling.empresa_id=cf.empresa_id and sibling.cuenta_contable_id=cf.cuenta_contable_id)>1 then 'cuenta_compartida'
      when cf.moneda<>e.moneda then 'requiere_conversion' else 'contabilizado' end as estado_saldo,
    case when c.id is not null and c.permite_movimiento and cf.moneda=e.moneda
      and (select count(*) from cuentas_financieras sibling where sibling.empresa_id=cf.empresa_id and sibling.cuenta_contable_id=cf.cuenta_contable_id)=1
      then coalesce(j.saldo,0) else null end as saldo_contable
    from cuentas_financieras cf join empresas e on e.id=cf.empresa_id
    left join catalogo_cuentas c on c.id=cf.cuenta_contable_id and c.empresa_id=cf.empresa_id
    left join lateral (select sum(case when c.naturaleza='acreedora' then p.haber-p.debe else p.debe-p.haber end) as saldo
      from asiento_partidas p join asientos_contables a on a.id=p.asiento_id
      where p.cuenta_id=c.id and a.empresa_id=cf.empresa_id and a.estado='registrado') j on true
    where cf.empresa_id=${empresaId}::uuid ${scope}`;
}

export type CuentaConSaldoContable={id:string;empresa_id:string;nombre:string;tipo:string;banco:string|null;numero_cuenta:string|null;moneda:string;moneda_contable:string;saldo_actual:string;saldo_contable:string|null;estado_saldo:"sin_vincular"|"cuenta_compartida"|"requiere_conversion"|"contabilizado";activa:boolean};
export async function getCuentasConSaldoContable(empresaId:string):Promise<CuentaConSaldoContable[]> {
  return dbConEmpresa(empresaId,async(tx)=>[...await tx.execute(cuentasConSaldoContableQuery(empresaId))] as CuentaConSaldoContable[]);
}

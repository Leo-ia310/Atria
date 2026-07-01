/**
 * Helpers de cálculo financiero del lado cliente.
 * Toma los entries+accounts del API y genera saldos por cuenta y los
 * estados financieros agregados (estado de resultados, balance general).
 *
 * Nota: actualmente /accounting/entries devuelve los últimos 40 asientos
 * (limite del API). Cuando crezca el histórico, los reportes deben
 * calcularse en el servidor con una query SQL agregada.
 */

export type AccountType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "INCOME"
  | "REVENUE"
  | "EXPENSE"
  | "COST";

export type AccountDTO = {
  id: string;
  code: string;
  name: string;
  type: string;
};

export type EntryLineDTO = {
  debit: string | number;
  credit: string | number;
  account: { code: string; name: string };
};

export type EntryDTO = {
  id: string;
  status?: string;
  lines: EntryLineDTO[];
};

export type SaldoCuenta = {
  code: string;
  name: string;
  type: string;
  naturaleza: "debit" | "credit";
  totalDebit: number;
  totalCredit: number;
  saldo: number;
};

const NATURALEZA: Record<string, "debit" | "credit"> = {
  ASSET: "debit",
  EXPENSE: "debit",
  COST: "debit",
  COST_OF_SALES: "debit",
  LIABILITY: "credit",
  EQUITY: "credit",
  INCOME: "credit",
  REVENUE: "credit",
};

export function calcularSaldosPorCuenta(
  entries: EntryDTO[],
  accounts: AccountDTO[],
): SaldoCuenta[] {
  const mapa = new Map<string, AccountDTO>();
  for (const a of accounts) mapa.set(a.code, a);

  const acumulado = new Map<string, { debit: number; credit: number }>();
  for (const e of entries) {
    if (e.status === "VOIDED") continue;
    for (const l of e.lines) {
      const code = l.account.code;
      const actual = acumulado.get(code) ?? { debit: 0, credit: 0 };
      actual.debit += Number(l.debit);
      actual.credit += Number(l.credit);
      acumulado.set(code, actual);
    }
  }

  const saldos: SaldoCuenta[] = [];
  for (const [code, { debit, credit }] of acumulado) {
    const cuenta = mapa.get(code);
    if (!cuenta) continue;
    const naturaleza = NATURALEZA[cuenta.type] ?? "debit";
    const saldo = naturaleza === "debit" ? debit - credit : credit - debit;
    if (Math.abs(debit) < 0.0001 && Math.abs(credit) < 0.0001) continue;
    saldos.push({
      code,
      name: cuenta.name,
      type: cuenta.type,
      naturaleza,
      totalDebit: debit,
      totalCredit: credit,
      saldo,
    });
  }
  return saldos.sort((a, b) => a.code.localeCompare(b.code));
}

export type EstadoResultados = {
  ingresos: SaldoCuenta[];
  costos: SaldoCuenta[];
  gastos: SaldoCuenta[];
  totalIngresos: number;
  totalCostos: number;
  utilidadBruta: number;
  totalGastos: number;
  utilidadNeta: number;
};

export function calcularEstadoResultados(saldos: SaldoCuenta[]): EstadoResultados {
  const ingresos = saldos.filter((s) => s.type === "INCOME" || s.type === "REVENUE");
  const costos = saldos.filter((s) => s.type === "COST" || s.type === "COST_OF_SALES");
  const gastos = saldos.filter((s) => s.type === "EXPENSE");

  const totalIngresos = ingresos.reduce((a, s) => a + s.saldo, 0);
  const totalCostos = costos.reduce((a, s) => a + s.saldo, 0);
  const utilidadBruta = totalIngresos - totalCostos;
  const totalGastos = gastos.reduce((a, s) => a + s.saldo, 0);
  const utilidadNeta = utilidadBruta - totalGastos;

  return {
    ingresos,
    costos,
    gastos,
    totalIngresos,
    totalCostos,
    utilidadBruta,
    totalGastos,
    utilidadNeta,
  };
}

export type BalanceGeneral = {
  activos: SaldoCuenta[];
  pasivos: SaldoCuenta[];
  patrimonio: SaldoCuenta[];
  totalActivos: number;
  totalPasivos: number;
  totalPatrimonio: number;
  utilidadEjercicio: number;
  totalPasivoMasPatrimonio: number;
  balanceado: boolean;
};

export function calcularBalanceGeneral(saldos: SaldoCuenta[]): BalanceGeneral {
  const activos = saldos.filter((s) => s.type === "ASSET");
  const pasivos = saldos.filter((s) => s.type === "LIABILITY");
  const patrimonio = saldos.filter((s) => s.type === "EQUITY");
  const utilidadEjercicio = calcularEstadoResultados(saldos).utilidadNeta;

  const totalActivos = activos.reduce((a, s) => a + s.saldo, 0);
  const totalPasivos = pasivos.reduce((a, s) => a + s.saldo, 0);
  const totalPatrimonio = patrimonio.reduce((a, s) => a + s.saldo, 0) + utilidadEjercicio;
  const totalPasivoMasPatrimonio = totalPasivos + totalPatrimonio;
  const balanceado = Math.abs(totalActivos - totalPasivoMasPatrimonio) < 0.01;

  return {
    activos,
    pasivos,
    patrimonio,
    totalActivos,
    totalPasivos,
    totalPatrimonio,
    utilidadEjercicio,
    totalPasivoMasPatrimonio,
    balanceado,
  };
}

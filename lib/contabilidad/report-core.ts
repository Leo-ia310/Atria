export type SaldoCuenta = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: "activo" | "pasivo" | "patrimonio" | "ingreso" | "costo" | "gasto" | "orden";
  naturaleza: "deudora" | "acreedora";
  totalDebe: number;
  totalHaber: number;
  /** Saldo en su naturaleza natural. Positivo = saldo normal. Negativo = saldo invertido (anomalía). */
  saldo: number;
};

export function mapSaldoCuenta(row:Omit<SaldoCuenta,"saldo"|"totalDebe"|"totalHaber">&{totalDebe:string|number;totalHaber:string|number}):SaldoCuenta {
  const totalDebe=Number(row.totalDebe),totalHaber=Number(row.totalHaber);
  return {id:row.id,codigo:row.codigo,nombre:row.nombre,tipo:row.tipo,naturaleza:row.naturaleza,totalDebe,totalHaber,saldo:row.naturaleza==="deudora"?totalDebe-totalHaber:totalHaber-totalDebe};
}
export function saldoCorrido<T extends {debe:string|number;haber:string|number}>(rows:T[],naturaleza:"deudora"|"acreedora",inicial=0) {
  let saldo=inicial;
  return rows.map((row)=>{const debe=Number(row.debe),haber=Number(row.haber);saldo+=naturaleza==="deudora"?debe-haber:haber-debe;return {...row,debe,haber,saldo};});
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
  const ingresos = saldos.filter((s) => s.tipo === "ingreso" && s.saldo !== 0);
  const costos = saldos.filter((s) => s.tipo === "costo" && s.saldo !== 0);
  const gastos = saldos.filter((s) => s.tipo === "gasto" && s.saldo !== 0);

  const totalIngresos = ingresos.reduce((a, c) => a + c.saldo, 0);
  const totalCostos = costos.reduce((a, c) => a + c.saldo, 0);
  const utilidadBruta = totalIngresos - totalCostos;
  const totalGastos = gastos.reduce((a, c) => a + c.saldo, 0);
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
  const activos = saldos.filter((s) => s.tipo === "activo" && s.saldo !== 0);
  const pasivos = saldos.filter((s) => s.tipo === "pasivo" && s.saldo !== 0);
  const patrimonio = saldos.filter((s) => s.tipo === "patrimonio" && s.saldo !== 0);

  const er = calcularEstadoResultados(saldos);
  const utilidadEjercicio = er.utilidadNeta;

  const totalActivos = activos.reduce((a, c) => a + c.saldo, 0);
  const totalPasivos = pasivos.reduce((a, c) => a + c.saldo, 0);
  const totalPatrimonio = patrimonio.reduce((a, c) => a + c.saldo, 0) + utilidadEjercicio;

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

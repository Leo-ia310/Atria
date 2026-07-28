"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  empresas,
  usuarios,
  roles,
  permisos as permisosTable,
  rolPermisos,
  sucursales,
  almacenes,
  formasPago,
  catalogoCuentas,
  periodosContables,
  suscripciones,
  planes as planesTable,
  impuestos as impuestosTable,
  listasPrecios,
  unidadesMedida,
  categoriasGasto,
  cuentasFinancieras,
  configuraciones,
} from "@/lib/db/schema";
import { registroCompletoSchema } from "@/lib/validations/auth";
import { CATALOGO_CUENTAS_BASE, getPaisConfig, CUENTAS_CLAVE } from "@/lib/paises";
import { PLANES } from "@/lib/pricing";

const PERMISOS_BASE = [
  { clave: "ventas.crear", modulo: "ventas", descripcion: "Crear ventas en el POS" },
  { clave: "ventas.anular", modulo: "ventas", descripcion: "Anular ventas" },
  { clave: "ventas.descuento_supervisor", modulo: "ventas", descripcion: "Aplicar descuentos altos" },
  { clave: "ventas.ver", modulo: "ventas", descripcion: "Ver historial de ventas" },
  { clave: "inventario.ver", modulo: "inventario", descripcion: "Ver inventario" },
  { clave: "inventario.ajustar", modulo: "inventario", descripcion: "Ajustar stock manualmente" },
  { clave: "inventario.conteo", modulo: "inventario", descripcion: "Realizar conteo físico" },
  { clave: "compras.crear", modulo: "compras", descripcion: "Registrar compras" },
  { clave: "contabilidad.ver", modulo: "contabilidad", descripcion: "Ver libro diario y reportes" },
  { clave: "contabilidad.asiento_manual", modulo: "contabilidad", descripcion: "Crear asientos manuales" },
  { clave: "contabilidad.cerrar_periodo", modulo: "contabilidad", descripcion: "Cerrar períodos contables" },
  { clave: "tesoreria.ver", modulo: "tesoreria", descripcion: "Ver cuentas financieras" },
  { clave: "reportes.ver", modulo: "reportes", descripcion: "Ver reportes básicos" },
  { clave: "reportes.avanzados", modulo: "reportes", descripcion: "Ver reportes avanzados" },
  { clave: "configuracion.usuarios", modulo: "configuracion", descripcion: "Gestionar usuarios" },
  { clave: "configuracion.roles", modulo: "configuracion", descripcion: "Gestionar roles" },
  { clave: "auditoria.ver", modulo: "auditoria", descripcion: "Ver auditoría" },
] as const;

const ROLES_BASE = [
  {
    nombre: "Administrador",
    descripcion: "Acceso total al sistema",
    permisos: PERMISOS_BASE.map((p) => p.clave),
  },
  {
    nombre: "Gerente",
    descripcion: "Operación diaria y supervisión",
    permisos: [
      "ventas.crear", "ventas.anular", "ventas.descuento_supervisor", "ventas.ver",
      "inventario.ver", "inventario.ajustar", "inventario.conteo",
      "compras.crear", "tesoreria.ver", "reportes.ver", "reportes.avanzados",
    ],
  },
  {
    nombre: "Cajero",
    descripcion: "Punto de venta",
    permisos: ["ventas.crear", "ventas.ver", "inventario.ver"],
  },
  {
    nombre: "Contador",
    descripcion: "Contabilidad y reportes",
    permisos: [
      "ventas.ver", "inventario.ver", "compras.crear",
      "contabilidad.ver", "contabilidad.asiento_manual", "contabilidad.cerrar_periodo",
      "tesoreria.ver", "reportes.ver", "reportes.avanzados",
    ],
  },
  {
    nombre: "Vendedor",
    descripcion: "Crea ventas, no anula",
    permisos: ["ventas.crear", "ventas.ver", "inventario.ver"],
  },
  {
    nombre: "Auditor",
    descripcion: "Solo lectura para auditoría",
    permisos: [
      "ventas.ver", "inventario.ver", "contabilidad.ver",
      "tesoreria.ver", "reportes.ver", "auditoria.ver",
    ],
  },
];

type ResultadoRegistro =
  | { ok: true; empresaId: string; usuarioId: string }
  | { ok: false; error: string };

export async function registrarEmpresa(
  formData: unknown,
): Promise<ResultadoRegistro> {
  const parsed = registroCompletoSchema.safeParse(formData);
  if (!parsed.success) {
    const primer = parsed.error.issues[0];
    return { ok: false, error: primer?.message ?? "Datos inválidos" };
  }

  const { empresa, admin, plan } = parsed.data;
  const paisCfg = getPaisConfig(empresa.pais);

  const yaExiste = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.email, admin.email))
    .limit(1);
  if (yaExiste.length > 0) {
    return { ok: false, error: "Ya existe una cuenta con ese correo" };
  }

  const planRow = await db
    .select()
    .from(planesTable)
    .where(eq(planesTable.codigo, plan.planId))
    .limit(1);
  if (planRow.length === 0) {
    await asegurarPlanes();
    const reintento = await db
      .select()
      .from(planesTable)
      .where(eq(planesTable.codigo, plan.planId))
      .limit(1);
    if (reintento.length === 0) {
      return { ok: false, error: "Plan no encontrado" };
    }
    planRow.push(reintento[0]);
  }
  const planSeleccionado = planRow[0];

  try {
    const resultado = await db.transaction(async (tx) => {
      const [empresaCreada] = await tx
        .insert(empresas)
        .values({
          razonSocial: empresa.razonSocial,
          nombreComercial: empresa.nombreComercial || null,
          identificacionFiscal: empresa.identificacionFiscal,
          pais: empresa.pais,
          moneda: empresa.moneda,
          zonaHoraria: paisCfg.zonaHoraria,
          formatoFecha: paisCfg.formatoFecha,
          onboardingCompleto: false,
        })
        .returning();

      await asegurarPermisos(tx);

      const permisosRows = await tx.select().from(permisosTable);
      const permisosPorClave = new Map(permisosRows.map((p) => [p.clave, p.id]));

      let rolAdminId: string | null = null;
      for (const rb of ROLES_BASE) {
        const [rolCreado] = await tx
          .insert(roles)
          .values({
            empresaId: empresaCreada.id,
            nombre: rb.nombre,
            descripcion: rb.descripcion,
            esBase: true,
          })
          .returning();
        if (rb.nombre === "Administrador") rolAdminId = rolCreado.id;

        const filas = rb.permisos
          .map((clave) => permisosPorClave.get(clave))
          .filter((id): id is string => Boolean(id))
          .map((permisoId) => ({ rolId: rolCreado.id, permisoId }));
        if (filas.length > 0) await tx.insert(rolPermisos).values(filas);
      }

      const passwordHash = await bcrypt.hash(admin.password, 10);
      const [usuarioCreado] = await tx
        .insert(usuarios)
        .values({
          empresaId: empresaCreada.id,
          rolId: rolAdminId,
          nombre: admin.nombre,
          email: admin.email,
          passwordHash,
          activo: true,
        })
        .returning();

      const [sucursalCreada] = await tx
        .insert(sucursales)
        .values({
          empresaId: empresaCreada.id,
          codigo: "PRIN",
          nombre: "Sucursal Principal",
          esPrincipal: true,
        })
        .returning();

      const cuentasCreadas = await crearCatalogoCuentas(tx, empresaCreada.id);
      const cuentasPorCodigo = new Map(cuentasCreadas.map((c) => [c.codigo, c.id]));

      await tx.insert(unidadesMedida).values([
        { empresaId: empresaCreada.id, codigo: "UND", nombre: "Unidad", esBase: true },
        { empresaId: empresaCreada.id, codigo: "KG", nombre: "Kilogramo", esBase: false },
        { empresaId: empresaCreada.id, codigo: "LT", nombre: "Litro", esBase: false },
        { empresaId: empresaCreada.id, codigo: "CJA", nombre: "Caja", esBase: false },
        { empresaId: empresaCreada.id, codigo: "PQT", nombre: "Paquete", esBase: false },
      ]);

      await tx.insert(impuestosTable).values({
        empresaId: empresaCreada.id,
        nombre: paisCfg.impuestoNombre,
        codigo: paisCfg.impuestoCodigo,
        tasa: paisCfg.tasaDefault.toString(),
        cuentaContableId: cuentasPorCodigo.get(CUENTAS_CLAVE.IVA_DEBITO),
        activo: true,
      });

      await tx.insert(listasPrecios).values({
        empresaId: empresaCreada.id,
        nombre: "Precio Público",
        esDefault: true,
        activa: true,
      });

      const [almacenCreado] = await tx
        .insert(almacenes)
        .values({
          empresaId: empresaCreada.id,
          sucursalId: sucursalCreada.id,
          codigo: "PRIN",
          nombre: "Almacén Principal",
          esPrincipal: true,
        })
        .returning();
      void almacenCreado;

      const [cuentaCaja] = await tx
        .insert(cuentasFinancieras)
        .values({
          empresaId: empresaCreada.id,
          sucursalId: sucursalCreada.id,
          tipo: "caja",
          nombre: "Caja Principal",
          moneda: empresa.moneda,
          cuentaContableId: cuentasPorCodigo.get(CUENTAS_CLAVE.CAJA),
          activa: true,
        })
        .returning();

      const [cuentaBanco] = await tx
        .insert(cuentasFinancieras)
        .values({
          empresaId: empresaCreada.id,
          tipo: "banco",
          nombre: "Banco Principal",
          moneda: empresa.moneda,
          cuentaContableId: cuentasPorCodigo.get(CUENTAS_CLAVE.BANCO),
          activa: true,
        })
        .returning();

      await tx.insert(formasPago).values([
        {
          empresaId: empresaCreada.id,
          codigo: "EFE",
          nombre: "Efectivo",
          cuentaFinancieraId: cuentaCaja.id,
          requiereReferencia: false,
        },
        {
          empresaId: empresaCreada.id,
          codigo: "TAR",
          nombre: "Tarjeta",
          cuentaFinancieraId: cuentaBanco.id,
          requiereReferencia: true,
        },
        {
          empresaId: empresaCreada.id,
          codigo: "TRA",
          nombre: "Transferencia",
          cuentaFinancieraId: cuentaBanco.id,
          requiereReferencia: true,
        },
        {
          empresaId: empresaCreada.id,
          codigo: "CRE",
          nombre: "Crédito",
          requiereReferencia: false,
        },
      ]);

      await tx.insert(categoriasGasto).values([
        { empresaId: empresaCreada.id, nombre: "Alquiler", cuentaContableId: cuentasPorCodigo.get("6102") },
        { empresaId: empresaCreada.id, nombre: "Servicios Públicos", cuentaContableId: cuentasPorCodigo.get("6103") },
        { empresaId: empresaCreada.id, nombre: "Comunicaciones", cuentaContableId: cuentasPorCodigo.get("6105") },
        { empresaId: empresaCreada.id, nombre: "Sueldos", cuentaContableId: cuentasPorCodigo.get("6101") },
        { empresaId: empresaCreada.id, nombre: "Publicidad", cuentaContableId: cuentasPorCodigo.get("6202") },
      ]);

      const hoy = new Date();
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      await tx.insert(periodosContables).values({
        empresaId: empresaCreada.id,
        anio: hoy.getFullYear(),
        mes: hoy.getMonth() + 1,
        fechaInicio: inicioMes.toISOString().slice(0, 10),
        fechaFin: finMes.toISOString().slice(0, 10),
        estado: "abierto",
      });

      const inicio = new Date();
      const fin = new Date();
      if (plan.ciclo === "anual") fin.setFullYear(fin.getFullYear() + 1);
      else fin.setMonth(fin.getMonth() + 1);
      if (plan.planId === "demo") fin.setDate(fin.getDate() + 14);

      await tx.insert(suscripciones).values({
        empresaId: empresaCreada.id,
        planId: planSeleccionado.id,
        estado: plan.planId === "demo" ? "trial" : "activa",
        ciclo: plan.ciclo,
        inicioPeriodo: inicio,
        finPeriodo: fin,
      });

      await tx.insert(configuraciones).values([
        { empresaId: empresaCreada.id, clave: "ticket.formato", valor: { ancho_mm: 80, fuente: "monospace" } },
        { empresaId: empresaCreada.id, clave: "inventario.metodo_costeo", valor: { metodo: "promedio" } },
        { empresaId: empresaCreada.id, clave: "ventas.descuento_max_sin_pin", valor: { porcentaje: 10 } },
        { empresaId: empresaCreada.id, clave: "cuentas_clave", valor: CUENTAS_CLAVE },
      ]);

      await tx
        .update(empresas)
        .set({ onboardingCompleto: true })
        .where(eq(empresas.id, empresaCreada.id));

      return { empresaId: empresaCreada.id, usuarioId: usuarioCreado.id };
    });

    return { ok: true, ...resultado };
  } catch (err) {
    console.error("[registrarEmpresa]", err);
    return { ok: false, error: "No pudimos crear tu cuenta. Intenta de nuevo." };
  }
}

async function asegurarPermisos(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
  const existentes = await tx.select({ clave: permisosTable.clave }).from(permisosTable);
  const yaExisten = new Set(existentes.map((p) => p.clave));
  const aInsertar = PERMISOS_BASE.filter((p) => !yaExisten.has(p.clave));
  if (aInsertar.length > 0) await tx.insert(permisosTable).values(aInsertar);
}

async function crearCatalogoCuentas(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  empresaId: string,
) {
  const filas = CATALOGO_CUENTAS_BASE.map((c) => ({
    empresaId,
    codigo: c.codigo,
    nombre: c.nombre,
    tipo: c.tipo,
    naturaleza: c.naturaleza,
    nivel: c.nivel,
    esDetalle: c.esDetalle,
    permiteMovimiento: c.esDetalle,
    activa: true,
  }));
  const insertadas = await tx
    .insert(catalogoCuentas)
    .values(filas)
    .returning({ id: catalogoCuentas.id, codigo: catalogoCuentas.codigo });

  const porCodigo = new Map(insertadas.map((c) => [c.codigo, c.id]));
  for (const c of CATALOGO_CUENTAS_BASE) {
    if (c.padreCodigo) {
      const padreId = porCodigo.get(c.padreCodigo);
      const hijaId = porCodigo.get(c.codigo);
      if (padreId && hijaId) {
        await tx
          .update(catalogoCuentas)
          .set({ padreId })
          .where(eq(catalogoCuentas.id, hijaId));
      }
    }
  }
  return insertadas;
}

export async function asegurarPlanes() {
  const filas = await db.select().from(planesTable);
  const existentes = new Set(filas.map((p) => p.codigo));

  for (const id of ["demo", "pro", "enterprise"] as const) {
    const p = PLANES[id];
    const values = {
      codigo: p.id,
      nombre: p.nombre,
      tipo: p.id,
      precioMensual: p.precioMensual.toString(),
      precioAnual: p.precioAnual.toString(),
      maxSucursales: p.maxSucursales,
      maxUsuarios: p.maxUsuarios,
      maxProductos: p.maxProductos,
      maxTransaccionesMes: p.maxTransaccionesMes,
      precioUsuarioExtra: p.precioUsuarioExtra?.toString(),
      precioSucursalExtra: p.precioSucursalExtra?.toString(),
      features: p.features,
      activo: true,
    };

    if (existentes.has(id)) {
      await db.update(planesTable).set(values).where(eq(planesTable.codigo, id));
    } else {
      await db.insert(planesTable).values(values);
    }
  }
}

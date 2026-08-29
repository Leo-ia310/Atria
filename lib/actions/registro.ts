"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { dbSuperAdmin, type Tx } from "@/lib/db";
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
import { VERSION_LEGAL } from "@/lib/legal";
import { CATALOGO_CUENTAS_BASE, getPaisConfig, CUENTAS_CLAVE } from "@/lib/paises";
import { PLANES } from "@/lib/pricing";
import { finPeriodo, finTrialPlanPago } from "@/lib/suscripciones/core";
import {
  leerCodigoReferidoDesdeCookie,
  normalizarCodigoReferido,
} from "@/lib/referrals/atria-vendedores";
import { rateLimit } from "@/lib/redis/rate-limit";

const PERMISOS_BASE = [
  { clave: "ventas.crear", modulo: "ventas", descripcion: "Crear ventas en el POS" },
  { clave: "ventas.anular", modulo: "ventas", descripcion: "Anular ventas" },
  { clave: "ventas.descuento_supervisor", modulo: "ventas", descripcion: "Aplicar descuentos altos" },
  { clave: "ventas.ver", modulo: "ventas", descripcion: "Ver historial de ventas" },
  { clave: "restaurante.menu", modulo: "restaurante", descripcion: "Gestionar menu virtual" },
  { clave: "restaurante.pedidos", modulo: "restaurante", descripcion: "Ver y actualizar pedidos de cocina" },
  { clave: "restaurante.dashboard.ver", modulo: "restaurante", descripcion: "Ver dashboard de ARCA Restaurante" },
  { clave: "restaurante.mesas.ver", modulo: "restaurante", descripcion: "Ver plano y estados de mesas" },
  { clave: "restaurante.mesas.editar", modulo: "restaurante", descripcion: "Editar areas y mesas" },
  { clave: "restaurante.ordenes.crear", modulo: "restaurante", descripcion: "Crear ordenes de restaurante" },
  { clave: "restaurante.ordenes.editar", modulo: "restaurante", descripcion: "Editar ordenes abiertas" },
  { clave: "restaurante.ordenes.cancelar", modulo: "restaurante", descripcion: "Cancelar ordenes de restaurante" },
  { clave: "restaurante.comandas.enviar", modulo: "restaurante", descripcion: "Enviar comandas a cocina" },
  { clave: "restaurante.kds.ver", modulo: "restaurante", descripcion: "Ver KDS por estacion" },
  { clave: "restaurante.kds.actualizar", modulo: "restaurante", descripcion: "Actualizar estados de KDS" },
  { clave: "restaurante.recetas.ver", modulo: "restaurante", descripcion: "Ver recetas y food cost" },
  { clave: "restaurante.recetas.editar", modulo: "restaurante", descripcion: "Editar recetas y preparaciones" },
  { clave: "restaurante.mermas.ver", modulo: "restaurante", descripcion: "Ver mermas" },
  { clave: "restaurante.mermas.crear", modulo: "restaurante", descripcion: "Registrar mermas" },
  { clave: "restaurante.reservaciones.ver", modulo: "restaurante", descripcion: "Ver reservaciones y lista de espera" },
  { clave: "restaurante.reservaciones.editar", modulo: "restaurante", descripcion: "Editar reservaciones" },
  { clave: "restaurante.descuentos.aplicar", modulo: "restaurante", descripcion: "Aplicar descuentos autorizados" },
  { clave: "restaurante.cuentas.dividir", modulo: "restaurante", descripcion: "Dividir cuentas" },
  { clave: "restaurante.reportes.ver", modulo: "restaurante", descripcion: "Ver reportes especializados" },
  { clave: "restaurante.crm.ver", modulo: "restaurante", descripcion: "Ver CRM de comensales" },
  { clave: "restaurante.promociones.ver", modulo: "restaurante", descripcion: "Ver promociones restaurante" },
  { clave: "restaurante.promociones.editar", modulo: "restaurante", descripcion: "Editar promociones restaurante" },
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
      "restaurante.menu", "restaurante.pedidos",
      "restaurante.dashboard.ver", "restaurante.mesas.ver", "restaurante.mesas.editar",
      "restaurante.ordenes.crear", "restaurante.ordenes.editar", "restaurante.ordenes.cancelar",
      "restaurante.comandas.enviar", "restaurante.kds.ver", "restaurante.kds.actualizar",
      "restaurante.recetas.ver", "restaurante.recetas.editar", "restaurante.mermas.ver",
      "restaurante.mermas.crear", "restaurante.reservaciones.ver",
      "restaurante.reservaciones.editar", "restaurante.descuentos.aplicar",
      "restaurante.cuentas.dividir", "restaurante.reportes.ver", "restaurante.crm.ver",
      "restaurante.promociones.ver", "restaurante.promociones.editar",
      "inventario.ver", "inventario.ajustar", "inventario.conteo",
      "compras.crear", "tesoreria.ver", "reportes.ver", "reportes.avanzados",
    ],
  },
  {
    nombre: "Cajero",
    descripcion: "Punto de venta",
    permisos: [
      "ventas.crear", "ventas.ver", "restaurante.pedidos",
      "restaurante.dashboard.ver", "restaurante.mesas.ver",
      "restaurante.ordenes.crear", "restaurante.ordenes.editar",
      "restaurante.comandas.enviar", "restaurante.kds.ver",
      "restaurante.cuentas.dividir", "inventario.ver",
    ],
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

  const limite = await rateLimit("registro", admin.email.toLowerCase(), 5, 60 * 60);
  if (!limite.permitido) {
    return { ok: false, error: "Demasiados intentos. Intenta de nuevo más tarde." };
  }

  const paisCfg = getPaisConfig(empresa.pais);
  const codigoReferido = normalizarCodigoReferido(await leerCodigoReferidoDesdeCookie());

  // Registro corre SIN sesión (crea una empresa nueva): bypass de RLS.
  const yaExiste = await dbSuperAdmin((tx) =>
    tx
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.email, admin.email))
      .limit(1),
  );
  if (yaExiste.length > 0) {
    return { ok: false, error: "Ya existe una cuenta con ese correo" };
  }

  const planRow = await dbSuperAdmin((tx) =>
    tx
      .select()
      .from(planesTable)
      .where(eq(planesTable.codigo, plan.planId))
      .limit(1),
  );
  if (planRow.length === 0) {
    await asegurarPlanes();
    const reintento = await dbSuperAdmin((tx) =>
      tx
        .select()
        .from(planesTable)
        .where(eq(planesTable.codigo, plan.planId))
        .limit(1),
    );
    if (reintento.length === 0) {
      return { ok: false, error: "Plan no encontrado" };
    }
    planRow.push(reintento[0]);
  }
  const planSeleccionado = planRow[0];

  try {
    const resultado = await dbSuperAdmin(async (tx) => {
      const [empresaCreada] = await tx
        .insert(empresas)
        .values({
          razonSocial: empresa.razonSocial,
          nombreComercial: empresa.nombreComercial || null,
          identificacionFiscal: empresa.identificacionFiscal.trim(),
          tipoEmpresa: empresa.tipoEmpresa,
          verticalEmpresa: empresa.tipoEmpresa === "restaurante" ? "restaurante" : "retail",
          pais: empresa.pais,
          moneda: empresa.moneda,
          codigoReferido: codigoReferido || null,
          referidoCapturadoEn: codigoReferido ? new Date() : null,
          zonaHoraria: paisCfg.zonaHoraria,
          formatoFecha: paisCfg.formatoFecha,
          onboardingCompleto: false,
          terminosVersion: VERSION_LEGAL,
          terminosAceptadosEn: new Date(),
        })
        .returning();

      await asegurarPermisos(tx);

      const permisosRows = await tx.select().from(permisosTable);
      const permisosPorClave = new Map(permisosRows.map((p) => [p.clave, p.id]));

      const rolesCreados = await tx
        .insert(roles)
        .values(
          ROLES_BASE.map((rb) => ({
            empresaId: empresaCreada.id,
            nombre: rb.nombre,
            descripcion: rb.descripcion,
            esBase: true,
          })),
        )
        .returning({ id: roles.id, nombre: roles.nombre });
      const rolesPorNombre = new Map(rolesCreados.map((rol) => [rol.nombre, rol.id]));
      const rolAdminId = rolesPorNombre.get("Administrador") ?? null;
      const permisosPorRol: { rolId: string; permisoId: string }[] = [];
      for (const rb of ROLES_BASE) {
        const rolId = rolesPorNombre.get(rb.nombre);
        if (!rolId) continue;
        for (const clave of rb.permisos) {
          const permisoId = permisosPorClave.get(clave);
          if (permisoId) permisosPorRol.push({ rolId, permisoId });
        }
      }
      if (permisosPorRol.length > 0) await tx.insert(rolPermisos).values(permisosPorRol);

      const passwordHash = await bcrypt.hash(admin.password, 10);
      const [[usuarioCreado], [sucursalCreada], cuentasCreadas] = await Promise.all([
        tx
          .insert(usuarios)
          .values({
            empresaId: empresaCreada.id,
            rolId: rolAdminId,
            nombre: admin.nombre,
            email: admin.email,
            passwordHash,
            activo: true,
          })
          .returning(),
        tx
          .insert(sucursales)
          .values({
            empresaId: empresaCreada.id,
            codigo: "PRIN",
            nombre: "Sucursal Principal",
            esPrincipal: true,
          })
          .returning(),
        crearCatalogoCuentas(tx, empresaCreada.id),
      ]);
      const cuentasPorCodigo = new Map(cuentasCreadas.map((c) => [c.codigo, c.id]));

      await tx.insert(unidadesMedida).values([
        { empresaId: empresaCreada.id, codigo: "UND", nombre: "Unidad", esBase: true },
        { empresaId: empresaCreada.id, codigo: "KG", nombre: "Kilogramo", esBase: false },
        { empresaId: empresaCreada.id, codigo: "G", nombre: "Gramo", esBase: false },
        { empresaId: empresaCreada.id, codigo: "LT", nombre: "Litro", esBase: false },
        { empresaId: empresaCreada.id, codigo: "ML", nombre: "Mililitro", esBase: false },
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

      const [[almacenCreado], [cuentaCaja], [cuentaBanco]] = await Promise.all([
        tx
          .insert(almacenes)
          .values({
            empresaId: empresaCreada.id,
            sucursalId: sucursalCreada.id,
            codigo: "PRIN",
            nombre: "Almacén Principal",
            esPrincipal: true,
          })
          .returning(),
        tx
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
          .returning(),
        tx
          .insert(cuentasFinancieras)
          .values({
            empresaId: empresaCreada.id,
            tipo: "banco",
            nombre: "Banco Principal",
            moneda: empresa.moneda,
            cuentaContableId: cuentasPorCodigo.get(CUENTAS_CLAVE.BANCO),
            activa: true,
          })
          .returning(),
      ]);
      void almacenCreado;

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

      // Demo es permanente y limitado. Pro/Enterprise inician con 15 dias gratis.
      const inicio = new Date();
      const planIdInicial = planSeleccionado.codigo as keyof typeof PLANES;
      const fin =
        planIdInicial === "demo"
          ? finPeriodo(inicio, "demo", "mensual")
          : finTrialPlanPago(inicio);

      await tx.insert(suscripciones).values({
        empresaId: empresaCreada.id,
        planId: planSeleccionado.id,
        estado: "trial",
        ciclo: planIdInicial === "demo" ? "mensual" : plan.ciclo,
        codigoReferido: codigoReferido || null,
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

async function asegurarPermisos(tx: Tx) {
  const existentes = await tx.select({ clave: permisosTable.clave }).from(permisosTable);
  const yaExisten = new Set(existentes.map((p) => p.clave));
  const aInsertar = PERMISOS_BASE.filter((p) => !yaExisten.has(p.clave));
  if (aInsertar.length > 0) await tx.insert(permisosTable).values(aInsertar);
}

async function crearCatalogoCuentas(
  tx: Tx,
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
  const parentUpdates = [];
  for (const c of CATALOGO_CUENTAS_BASE) {
    if (c.padreCodigo) {
      const padreId = porCodigo.get(c.padreCodigo);
      const hijaId = porCodigo.get(c.codigo);
      if (padreId && hijaId) {
        parentUpdates.push(
          tx
            .update(catalogoCuentas)
            .set({ padreId })
            .where(eq(catalogoCuentas.id, hijaId)),
        );
      }
    }
  }
  await Promise.all(parentUpdates);
  return insertadas;
}

export async function asegurarPlanes() {
  // Tabla `planes` es global (sin RLS); bypass explícito por consistencia.
  const filas = await dbSuperAdmin((tx) => tx.select().from(planesTable));
  const existentes = new Set(filas.map((p) => p.codigo));

  await Promise.all((["demo", "pro", "enterprise"] as const).map((id) => {
    const p = PLANES[id];
    const values = {
      codigo: p.id,
      nombre: p.nombre,
      tipo: p.id,
      precioMensual: p.precioMensual.toString(),
      precioSemestral: p.precioSemestral.toString(),
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
      return dbSuperAdmin((tx) =>
        tx.update(planesTable).set(values).where(eq(planesTable.codigo, id)),
      );
    }
    return dbSuperAdmin((tx) => tx.insert(planesTable).values(values));
  }));
}

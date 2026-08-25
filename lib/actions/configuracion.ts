"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  usuarios,
  roles,
  rolPermisos,
  formasPago,
  impuestos,
  cuentasFinancieras,
  secuenciasFiscales,
  tiposDocumento,
  sucursales,
  almacenes,
  empresas,
  configuraciones,
  menusVirtuales,
  pedidosCocina,
  restauranteAreas,
  restauranteComandaItems,
  restauranteComandas,
  restauranteComensalTokens,
  restauranteComensales,
  restauranteComprasSugeridas,
  restauranteEncuestaRespuestas,
  restauranteEncuestas,
  restauranteEstaciones,
  restauranteFidelizacionConfig,
  restauranteListaEspera,
  restauranteMermas,
  restauranteMesas,
  restauranteMeseros,
  restauranteModificadorGrupos,
  restauranteModificadores,
  restauranteMovimientosPuntos,
  restauranteOrdenItems,
  restauranteOrdenes,
  restauranteProductos,
  restaurantePromociones,
  restauranteRecetaIngredientes,
  restauranteRecetas,
  restauranteReservaciones,
  restauranteVisitasComensal,
} from "@/lib/db/schema";
import {
  crearUsuarioSchema,
  crearSucursalSchema,
  actualizarUsuarioSchema,
  formaPagoSchema,
  impuestoSchema,
  rolSchema,
  cuentaFinancieraSchema,
  secuenciaFiscalSchema,
  perfilSchema,
  empresaTipoSchema,
  politicasNegocioSchema,
  configuracionNegocioSchema,
  cambiarPasswordSchema,
} from "@/lib/validations/configuracion";
import { requireSession } from "@/lib/actions/session-helpers";
import { validarAccion, validarLimitePlan } from "@/lib/server-access";
import { esPalabraConfirmacionRestaurante } from "@/lib/restaurante/confirmacion";
import {
  POLITICAS_NEGOCIO_CLAVE,
  normalizarPoliticasNegocio,
} from "@/lib/politicas-negocio";
import {
  CONFIGURACION_NEGOCIO_CLAVE,
  normalizarConfiguracionNegocio,
} from "@/lib/configuracion-negocio";

type Resultado = { ok: true; id?: string } | { ok: false; error: string };

/* ------------------------------ Sucursales ------------------------------ */

export async function crearSucursal(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;

  const parsed = crearSucursalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const limite = await validarLimitePlan(acceso.access, user.empresaId, "sucursales");
  if (!limite.ok) return limite;

  const d = parsed.data;

  try {
    const yaExiste = await db
      .select({ id: sucursales.id })
      .from(sucursales)
      .where(and(eq(sucursales.empresaId, user.empresaId), eq(sucursales.codigo, d.codigo)))
      .limit(1);
    if (yaExiste.length > 0) {
      return { ok: false, error: "Ya existe una sucursal con ese codigo" };
    }

    const creada = await db.transaction(async (tx) => {
      const [sucursal] = await tx
        .insert(sucursales)
        .values({
          empresaId: user.empresaId,
          codigo: d.codigo,
          nombre: d.nombre,
          direccion: d.direccion || null,
          telefono: d.telefono || null,
          esPrincipal: false,
          activa: true,
        })
        .returning({ id: sucursales.id });

      const codigoAlmacenBase = `ALM_${d.codigo}`;
      const [almacenExistente] = await tx
        .select({ id: almacenes.id })
        .from(almacenes)
        .where(
          and(eq(almacenes.empresaId, user.empresaId), eq(almacenes.codigo, codigoAlmacenBase)),
        )
        .limit(1);

      await tx.insert(almacenes).values({
        empresaId: user.empresaId,
        sucursalId: sucursal.id,
        codigo: almacenExistente
          ? `${codigoAlmacenBase}_${sucursal.id.slice(0, 4).toUpperCase()}`
          : codigoAlmacenBase,
        nombre: `Almacen ${d.nombre}`,
        esPrincipal: false,
        activo: true,
      });

      return sucursal;
    });

    revalidatePath("/configuracion/sucursales");
    revalidatePath("/configuracion/cajas");
    revalidatePath("/inventario");
    revalidatePath("/dashboard");
    return { ok: true, id: creada.id };
  } catch (err) {
    console.error("[crearSucursal]", err);
    return { ok: false, error: "No pudimos crear la sucursal." };
  }
}

/* ------------------------------- Usuarios ------------------------------- */

export async function crearUsuario(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;
  const parsed = crearUsuarioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  if (d.activo) {
    const limite = await validarLimitePlan(acceso.access, user.empresaId, "usuarios");
    if (!limite.ok) return limite;
  }
  try {
    const [rol] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.id, d.rolId), eq(roles.empresaId, user.empresaId)))
      .limit(1);
    if (!rol) return { ok: false, error: "Rol no válido" };

    const yaExiste = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.empresaId, user.empresaId), eq(usuarios.email, d.email)))
      .limit(1);
    if (yaExiste.length > 0) {
      return { ok: false, error: "Ya existe un usuario con ese correo" };
    }

    const passwordHash = await bcrypt.hash(d.password, 10);
    const [creado] = await db
      .insert(usuarios)
      .values({
        empresaId: user.empresaId,
        rolId: d.rolId,
        nombre: d.nombre,
        email: d.email,
        passwordHash,
        activo: d.activo,
      })
      .returning({ id: usuarios.id });

    revalidatePath("/configuracion/usuarios");
    return { ok: true, id: creado.id };
  } catch (err) {
    console.error("[crearUsuario]", err);
    return { ok: false, error: "No pudimos crear el usuario." };
  }
}

export async function cambiarEstadoUsuario(
  id: string,
  activo: boolean,
): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;
  if (id === user.id) {
    return { ok: false, error: "No puedes desactivar tu propio usuario." };
  }
  if (activo) {
    const limite = await validarLimitePlan(acceso.access, user.empresaId, "usuarios");
    if (!limite.ok) return limite;
  }
  try {
    await db
      .update(usuarios)
      .set({ activo })
      .where(and(eq(usuarios.id, id), eq(usuarios.empresaId, user.empresaId)));
    revalidatePath("/configuracion/usuarios");
    return { ok: true };
  } catch (err) {
    console.error("[cambiarEstadoUsuario]", err);
    return { ok: false, error: "No pudimos actualizar el usuario." };
  }
}

export async function actualizarUsuario(
  id: string,
  input: unknown,
): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;
  const parsed = actualizarUsuarioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const d = parsed.data;

  try {
    const [actual] = await db
      .select({
        id: usuarios.id,
        rolId: usuarios.rolId,
        activo: usuarios.activo,
      })
      .from(usuarios)
      .where(and(eq(usuarios.id, id), eq(usuarios.empresaId, user.empresaId)))
      .limit(1);
    if (!actual) return { ok: false, error: "Usuario no encontrado" };

    if (id === user.id && actual.rolId !== d.rolId) {
      return { ok: false, error: "No puedes cambiar tu propio rol." };
    }
    if (id === user.id && !d.activo) {
      return { ok: false, error: "No puedes desactivar tu propio usuario." };
    }

    if (!actual.activo && d.activo) {
      const limite = await validarLimitePlan(acceso.access, user.empresaId, "usuarios");
      if (!limite.ok) return limite;
    }

    const [rol] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.id, d.rolId), eq(roles.empresaId, user.empresaId)))
      .limit(1);
    if (!rol) return { ok: false, error: "Rol no valido" };

    const duplicado = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.empresaId, user.empresaId), eq(usuarios.email, d.email)))
      .limit(1);
    if (duplicado.length > 0 && duplicado[0].id !== id) {
      return { ok: false, error: "Ya existe un usuario con ese correo" };
    }

    const cambios: Partial<typeof usuarios.$inferInsert> = {
      nombre: d.nombre,
      email: d.email,
      rolId: d.rolId,
      activo: d.activo,
    };
    if (d.password) {
      cambios.passwordHash = await bcrypt.hash(d.password, 10);
    }

    await db
      .update(usuarios)
      .set(cambios)
      .where(and(eq(usuarios.id, id), eq(usuarios.empresaId, user.empresaId)));

    revalidatePath("/configuracion/usuarios");
    return { ok: true, id };
  } catch (err) {
    console.error("[actualizarUsuario]", err);
    return { ok: false, error: "No pudimos actualizar el usuario." };
  }
}

/* ------------------------------ Mi cuenta ------------------------------ */

export async function actualizarPerfil(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const parsed = perfilSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    const duplicado = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(
        and(
          eq(usuarios.empresaId, user.empresaId),
          eq(usuarios.email, d.email),
        ),
      )
      .limit(1);
    if (duplicado[0] && duplicado[0].id !== user.id) {
      return { ok: false, error: "Ese correo ya está en uso en tu empresa." };
    }

    await db
      .update(usuarios)
      .set({ nombre: d.nombre, email: d.email, telefono: d.telefono || null })
      .where(eq(usuarios.id, user.id));
    revalidatePath("/mi-cuenta");
    return { ok: true };
  } catch (err) {
    console.error("[actualizarPerfil]", err);
    return { ok: false, error: "No pudimos actualizar el perfil." };
  }
}

export async function cambiarMiPassword(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const parsed = cambiarPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    const [row] = await db
      .select({ passwordHash: usuarios.passwordHash })
      .from(usuarios)
      .where(eq(usuarios.id, user.id))
      .limit(1);
    if (!row) return { ok: false, error: "Usuario no encontrado" };

    const coincide = await bcrypt.compare(d.actual, row.passwordHash);
    if (!coincide) return { ok: false, error: "La contraseña actual no es correcta" };

    const passwordHash = await bcrypt.hash(d.nueva, 10);
    await db
      .update(usuarios)
      .set({ passwordHash })
      .where(eq(usuarios.id, user.id));
    return { ok: true };
  } catch (err) {
    console.error("[cambiarMiPassword]", err);
    return { ok: false, error: "No pudimos cambiar la contraseña." };
  }
}

/* ------------------------------ Empresa ------------------------------ */

export async function actualizarTipoEmpresa(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;

  const parsed = empresaTipoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  try {
    if (parsed.data.tipoEmpresa !== "restaurante") {
      const datos = await contarDatosRestaurante(user.empresaId);
      if (datos.total > 0) {
        return {
          ok: false,
          error:
            "No puedes cambiar el tipo de empresa porque existen menus virtuales o pedidos de cocina. Elimina primero los datos de restaurante.",
        };
      }
    }

    await db
      .update(empresas)
      .set({
        tipoEmpresa: parsed.data.tipoEmpresa,
        verticalEmpresa:
          parsed.data.tipoEmpresa === "restaurante" ? "restaurante" : "retail",
        actualizadoEn: new Date(),
      })
      .where(eq(empresas.id, user.empresaId));

    revalidatePath("/configuracion");
    revalidatePath("/configuracion/empresa");
    revalidatePath("/dashboard");
    revalidatePath("/restaurante");
    revalidatePath("/restaurante/kds");
    revalidatePath("/restaurante/menu");
    revalidatePath("/menu-virtual");
    revalidatePath("/pedidos-cocina");
    revalidateTag("empresa-metadata");
    return { ok: true };
  } catch (err) {
    console.error("[actualizarTipoEmpresa]", err);
    return { ok: false, error: "No pudimos actualizar el tipo de empresa." };
  }
}

export async function actualizarPoliticasNegocio(
  input: unknown,
): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;

  const parsed = politicasNegocioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const politicas = normalizarPoliticasNegocio(parsed.data);

  try {
    await db
      .insert(configuraciones)
      .values({
        empresaId: user.empresaId,
        clave: POLITICAS_NEGOCIO_CLAVE,
        valor: politicas,
      })
      .onConflictDoUpdate({
        target: [configuraciones.empresaId, configuraciones.clave],
        set: {
          valor: politicas,
          actualizadoEn: new Date(),
        },
      });

    revalidatePath("/", "layout");
    revalidatePath("/configuracion/empresa");
    revalidatePath("/pos");
    revalidatePath("/clientes/nuevo");
    revalidatePath("/compras/nueva");
    revalidatePath("/compras/proveedores/nuevo");
    revalidatePath("/cxc");
    revalidatePath("/cxp");
    revalidatePath("/facturas/credito");
    return { ok: true };
  } catch (err) {
    console.error("[actualizarPoliticasNegocio]", err);
    return { ok: false, error: "No pudimos actualizar las politicas." };
  }
}

export async function actualizarConfiguracionNegocio(
  input: unknown,
): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;

  const parsed = configuracionNegocioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const config = normalizarConfiguracionNegocio(parsed.data);

  try {
    await db
      .insert(configuraciones)
      .values({
        empresaId: user.empresaId,
        clave: CONFIGURACION_NEGOCIO_CLAVE,
        valor: config,
      })
      .onConflictDoUpdate({
        target: [configuraciones.empresaId, configuraciones.clave],
        set: {
          valor: config,
          actualizadoEn: new Date(),
        },
      });

    revalidatePath("/", "layout");
    revalidatePath("/configuracion/empresa");
    revalidatePath("/rrhh/nomina");
    return { ok: true };
  } catch (err) {
    console.error("[actualizarConfiguracionNegocio]", err);
    return { ok: false, error: "No pudimos actualizar la configuracion del negocio." };
  }
}

export async function eliminarDatosRestaurante(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;

  const data = input as { reto?: unknown; confirmacion?: unknown };
  const reto = typeof data.reto === "string" ? data.reto.trim() : "";
  const confirmacion =
    typeof data.confirmacion === "string" ? data.confirmacion.trim() : "";

  if (
    !reto ||
    !esPalabraConfirmacionRestaurante(reto) ||
    confirmacion !== reto
  ) {
    return { ok: false, error: "La palabra de confirmacion no coincide." };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(restauranteEncuestaRespuestas)
        .where(eq(restauranteEncuestaRespuestas.empresaId, user.empresaId));
      await tx.delete(restauranteEncuestas).where(eq(restauranteEncuestas.empresaId, user.empresaId));
      await tx
        .delete(restauranteMovimientosPuntos)
        .where(eq(restauranteMovimientosPuntos.empresaId, user.empresaId));
      await tx
        .delete(restauranteFidelizacionConfig)
        .where(eq(restauranteFidelizacionConfig.empresaId, user.empresaId));
      await tx
        .delete(restauranteComensalTokens)
        .where(eq(restauranteComensalTokens.empresaId, user.empresaId));
      await tx
        .delete(restauranteVisitasComensal)
        .where(eq(restauranteVisitasComensal.empresaId, user.empresaId));
      await tx
        .delete(restauranteListaEspera)
        .where(eq(restauranteListaEspera.empresaId, user.empresaId));
      await tx
        .delete(restauranteReservaciones)
        .where(eq(restauranteReservaciones.empresaId, user.empresaId));
      await tx
        .delete(restauranteComandaItems)
        .where(eq(restauranteComandaItems.empresaId, user.empresaId));
      await tx.delete(restauranteComandas).where(eq(restauranteComandas.empresaId, user.empresaId));
      await tx
        .delete(restauranteOrdenItems)
        .where(eq(restauranteOrdenItems.empresaId, user.empresaId));
      await tx.delete(restauranteOrdenes).where(eq(restauranteOrdenes.empresaId, user.empresaId));
      await tx.delete(restauranteMermas).where(eq(restauranteMermas.empresaId, user.empresaId));
      await tx
        .delete(restauranteComprasSugeridas)
        .where(eq(restauranteComprasSugeridas.empresaId, user.empresaId));
      await tx
        .delete(restaurantePromociones)
        .where(eq(restaurantePromociones.empresaId, user.empresaId));
      await tx
        .delete(restauranteModificadores)
        .where(eq(restauranteModificadores.empresaId, user.empresaId));
      await tx
        .delete(restauranteModificadorGrupos)
        .where(eq(restauranteModificadorGrupos.empresaId, user.empresaId));
      await tx
        .delete(restauranteRecetaIngredientes)
        .where(eq(restauranteRecetaIngredientes.empresaId, user.empresaId));
      await tx.delete(restauranteRecetas).where(eq(restauranteRecetas.empresaId, user.empresaId));
      await tx.delete(restauranteMeseros).where(eq(restauranteMeseros.empresaId, user.empresaId));
      await tx.delete(restauranteMesas).where(eq(restauranteMesas.empresaId, user.empresaId));
      await tx.delete(restauranteAreas).where(eq(restauranteAreas.empresaId, user.empresaId));
      await tx
        .delete(restauranteProductos)
        .where(eq(restauranteProductos.empresaId, user.empresaId));
      await tx
        .delete(restauranteEstaciones)
        .where(eq(restauranteEstaciones.empresaId, user.empresaId));
      await tx.delete(restauranteComensales).where(eq(restauranteComensales.empresaId, user.empresaId));
      await tx.delete(menusVirtuales).where(eq(menusVirtuales.empresaId, user.empresaId));
      await tx.delete(pedidosCocina).where(eq(pedidosCocina.empresaId, user.empresaId));
    });

    revalidatePath("/configuracion");
    revalidatePath("/configuracion/empresa");
    revalidatePath("/dashboard");
    revalidatePath("/restaurante");
    revalidatePath("/restaurante/kds");
    revalidatePath("/restaurante/menu");
    revalidatePath("/menu-virtual");
    revalidatePath("/pedidos-cocina");
    return { ok: true };
  } catch (err) {
    console.error("[eliminarDatosRestaurante]", err);
    return { ok: false, error: "No pudimos eliminar los datos de restaurante." };
  }
}

async function contarDatosRestaurante(empresaId: string): Promise<{
  menus: number;
  pedidos: number;
  dominio: number;
  total: number;
}> {
  const [[menus], [pedidos], [dominio]] = await Promise.all([
    db
      .select({ n: count() })
      .from(menusVirtuales)
      .where(eq(menusVirtuales.empresaId, empresaId)),
    db
      .select({ n: count() })
      .from(pedidosCocina)
      .where(eq(pedidosCocina.empresaId, empresaId)),
    db
      .select({ n: count() })
      .from(restauranteOrdenes)
      .where(eq(restauranteOrdenes.empresaId, empresaId)),
  ]);
  const menusN = menus?.n ?? 0;
  const pedidosN = pedidos?.n ?? 0;
  const dominioN = dominio?.n ?? 0;
  return {
    menus: menusN,
    pedidos: pedidosN,
    dominio: dominioN,
    total: menusN + pedidosN + dominioN,
  };
}

/* ------------------------------ Roles ------------------------------ */

export async function crearRol(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;
  const parsed = rolSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    const yaExiste = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.empresaId, user.empresaId), eq(roles.nombre, d.nombre)))
      .limit(1);
    if (yaExiste.length > 0) {
      return { ok: false, error: "Ya existe un rol con ese nombre" };
    }
    const rolId = await db.transaction(async (tx) => {
      const [rol] = await tx
        .insert(roles)
        .values({
          empresaId: user.empresaId,
          nombre: d.nombre,
          descripcion: d.descripcion || null,
          esBase: false,
        })
        .returning({ id: roles.id });
      if (d.permisoIds.length > 0) {
        await tx
          .insert(rolPermisos)
          .values(d.permisoIds.map((pid) => ({ rolId: rol.id, permisoId: pid })));
      }
      return rol.id;
    });
    revalidatePath("/configuracion/roles");
    return { ok: true, id: rolId };
  } catch (err) {
    console.error("[crearRol]", err);
    return { ok: false, error: "No pudimos crear el rol." };
  }
}

export async function actualizarPermisosRol(
  rolId: string,
  permisoIds: string[],
): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;
  try {
    const [rol] = await db
      .select({ id: roles.id, esBase: roles.esBase })
      .from(roles)
      .where(and(eq(roles.id, rolId), eq(roles.empresaId, user.empresaId)))
      .limit(1);
    if (!rol) return { ok: false, error: "Rol no encontrado" };

    await db.transaction(async (tx) => {
      await tx.delete(rolPermisos).where(eq(rolPermisos.rolId, rolId));
      if (permisoIds.length > 0) {
        await tx
          .insert(rolPermisos)
          .values(permisoIds.map((pid) => ({ rolId, permisoId: pid })));
      }
    });
    revalidatePath("/configuracion/roles");
    return { ok: true };
  } catch (err) {
    console.error("[actualizarPermisosRol]", err);
    return { ok: false, error: "No pudimos actualizar los permisos." };
  }
}

/* ------------------------- Cuentas financieras ------------------------- */

export async function crearCuentaFinanciera(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;
  const parsed = cuentaFinancieraSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    const [creada] = await db
      .insert(cuentasFinancieras)
      .values({
        empresaId: user.empresaId,
        tipo: d.tipo,
        nombre: d.nombre,
        banco: d.banco || null,
        numeroCuenta: d.numeroCuenta || null,
        moneda: d.moneda,
        saldoActual: d.saldoInicial.toString(),
        activa: true,
      })
      .returning({ id: cuentasFinancieras.id });
    revalidatePath("/configuracion/cuentas-financieras");
    return { ok: true, id: creada.id };
  } catch (err) {
    console.error("[crearCuentaFinanciera]", err);
    return { ok: false, error: "No pudimos crear la cuenta." };
  }
}

/* --------------------------- Facturación fiscal --------------------------- */

export async function crearSecuenciaFiscal(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;
  const parsed = secuenciaFiscalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  if (
    d.rangoInicial !== undefined &&
    d.rangoFinal !== undefined &&
    d.rangoFinal < d.rangoInicial
  ) {
    return { ok: false, error: "El rango final debe ser mayor al inicial" };
  }
  try {
    const secuenciaId = await db.transaction(async (tx) => {
      let [tipo] = await tx
        .select({ id: tiposDocumento.id })
        .from(tiposDocumento)
        .where(
          and(
            eq(tiposDocumento.empresaId, user.empresaId),
            eq(tiposDocumento.codigo, d.tipoCodigo),
          ),
        )
        .limit(1);
      if (!tipo) {
        [tipo] = await tx
          .insert(tiposDocumento)
          .values({
            empresaId: user.empresaId,
            codigo: d.tipoCodigo,
            nombre: d.tipoNombre,
            aplicaA: "venta",
            activo: true,
          })
          .returning({ id: tiposDocumento.id });
      }
      const [sec] = await tx
        .insert(secuenciasFiscales)
        .values({
          empresaId: user.empresaId,
          tipoDocumentoId: tipo.id,
          prefijo: d.prefijo || null,
          siguienteNumero: d.rangoInicial ?? 1,
          rangoInicial: d.rangoInicial ?? null,
          rangoFinal: d.rangoFinal ?? null,
          autorizacion: d.autorizacion || null,
          fechaLimite: d.fechaLimite || null,
          activa: true,
        })
        .returning({ id: secuenciasFiscales.id });
      return sec.id;
    });
    revalidatePath("/configuracion/facturacion");
    return { ok: true, id: secuenciaId };
  } catch (err) {
    console.error("[crearSecuenciaFiscal]", err);
    return { ok: false, error: "No pudimos crear la secuencia fiscal." };
  }
}

/* ----------------------------- Formas de pago ---------------------------- */

export async function crearFormaPago(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;
  const parsed = formaPagoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    const yaExiste = await db
      .select({ id: formasPago.id })
      .from(formasPago)
      .where(and(eq(formasPago.empresaId, user.empresaId), eq(formasPago.codigo, d.codigo)))
      .limit(1);
    if (yaExiste.length > 0) {
      return { ok: false, error: "Ya existe una forma de pago con ese código" };
    }
    const [creada] = await db
      .insert(formasPago)
      .values({
        empresaId: user.empresaId,
        codigo: d.codigo,
        nombre: d.nombre,
        requiereReferencia: d.requiereReferencia,
        cuentaFinancieraId: d.cuentaFinancieraId || null,
        activa: true,
      })
      .returning({ id: formasPago.id });
    revalidatePath("/configuracion/formas-pago");
    return { ok: true, id: creada.id };
  } catch (err) {
    console.error("[crearFormaPago]", err);
    return { ok: false, error: "No pudimos crear la forma de pago." };
  }
}

export async function actualizarFormaPago(
  id: string,
  input: unknown,
): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;
  const parsed = formaPagoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    const duplicado = await db
      .select({ id: formasPago.id })
      .from(formasPago)
      .where(and(eq(formasPago.empresaId, user.empresaId), eq(formasPago.codigo, d.codigo)))
      .limit(1);
    if (duplicado.length > 0 && duplicado[0].id !== id) {
      return { ok: false, error: "Otro registro ya usa ese código" };
    }
    await db
      .update(formasPago)
      .set({
        codigo: d.codigo,
        nombre: d.nombre,
        requiereReferencia: d.requiereReferencia,
        cuentaFinancieraId: d.cuentaFinancieraId || null,
      })
      .where(and(eq(formasPago.id, id), eq(formasPago.empresaId, user.empresaId)));
    revalidatePath("/configuracion/formas-pago");
    return { ok: true };
  } catch (err) {
    console.error("[actualizarFormaPago]", err);
    return { ok: false, error: "No pudimos actualizar la forma de pago." };
  }
}

export async function eliminarFormaPago(id: string): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;
  try {
    // Baja lógica: se desactiva para no romper ventas históricas que la referencian.
    await db
      .update(formasPago)
      .set({ activa: false })
      .where(and(eq(formasPago.id, id), eq(formasPago.empresaId, user.empresaId)));
    revalidatePath("/configuracion/formas-pago");
    return { ok: true };
  } catch (err) {
    console.error("[eliminarFormaPago]", err);
    return { ok: false, error: "No pudimos eliminar la forma de pago." };
  }
}

/* ------------------------------- Impuestos ------------------------------- */

export async function crearImpuesto(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;
  const parsed = impuestoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    const yaExiste = await db
      .select({ id: impuestos.id })
      .from(impuestos)
      .where(and(eq(impuestos.empresaId, user.empresaId), eq(impuestos.codigo, d.codigo)))
      .limit(1);
    if (yaExiste.length > 0) {
      return { ok: false, error: "Ya existe un impuesto con ese código" };
    }
    const [creado] = await db
      .insert(impuestos)
      .values({
        empresaId: user.empresaId,
        nombre: d.nombre,
        codigo: d.codigo,
        tasa: d.tasa.toString(),
        esRetencion: d.esRetencion,
        activo: true,
      })
      .returning({ id: impuestos.id });
    revalidatePath("/configuracion/impuestos");
    return { ok: true, id: creado.id };
  } catch (err) {
    console.error("[crearImpuesto]", err);
    return { ok: false, error: "No pudimos crear el impuesto." };
  }
}

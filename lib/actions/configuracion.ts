"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
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
} from "@/lib/db/schema";
import {
  crearUsuarioSchema,
  formaPagoSchema,
  impuestoSchema,
  rolSchema,
  cuentaFinancieraSchema,
  secuenciaFiscalSchema,
  perfilSchema,
  cambiarPasswordSchema,
} from "@/lib/validations/configuracion";
import { requireSession } from "@/lib/actions/session-helpers";

type Resultado = { ok: true; id?: string } | { ok: false; error: string };

/* ------------------------------- Usuarios ------------------------------- */

export async function crearUsuario(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const parsed = crearUsuarioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
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
  if (id === user.id) {
    return { ok: false, error: "No puedes desactivar tu propio usuario." };
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

/* ------------------------------ Mi cuenta ------------------------------ */

export async function actualizarPerfil(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const parsed = perfilSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    await db
      .update(usuarios)
      .set({ nombre: d.nombre, telefono: d.telefono || null })
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

/* ------------------------------ Roles ------------------------------ */

export async function crearRol(input: unknown): Promise<Resultado> {
  const user = await requireSession();
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

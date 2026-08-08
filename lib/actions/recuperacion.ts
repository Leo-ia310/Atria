"use server";

import { randomInt, createHash } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { usuarios, codigosRecuperacion } from "@/lib/db/schema";
import {
  recuperarSolicitarSchema,
  recuperarCanjearSchema,
  type RecuperarSolicitarInput,
  type RecuperarCanjearInput,
} from "@/lib/validations/auth";
import { rateLimit } from "@/lib/redis/rate-limit";
import { enviarEmail } from "@/lib/email/resend";
import {
  codigoRecuperacionHtml,
  codigoRecuperacionTexto,
} from "@/lib/email/templates/codigo-recuperacion";

const CODIGO_MINUTOS_VALIDEZ = 15;
const SOLICITAR_MAX_INTENTOS = 5;
const SOLICITAR_VENTANA_SEG = 60 * 60;
const CANJEAR_MAX_INTENTOS = 10;
const CANJEAR_VENTANA_SEG = 15 * 60;

type Resultado = { ok: true } | { ok: false; error: string };

// Respuesta idéntica exista o no la cuenta: evita que alguien use este
// formulario para averiguar qué correos están registrados.
const OK_GENERICO: Resultado = { ok: true };
const ERROR_CODIGO: Resultado = { ok: false, error: "Código inválido o expirado." };

function hashCodigo(codigo: string): string {
  return createHash("sha256").update(codigo).digest("hex");
}

function generarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function solicitarCodigoRecuperacion(
  input: RecuperarSolicitarInput,
): Promise<Resultado> {
  const parsed = recuperarSolicitarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Correo no válido" };
  }
  const email = parsed.data.email.trim().toLowerCase();

  const limite = await rateLimit(
    "recuperar-solicitar",
    email,
    SOLICITAR_MAX_INTENTOS,
    SOLICITAR_VENTANA_SEG,
  );
  if (!limite.permitido) {
    return { ok: false, error: "Demasiados intentos. Espera unos minutos e intenta de nuevo." };
  }

  const [usuario] = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      activo: usuarios.activo,
    })
    .from(usuarios)
    .where(and(eq(usuarios.email, email), isNull(usuarios.eliminadoEn)))
    .limit(1);

  if (!usuario || !usuario.activo) return OK_GENERICO;

  const codigo = generarCodigo();
  const expiraEn = new Date(Date.now() + CODIGO_MINUTOS_VALIDEZ * 60 * 1000);

  await db.insert(codigosRecuperacion).values({
    usuarioId: usuario.id,
    codigoHash: hashCodigo(codigo),
    expiraEn,
  });

  await enviarEmail({
    para: usuario.email,
    asunto: "Tu código para recuperar tu contraseña — ARCA",
    html: codigoRecuperacionHtml({
      nombre: usuario.nombre,
      codigo,
      minutosValidez: CODIGO_MINUTOS_VALIDEZ,
    }),
    texto: codigoRecuperacionTexto({
      nombre: usuario.nombre,
      codigo,
      minutosValidez: CODIGO_MINUTOS_VALIDEZ,
    }),
  });

  return OK_GENERICO;
}

export async function canjearCodigoRecuperacion(
  input: RecuperarCanjearInput,
): Promise<Resultado> {
  const parsed = recuperarCanjearSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const email = parsed.data.email.trim().toLowerCase();
  const codigo = parsed.data.codigo.trim();
  const { password } = parsed.data;

  const limite = await rateLimit(
    "recuperar-canjear",
    email,
    CANJEAR_MAX_INTENTOS,
    CANJEAR_VENTANA_SEG,
  );
  if (!limite.permitido) {
    return { ok: false, error: "Demasiados intentos. Solicita un nuevo código." };
  }

  const [usuario] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.email, email), isNull(usuarios.eliminadoEn)))
    .limit(1);
  if (!usuario) return ERROR_CODIGO;

  const [fila] = await db
    .select()
    .from(codigosRecuperacion)
    .where(
      and(
        eq(codigosRecuperacion.usuarioId, usuario.id),
        isNull(codigosRecuperacion.usadoEn),
      ),
    )
    .orderBy(desc(codigosRecuperacion.creadoEn))
    .limit(1);

  if (!fila) return ERROR_CODIGO;
  if (fila.expiraEn.getTime() < Date.now()) return ERROR_CODIGO;
  if (fila.codigoHash !== hashCodigo(codigo)) return ERROR_CODIGO;

  const passwordHash = await bcrypt.hash(password, 10);

  await db.transaction(async (tx) => {
    await tx.update(usuarios).set({ passwordHash }).where(eq(usuarios.id, usuario.id));
    await tx
      .update(codigosRecuperacion)
      .set({ usadoEn: new Date() })
      .where(eq(codigosRecuperacion.id, fila.id));
  });

  return { ok: true };
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { enviarEmail } from "@/lib/email/resend";

const solicitudSchema = z.object({
  nombre: z.string().trim().min(2, "Indica tu nombre completo.").max(120),
  email: z.string().trim().email("Indica un correo válido.").max(254),
  telefono: z.string().trim().min(7, "Indica un teléfono válido.").max(40),
  empresa: z.string().trim().min(2, "Indica tu empresa o red de contactos.").max(160),
  mensaje: z.string().trim().max(1500).optional().default(""),
  sitioWeb: z.string().max(0).optional(),
});

function escaparHtml(valor: string) {
  return valor.replace(/[&<>'"]/g, (caracter) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[caracter] ?? caracter);
}

export async function POST(request: Request) {
  let datos: unknown;

  try {
    datos = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 });
  }

  const resultado = solicitudSchema.safeParse(datos);
  if (!resultado.success) {
    return NextResponse.json(
      { error: resultado.error.issues[0]?.message || "Revisa los datos ingresados." },
      { status: 400 },
    );
  }

  const { nombre, email, telefono, empresa, mensaje, sitioWeb } = resultado.data;
  if (sitioWeb) return NextResponse.json({ ok: true });

  const texto = [
    "Nueva solicitud del programa Reseller de ARCA",
    "",
    `Nombre: ${nombre}`,
    `Correo: ${email}`,
    `Teléfono: ${telefono}`,
    `Empresa o red: ${empresa}`,
    `Mensaje: ${mensaje || "Sin mensaje adicional."}`,
  ].join("\n");

  const emailEnviado = await enviarEmail({
    para: "maikel.martinezdev@gmail.com",
    asunto: `Nueva solicitud Reseller: ${nombre}`,
    respuestaA: email,
    texto,
    html: `<h1>Nueva solicitud del programa Reseller de ARCA</h1><p><strong>Nombre:</strong> ${escaparHtml(nombre)}</p><p><strong>Correo:</strong> ${escaparHtml(email)}</p><p><strong>Teléfono:</strong> ${escaparHtml(telefono)}</p><p><strong>Empresa o red:</strong> ${escaparHtml(empresa)}</p><p><strong>Mensaje:</strong><br>${escaparHtml(mensaje || "Sin mensaje adicional.").replace(/\n/g, "<br>")}</p>`,
  });

  if (!emailEnviado.ok) {
    return NextResponse.json(
      { error: "No pudimos enviar tu solicitud. Inténtalo de nuevo más tarde." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}

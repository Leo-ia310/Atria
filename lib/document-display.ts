import { z } from "zod";
export function inputMessage(
  error: unknown,
  fallback = "No se pudo completar la operación.",
) {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    if (!issue) return fallback;
    return /^(Expected|Invalid|Number|String|Array|Required|Unrecognized)/.test(
      issue.message,
    )
      ? "Revisa los campos y los límites del formulario."
      : issue.message;
  }
  if (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string"
  )
    return ["42P01", "42703"].includes(error.code)
      ? "ARCA Cloud necesita actualizar su esquema de datos. Contacta al administrador."
      : fallback;
  return error instanceof Error ? error.message : fallback;
}
export function documentEventLabel(value: string) {
  const key = value.replace(/^documento\./, "");
  return (
    (
      {
        create: "Creación",
        edit: "Edición",
        revise: "Nueva revisión",
        duplicate: "Duplicación",
        derive: "Proforma derivada",
        enviada: "Entrega registrada",
        aceptada: "Aceptación",
        rechazada: "Rechazo",
        vencida: "Vencimiento",
        convert: "Conversión a venta",
        pdf_generacion_solicitada: "PDF preparado",
        impresion_solicitada: "Impresión solicitada",
        emision_interna: "Documento interno preparado",
        reimpresion_preparada: "Reimpresión preparada",
        createTemplate: "Plantilla creada",
        saveTemplate: "Nueva versión de plantilla",
        duplicateTemplate: "Plantilla duplicada",
      } as Record<string, string>
    )[key] ?? key.replaceAll("_", " ")
  );
}
export function documentEventDate(value: string) {
  const normalized = value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"),
    date = new Date(normalized);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("es-NI", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Managua",
      }).format(date);
}
export function documentFileName(
  kind: string,
  number: string,
  version: number,
  copy: string,
) {
  const prefix =
    kind === "factura" || kind === "venta"
      ? "recibo-venta"
      : kind === "nota_credito"
        ? "nota-credito"
        : kind === "recibo"
          ? "recibo-cobro"
          : kind === "estado_cuenta"
            ? "estado-cuenta"
            : kind;
  return `${prefix}-${number}${["cotizacion", "proforma"].includes(kind) ? "-r" + version : ""}${copy === "duplicado" ? "-duplicado" : ""}.pdf`.replace(
    /[^a-zA-Z0-9_.-]/g,
    "-",
  );
}

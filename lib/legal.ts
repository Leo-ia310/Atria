/**
 * Fuente única de verdad para los documentos legales de ARCA.
 *
 * Los valores entre corchetes son MARCADORES: reemplázalos por la información
 * real del titular de ARCA antes de publicar. No borres los corchetes a medias;
 * busca "[" en este archivo para encontrarlos todos.
 */

export const VERSION_LEGAL = "1.1";

/** Fecha de vigencia mostrada en cada documento (formato LATAM DD/MM/YYYY). */
export const FECHA_VIGENCIA = "10/08/2026";
export const FECHA_VIGENCIA_LARGA = "10 de agosto de 2026";

/**
 * Identidad legal del proveedor del servicio. Se deja como marcadores porque
 * la entidad aún no está definida. Reemplazar en un solo lugar propaga el
 * cambio a todos los documentos.
 */
export const INFO_LEGAL = {
  marca: "ARCA",
  proveedor: "El proveedor",
  paisSede: "Nicaragua",
  direccion: "Masaya, Nicaragua",
  sitio: "[DOMINIO — opcional, cuando exista sitio propio]",
  dominio: "arcaoficontac@gmail.com",
  correoLegal: "arcaoficontac@gmail.com",
  correoPrivacidad: "arcaoficontac@gmail.com",
  correoSoporte: "arcaoficontac@gmail.com",
  correoAbuso: "arcaoficontac@gmail.com",
  // Ley de Nicaragua + arbitraje conforme a la Ley No. 540. El servicio se
  // ofrece en toda Centroamérica, pero el contrato se rige por una sola ley.
  leyAplicable: "la República de Nicaragua",
  sedeArbitraje: "Masaya, Nicaragua",
  centroArbitraje:
    "un centro de mediación y arbitraje legalmente acreditado en Nicaragua (por ejemplo, el de la Cámara de Comercio y Servicios de Nicaragua)",
  reglasArbitraje:
    "la Ley No. 540, Ley de Mediación y Arbitraje de la República de Nicaragua, y el reglamento del centro que administre el arbitraje",
  idiomaArbitraje: "español",
} as const;

export type DocumentoLegalSlug =
  | "terminos"
  | "privacidad"
  | "cookies"
  | "tratamiento-datos"
  | "uso-aceptable"
  | "inteligencia-artificial";

export interface DocumentoLegal {
  slug: DocumentoLegalSlug;
  titulo: string;
  tituloCorto: string;
  resumen: string;
}

export const DOCUMENTOS_LEGALES: DocumentoLegal[] = [
  {
    slug: "terminos",
    titulo: "Términos y Condiciones del Servicio",
    tituloCorto: "Términos y Condiciones",
    resumen:
      "El contrato que rige el uso de ARCA: suscripción, pagos, planes, límites, garantías, responsabilidad, propiedad intelectual y terminación.",
  },
  {
    slug: "privacidad",
    titulo: "Política de Privacidad",
    tituloCorto: "Privacidad",
    resumen:
      "Qué datos personales tratamos, con qué finalidad y base legal, con quién se comparten, cuánto se conservan y qué derechos tienes sobre ellos.",
  },
  {
    slug: "cookies",
    titulo: "Aviso de Cookies",
    tituloCorto: "Cookies",
    resumen:
      "Qué cookies y tecnologías similares usamos en el sitio y en la plataforma, para qué sirven y cómo puedes gestionarlas.",
  },
  {
    slug: "tratamiento-datos",
    titulo: "Acuerdo de Tratamiento de Datos (DPA)",
    tituloCorto: "Tratamiento de Datos",
    resumen:
      "Cómo ARCA trata, por cuenta de tu empresa, los datos personales de tus clientes, empleados y proveedores. Aplica como Encargado del tratamiento.",
  },
  {
    slug: "uso-aceptable",
    titulo: "Política de Uso Aceptable",
    tituloCorto: "Uso Aceptable",
    resumen:
      "Las conductas prohibidas al usar ARCA y las consecuencias de infringirlas. Protege la plataforma, a los demás usuarios y a terceros.",
  },
  {
    slug: "inteligencia-artificial",
    titulo: "Política de Inteligencia Artificial",
    tituloCorto: "Inteligencia Artificial",
    resumen:
      "Cómo funcionan las funciones asistidas por IA de ARCA, qué datos usan, qué limitaciones tienen y por qué su salida no sustituye el criterio profesional.",
  },
];

export function getDocumentoLegal(slug: DocumentoLegalSlug): DocumentoLegal {
  const doc = DOCUMENTOS_LEGALES.find((d) => d.slug === slug);
  if (!doc) throw new Error(`Documento legal desconocido: ${slug}`);
  return doc;
}

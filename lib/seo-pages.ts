import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, urlAbsoluta } from "@/lib/seo";

export type SeoPage = {
  slug: string;
  category: "producto" | "industria" | "comparativa";
  title: string;
  h1: string;
  eyebrow: string;
  description: string;
  intro: string;
  keywords: string[];
  primaryKeyword: string;
  audience: string;
  outcomes: string[];
  features: { title: string; body: string }[];
  faqs: { question: string; answer: string }[];
  priority: number;
};

export const SEO_PAGES: SeoPage[] = [
  {
    slug: "punto-de-venta",
    category: "producto",
    title: "Sistema POS y punto de venta para negocios en Latinoamerica",
    h1: "Sistema POS conectado a inventario, caja y contabilidad",
    eyebrow: "Punto de venta",
    description:
      "ARCA es un sistema POS para vender rapido, controlar caja, descontar inventario y generar reportes sin duplicar trabajo.",
    intro:
      "Vende desde mostrador, tablet o computadora con un flujo rapido para cajeros y una vista confiable para administracion. Cada venta actualiza caja, existencias, facturacion y reportes.",
    primaryKeyword: "sistema POS",
    keywords: [
      "sistema POS",
      "punto de venta",
      "software punto de venta",
      "POS para negocios",
      "POS con inventario",
    ],
    audience: "tiendas, farmacias, ferreterias, restaurantes rapidos y comercios con caja diaria",
    outcomes: [
      "Cierres de caja claros por turno y usuario.",
      "Ventas, descuentos, pagos mixtos y tickets en un solo flujo.",
      "Inventario y reportes actualizados despues de cada transaccion.",
    ],
    features: [
      {
        title: "Venta rapida",
        body: "Busca productos, cobra con varios metodos de pago, aplica descuentos y emite comprobantes sin salir del POS.",
      },
      {
        title: "Caja controlada",
        body: "Aperturas, arqueos, movimientos y cierres quedan registrados para reducir faltantes y errores.",
      },
      {
        title: "Operacion conectada",
        body: "Cada venta descuenta stock, actualiza cuentas por cobrar cuando aplica y deja datos listos para reportes.",
      },
    ],
    faqs: [
      {
        question: "¿ARCA funciona como POS para una tienda pequena?",
        answer:
          "Si. Puedes iniciar con productos, caja y usuarios basicos, y crecer hacia inventario, facturacion y contabilidad cuando el negocio lo necesite.",
      },
      {
        question: "¿El punto de venta descuenta inventario?",
        answer:
          "Si. Las ventas descuentan existencias y alimentan reportes para saber que se vendio, que queda y que necesita reposicion.",
      },
    ],
    priority: 0.95,
  },
  {
    slug: "inventario",
    category: "producto",
    title: "Software de inventario con ventas, compras y multi-sucursal",
    h1: "Software de inventario para saber que tienes, donde esta y cuanto rota",
    eyebrow: "Inventario",
    description:
      "Controla existencias, lotes, vencimientos, compras, movimientos y stock bajo con ARCA, conectado al punto de venta y reportes.",
    intro:
      "ARCA convierte el inventario en una fuente viva de decisiones: cada venta, compra, ajuste o traslado queda trazado para que el negocio compre mejor y pierda menos.",
    primaryKeyword: "software de inventario",
    keywords: [
      "software de inventario",
      "control de inventario",
      "inventario multi sucursal",
      "stock bajo",
      "inventario para negocios",
    ],
    audience: "negocios con productos fisicos, varias categorias, almacenes o sucursales",
    outcomes: [
      "Existencias por sucursal y almacen.",
      "Alertas de stock bajo y productos sin movimiento.",
      "Trazabilidad de compras, ventas, ajustes y traslados.",
    ],
    features: [
      {
        title: "Stock en tiempo real",
        body: "Consulta existencias disponibles y movimientos sin esperar hojas de calculo al cierre del dia.",
      },
      {
        title: "Lotes y vencimientos",
        body: "Control util para farmacias, alimentos, restaurantes y negocios donde la caducidad importa.",
      },
      {
        title: "Compras conectadas",
        body: "Las compras aumentan inventario, actualizan costos y dejan informacion lista para rentabilidad.",
      },
    ],
    faqs: [
      {
        question: "¿Puedo manejar varias sucursales?",
        answer:
          "Si. ARCA permite operar con sucursales y almacenes para comparar disponibilidad, ventas y movimientos.",
      },
      {
        question: "¿Sirve para productos con vencimiento?",
        answer:
          "Si. Puedes trabajar con lotes y vencimientos para reducir perdidas y mejorar reposicion.",
      },
    ],
    priority: 0.92,
  },
  {
    slug: "facturacion",
    category: "producto",
    title: "Software de facturacion para negocios con POS e inventario",
    h1: "Facturacion conectada a ventas, clientes e inventario",
    eyebrow: "Facturacion",
    description:
      "Emite documentos, controla secuencias, registra clientes y conecta la facturacion con caja, inventario y contabilidad.",
    intro:
      "ARCA ayuda a formalizar la operacion sin volver lento al equipo. La venta nace en caja y queda respaldada con documentos, cuentas y reportes.",
    primaryKeyword: "software de facturacion",
    keywords: [
      "software de facturacion",
      "facturacion para negocios",
      "facturacion con inventario",
      "facturas y POS",
      "sistema de facturacion",
    ],
    audience: "empresas que necesitan comprobantes, control fiscal y trazabilidad comercial",
    outcomes: [
      "Secuencias y documentos organizados por empresa.",
      "Clientes, pagos y facturas conectados.",
      "Ventas listas para reportes y revision administrativa.",
    ],
    features: [
      {
        title: "Documentos desde la venta",
        body: "El flujo de caja genera el respaldo comercial necesario sin capturas duplicadas.",
      },
      {
        title: "Clientes y cuentas",
        body: "Registra clientes, creditos, abonos y saldos pendientes desde el mismo sistema.",
      },
      {
        title: "Control por pais",
        body: "ARCA esta preparado para configuraciones fiscales y monedas por mercado.",
      },
    ],
    faqs: [
      {
        question: "¿La facturacion esta conectada al POS?",
        answer:
          "Si. La venta puede generar el documento y alimentar caja, inventario, cuentas y reportes.",
      },
      {
        question: "¿Puedo manejar ventas al credito?",
        answer:
          "Si. ARCA incluye cuentas por cobrar, abonos y seguimiento de saldos.",
      },
    ],
    priority: 0.9,
  },
  {
    slug: "contabilidad",
    category: "producto",
    title: "Software contable conectado a ventas, compras y gastos",
    h1: "Contabilidad automatica para negocios que venden todos los dias",
    eyebrow: "Contabilidad",
    description:
      "ARCA conecta ventas, compras, gastos, caja y cuentas para generar informacion contable sin perseguir hojas separadas.",
    intro:
      "La contabilidad deja de ser una tarea aislada cuando cada movimiento operativo alimenta los libros. ARCA reduce doble digitacion y mejora la visibilidad financiera.",
    primaryKeyword: "software contable",
    keywords: [
      "software contable",
      "contabilidad automatica",
      "contabilidad para pymes",
      "ventas y contabilidad",
      "libro diario",
    ],
    audience: "negocios que quieren ordenar administracion, reportes y revision contable",
    outcomes: [
      "Asientos desde ventas, compras, gastos y pagos.",
      "Reportes financieros ligados a la operacion real.",
      "Menos trabajo manual para administradores y contadores.",
    ],
    features: [
      {
        title: "Partida doble operativa",
        body: "Los movimientos clave generan informacion contable desde el origen de la transaccion.",
      },
      {
        title: "Reportes financieros",
        body: "Consulta libro diario, mayor, balance de comprobacion, resultados y cuentas por cobrar o pagar.",
      },
      {
        title: "Auditoria y permisos",
        body: "Roles, trazabilidad y separacion por empresa mantienen el control cuando el equipo crece.",
      },
    ],
    faqs: [
      {
        question: "¿Necesito saber contabilidad para vender en ARCA?",
        answer:
          "No. El equipo puede operar ventas, compras y gastos mientras ARCA organiza la informacion para revision administrativa y contable.",
      },
      {
        question: "¿ARCA reemplaza a mi contador?",
        answer:
          "No. ARCA ordena y automatiza informacion para que tu contador revise con mejores datos y menos trabajo repetido.",
      },
    ],
    priority: 0.88,
  },
  {
    slug: "restaurantes",
    category: "industria",
    title: "Software para restaurantes con POS, mesas, inventario y cocina",
    h1: "Software para restaurantes que conecta mesas, cocina, caja e inventario",
    eyebrow: "Restaurantes",
    description:
      "Gestiona POS, mesas, comandas, cocina, inventario, recetas, caja y reportes para restaurantes con ARCA.",
    intro:
      "ARCA esta pensado para restaurantes que necesitan velocidad en servicio y control atras del mostrador: pedidos, cocina, inventario, recetas y cierre de caja en una sola operacion.",
    primaryKeyword: "software para restaurantes",
    keywords: [
      "software para restaurantes",
      "POS restaurante",
      "sistema para restaurantes",
      "inventario restaurante",
      "comandas digitales",
    ],
    audience: "restaurantes, cafeterias, bares, comida rapida y cocinas con inventario",
    outcomes: [
      "Pedidos por mesa y flujos para cocina.",
      "Recetas e insumos ligados a inventario.",
      "Cierres, ventas y rentabilidad visibles por dia.",
    ],
    features: [
      {
        title: "Mesas y comandas",
        body: "Organiza pedidos por mesa y mantiene a caja y cocina trabajando con la misma informacion.",
      },
      {
        title: "Recetas e insumos",
        body: "Conecta platos con productos para entender consumo, costos y reposicion.",
      },
      {
        title: "Menu digital",
        body: "Publica menus con QR y facilita pedidos para comensales cuando el flujo lo necesita.",
      },
    ],
    faqs: [
      {
        question: "¿ARCA sirve para restaurantes pequenos?",
        answer:
          "Si. Puedes iniciar con POS, mesas y caja, y activar inventario, recetas, cocina y reportes al crecer.",
      },
      {
        question: "¿Puedo usar menu QR?",
        answer:
          "Si. ARCA incluye menus publicos para restaurantes con productos, secciones y pedidos.",
      },
    ],
    priority: 0.93,
  },
  {
    slug: "tiendas",
    category: "industria",
    title: "Software para tiendas con POS, inventario y reportes",
    h1: "Software para tiendas que necesitan vender rapido y controlar stock",
    eyebrow: "Tiendas",
    description:
      "ARCA ayuda a tiendas de ropa, abarrotes, accesorios y comercios a controlar ventas, inventario, caja, clientes y reportes.",
    intro:
      "Para una tienda, perder visibilidad de caja o inventario se vuelve caro. ARCA une ventas, existencias, compras y reportes para operar con informacion confiable.",
    primaryKeyword: "software para tiendas",
    keywords: [
      "software para tiendas",
      "POS para tiendas",
      "inventario para tienda",
      "sistema para tienda",
      "control de ventas tienda",
    ],
    audience: "tiendas de ropa, accesorios, abarrotes, calzado, regalos y comercios de mostrador",
    outcomes: [
      "Ventas rapidas desde mostrador.",
      "Stock por producto, categoria y sucursal.",
      "Clientes, creditos y reportes de rentabilidad.",
    ],
    features: [
      {
        title: "Catalogo ordenado",
        body: "Productos, precios, categorias y existencias listos para vender sin depender de hojas externas.",
      },
      {
        title: "Reposicion clara",
        body: "Detecta stock bajo y productos con mayor rotacion para comprar mejor.",
      },
      {
        title: "Control de caja",
        body: "Turnos, arqueos y movimientos ayudan a cuidar el efectivo diario.",
      },
    ],
    faqs: [
      {
        question: "¿Puedo registrar ventas al credito?",
        answer:
          "Si. ARCA permite controlar clientes, saldos y abonos para negocios que venden fiado o al credito.",
      },
      {
        question: "¿Funciona para varias tiendas?",
        answer:
          "Si. Puedes trabajar con varias sucursales y comparar ventas, inventario y resultados.",
      },
    ],
    priority: 0.89,
  },
  {
    slug: "ferreterias",
    category: "industria",
    title: "Software para ferreterias con inventario, POS y compras",
    h1: "Software para ferreterias con miles de productos bajo control",
    eyebrow: "Ferreterias",
    description:
      "Controla ventas, inventario, proveedores, compras, precios, caja y reportes para ferreterias con ARCA.",
    intro:
      "Una ferreteria necesita encontrar productos rapido, controlar margenes y saber que reponer. ARCA conecta mostrador, bodega, compras y administracion.",
    primaryKeyword: "software para ferreterias",
    keywords: [
      "software para ferreterias",
      "POS ferreteria",
      "inventario ferreteria",
      "sistema para ferreteria",
      "control de stock ferreteria",
    ],
    audience: "ferreterias, ventas de materiales, repuestos y negocios con catalogos amplios",
    outcomes: [
      "Busqueda rapida de productos y precios.",
      "Inventario confiable por almacen o sucursal.",
      "Compras y proveedores conectados a costos.",
    ],
    features: [
      {
        title: "Catalogos amplios",
        body: "Ordena productos por categorias, unidades, precios y disponibilidad.",
      },
      {
        title: "Proveedores y compras",
        body: "Registra compras, cuentas por pagar y reposiciones sin perder trazabilidad.",
      },
      {
        title: "Rentabilidad visible",
        body: "Compara ventas, costos y movimiento para cuidar margenes.",
      },
    ],
    faqs: [
      {
        question: "¿ARCA soporta muchos productos?",
        answer:
          "Si. Esta pensado para negocios con catalogos grandes, movimientos frecuentes y varias categorias.",
      },
      {
        question: "¿Puedo controlar proveedores?",
        answer:
          "Si. ARCA incluye gestion de proveedores, compras y cuentas por pagar.",
      },
    ],
    priority: 0.86,
  },
  {
    slug: "farmacias",
    category: "industria",
    title: "Software para farmacias con inventario, lotes y vencimientos",
    h1: "Software para farmacias con control de stock, lotes y vencimientos",
    eyebrow: "Farmacias",
    description:
      "ARCA ayuda a farmacias a vender, controlar inventario, lotes, vencimientos, compras, caja y reportes.",
    intro:
      "En farmacia, el inventario tiene que ser exacto y oportuno. ARCA ayuda a controlar stock, fechas, compras, ventas y caja desde un sistema conectado.",
    primaryKeyword: "software para farmacias",
    keywords: [
      "software para farmacias",
      "inventario farmacia",
      "POS farmacia",
      "lotes y vencimientos",
      "sistema para farmacia",
    ],
    audience: "farmacias, ventas de productos regulados, tiendas de salud y negocios con vencimientos",
    outcomes: [
      "Control de productos con vencimiento.",
      "Stock bajo para reposicion oportuna.",
      "Ventas y caja ligadas a reportes.",
    ],
    features: [
      {
        title: "Vencimientos visibles",
        body: "Gestiona productos donde la fecha de vencimiento impacta perdida, reposicion y venta.",
      },
      {
        title: "Caja rapida",
        body: "El equipo atiende desde el POS mientras administracion ve ventas y movimientos.",
      },
      {
        title: "Compras ordenadas",
        body: "Proveedores, costos y entradas quedan conectados con el inventario.",
      },
    ],
    faqs: [
      {
        question: "¿ARCA maneja vencimientos?",
        answer:
          "Si. El control de lotes y vencimientos ayuda a prevenir perdidas y mejorar reposicion.",
      },
      {
        question: "¿Sirve para varias sucursales de farmacia?",
        answer:
          "Si. Puedes manejar inventario y ventas por sucursal o almacen.",
      },
    ],
    priority: 0.86,
  },
  {
    slug: "distribuidoras",
    category: "industria",
    title: "Software para distribuidoras con inventario, ventas y cuentas",
    h1: "Software para distribuidoras con inventario, clientes y cartera bajo control",
    eyebrow: "Distribuidoras",
    description:
      "Controla inventario, compras, ventas, clientes, cuentas por cobrar, cuentas por pagar y reportes para distribuidoras.",
    intro:
      "ARCA ayuda a distribuidoras a coordinar productos, clientes, creditos, proveedores y resultados sin perder trazabilidad entre ventas y administracion.",
    primaryKeyword: "software para distribuidoras",
    keywords: [
      "software para distribuidoras",
      "inventario distribuidora",
      "sistema para distribuidora",
      "cuentas por cobrar",
      "ventas mayoristas",
    ],
    audience: "distribuidoras, mayoristas, negocios B2B y empresas con cartera de clientes",
    outcomes: [
      "Inventario y compras conectadas.",
      "Clientes, creditos y abonos visibles.",
      "Reportes de ventas, margen y cartera.",
    ],
    features: [
      {
        title: "Cartera de clientes",
        body: "Controla cuentas por cobrar, facturas, abonos y saldos pendientes.",
      },
      {
        title: "Inventario por movimiento",
        body: "Cada venta, compra, ajuste o traslado deja historial para revisar.",
      },
      {
        title: "Rentabilidad por linea",
        body: "Reportes para entender que productos, clientes o sucursales mueven el negocio.",
      },
    ],
    faqs: [
      {
        question: "¿Puedo vender al credito?",
        answer:
          "Si. ARCA incluye cuentas por cobrar y seguimiento de abonos.",
      },
      {
        question: "¿Puedo controlar cuentas por pagar?",
        answer:
          "Si. Las compras y proveedores pueden conectarse con cuentas por pagar.",
      },
    ],
    priority: 0.85,
  },
  {
    slug: "pulperias",
    category: "industria",
    title: "Software para pulperias y mini mercados con POS e inventario",
    h1: "Software para pulperias que quieren vender rapido y dejar el cuaderno",
    eyebrow: "Pulperias y mini mercados",
    description:
      "ARCA ayuda a pulperias, mini mercados y tiendas de barrio a controlar ventas, caja, inventario, fiado y reportes.",
    intro:
      "El cuaderno sirve hasta que el negocio crece. ARCA ordena ventas, caja, productos, clientes y fiado para que cada dia cierre con numeros claros.",
    primaryKeyword: "software para pulperias",
    keywords: [
      "software para pulperias",
      "POS pulperia",
      "sistema para mini mercado",
      "control de fiado",
      "inventario tienda de barrio",
    ],
    audience: "pulperias, mini mercados, tiendas de barrio y negocios familiares",
    outcomes: [
      "Ventas rapidas y cierre de caja.",
      "Control de fiado, clientes y abonos.",
      "Inventario de productos de alta rotacion.",
    ],
    features: [
      {
        title: "Adios al cuaderno",
        body: "Registra ventas, clientes y saldos sin depender de apuntes que se pierden o se confunden.",
      },
      {
        title: "Stock diario",
        body: "Identifica productos agotados, reposicion necesaria y ventas por categoria.",
      },
      {
        title: "Inicio simple",
        body: "Empieza con lo basico y activa mas modulos cuando el negocio lo pida.",
      },
    ],
    faqs: [
      {
        question: "¿Es demasiado avanzado para una pulperia?",
        answer:
          "No. Puedes iniciar con ventas, caja, productos y clientes, y usar mas funciones gradualmente.",
      },
      {
        question: "¿Puedo llevar control del fiado?",
        answer:
          "Si. ARCA permite registrar clientes, saldos y abonos para ventas al credito.",
      },
    ],
    priority: 0.84,
  },
  {
    slug: "treinta",
    category: "comparativa",
    title: "Alternativa a Treinta para POS, inventario y contabilidad",
    h1: "Alternativa a Treinta para negocios que necesitan control completo",
    eyebrow: "Comparativa",
    description:
      "Compara ARCA como alternativa a Treinta si buscas POS, inventario, facturacion, contabilidad, multi-sucursal y soporte para Latinoamerica.",
    intro:
      "Treinta comunica una plataforma facil para ventas, gastos, inventario y facturacion. ARCA compite desde una apuesta distinta: conectar la operacion diaria con contabilidad, reportes, permisos y crecimiento multi-sucursal.",
    primaryKeyword: "alternativa a Treinta",
    keywords: [
      "alternativa a Treinta",
      "competencia de Treinta",
      "sistema POS Latinoamerica",
      "software de gestion para negocios",
      "Treinta vs ARCA",
    ],
    audience: "negocios que comparan sistemas de gestion, POS, inventario, facturacion y contabilidad",
    outcomes: [
      "POS, inventario, facturacion y contabilidad en un solo sistema.",
      "Modulos para restaurantes, tiendas, ferreterias, farmacias y distribuidoras.",
      "Base preparada para empresas que crecen en usuarios, sucursales y control financiero.",
    ],
    features: [
      {
        title: "Mas profundidad operativa",
        body: "ARCA conecta ventas con caja, inventario, facturas, cuentas, reportes y contabilidad automatica.",
      },
      {
        title: "Vertical restaurante",
        body: "Incluye flujos especificos como mesas, cocina, menus, recetas e inventario para restaurantes.",
      },
      {
        title: "Gestion financiera",
        body: "Cuentas por cobrar, cuentas por pagar, tesoreria y reportes contables viven junto al POS.",
      },
    ],
    faqs: [
      {
        question: "¿ARCA es una alternativa a Treinta?",
        answer:
          "Si. ARCA cubre necesidades similares de POS, inventario y gestion, con un enfoque fuerte en contabilidad, control financiero y operacion multi-modulo.",
      },
      {
        question: "¿Por que comparar ARCA con Treinta?",
        answer:
          "Porque muchos negocios buscan una plataforma simple para vender y controlar inventario. ARCA agrega profundidad administrativa para empresas que quieren crecer con mas trazabilidad.",
      },
    ],
    priority: 0.9,
  },
];

export const SEO_PRODUCT_PAGES = SEO_PAGES.filter((page) => page.category === "producto");
export const SEO_INDUSTRY_PAGES = SEO_PAGES.filter((page) => page.category === "industria");

export function getSeoPage(slug: string) {
  return SEO_PAGES.find((page) => page.slug === slug);
}

export function getSeoPath(page: SeoPage) {
  return page.category === "comparativa"
    ? `/alternativas/${page.slug}`
    : `/soluciones/${page.slug}`;
}

export function metadataForSeoPage(page: SeoPage): Metadata {
  const path = getSeoPath(page);
  return {
    title: page.title,
    description: page.description,
    keywords: page.keywords,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url: path,
      type: "website",
      siteName: SITE_NAME,
      locale: "es_ES",
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: urlAbsoluta("/LogoARCA.png"),
    sameAs: [
      "https://www.instagram.com/arca_contac",
      "https://www.facebook.com/share/1XtDCnM5M9/",
      "https://www.linkedin.com/",
    ],
    areaServed: [
      "Honduras",
      "Nicaragua",
      "Guatemala",
      "Costa Rica",
      "El Salvador",
      "United States",
      "Mexico",
    ],
  };
}

export function softwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    offers: {
      "@type": "Offer",
      category: "SaaS",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Punto de venta",
      "Inventario",
      "Facturacion",
      "Contabilidad",
      "Cuentas por cobrar",
      "Cuentas por pagar",
      "Reportes",
      "Multi-sucursal",
    ],
  };
}

export function seoPageJsonLd(page: SeoPage) {
  const path = getSeoPath(page);
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: page.title,
      headline: page.h1,
      description: page.description,
      url: urlAbsoluta(path),
      inLanguage: "es",
      about: page.primaryKeyword,
      audience: {
        "@type": "Audience",
        audienceType: page.audience,
      },
      isPartOf: {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Inicio",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: page.category === "comparativa" ? "Alternativas" : "Soluciones",
          item: urlAbsoluta(page.category === "comparativa" ? "/alternativas" : "/soluciones"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: page.eyebrow,
          item: urlAbsoluta(path),
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  ];
}

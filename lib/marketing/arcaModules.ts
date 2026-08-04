export type ArcaModuleIcon =
  | "BarChart3"
  | "Banknote"
  | "BookOpen"
  | "Building2"
  | "CalendarCheck"
  | "ChefHat"
  | "ClipboardCheck"
  | "CreditCard"
  | "FileText"
  | "HandCoins"
  | "Landmark"
  | "LayoutDashboard"
  | "Package"
  | "Receipt"
  | "Settings"
  | "ShieldCheck"
  | "ShoppingCart"
  | "Store"
  | "Truck"
  | "Users"
  | "UserRound"
  | "Wallet";

export type ArcaModule = {
  id: string;
  name: string;
  description: string;
  benefit: string;
  icon: ArcaModuleIcon;
  evidence: string;
};

export type ArcaModuleCategory = {
  id: string;
  name: string;
  summary: string;
  modules: ArcaModule[];
};

export const ARCA_MODULE_CATEGORIES: ArcaModuleCategory[] = [
  {
    id: "operaciones",
    name: "Operaciones",
    summary: "El flujo diario del negocio conectado desde caja hasta inventario.",
    modules: [
      {
        id: "pos",
        name: "Punto de venta",
        description: "Cobro rapido, busqueda de productos, ticket e impresion.",
        benefit: "Menos espera en caja y ventas registradas al instante.",
        icon: "ShoppingCart",
        evidence: "/pos",
      },
      {
        id: "caja",
        name: "Control de caja",
        description: "Apertura, arqueo, cierres y trazabilidad de sesiones.",
        benefit: "Cada turno queda cuadrado con evidencia.",
        icon: "Store",
        evidence: "/caja",
      },
      {
        id: "ventas",
        name: "Ventas",
        description: "Registro de ventas, documentos, anulaciones y detalle comercial.",
        benefit: "Operacion comercial visible para el equipo administrativo.",
        icon: "Receipt",
        evidence: "/ventas",
      },
      {
        id: "inventario",
        name: "Inventario",
        description: "Productos, stock, alertas, importacion y movimientos.",
        benefit: "Reduce quiebres de stock y errores de conteo.",
        icon: "Package",
        evidence: "/inventario",
      },
      {
        id: "compras",
        name: "Compras",
        description: "Registro de compras vinculadas a proveedores e inventario.",
        benefit: "Reposicion con costo y deuda conectados.",
        icon: "Truck",
        evidence: "/compras",
      },
      {
        id: "sucursales",
        name: "Sucursales",
        description: "Administracion de tiendas, alcance de usuarios y operacion por sede.",
        benefit: "Crecimiento ordenado sin perder control.",
        icon: "Building2",
        evidence: "/configuracion/sucursales",
      },
    ],
  },
  {
    id: "finanzas",
    name: "Finanzas",
    summary: "Documentos, cuentas y reportes que nacen desde los movimientos reales.",
    modules: [
      {
        id: "facturas",
        name: "Facturas",
        description: "Documentos emitidos, vista de detalle e impresion por lote.",
        benefit: "Menos trabajo manual para respaldar ventas.",
        icon: "FileText",
        evidence: "/facturas",
      },
      {
        id: "facturacion-fiscal",
        name: "Facturacion fiscal",
        description: "Tipos de documento, secuencias, autorizacion y numeracion.",
        benefit: "Documentos consistentes por pais y sucursal.",
        icon: "ClipboardCheck",
        evidence: "/configuracion/facturacion",
      },
      {
        id: "cxc",
        name: "Cuentas por cobrar",
        description: "Saldos, abonos y seguimiento de clientes pendientes.",
        benefit: "Mayor claridad sobre dinero por recuperar.",
        icon: "HandCoins",
        evidence: "/cxc",
      },
      {
        id: "cxp",
        name: "Cuentas por pagar",
        description: "Pagos a proveedores, vencimientos y detalle de deuda.",
        benefit: "Compras y obligaciones bajo control.",
        icon: "Banknote",
        evidence: "/cxp",
      },
      {
        id: "contabilidad",
        name: "Contabilidad",
        description: "Motor contable, catalogo de cuentas y estados financieros.",
        benefit: "Menos redigitacion entre operacion y libros.",
        icon: "BookOpen",
        evidence: "/contabilidad",
      },
      {
        id: "libro-diario",
        name: "Libro diario",
        description: "Asientos contables por periodo y origen del movimiento.",
        benefit: "Trazabilidad contable desde cada evento.",
        icon: "Landmark",
        evidence: "/contabilidad/libro-diario",
      },
      {
        id: "tesoreria",
        name: "Tesoreria",
        description: "Cuentas financieras, gastos, movimientos y gastos recurrentes.",
        benefit: "Flujo de dinero centralizado.",
        icon: "Wallet",
        evidence: "/tesoreria",
      },
      {
        id: "reportes-financieros",
        name: "Reportes financieros",
        description: "Ventas, inventario, rentabilidad y reportes contables.",
        benefit: "Decisiones con informacion conectada.",
        icon: "BarChart3",
        evidence: "/reportes",
      },
    ],
  },
  {
    id: "relaciones",
    name: "Relaciones comerciales",
    summary: "Clientes, proveedores y documentos comerciales en el mismo contexto.",
    modules: [
      {
        id: "clientes",
        name: "Clientes",
        description: "Registro de clientes, datos fiscales y relacion con ventas.",
        benefit: "Historial comercial mas facil de consultar.",
        icon: "Users",
        evidence: "/clientes",
      },
      {
        id: "proveedores",
        name: "Proveedores",
        description: "Datos de proveedor, contacto, credito y compras relacionadas.",
        benefit: "Abastecimiento con informacion ordenada.",
        icon: "Truck",
        evidence: "/compras/proveedores",
      },
      {
        id: "cotizaciones",
        name: "Cotizaciones",
        description: "Estructura de cotizaciones y conversion hacia venta.",
        benefit: "Documentacion comercial lista para crecer.",
        icon: "FileText",
        evidence: "schema:cotizaciones",
      },
    ],
  },
  {
    id: "equipo",
    name: "Equipo",
    summary: "Personas, permisos y procesos internos con limites claros.",
    modules: [
      {
        id: "rrhh",
        name: "Recursos humanos",
        description: "Panel de RR. HH. para gestionar informacion laboral.",
        benefit: "Administracion del equipo sin hojas separadas.",
        icon: "Users",
        evidence: "/rrhh",
      },
      {
        id: "empleados",
        name: "Empleados",
        description: "Expedientes, estados, detalles y alta de colaboradores.",
        benefit: "Datos del personal en un solo lugar.",
        icon: "UserRound",
        evidence: "/rrhh/empleados",
      },
      {
        id: "asistencia",
        name: "Asistencia",
        description: "Tablero e historial de asistencia del equipo.",
        benefit: "Registro operativo para nomina y control.",
        icon: "CalendarCheck",
        evidence: "/rrhh/asistencia",
      },
      {
        id: "nomina",
        name: "Nomina",
        description: "Generacion, trazabilidad y detalle de pagos.",
        benefit: "Pagos mas claros y auditables.",
        icon: "Wallet",
        evidence: "/rrhh/nomina",
      },
      {
        id: "usuarios",
        name: "Usuarios",
        description: "Creacion y administracion de accesos del equipo.",
        benefit: "Cada persona entra con su propio alcance.",
        icon: "UserRound",
        evidence: "/configuracion/usuarios",
      },
      {
        id: "roles-permisos",
        name: "Roles y permisos",
        description: "Permisos granulares y roles base para operar con seguridad.",
        benefit: "Control sin compartir claves ni accesos amplios.",
        icon: "ShieldCheck",
        evidence: "/configuracion/roles",
      },
      {
        id: "configuracion",
        name: "Configuracion empresarial",
        description: "Empresa, impuestos, formas de pago, dispositivos y cuentas.",
        benefit: "La plataforma se adapta a la operacion real.",
        icon: "Settings",
        evidence: "/configuracion",
      },
    ],
  },
  {
    id: "restaurante",
    name: "Restaurante",
    summary: "Capacidades especificas cuando el negocio opera mesas, menus o cocina.",
    modules: [
      {
        id: "menu-virtual",
        name: "Menu virtual",
        description: "Menu publico, QR por mesa y administracion de cartas.",
        benefit: "Pedidos mas claros para negocios de comida.",
        icon: "ChefHat",
        evidence: "/menu-virtual",
      },
      {
        id: "pedidos-cocina",
        name: "Pedidos cocina",
        description: "Vista de preparacion para coordinar pedidos internos.",
        benefit: "Menos friccion entre caja y cocina.",
        icon: "ClipboardCheck",
        evidence: "/pedidos-cocina",
      },
    ],
  },
];

export const ARCA_MODULES = ARCA_MODULE_CATEGORIES.flatMap((category) => category.modules);

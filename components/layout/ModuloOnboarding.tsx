"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { marcarOnboardingModuloVisto } from "@/lib/actions/onboarding-modulos";
import { moduloDesdeRuta, type ModuloAcceso } from "@/lib/access-control";

type Tutorial = {
  titulo: string;
  descripcion: string;
  pasos: string[];
};

type Props = {
  habilitado: boolean;
  modulosVistos: string[];
};

const TUTORIALES: Partial<Record<ModuloAcceso, Tutorial>> = {
  dashboard: {
    titulo: "Dashboard",
    descripcion: "Resumen rápido del negocio.",
    pasos: [
      "Revisa ventas del día, ventas del mes, productos activos y cuentas por cobrar.",
      "Usa las tarjetas para detectar si el negocio está moviéndose como esperas.",
      "Mira la actividad reciente para abrir ventas o documentos sin buscar en menús.",
      "Exporta todo el negocio a Excel cuando necesites respaldar o revisar datos fuera de ARCA.",
      "Cambia de módulo desde el menú lateral o con el buscador superior.",
    ],
  },
  pos: {
    titulo: "POS",
    descripcion: "Punto de venta para cobrar rápido.",
    pasos: [
      "Busca o escanea productos para agregarlos al carrito.",
      "Ajusta cantidades, descuentos y cliente antes de cobrar.",
      "Elige la forma de pago y confirma la venta.",
      "ARCA actualiza inventario, caja, facturas y cuentas según corresponda.",
      "Imprime o consulta el comprobante desde ventas o facturación.",
    ],
  },
  caja: {
    titulo: "Caja",
    descripcion: "Turnos, aperturas y cierres.",
    pasos: [
      "Abre una sesión de caja con el monto inicial.",
      "Registra ventas y pagos durante el turno.",
      "Consulta movimientos para detectar diferencias antes del cierre.",
      "Haz arqueo con efectivo y medios de pago reales.",
      "Cierra la caja para dejar trazabilidad contable del turno.",
    ],
  },
  ventas: {
    titulo: "Ventas",
    descripcion: "Historial y control comercial.",
    pasos: [
      "Consulta ventas completadas, pendientes o anuladas.",
      "Abre una venta para revisar cliente, detalle, pagos y factura.",
      "Filtra por fecha, estado o búsqueda cuando el volumen crezca.",
      "Anula solo cuando corresponda, dejando auditoría.",
      "Exporta ventas a Excel para análisis o conciliación externa.",
    ],
  },
  inventario: {
    titulo: "Inventario",
    descripcion: "Productos, stock y catálogo.",
    pasos: [
      "Crea productos manualmente, por Excel, código de barras o con IA.",
      "Usa la IA con texto o audio para cargar uno o varios productos en una tanda.",
      "Revisa precio, costo, existencia inicial y stock mínimo antes de guardar.",
      "El stock se actualiza con compras, ventas, ajustes y movimientos.",
      "Exporta el inventario a Excel para respaldos, conteos o revisión de catálogo.",
    ],
  },
  clientes: {
    titulo: "Clientes",
    descripcion: "Datos comerciales y crédito.",
    pasos: [
      "Registra clientes con datos fiscales y contacto.",
      "Define límites y días de crédito cuando vendes a plazo.",
      "Consulta saldos y ventas desde el perfil del cliente.",
      "Mantén datos limpios para facturación y cobranza.",
      "Usa clientes en POS, ventas y cuentas por cobrar.",
    ],
  },
  compras: {
    titulo: "Compras",
    descripcion: "Entrada de productos y proveedores.",
    pasos: [
      "Registra compras por proveedor, fecha y sucursal.",
      "Agrega productos para actualizar costos y existencias.",
      "Marca si la compra es de contado o crédito.",
      "ARCA puede generar cuentas por pagar y movimientos de inventario.",
      "Consulta compras para comparar costos y preparar pagos.",
    ],
  },
  facturas: {
    titulo: "Facturas",
    descripcion: "Comprobantes y documentos.",
    pasos: [
      "Consulta facturas generadas por ventas.",
      "Separa facturas cobradas y facturas al crédito.",
      "Abre cada documento para ver cliente, detalle y total.",
      "Imprime o revisa comprobantes cuando el cliente lo pida.",
      "Exporta listas para conciliación o reportes externos.",
    ],
  },
  cxc: {
    titulo: "Cuentas por cobrar",
    descripcion: "Cobros pendientes de clientes.",
    pasos: [
      "Revisa facturas pendientes, parciales o vencidas.",
      "Filtra por cliente para priorizar seguimiento.",
      "Registra abonos cuando recibas pagos.",
      "ARCA actualiza saldos y estados automáticamente.",
      "Usa el módulo para mantener la cartera al día.",
    ],
  },
  cxp: {
    titulo: "Cuentas por pagar",
    descripcion: "Pagos pendientes a proveedores.",
    pasos: [
      "Revisa compras a crédito y vencimientos.",
      "Prioriza proveedores por saldo o fecha de pago.",
      "Registra pagos parciales o totales.",
      "ARCA actualiza saldos, tesorería y contabilidad.",
      "Exporta la lista para planificación de caja.",
    ],
  },
  contabilidad: {
    titulo: "Contabilidad",
    descripcion: "Libros, balances y períodos.",
    pasos: [
      "Consulta libro diario y partidas generadas por operaciones.",
      "Revisa mayor, balance de comprobación y estados financieros.",
      "Controla períodos contables abiertos o cerrados.",
      "Usa reportes para detectar descuadres antes de cerrar.",
      "Exporta libros cuando necesites revisión contable externa.",
    ],
  },
  tesoreria: {
    titulo: "Tesorería",
    descripcion: "Gastos y movimientos de dinero.",
    pasos: [
      "Registra gastos operativos con categoría, fecha y monto.",
      "Marca gastos recurrentes para que se repitan cada mes.",
      "Consulta egresos recientes y el historial completo.",
      "Las cuentas financieras se administran desde Configuración.",
      "ARCA conecta gastos con caja, contabilidad y reportes.",
    ],
  },
  rrhh: {
    titulo: "Recursos Humanos",
    descripcion: "Equipo, asistencia y nómina.",
    pasos: [
      "Crea empleados con cargo, salario y estado.",
      "Registra asistencia para calcular horas trabajadas.",
      "Configura ingresos, deducciones y feriados.",
      "Genera nómina y verifica montos antes de aprobar.",
      "Consulta solicitudes para permisos, vacaciones o ajustes.",
    ],
  },
  reportes: {
    titulo: "Reportes",
    descripcion: "Análisis para decidir.",
    pasos: [
      "Revisa ventas, inventario y métricas clave.",
      "Filtra por fechas o alcance de sucursal si aplica.",
      "Compara resultados para detectar tendencias.",
      "Exporta datos cuando necesites trabajarlos en Excel.",
      "Usa los reportes para decidir compras, cobros y ventas.",
    ],
  },
  "reportes-avanzados": {
    titulo: "Reportes avanzados",
    descripcion: "Rentabilidad y lectura profunda.",
    pasos: [
      "Consulta margen y rentabilidad por período.",
      "Compara ingresos contra costos para entender resultados.",
      "Revisa productos o líneas que empujan la utilidad.",
      "Usa filtros para separar sucursales o rangos.",
      "Exporta el análisis para reuniones o cierres.",
    ],
  },
  soporte: {
    titulo: "Soporte",
    descripcion: "Ayuda dentro de ARCA.",
    pasos: [
      "Describe el problema o duda con contexto.",
      "Incluye módulo, pantalla y acción que estabas haciendo.",
      "Revisa la respuesta sugerida antes de aplicar cambios.",
      "Usa soporte para resolver bloqueos operativos.",
      "Vuelve al módulo original cuando tengas la respuesta.",
    ],
  },
  configuracion: {
    titulo: "Configuración",
    descripcion: "Ajustes base del negocio.",
    pasos: [
      "Configura empresa, sucursales, usuarios y roles.",
      "Administra cajas, impuestos y formas de pago.",
      "Crea cuentas financieras para pagos y cobros.",
      "Ajusta facturación fiscal y dispositivos cuando aplique.",
      "Revisa permisos antes de dar acceso a nuevos usuarios.",
    ],
  },
  "mi-cuenta": {
    titulo: "Mi cuenta",
    descripcion: "Perfil y acceso personal.",
    pasos: [
      "Revisa tu nombre, correo y datos de contacto.",
      "Actualiza tu contraseña si el acceso fue temporal.",
      "Consulta el estado de tu plan o cuenta.",
      "Cierra sesión cuando uses un equipo compartido.",
      "Pide a un administrador cambios de rol o permisos.",
    ],
  },
  "restaurante-dashboard": {
    titulo: "Dashboard restaurante",
    descripcion: "Operación del turno.",
    pasos: [
      "Revisa ventas, órdenes, ticket promedio y food cost.",
      "Abre POS o KDS desde los accesos rápidos.",
      "Consulta alertas de insumos y vencimientos.",
      "Entra a cada área: salón, cocina, compras, finanzas o personal.",
      "Usa este panel como punto de partida de cada turno.",
    ],
  },
  "restaurante-pos": {
    titulo: "POS restaurante",
    descripcion: "Órdenes de salón, barra y delivery.",
    pasos: [
      "Elige mesa, canal o pedido para llevar.",
      "Agrega platillos, cantidades y notas de cocina.",
      "Envía comandas al KDS cuando la orden esté lista.",
      "Solicita cuenta y cobra cuando el cliente cierre.",
      "ARCA conecta venta, caja, inventario y factura.",
    ],
  },
  "restaurante-mesas": {
    titulo: "Mesas",
    descripcion: "Mapa del salón.",
    pasos: [
      "Revisa disponibilidad, ocupación y mesas por limpiar.",
      "Crea áreas y mesas con capacidad.",
      "Cambia estados según avanza el servicio.",
      "Abre órdenes desde una mesa cuando corresponda.",
      "Mantén el salón ordenado para el equipo de turno.",
    ],
  },
  "restaurante-ordenes": {
    titulo: "Órdenes",
    descripcion: "Seguimiento de cuentas abiertas.",
    pasos: [
      "Consulta órdenes abiertas, en cocina o con cuenta solicitada.",
      "Revisa items, notas y estado de preparación.",
      "Envía nuevos items a cocina sin duplicar lo anterior.",
      "Cobra o cierra la cuenta cuando termine el servicio.",
      "Usa el historial para resolver dudas del turno.",
    ],
  },
  "restaurante-kds": {
    titulo: "KDS",
    descripcion: "Pantalla de cocina.",
    pasos: [
      "Filtra comandas por estación o prioridad.",
      "Marca items como recibidos, preparando o listos.",
      "Lee notas de cocina antes de preparar.",
      "Mantén la pantalla actualizada para salón.",
      "Los tiempos alimentan métricas operativas.",
    ],
  },
  "restaurante-menu": {
    titulo: "Carta QR",
    descripcion: "Menú público y platillos.",
    pasos: [
      "Crea secciones y platillos visibles para clientes.",
      "Define precios, descripciones e imágenes cuando aplique.",
      "Conecta platillos a productos del inventario.",
      "Publica QR por mesa o menú general.",
      "Controla disponibilidad desde el catálogo.",
    ],
  },
  "restaurante-recetas": {
    titulo: "Recetas",
    descripcion: "Costos y preparación.",
    pasos: [
      "Clasifica productos como insumos, platillos o preparaciones.",
      "Agrega ingredientes con cantidades y unidades.",
      "Calcula costo estimado y margen.",
      "Conecta recetas con la carta y el POS.",
      "Usa recetas para controlar consumo de inventario.",
    ],
  },
  "restaurante-inventario": {
    titulo: "Insumos",
    descripcion: "Inventario de cocina.",
    pasos: [
      "Consulta stock operativo de insumos clasificados.",
      "Revisa mínimos, costos y vencimientos.",
      "Registra mermas cuando haya caducidad, preparación o accidentes.",
      "Usa existencias, movimientos, conteos y transferencias para control fino.",
      "Estos insumos pertenecen a Restaurante, no al inventario general de ARCA Negocios.",
    ],
  },
  "restaurante-mermas": {
    titulo: "Mermas",
    descripcion: "Pérdidas y ajustes de cocina.",
    pasos: [
      "Registra producto, cantidad, unidad y motivo.",
      "Agrega observación cuando necesites contexto.",
      "ARCA genera el movimiento de inventario.",
      "Revisa mermas por fecha para detectar patrones.",
      "Usa el dato para ajustar compras y preparación.",
    ],
  },
  "restaurante-reservaciones": {
    titulo: "Reservaciones",
    descripcion: "Agenda de clientes.",
    pasos: [
      "Registra cliente, fecha, hora y cantidad de personas.",
      "Consulta próximas reservas antes del turno.",
      "Actualiza estados como confirmada, sentada o cancelada.",
      "Usa notas para ocasiones especiales.",
      "Conecta recepción con salón para preparar mesas.",
    ],
  },
  "restaurante-comensales": {
    titulo: "Comensales",
    descripcion: "CRM del restaurante.",
    pasos: [
      "Guarda datos y preferencias de clientes frecuentes.",
      "Consulta visitas e historial.",
      "Usa preferencias para mejorar atención.",
      "Apoya reservas, promociones y seguimiento.",
      "Mantén la información mínima y útil para el servicio.",
    ],
  },
  "restaurante-reportes": {
    titulo: "Reportes restaurante",
    descripcion: "Indicadores de operación.",
    pasos: [
      "Revisa ventas, ranking y margen.",
      "Controla food cost y desempeño de platillos.",
      "Compara períodos para decisiones de menú.",
      "Usa métricas de cocina y salón para mejorar turnos.",
      "Exporta información cuando necesites análisis externo.",
    ],
  },
  "restaurante-promociones": {
    titulo: "Promociones",
    descripcion: "Ofertas del restaurante.",
    pasos: [
      "Crea promociones por horario, día o producto.",
      "Define descuentos o precios especiales.",
      "Activa solo lo que el equipo debe ofrecer.",
      "Mide resultados desde reportes.",
      "Ajusta promociones según margen y demanda.",
    ],
  },
  "restaurante-soporte": {
    titulo: "Soporte restaurante",
    descripcion: "Ayuda enfocada en operación.",
    pasos: [
      "Pregunta sobre salón, cocina, QR, reservas o inventario.",
      "Incluye mesa, orden o módulo si aplica.",
      "Usa la respuesta para resolver bloqueos del turno.",
      "Vuelve al módulo original cuando termines.",
      "Escala el caso si requiere revisión técnica.",
    ],
  },
  "restaurante-configuracion": {
    titulo: "Configuración restaurante",
    descripcion: "Ajustes de la vertical.",
    pasos: [
      "Configura empresa, áreas, dispositivos y permisos.",
      "Revisa datos fiscales y formas de operación.",
      "Administra elementos sensibles con usuarios autorizados.",
      "Mantén el entorno listo antes de abrir turnos.",
      "Usa auditoría para revisar cambios importantes.",
    ],
  },
  "restaurante-plan": {
    titulo: "Plan restaurante",
    descripcion: "Suscripción y límites.",
    pasos: [
      "Consulta el plan activo y estado de suscripción.",
      "Revisa límites de usuarios, productos o funciones.",
      "Actualiza el plan cuando el negocio crezca.",
      "Atiende pagos pendientes para evitar bloqueos.",
      "Vuelve a operación cuando el estado esté correcto.",
    ],
  },
};

function obtenerTutorial(modulo: ModuloAcceso): Tutorial {
  return (
    TUTORIALES[modulo] ?? {
      titulo: "Módulo",
      descripcion: "Vista de trabajo en ARCA.",
      pasos: [
        "Revisa el encabezado para entender el objetivo de la pantalla.",
        "Usa los filtros o acciones principales para trabajar con datos.",
        "Abre registros individuales cuando necesites detalle.",
        "Guarda cambios solo después de revisar la información.",
        "Vuelve al menú lateral para moverte a otro módulo.",
      ],
    }
  );
}

export function ModuloOnboarding({ habilitado, modulosVistos }: Props) {
  const pathname = usePathname();
  const [vistos, setVistos] = useState<string[]>(modulosVistos);
  const [moduloAbierto, setModuloAbierto] = useState<ModuloAcceso | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setVistos(modulosVistos);
  }, [modulosVistos]);

  const moduloActual = useMemo(() => moduloDesdeRuta(pathname), [pathname]);
  const vistosSet = useMemo(() => new Set(vistos), [vistos]);
  const tutorial = moduloAbierto ? obtenerTutorial(moduloAbierto) : null;

  useEffect(() => {
    if (!habilitado || !moduloActual || vistosSet.has(moduloActual)) return;
    setModuloAbierto(moduloActual);
  }, [habilitado, moduloActual, vistosSet]);

  function cerrar() {
    if (!moduloAbierto) return;
    const modulo = moduloAbierto;
    setVistos((prev) => (prev.includes(modulo) ? prev : [...prev, modulo]));
    setModuloAbierto(null);
    startTransition(async () => {
      await marcarOnboardingModuloVisto(modulo);
    });
  }

  if (!habilitado || !tutorial) return null;

  return (
    <Modal
      abierto={Boolean(moduloAbierto)}
      onCerrar={cerrar}
      titulo={tutorial.titulo}
      descripcion={tutorial.descripcion}
      ancho="lg"
      footer={
        <Button onClick={cerrar}>
          <CheckCircle2 size={14} /> Entendido
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-[color:var(--color-primary)]/25 bg-[color:var(--color-primary)]/10 p-3 text-small">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-[color:var(--color-primary)]" />
          <p className="text-[color:var(--color-text-secondary)]">
            Tutorial rápido de 5 pasos. Solo aparecerá una vez para este módulo.
          </p>
        </div>
        <ol className="space-y-2">
          {tutorial.pasos.map((paso, index) => (
            <li
              key={paso}
              className="flex gap-3 rounded-md border border-[color:var(--color-border)] p-3 text-small"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[color:var(--color-primary)] text-[12px] font-semibold text-white">
                {index + 1}
              </span>
              <span className="pt-0.5 text-[color:var(--color-text-secondary)]">
                {paso}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}

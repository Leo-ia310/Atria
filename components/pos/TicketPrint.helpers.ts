import type { PaisCodigo } from "@/lib/paises";

type ItemTicket = {
  nombre: string;
  sku: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
};

type PagoTicket = {
  formaPago: string;
  monto: number;
  referencia: string | null;
};

export type TicketData = {
  pais: PaisCodigo;
  empresa: {
    nombre: string;
    idFiscalNombre: string;
    identificacionFiscal: string;
    direccion: string | null;
    telefono: string | null;
  };
  numero: string;
  fecha: string;
  zonaHoraria?: string | null;
  cajero: string | null;
  cliente: string;
  esCredito: boolean;
  items: ItemTicket[];
  pagos: PagoTicket[];
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  impuestoNombre: string;
  autoPrint?: boolean;
  copies?: 1 | 2;
};

export function imprimirRecibo(modo?: "simple" | "lote" | unknown) {
  const clase = modo === "lote" ? "imprimiendo-recibos-lote" : "imprimiendo-recibo";
  document.body.classList.add(clase);
  const cleanup = () => {
    document.body.classList.remove(clase);
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

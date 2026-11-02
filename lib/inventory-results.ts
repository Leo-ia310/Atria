import type {PropuestaProducto} from "./validations/inventario-ia";
export type Resultado =
  | { ok: true; id: string }
  | { ok: false; error: string };
export type ResultadoSimple = { ok: true } | { ok: false; error: string };
export type ResultadoImportacion =
  | {
      ok: true;
      creados: number;
      actualizados: number;
      advertencias: number;
      stockAjustado: number;
      mensajes: string[];
    }
  | { ok: false; error: string };
export type ResultadoEntradaLector =
  | { ok: true; productoId: string; existencia: number }
  | { ok: false; error: string };
export type ResultadoCompraRapidaLector =
  | { ok: true; productoId: string; compraId: string; existencia: number }
  | { ok: false; error: string };

export type ResultadoPropuesta =
  | {
      ok: true;
      productos: PropuestaProducto[];
      preguntas: string[];
      nota: string;
      restantesDia: number | null;
    }
  | { ok: false; error: string; tipo?: "error" | "warning" };

export type FilaSupervisada = {
  fila: number;
  descartar: boolean;
  sku: string;
  codigoBarras: string;
  nombre: string;
  descripcion: string;
  precioBase: number;
  costoPromedio: number;
  stockMinimo: number;
  stockMaximo?: number;
  existenciaInicial: number;
  nota: string;
};

export type ResultadoSupervision =
  | { ok: true; filas: FilaSupervisada[]; restantesDia: number | null }
  | { ok: false; error: string; tipo?: "error" | "warning" };

export type ResultadoCrear =
  | { ok: true; id: string; nombre: string; sku: string; existencia: number }
  | { ok: false; error: string };

export type ProductoCreado = {
  id: string;
  nombre: string;
  sku: string;
  existencia: number;
};

export type ResultadoCrearMultiple =
  | {
      ok: true;
      productos: ProductoCreado[];
      creados: number;
      existenciaTotal: number;
    }
  | { ok: false; error: string };

export type ResultadoTransaccionCrear =
  | { productos: ProductoCreado[] }
  | { error: string };


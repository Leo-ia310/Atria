import "server-only";
import { construirLibro as construirBytes, construirLibroMultiHoja as construirMultiBytes, type OpcionesLibro, type HojaExport } from "./workbook";
export type { TipoColumna, ColumnaExcel, EmpresaExcel, OpcionesLibro, HojaExport } from "./workbook";
export async function construirLibro(opts:OpcionesLibro):Promise<Buffer>{return Buffer.from(await construirBytes(opts));}
export async function construirLibroMultiHoja(hojas:HojaExport[]):Promise<Buffer>{return Buffer.from(await construirMultiBytes(hojas));}
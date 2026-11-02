import { fechaISOEnZona, sumarDiasISO } from "../dates";

/** Pure report rules shared by Cloud pages and the native SQLite adapter. */
export function rangoReporte(dias=30,zona="America/Managua",ahora=new Date()) {
  const hasta=fechaISOEnZona(ahora,zona);
  return {desde:sumarDiasISO(hasta,-dias),hasta};
}
export function inicioDoceMeses(hoy:string):string {
  const [year,month]=hoy.split("-").map(Number);
  return new Date(Date.UTC(year,month-12,1,12)).toISOString().slice(0,10);
}
export function margenReporte(ingresos:number,costos:number) {
  const margen=ingresos-costos;
  return {margen,porcentaje:ingresos>0?margen/ingresos*100:0};
}
export type InventarioReporte = {productoId:string;nombre:string;sku:string;stockTotal:number;stockMinimo:number;stockMinimoConocido:boolean;costoPromedio:number;valorTotal:number};
export function procesarInventarioReporte(rows:Array<{productoId:string;nombre:string;sku:string;stockTotal:string|number;stockMinimo:string|number|null;costoPromedio:string|number}>):InventarioReporte[] {
  return rows.map((row)=>({...row,stockTotal:Number(row.stockTotal),stockMinimo:Number(row.stockMinimo??0),stockMinimoConocido:row.stockMinimo!==null,costoPromedio:Number(row.costoPromedio),valorTotal:Number(row.stockTotal)*Number(row.costoPromedio)}))
    .sort((a,b)=>b.valorTotal-a.valorTotal||a.sku.localeCompare(b.sku));
}
export type RentabilidadReporte={periodo:string;mes:string;ingresos:number;costos:number;margen:number;cantVentas:number};
const MESES=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
export function procesarRentabilidadReporte(rows:Array<{periodo:string;ingresos:string|number;costos:string|number;cantVentas:string|number}>):RentabilidadReporte[] {
  return rows.map((row)=>({periodo:row.periodo,mes:`${MESES[Number(row.periodo.slice(5,7))-1]} ${row.periodo.slice(0,4)}`,ingresos:Number(row.ingresos),costos:Number(row.costos),margen:Number(row.ingresos)-Number(row.costos),cantVentas:Number(row.cantVentas)}));
}

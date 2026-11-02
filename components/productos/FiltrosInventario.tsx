"use client";
import {useState} from "react";
export type InventoryRanges={priceMin:string;priceMax:string;stockMin:string;stockMax:string};
export const emptyInventoryRanges:InventoryRanges={priceMin:"",priceMax:"",stockMin:"",stockMax:""};
export function matchesInventoryRanges(price:number,stock:number,r:InventoryRanges){return (r.priceMin===""||price>=Number(r.priceMin))&&(r.priceMax===""||price<=Number(r.priceMax))&&(r.stockMin===""||stock>=Number(r.stockMin))&&(r.stockMax===""||stock<=Number(r.stockMax));}
export function FiltrosInventario({value,onChange}:{value:InventoryRanges;onChange:(next:InventoryRanges)=>void}){
 const [open,setOpen]=useState(false);
 return <div><button type="button" className="arca-btn arca-btn-secondary" aria-expanded={open} onClick={()=>setOpen(!open)}>Filtros {Object.values(value).some(v=>v!=="")?"· activos":""}</button>{open&&<div className="my-3 flex flex-wrap items-end gap-3 rounded-md border border-[color:var(--color-border)] p-3">{([["priceMin","Precio mínimo"],["priceMax","Precio máximo"],["stockMin","Stock mínimo"],["stockMax","Stock máximo"]] as const).map(([key,label])=><label key={key} className="text-small">{label}<input aria-label={label} className="arca-input mt-1 w-36" type="number" step="any" value={value[key]} onChange={e=>onChange({...value,[key]:e.target.value})}/></label>)}<button type="button" className="arca-btn arca-btn-secondary" onClick={()=>onChange({...emptyInventoryRanges,priceMin:"0",priceMax:"0"})}>Precio cero</button><button type="button" className="arca-btn arca-btn-secondary" onClick={()=>onChange(emptyInventoryRanges)}>Limpiar filtros</button></div>}</div>;
}

"use client";
export function CashSessionChoice({sessions,onPick}:{sessions:Array<{id:string;nombre:string}>;onPick:(id:string)=>void}){
 return <div className="grid gap-3" role="group" aria-label="Turnos de caja disponibles">{sessions.map(row=><button key={row.id} type="button" className="arca-btn arca-btn-secondary w-full" onClick={()=>onPick(row.id)}>Usar {row.nombre}</button>)}</div>;
}

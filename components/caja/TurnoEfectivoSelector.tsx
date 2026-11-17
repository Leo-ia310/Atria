"use client";
import {useEffect,useState} from "react";
import {turnosCajaDisponibles} from "../../lib/actions/caja-integrity";
export function TurnoEfectivoSelector({value,onChange}:{value:string;onChange:(id:string)=>void}){
  const [rows,setRows]=useState<Array<{id:string;nombre:string}>>([]);
  const [error,setError]=useState("");
  useEffect(()=>{let active=true;void turnosCajaDisponibles().then(result=>{
    if(active){if(result.ok)setRows(result.turnos);else setError(result.error);}
  }).catch(()=>{if(active)setError("No se pudieron consultar los turnos.");});return()=>{active=false;};},[]);
  return <label className="block text-small">Turno para el efectivo
    <select className="arca-input" value={value} onChange={e=>onChange(e.target.value)}><option value="">Sin vínculo con un turno</option>{rows.map(row=><option key={row.id} value={row.id}>{row.nombre}</option>)}</select>
    <span className="text-[11px]">Selecciona el turno si este cobro o pago entra o sale de su efectivo.</span>
    {error&&<span role="alert">{error}</span>}
  </label>;
}

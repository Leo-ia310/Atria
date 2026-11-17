"use client";
import { useRef, useState } from "react";
import { CASH_CLOSE_NOTICE } from "../../lib/cash-core";

type Row=Record<string,unknown>;
function entryDescription(row:Row):string{
  const detail=(row.detalle ?? (typeof row.detalle_json==="string"?JSON.parse(row.detalle_json):{})) as Record<string,unknown>;
  return [detail.motivo,detail.numero,typeof detail.declarado==="number"?`Contado ${detail.declarado} · Esperado ${detail.esperado??"cierre original"}`:"",typeof detail.esperadoLocal==="number"?`Esperado offline ${detail.esperadoLocal}`:""]
    .filter(Boolean).join(" · ");
}
export function CashLedgerPanel({sessionId,open,entries,reviews,onMove,onReview,pending=0}:{
  sessionId:string;open:boolean;entries:Row[];reviews:Row[];pending?:number;
  onMove:(input:{id:string;sesionId:string;tipo:"entrada"|"salida"|"retiro"|"devolucion";monto:number;motivo:string;ventaId?:string})=>Promise<void>;
  onReview:(id:string,resolucion:string)=>Promise<void>;
}){
  const key=useRef<string|null>(null);
  const [tipo,setTipo]=useState<"entrada"|"salida"|"retiro"|"devolucion">("retiro");
  const [amount,setAmount]=useState(""),[reason,setReason]=useState(""),[saleId,setSaleId]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const [resolutions,setResolutions]=useState<Record<string,string>>({});
  async function move(){
    setBusy(true);setError("");
    try{
      const monto=Number(amount.replace(",","."));
      if(!Number.isFinite(monto)||monto<=0||reason.trim().length<3)throw new Error("Ingresa un monto positivo y el motivo.");
      key.current??=crypto.randomUUID();
      await onMove({id:key.current,sesionId:sessionId,tipo,monto,motivo:reason.trim(),...(tipo==="devolucion"?{ventaId:saleId.trim()}:{})});
      key.current=null;setAmount("");setReason("");setSaleId("");
    }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  }
  return <section className="space-y-3 rounded border p-4">
    <h3 className="font-semibold">Movimientos y conciliación de caja</h3>
    <p className="text-small">{CASH_CLOSE_NOTICE}</p>
    {pending>0&&<p role="status">{pending} operaciones locales pendientes vinculadas al turno.</p>}
    {open&&<div className="space-y-2">
      <p className="text-small">Registra entradas y salidas físicas de efectivo con su soporte. Para gastos y pagos utiliza su formulario y selecciona el turno. Un reintegro de efectivo requiere el UUID de la venta y su soporte comercial.</p>
      <label>Movimiento<select className="arca-input" value={tipo} onChange={e=>setTipo(e.target.value as typeof tipo)}><option value="entrada">Entrada</option><option value="salida">Salida</option><option value="retiro">Retiro</option><option value="devolucion">Reintegro de efectivo</option></select></label>
      <label>Monto<input className="arca-input" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
      <label>Motivo y soporte<input className="arca-input" value={reason} onChange={e=>setReason(e.target.value)} maxLength={300}/></label>
      {tipo==="devolucion"&&<label>UUID de la venta<input className="arca-input" value={saleId} onChange={e=>setSaleId(e.target.value)}/></label>}
      <button type="button" className="arca-btn arca-btn-primary" disabled={busy} onClick={()=>void move()}>Registrar movimiento</button>
    </div>}
    {error&&<p role="alert">{error}</p>}
    <div className="overflow-auto"><table className="w-full text-small"><thead><tr><th>Movimiento</th><th>Efectivo</th><th>Usuario / equipo</th><th>Fecha registrada</th></tr></thead>
      <tbody>{entries.map(row=><tr key={String(row.id)}><td>{String(row.tipo)}<p>{entryDescription(row)}</p><div className="text-[11px]">{String(row.origen_id)}</div></td><td>{Number(row.monto).toFixed(2)}</td><td>{String(row.usuario_id)}<div className="text-[11px]">{String(row.device_id??"Web")}</div></td><td>{new Date(String(row.registrado_en)).toLocaleString("es-NI")}</td></tr>)}</tbody></table></div>
    {reviews.map(row=><div key={String(row.id)} className="rounded border p-3">
      <p>{String(row.motivo)}</p>
      {row.resuelta_en?<p>Revisada por {String(row.resuelta_por)}. {String(row.resolucion)}</p>:<>
        <label>Conclusión del supervisor<input className="arca-input" value={resolutions[String(row.id)]??""} onChange={e=>setResolutions({...resolutions,[String(row.id)]:e.target.value})}/></label>
        <button type="button" className="arca-btn arca-btn-secondary" disabled={busy} onClick={async()=>{
          setBusy(true);setError("");
          try{await onReview(String(row.id),resolutions[String(row.id)]??"");}
          catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
        }}>Registrar revisión</button>
      </>}
    </div>)}
  </section>;
}

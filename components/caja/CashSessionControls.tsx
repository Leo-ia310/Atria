"use client";
import {useRouter} from "next/navigation";
import {CashLedgerPanel} from "./CashLedgerPanel";
import {registrarMovimientoCaja,revisarIncidenciaCaja} from "../../lib/actions/caja-integrity";
export function CashSessionControls(props:Omit<Parameters<typeof CashLedgerPanel>[0],"onMove"|"onReview">){
  const router=useRouter();
  return <CashLedgerPanel {...props} onMove={async input=>{
    const result=await registrarMovimientoCaja(input);if(!result.ok)throw new Error(result.error);router.refresh();
  }} onReview={async(id,resolucion)=>{
    const result=await revisarIncidenciaCaja({id,resolucion});if(!result.ok)throw new Error(result.error);router.refresh();
  }}/>;
}

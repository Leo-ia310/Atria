/** Internal receipts remain pending until an actual provider is integrated. */
export function pendingFiscalDocument() {
  return { documentType: "internal_receipt" as const, fiscal_status: "pending_submission" as const, fiscal_provider_status: "not_configured" as const, official_fiscal_id: null };
}

export const INTERNAL_FISCAL_NOTICE = "Comprobante interno. Emisión fiscal pendiente; no se ha enviado a una autoridad fiscal. Sincronizar no equivale a obtener autorización fiscal.";

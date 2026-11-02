-- Pending is not accepted. No official ID is invented or sent by a device.
UPDATE facturas SET snapshot=snapshot || '{"fiscal_status":"pending_submission","fiscal_provider_status":"not_configured","official_fiscal_id":null}'::jsonb
WHERE snapshot->>'documentType'='internal_receipt' AND snapshot->>'fiscal_status' IS NULL;

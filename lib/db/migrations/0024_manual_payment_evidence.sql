-- Additive only: historical records retain unknown evidence, never fabricated approval.
ALTER TABLE pagos_venta ADD COLUMN IF NOT EXISTS payment_source text NOT NULL DEFAULT 'legacy';
--> statement-breakpoint
ALTER TABLE pagos_venta ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unverified';
--> statement-breakpoint
ALTER TABLE pagos_venta ADD COLUMN IF NOT EXISTS terminal_approved boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE pagos_venta ADD COLUMN IF NOT EXISTS terminal_independent boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE pagos_venta ADD COLUMN IF NOT EXISTS terminal_authorization text;

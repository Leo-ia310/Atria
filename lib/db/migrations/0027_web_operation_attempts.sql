CREATE TABLE IF NOT EXISTS web_operation_attempts (
  empresa_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  attempt_key uuid NOT NULL,
  request_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, user_id, kind, attempt_key)
);
--> statement-breakpoint
ALTER TABLE web_operation_attempts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE web_operation_attempts FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY web_operation_attempts_tenant_isolation ON web_operation_attempts
  USING (empresa_id = NULLIF(current_setting('app.empresa_id', true), '')::uuid)
  WITH CHECK (empresa_id = NULLIF(current_setting('app.empresa_id', true), '')::uuid);

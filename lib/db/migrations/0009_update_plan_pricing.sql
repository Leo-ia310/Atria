UPDATE "planes"
SET
  "precio_mensual" = '19.99',
  "precio_anual" = '203.90',
  "max_usuarios" = 7
WHERE "codigo" = 'pro';--> statement-breakpoint
UPDATE "planes"
SET
  "precio_mensual" = '89.99',
  "precio_anual" = '917.90'
WHERE "codigo" = 'enterprise';

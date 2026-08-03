UPDATE "planes"
SET
  "precio_mensual" = '39.00',
  "precio_anual" = '327.60',
  "max_usuarios" = 7
WHERE "codigo" = 'pro';--> statement-breakpoint
UPDATE "planes"
SET
  "precio_mensual" = '149.00',
  "precio_anual" = '1251.60'
WHERE "codigo" = 'enterprise';

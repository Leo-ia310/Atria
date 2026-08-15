UPDATE "planes"
SET
  "precio_mensual" = '20.00',
  "precio_anual" = '168.00',
  "max_usuarios" = 7
WHERE "codigo" = 'pro';--> statement-breakpoint
UPDATE "planes"
SET
  "precio_mensual" = '99.00',
  "precio_anual" = '831.60',
  "max_sucursales" = 5,
  "max_usuarios" = 20
WHERE "codigo" = 'enterprise';

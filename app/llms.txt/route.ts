import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

const contenido = `# ARCA

> ARCA es un SaaS multi-tenant de gestión comercial para pequeñas y medianas
> empresas de Latinoamérica. Reemplaza Excel, el cuaderno de fiado y los sistemas
> desconectados con una plataforma única que conecta el punto de venta, el
> inventario y la contabilidad en un solo motor: cada venta, compra, gasto o
> ajuste genera automáticamente su asiento contable de partida doble.

Pensado para negocios reales de Honduras, Nicaragua, Guatemala, Costa Rica,
El Salvador, Estados Unidos y México: ferreterías, farmacias, pulperías,
distribuidoras, tiendas de ropa y abarroterías. Todo en español, con formatos
y moneda por país.

## Producto

- [Inicio](${SITE_URL}/): Visión general de ARCA, módulos y beneficios.
- [Precios](${SITE_URL}/precios): Planes Demo, Pro y Enterprise con sus límites.

## Módulos principales

- Punto de venta (POS) rápido y con modo offline.
- Inventario vivo: existencias, lotes, vencimientos y multi-sucursal.
- Facturación fiscal por país.
- Contabilidad automática de partida doble.
- Reportes de ventas, rentabilidad, cuentas por cobrar y stock.

## Legal

- [Términos y Condiciones](${SITE_URL}/legal/terminos)
- [Privacidad](${SITE_URL}/legal/privacidad)
- [Cookies](${SITE_URL}/legal/cookies)
- [Tratamiento de Datos](${SITE_URL}/legal/tratamiento-datos)
- [Uso Aceptable](${SITE_URL}/legal/uso-aceptable)
- [Inteligencia Artificial](${SITE_URL}/legal/inteligencia-artificial)

## Contacto

- Sitio: ${SITE_URL}
- Soporte: soporte@arca.onl
`;

export function GET() {
  return new Response(contenido, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}

# Reporte de prueba de estres K6 - ARCA SaaS

Fecha de ejecucion: 2026-08-19  
Target probado: `http://localhost:3000`  
Modo de app: `next start` sobre build de produccion  
Herramienta: `k6 v1.7.1`  
Runtime: `node v22.15.1`, `Next.js 15.5.22`

## Resumen ejecutivo

El limite maximo sostenible medido para esta instancia local, con trafico mixto realista y rutas publicas con consultas a Supabase, es:

**3 iteraciones de usuario por segundo**  
Equivalente observado: **~5.5 HTTP requests/s completados** por la descarga parcial de assets y llamadas auxiliares.

Ese nivel fue el ultimo que mantuvo:

- 0% fallos HTTP.
- 100% checks K6 correctos.
- 0 iteraciones descartadas.
- p95 global cercano a 3 s.

El sistema empieza a perder estabilidad desde **4 iteraciones/s**: no hubo errores HTTP todavia, pero ya aparecieron iteraciones descartadas y el p95 subio a **12.8 s**. En **6 iteraciones/s** ya hubo timeouts de 30 s en menus publicos y 5.75% de fallos HTTP.

Concluson operativa: **no recomiendo operar por encima de 3 iteraciones/s con este mix hasta cachear u optimizar los menus publicos.**

## Alcance

La prueba fue agresiva pero no destructiva. Se excluyeron rutas que escriben datos o ejecutan procesos administrativos:

- No se golpeo `/api/sync`, porque escribe en `desktop_sync_inbox`.
- No se ejecutaron cron jobs reales.
- No se hicieron registros masivos ni logins validos.

La mezcla K6 incluyo:

- Landing publica `/`
- Precios `/precios`
- Login `/login`
- Registro `/registro`
- Legal `/legal/privacidad`
- Menus publicos reales: `/tiptop`, `/nicaris-carta-principal`, `/nicaris-desayunos-cafe`, `/nicaris-bebidas-postres`
- Auth CSRF `/api/auth/csrf`
- Redirect protegido `/dashboard`
- 8% de sesiones con descarga de assets `_next/static` para simular usuarios nuevos

Script usado: `tests/k6/arca-stress.js`

## Criterio de limite

Tome como sostenible el mayor nivel que cumple simultaneamente:

- `http_req_failed = 0%`
- `checks_ok = 100%`
- `dropped_iterations = 0`
- sin iteraciones interrumpidas inferidas
- p95 global alrededor de 3 s o menos

## Resultado fino: 3 a 6 iteraciones/s

| Fase | Iter/s objetivo | Iteraciones programadas | Requests principales completados | Drops | Interrumpidas inferidas | Fallos HTTP | Checks OK | p95 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `rps_3` | 3 | 135 | 136 | 0 | 0 | 0.00% | 100.00% | 2.96 s |
| `rps_4` | 4 | 180 | 170 | 6 | 4 | 0.00% | 100.00% | 12.78 s |
| `rps_5` | 5 | 225 | 201 | 11 | 13 | 0.00% | 100.00% | 14.64 s |
| `rps_6` | 6 | 270 | 185 | 45 | 40 | 5.75% | 90.27% | 30.00 s |

Fuente: `tests/k6/results/fine2-analysis.json`

## Resultado de estres alto: 3 a 40 iteraciones/s

| Fase | Iter/s objetivo | Requests principales completados | Drops | Fallos HTTP | Checks OK | p95 |
|---|---:|---:|---:|---:|---:|---:|
| `rps_3` | 3 | 136 | 0 | 0.00% | 100.00% | 2.37 s |
| `rps_5` | 5 | 211 | 8 | 0.00% | 100.00% | 12.14 s |
| `rps_8` | 8 | 260 | 53 | 4.04% | 94.03% | 26.62 s |
| `rps_10` | 10 | 222 | 176 | 28.06% | 64.86% | 30.00 s |
| `rps_20` | 20 | 290 | 532 | 20.73% | 72.41% | 30.00 s |
| `rps_40` | 40 | 455 | 1226 | 19.77% | 73.63% | 30.00 s |

Fuente: `tests/k6/results/capacity-analysis.json`

## Cuello de botella

El cuello de botella principal son los menus publicos renderizados por servidor en `app/[slug]/page.tsx`.

Evidencia:

- A 3 iter/s, las rutas estaticas y auth livianas respondieron generalmente en decenas de ms.
- A 3 iter/s, los menus ya tuvieron p95 entre ~3.0 s y ~5.1 s.
- A 4 iter/s, los menus subieron a p95 de ~9.6 s a ~14.3 s.
- A 6 iter/s, varios menus empezaron a agotar el timeout de 30 s.
- Despues del tramo alto, Next registro `CONNECT_TIMEOUT` contra `aws-1-us-west-2.pooler.supabase.com:6543`, indicando saturacion o agotamiento temporal del pooler/conectividad hacia Supabase.

Las rutas no dependientes de esas consultas siguieron respondiendo bien incluso durante fases mas altas. Por eso el limite real de la SaaS, para este flujo, lo define el render SSR de menus con DB, no el servidor Next sirviendo paginas estaticas.

## Limite maximo recomendado

| Tipo de limite | Valor |
|---|---:|
| Maximo sostenible medido | 3 iteraciones/s |
| HTTP throughput equivalente observado | ~5.5 req/s |
| Primer nivel con cola/drops | 4 iteraciones/s |
| Primer nivel con fallos HTTP/timeouts | 6 iteraciones/s |
| Zona de colapso fuerte | 8+ iteraciones/s |

En usuarios reales, una "iteracion" representa una accion/navegacion de usuario en el mix probado. No equivale a usuarios conectados totales, porque cada usuario humano tendria pausas mas largas entre acciones.

## Recomendaciones para subir el limite

1. Cachear la data de menus publicos por slug durante 30-60 s como minimo.
2. Evitar recalcular stock con agregaciones en cada request de menu; usar snapshot o materializacion de disponibilidad.
3. Revisar indices con `EXPLAIN ANALYZE` para `menus_virtuales.slug`, `menu_secciones.menu_id`, `menu_platillos.menu_id`, `menu_promociones.menu_id`, `existencias.producto_id` y filtros por `empresa_id`.
4. Separar assets estaticos/CDN de la medicion backend cuando se mida en produccion real.
5. Repetir esta prueba contra un entorno staging en Vercel con una base Supabase staging para comparar contra la infraestructura real.
6. Agregar un test autenticado con usuario seed de staging para medir dashboard/POS/inventario sin tocar datos reales.

## Artefactos generados

- `tests/k6/arca-stress.js`
- `scripts/analyze-k6-results.mjs`
- `tests/k6/results/capacity-summary.json`
- `tests/k6/results/capacity-analysis.json`
- `tests/k6/results/fine2-summary.json`
- `tests/k6/results/fine2-analysis.json`


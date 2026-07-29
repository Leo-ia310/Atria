"use client";

import dynamic from "next/dynamic";

const GraficaVentas = dynamic(
  () =>
    import("@/components/reportes/GraficaVentas").then(
      (modulo) => modulo.GraficaVentas,
    ),
  {
    ssr: false,
    loading: () => <GraficaSkeleton altura="h-64" />,
  },
);

const GraficaInventario = dynamic(
  () =>
    import("@/components/reportes/GraficaInventario").then(
      (modulo) => modulo.GraficaInventario,
    ),
  {
    ssr: false,
    loading: () => <GraficaSkeleton altura="h-96" />,
  },
);

const GraficaRentabilidad = dynamic(
  () =>
    import("@/components/reportes/GraficaRentabilidad").then(
      (modulo) => modulo.GraficaRentabilidad,
    ),
  {
    ssr: false,
    loading: () => <GraficaSkeleton altura="h-72" />,
  },
);

export {
  GraficaVentas as GraficaVentasDinamica,
  GraficaInventario as GraficaInventarioDinamica,
  GraficaRentabilidad as GraficaRentabilidadDinamica,
};

function GraficaSkeleton({ altura }: { altura: string }) {
  return (
    <div
      className={`${altura} w-full animate-pulse rounded-md bg-[color:var(--color-surface-2)]`}
      aria-label="Cargando gráfica"
    />
  );
}

type ArcaLogoProps = {
  className?: string;
  eager?: boolean;
};

/**
 * Isotipo de ARCA (monograma en badge). SVG inline: se ve nítido en cualquier
 * tamaño y sobre fondo claro u oscuro. El tamaño se controla con la altura del
 * className (p.ej. h-8 w-auto).
 */
export function ArcaLogo({ className }: ArcaLogoProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="ARCA"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="arcaLogoGrad"
          x1="0"
          y1="0"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="url(#arcaLogoGrad)" />
      <text
        x="20"
        y="21"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="24"
        fontWeight="800"
        fill="#ffffff"
      >
        A
      </text>
    </svg>
  );
}

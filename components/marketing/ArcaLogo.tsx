type ArcaLogoProps = {
  className?: string;
  eager?: boolean;
};

export function ArcaLogo({ className, eager = false }: ArcaLogoProps) {
  return (
    <img
      src="/arca-logo.webp"
      width={640}
      height={530}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      className={className}
    />
  );
}

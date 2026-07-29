type AtriaLogoProps = {
  className?: string;
  eager?: boolean;
};

export function AtriaLogo({ className, eager = false }: AtriaLogoProps) {
  return (
    <img
      src="/atria-logo.webp"
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

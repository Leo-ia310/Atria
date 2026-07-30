import Image from "next/image";

type ArcaLogoProps = {
  className?: string;
  eager?: boolean;
};

export function ArcaLogo({ className, eager = false }: ArcaLogoProps) {
  return (
    <Image
      src="/LogoARCA-mark.png"
      alt="ARCA"
      width={2248}
      height={1860}
      className={className}
      priority={eager}
      sizes="64px"
    />
  );
}

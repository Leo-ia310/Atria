"use client";

import Image from "next/image";
import { useState } from "react";

export function MarketingAvatar({ nombre, foto }: { nombre: string; foto: string }) {
  const [error, setError] = useState(false);
  const iniciales = nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  if (error) {
    return (
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c3aed,#2563eb)] text-[13px] font-semibold text-white ring-2 ring-white/20">
        {iniciales}
      </div>
    );
  }

  return (
    <Image
      src={foto}
      alt={nombre}
      width={44}
      height={44}
      loading="lazy"
      onError={() => setError(true)}
      className="h-11 w-11 flex-shrink-0 rounded-full object-cover ring-2 ring-[#a78bfa]/40"
    />
  );
}

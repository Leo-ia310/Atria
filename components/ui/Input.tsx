"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, className, id, type, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  const esPassword = type === "password";
  const [revelar, setRevelar] = useState(false);
  const tipoActual = esPassword ? (revelar ? "text" : "password") : type;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="text-label mb-1.5 block">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={tipoActual}
          className={cn(
            "arca-input",
            esPassword && "arca-input-pw",
            error && "border-[color:var(--color-error)] focus:border-[color:var(--color-error)]",
            className,
          )}
          {...rest}
        />
        {esPassword && (
          <button
            type="button"
            onClick={() => setRevelar((r) => !r)}
            aria-label={revelar ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-secondary)]"
          >
            {revelar ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error ? (
        <p className="mt-1.5 text-[12px] text-[color:var(--color-error)]">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] text-[color:var(--color-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
});

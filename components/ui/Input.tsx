import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="text-label mb-1.5 block">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "atria-input",
          error && "border-[color:var(--color-error)] focus:border-[color:var(--color-error)]",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p className="mt-1.5 text-[12px] text-[color:var(--color-error)]">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] text-[color:var(--color-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
});

import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, error, hint, options, placeholder, className, id, ...rest },
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
      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "atria-input appearance-none pr-9",
            error && "border-[color:var(--color-error)]",
            className,
          )}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]"
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-[12px] text-[color:var(--color-error)]">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] text-[color:var(--color-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
});

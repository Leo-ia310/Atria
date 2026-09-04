export function GrupoOpciones({
  titulo,
  opciones,
  tipo = "checkbox",
}: {
  titulo: string;
  opciones: string[];
  tipo?: "checkbox" | "radio";
}) {
  return (
    <fieldset>
      <legend className="text-label">{titulo}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {opciones.map((opcion) => (
          <label
            key={opcion}
            className="cursor-pointer rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-small font-medium"
          >
            <input
              type={tipo}
              name="notasRapidas"
              defaultValue={opcion}
              className="sr-only"
            />
            {opcion}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

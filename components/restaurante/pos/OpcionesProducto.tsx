import { GrupoOpciones } from "@/components/restaurante/pos/GrupoOpciones";
import type { ProductoPos } from "@/components/restaurante/pos/types";
import { opcionesProducto } from "@/components/restaurante/pos/utils";

export function OpcionesProducto({ producto }: { producto: ProductoPos }) {
  const opciones = opcionesProducto(producto);
  return (
    <div className="space-y-3">
      {opciones.terminos.length > 0 && (
        <GrupoOpciones titulo="Termino" opciones={opciones.terminos} tipo="radio" />
      )}
      {opciones.extras.length > 0 && <GrupoOpciones titulo="Extras" opciones={opciones.extras} />}
      {opciones.quitar.length > 0 && <GrupoOpciones titulo="Quitar" opciones={opciones.quitar} />}
      {opciones.rapidas.length > 0 && <GrupoOpciones titulo="Notas rapidas" opciones={opciones.rapidas} />}
    </div>
  );
}

import { Construction } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { Card, CardBody } from "@/components/ui/Card";

export function PageStub({
  modulo,
  descripcion,
}: {
  modulo: string;
  descripcion: string;
}) {
  return (
    <div>
      <PageHeader title={modulo} subtitle={descripcion} />
      <Card>
        <CardBody>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 rounded-full bg-[color:var(--color-surface-2)] p-3 text-[color:var(--color-text-muted)]">
              <Construction size={24} />
            </div>
            <p className="text-base font-medium text-[color:var(--color-text-primary)]">
              Módulo en construcción
            </p>
            <p className="mt-1 max-w-md text-small text-[color:var(--color-text-muted)]">
              Esta fundación tiene el schema completo, el motor contable y el sistema
              de auth. La interfaz de este módulo se construye en la siguiente sesión.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

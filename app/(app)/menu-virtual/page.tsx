import Link from "next/link";
import { Plus, QrCode, Utensils } from "lucide-react";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { menuPlatillos, menuPromociones, menusVirtuales } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { crearMenuVirtual } from "@/lib/actions/restaurante";
import { slugifyMenu, getMenuPublicUrl } from "@/lib/restaurante/menu-utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export default async function MenuVirtualPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const [sp, user] = await Promise.all([searchParams, requireSession()]);
  await requireModulo(user, "menu-virtual");

  const [empresa, menus] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    db
      .select({
        id: menusVirtuales.id,
        nombre: menusVirtuales.nombre,
        descripcion: menusVirtuales.descripcion,
        slug: menusVirtuales.slug,
        plantilla: menusVirtuales.plantilla,
        publicado: menusVirtuales.publicado,
        creadoEn: menusVirtuales.creadoEn,
        platillos: sql<number>`(
          select count(*)
          from ${menuPlatillos}
          where ${menuPlatillos.menuId} = ${menusVirtuales.id}
        )`,
        promos: sql<number>`(
          select count(*)
          from ${menuPromociones}
          where ${menuPromociones.menuId} = ${menusVirtuales.id}
        )`,
      })
      .from(menusVirtuales)
      .where(eq(menusVirtuales.empresaId, user.empresaId))
      .orderBy(desc(menusVirtuales.creadoEn)),
  ]);

  const nombreBase = empresa?.nombreComercial || empresa?.razonSocial || "mi restaurante";
  const slugSugerido = slugifyMenu(nombreBase);

  return (
    <div>
      <PageHeader
        title="Menu virtual"
        subtitle="Crea menus publicos con QR, promos temporales y una vista bonita para tus clientes."
      />

      {(sp.error || sp.guardado) && (
        <div
          className={
            sp.error
              ? "mb-4 rounded-md bg-[color:var(--color-error-bg)] px-3 py-2 text-small text-[color:var(--color-error)]"
              : "mb-4 rounded-md bg-[color:var(--color-success)]/10 px-3 py-2 text-small text-[color:var(--color-success)]"
          }
        >
          {sp.error ?? "Cambios guardados."}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Nuevo menu" subtitle={`Link sugerido: arca.onl/${slugSugerido}`} />
          <CardBody>
            <form action={crearMenuVirtual} className="space-y-4">
              <Input
                name="nombre"
                label="Nombre del menu"
                placeholder="Menu principal"
                required
              />
              <input type="hidden" name="slug" value={slugSugerido} />
              <Input
                name="descripcion"
                label="Descripcion"
                placeholder="Desayunos, almuerzos, cocteles..."
              />
              <Select
                name="plantilla"
                label="Plantilla"
                defaultValue="bistro"
                options={[
                  { value: "bistro", label: "Bistro elegante" },
                  { value: "minimal", label: "Minimal limpio" },
                  { value: "fiesta", label: "Fiesta colorida" },
                ]}
              />
              <Button type="submit" className="w-full">
                <Plus size={14} /> Crear menu
              </Button>
            </form>
          </CardBody>
        </Card>

        {menus.length === 0 ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={Utensils}
                titulo="Aun no tienes menus"
                descripcion="Crea tu primer menu virtual y luego agrega secciones, platillos, ofertas y QR."
              />
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {menus.map((menu) => {
              const url = getMenuPublicUrl(menu.slug);
              return (
                <Card key={menu.id}>
                  <CardBody>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-base font-semibold text-[color:var(--color-text-primary)]">
                            {menu.nombre}
                          </h2>
                          <Badge variant={menu.publicado ? "success" : "neutral"}>
                            {menu.publicado ? "Publicado" : "Oculto"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
                          {menu.descripcion || "Sin descripcion"}
                        </p>
                      </div>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[color:var(--color-tertiary)]/15 text-[color:var(--color-primary)]">
                        <QrCode size={19} />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-small">
                      <div className="rounded-md bg-[color:var(--color-surface-2)] p-2">
                        <div className="font-semibold text-[color:var(--color-text-primary)]">
                          {menu.platillos}
                        </div>
                        <div className="text-[11px] text-[color:var(--color-text-muted)]">
                          Platillos
                        </div>
                      </div>
                      <div className="rounded-md bg-[color:var(--color-surface-2)] p-2">
                        <div className="font-semibold text-[color:var(--color-text-primary)]">
                          {menu.promos}
                        </div>
                        <div className="text-[11px] text-[color:var(--color-text-muted)]">
                          Promos
                        </div>
                      </div>
                      <div className="rounded-md bg-[color:var(--color-surface-2)] p-2">
                        <div className="font-semibold capitalize text-[color:var(--color-text-primary)]">
                          {menu.plantilla}
                        </div>
                        <div className="text-[11px] text-[color:var(--color-text-muted)]">
                          Plantilla
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-small">
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all font-medium text-[color:var(--color-primary)] hover:underline"
                      >
                        {url}
                      </a>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <Link href={`/${menu.slug}`} target="_blank" className="arca-btn arca-btn-ghost arca-btn-sm">
                        Ver publico
                      </Link>
                      <Link href={`/menu-virtual/${menu.id}`} className="arca-btn arca-btn-primary arca-btn-sm">
                        Administrar
                      </Link>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

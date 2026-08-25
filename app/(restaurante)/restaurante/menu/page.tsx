import Link from "next/link";
import QRCode from "qrcode";
import { asc, count, eq } from "drizzle-orm";
import { ExternalLink, Utensils } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import { menuPlatillos, menusVirtuales } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { crearMenuVirtual } from "@/lib/actions/restaurante";
import { getMenuPublicUrl } from "@/lib/restaurante/menu-utils";
import { MenuQrCard } from "@/components/restaurante/MenuQrCard";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function RestauranteMenuPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-menu");

  const menus = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({
        id: menusVirtuales.id,
        nombre: menusVirtuales.nombre,
        slug: menusVirtuales.slug,
        descripcion: menusVirtuales.descripcion,
        publicado: menusVirtuales.publicado,
        cantidadMesas: menusVirtuales.cantidadMesas,
        platillos: count(menuPlatillos.id),
        actualizadoEn: menusVirtuales.actualizadoEn,
      })
      .from(menusVirtuales)
      .leftJoin(menuPlatillos, eq(menuPlatillos.menuId, menusVirtuales.id))
      .where(eq(menusVirtuales.empresaId, user.empresaId))
      .groupBy(menusVirtuales.id)
      .orderBy(asc(menusVirtuales.nombre)),
  );

  const menusConQr = await Promise.all(
    menus.map(async (menu) => {
      const url = getMenuPublicUrl(menu.slug);
      return {
        ...menu,
        url,
        qrDataUrl: await QRCode.toDataURL(url, { width: 280, margin: 1 }),
      };
    }),
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-label">QR publico</p>
          <h1 className="mt-1 text-xl">Menu del restaurante</h1>
          <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
            Publicacion rapida, QR general y punto de control del menu publico.
          </p>
        </div>
        <form action={crearMenuVirtual}>
          <input type="hidden" name="nombre" value="Menu principal" />
          <input type="hidden" name="plantilla" value="bistro" />
          <Button type="submit" size="sm" variant="secondary">
            Crear menu
          </Button>
        </form>
      </header>

      {menusConQr.length === 0 ? (
        <Card>
          <CardBody>
            <div className="py-12 text-center">
              <Utensils className="mx-auto text-[color:var(--color-text-muted)]" size={30} />
              <p className="mt-3 text-small text-[color:var(--color-text-muted)]">
                No hay menus publicados. Crea la carta desde el editor.
              </p>
              <form action={crearMenuVirtual} className="mt-4">
                <input type="hidden" name="nombre" value="Menu principal" />
                <input type="hidden" name="plantilla" value="bistro" />
                <Button type="submit" size="sm">
                  Crear menu
                </Button>
              </form>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {menusConQr.map((menu) => (
              <Card key={menu.id}>
                <CardHeader
                  title={menu.nombre}
                  subtitle={menu.descripcion ?? "Menu publico"}
                  actions={
                    <Badge variant={menu.publicado ? "success" : "neutral"}>
                      {menu.publicado ? "Publicado" : "Oculto"}
                    </Badge>
                  }
                />
                <CardBody className="space-y-4">
                  <div className="grid gap-3 text-small sm:grid-cols-3">
                    <Dato label="Platillos" value={String(menu.platillos)} />
                    <Dato label="Mesas QR" value={String(menu.cantidadMesas)} />
                    <Dato label="Slug" value={menu.slug} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={menu.url} target="_blank" rel="noreferrer" className="arca-btn arca-btn-primary arca-btn-sm">
                      <ExternalLink size={14} /> Ver publico
                    </a>
                    <Link href={`/restaurante/menu/${menu.id}`} className="arca-btn arca-btn-secondary arca-btn-sm">
                      Editar carta
                    </Link>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
          <div className="space-y-4">
            {menusConQr.slice(0, 1).map((menu) => (
              <MenuQrCard
                key={menu.id}
                nombre={menu.nombre}
                url={menu.url}
                qrDataUrl={menu.qrDataUrl}
              />
            ))}
            <Card>
              <CardHeader title="Privacidad QR" />
              <CardBody className="space-y-2 text-small text-[color:var(--color-text-muted)]">
                <p>
                  El formulario de comensal es voluntario y el menu no queda bloqueado.
                </p>
                <p>
                  La cookie publica guarda solo un token opaco, nunca nombre,
                  telefono ni correo.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[color:var(--color-surface-2)] p-3">
      <div className="text-label">{label}</div>
      <div className="mt-1 truncate font-semibold">{value}</div>
    </div>
  );
}

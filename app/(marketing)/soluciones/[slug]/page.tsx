import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SeoPageTemplate } from "@/components/marketing/SeoPageTemplate";
import { SEO_PAGES, getSeoPage, metadataForSeoPage } from "@/lib/seo-pages";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return SEO_PAGES.flatMap((page) =>
    page.category !== "comparativa" ? [{ slug: page.slug }] : [],
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoPage(slug);
  if (!page || page.category === "comparativa") return {};
  return metadataForSeoPage(page);
}

export default async function SolucionSeoPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getSeoPage(slug);
  if (!page || page.category === "comparativa") notFound();

  return <SeoPageTemplate page={page} />;
}

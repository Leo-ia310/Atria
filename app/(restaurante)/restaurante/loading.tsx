export default function RestauranteLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-3 w-28 animate-pulse rounded bg-[color:var(--color-surface-2)]" />
        <div className="h-7 w-72 animate-pulse rounded bg-[color:var(--color-surface-2)]" />
        <div className="h-4 w-full max-w-lg animate-pulse rounded bg-[color:var(--color-surface-2)]" />
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {["a", "b", "c", "d"].map((item) => (
          <div key={item} className="arca-card h-32 animate-pulse" />
        ))}
      </section>
      <div className="arca-card h-80 animate-pulse" />
    </div>
  );
}

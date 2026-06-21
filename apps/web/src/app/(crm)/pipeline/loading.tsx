export default function PipelineLoading() {
  return (
    <section className="px-4 py-6 lg:px-6" aria-label="Cargando pipeline">
      <div className="mb-5 space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-10 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[32rem] min-w-72 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </section>
  );
}

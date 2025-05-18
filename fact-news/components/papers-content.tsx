export function PapersContent() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Papers</h1>
      <div className="grid gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <h2 className="mb-2 font-semibold">Paper {i + 1}</h2>
            <p className="text-sm text-muted-foreground">
              This is a sample paper. It would typically contain an abstract, authors, and publication date.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">Research</span>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">2023</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

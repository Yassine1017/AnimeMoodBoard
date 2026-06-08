type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 h-10 w-72 animate-pulse rounded-md bg-white/8" />
      <p className="mb-5 text-sm font-medium text-white/58">{label}</p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-lg border border-line bg-white/[0.045]"
          >
            <div className="aspect-[2/3] animate-pulse bg-white/8" />
            <div className="space-y-3 p-4">
              <div className="h-5 w-3/4 animate-pulse rounded bg-white/8" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-white/8" />
              <div className="h-16 animate-pulse rounded bg-white/8" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

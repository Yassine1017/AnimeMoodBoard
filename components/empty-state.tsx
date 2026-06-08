import { SearchX } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-white/18 bg-white/[0.035] p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-white/8 text-aqua">
        <SearchX className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/58">
        {description}
      </p>
    </div>
  );
}

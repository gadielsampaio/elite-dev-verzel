import { Skeleton } from "../../components/ui/skeleton";

export function LoadingSkeleton({
  label,
  layout = "rows",
}: {
  label: string;
  layout?: "rows" | "cards" | "hero" | "detail";
}) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className="w-full py-6"
    >
      <span className="sr-only">{label}</span>
      <div
        aria-hidden="true"
        className={
          layout === "cards"
            ? "grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
            : layout === "hero"
              ? "mx-auto grid max-w-screen-2xl gap-10 px-6 md:grid-cols-2 md:px-12"
              : "space-y-6"
        }
      >
        {layout === "hero" ? (
          <>
            <div className="flex min-h-80 flex-col justify-center gap-6">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-16 w-5/6" />
              <Skeleton className="h-16 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-6 h-12 w-full" />
            </div>
            <Skeleton className="min-h-80 md:min-h-[32rem]" />
          </>
        ) : (
          Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className={
                layout === "rows"
                  ? "flex items-center gap-5 border-b pb-6"
                  : "space-y-4"
              }
            >
              {layout === "cards" ? (
                <Skeleton className="aspect-square w-full" />
              ) : layout === "rows" ? (
                <Skeleton className="size-20 shrink-0" />
              ) : null}
              <div className="w-full space-y-3">
                <Skeleton className="h-3 w-1/4" />
                <Skeleton
                  className={layout === "detail" ? "h-10 w-2/3" : "h-5 w-3/4"}
                />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

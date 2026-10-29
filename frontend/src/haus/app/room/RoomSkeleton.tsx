import { Skeleton } from "../../../components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "../../../components/ui/dialog";

export function RoomSkeleton() {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) location.hash = "/home"; }}>
      <DialogContent
        aria-describedby={undefined}
        className="inset-0 left-0 top-0 h-dvh w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-6 sm:rounded-none md:p-12"
      >
        <DialogTitle className="sr-only">Loading auction room…</DialogTitle>
        <div
          role="status"
          aria-label="Loading auction room…"
          aria-busy="true"
          className="grid min-h-0 gap-8 pt-10 md:grid-cols-3 md:items-center"
        >
          <div aria-hidden="true" className="space-y-5 md:col-span-2">
            <Skeleton className="h-[45vh] w-full rounded-none md:h-[65vh]" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <div aria-hidden="true" className="space-y-6 border p-6">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

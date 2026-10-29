import { useTranslation } from "@/hooks/useTranslation";
import { AppLink } from "@/haus/app/routing/AppLink";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Lot } from "@/types/lot";

export function PublicationDialog({
  published,
  finishPublication,
}: {
  published: Lot | null;
  finishPublication: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={!!published}
      onOpenChange={(open) => {
        if (!open) finishPublication();
      }}
    >
      <DialogContent
        className="max-w-[calc(100%-2rem)] font-sans sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("seller-my-lots-tab")?.focus();
        }}
      >
        <DialogHeader className="gap-3 space-y-0 text-center sm:text-center">
          <DialogTitle className="px-6 font-display text-2xl font-semibold uppercase leading-tight tracking-[-.05em]">
            {t("Lot published!")}{" "}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {t("{title} is saved. You can manage it in My lots.", {
              title: published?.title ?? "",
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="grid grid-cols-2 gap-2 sm:grid sm:space-x-0">
          <Button
            variant="outline"
            onClick={finishPublication}
            className="h-12 w-full uppercase"
          >
            {t("My lots")}{" "}
          </Button>
          <Button asChild className="h-12 w-full uppercase">
            <AppLink to={`/lot/${published?.id}`}>{t("View lot")}</AppLink>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

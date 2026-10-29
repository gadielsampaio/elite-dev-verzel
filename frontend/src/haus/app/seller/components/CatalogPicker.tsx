import { useTranslation } from "@/hooks/useTranslation";
import type { CatalogArtwork } from "../../../../types/catalog";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import { sectionTitle } from "../../typography";
import { RefreshCw, ArrowUpRight } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../../../../components/ui/select";
import { useState } from "react";
import type { useSellerStudio } from "../../../../hooks/useSellerStudio";
import { sellerArtworkTypes } from "../../../../constants/artworkTypes";
import { Input } from "../../../../components/ui/input";
import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardFooter,
} from "../../../../components/ui/card";
import { LotPagination } from "../../components/LotPagination";

function ArtworkOption({
  artwork,
  disabled,
  select,
}: {
  artwork: CatalogArtwork;
  disabled: boolean;
  select: () => void;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled || failed}
      onClick={select}
      aria-label={t("Select {name}", { name: artwork.name })}
      className="group text-left disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Card className="h-full overflow-hidden border-transparent shadow-none transition-colors motion-reduce:transition-none group-hover:border-border group-focus-visible:border-border">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-muted">
          {failed ? (
            <span>{t("Image unavailable")}</span>
          ) : (
            <img
              src={artwork.imageUrl!}
              alt={artwork.name}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover object-top origin-top transition-transform duration-[1500ms] ease-out motion-safe:group-hover:scale-105 motion-safe:group-focus-visible:scale-105 motion-reduce:transition-none"
              onError={() => setFailed(true)}
            />
          )}
        </div>
        <div className="p-4 sm:p-6">
          <CardHeader className="space-y-4 p-0 pb-6">
            <div className="flex items-center justify-between gap-3 border-b pb-4 text-[10px] uppercase text-muted-foreground">
              <span>{artwork.artworkType || t("Artwork")}</span>
              <span>CMA {artwork.articArtworkId}</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {artwork.artistDisplay || "—"} / {artwork.dateDisplay || "—"}
            </p>
            <CardTitle className="font-display text-xl font-medium uppercase leading-snug">
              {artwork.name}
            </CardTitle>
          </CardHeader>
          <CardFooter className="justify-between gap-4 border-t px-0 pt-2">
            <span className="text-[10px] uppercase text-muted-foreground">
              {t("Select artwork")}{" "}
            </span>
            <span
              aria-hidden="true"
              className="inline-flex size-9 items-center justify-center border"
            >
              <ArrowUpRight className="size-4" />
            </span>
          </CardFooter>
        </div>
      </Card>
    </button>
  );
}
export function CatalogPicker({
  model: studio,
}: {
  model: ReturnType<typeof useSellerStudio>;
}) {
  const { t } = useTranslation();
  const results = studio.results;
  return (
    <section className="space-y-6" aria-label={t("Select artwork")}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className={sectionTitle}>{t("01 / Select an artwork")}</h2>
          <p className="text-sm text-muted-foreground">
            {t(
              "Public-domain works from the Cleveland Museum of Art. Only works with images are available.",
            )}{" "}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("Reload artwork")}
          title={t("Reload artwork")}
          disabled={studio.busy || !results}
          onClick={() => void studio.search(results?.page ?? 1)}
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void studio.search(1, { q: studio.query, type: studio.artworkType });
        }}
        className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]"
      >
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="seller-search" className="block text-xs uppercase">
            {t("Artwork / Artist")}{" "}
          </label>
          <Input
            id="seller-search"
            type="search"
            value={studio.query}
            onChange={(e) => studio.setQuery(e.target.value)}
            placeholder={t("e.g. Claude Monet")}
            maxLength={100}
            className="h-12"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="artwork-type" className="block text-xs uppercase">
            {t("Artwork type")}{" "}
          </label>
          <Select
            value={studio.artworkType || "all"}
            onValueChange={(value) =>
              studio.setArtworkType(value === "all" ? "" : value)
            }
          >
            <SelectTrigger id="artwork-type" className="h-12 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All types")}</SelectItem>
              {sellerArtworkTypes.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {t(label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="submit"
          disabled={
            studio.busy || (!studio.query.trim() && !studio.artworkType)
          }
          className="h-12 px-8"
        >
          {studio.busy ? t("SEARCHING…") : t("SEARCH")}
        </Button>
      </form>

      {studio.busy && (
        <LoadingSkeleton label={t("Loading artwork…")} layout="cards" />
      )}
      {!results && !studio.busy && !studio.error && (
        <div className="border px-6 py-16 text-center text-sm text-muted-foreground">
          {t(
            "Search by artwork/artist, select a type, or combine both filters.",
          )}{" "}
        </div>
      )}
      {results && (
        <>
          <p role="status" className="text-xs text-muted-foreground">
            {results.total} {t("artworks ·")} {results.provider}
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.items
              .filter((a) => a.imageUrl && a.isPublicDomain === true)
              .map((artwork) => (
                <ArtworkOption
                  key={artwork.articArtworkId}
                  artwork={artwork}
                  disabled={studio.busy}
                  select={() => void studio.select(artwork)}
                />
              ))}
          </div>
          {!results.items.some(
            (a) => a.imageUrl && a.isPublicDomain === true,
          ) && <p>{t("No artworks found. Try another search.")}</p>}
          <LotPagination
            page={results.page}
            totalPages={Math.min(
              100,
              Math.max(1, Math.ceil(results.total / 9)),
            )}
            disabled={studio.busy}
            onPageChange={(page) => void studio.search(page)}
          />
        </>
      )}
    </section>
  );
}

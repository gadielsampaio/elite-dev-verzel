import { LoadingSkeleton } from "../LoadingSkeleton";
import { sectionTitle } from "../typography";
import { RefreshCw, ArrowUpRight } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../../../components/ui/select";
import { useState } from "react";
import type {
  useSellerStudio,
  CatalogArtwork,
} from "../../data/useSellerStudio";
import { sellerArtworkTypes } from "../../artworkTypes";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardFooter,
} from "../../../components/ui/card";
import { LotPagination } from "../LotPagination";

function ArtworkOption({
  artwork,
  disabled,
  select,
}: {
  artwork: CatalogArtwork;
  disabled: boolean;
  select: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled || failed}
      onClick={select}
      aria-label={`Select ${artwork.name}`}
      className="group text-left disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Card className="h-full overflow-hidden border-transparent shadow-none transition-colors motion-reduce:transition-none group-hover:border-border group-focus-visible:border-border">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-muted">
          {failed ? (
            <span>Image unavailable</span>
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
              <span>{artwork.artworkType || "Artwork"}</span>
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
              Select artwork
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
  model: m,
}: {
  model: ReturnType<typeof useSellerStudio>;
}) {
  const results = m.results;
  return (
    <section className="space-y-6" aria-label="Select artwork">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className={sectionTitle}>01 / Select an artwork</h2>
          <p className="text-sm text-muted-foreground">
            Public-domain works from the Cleveland Museum of Art. Only works
            with images are available.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Reload artwork"
          title="Reload artwork"
          disabled={m.busy || !results}
          onClick={() => void m.search(results?.page ?? 1)}
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void m.search(1, { q: m.query, type: m.artworkType });
        }}
        className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]"
      >
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="seller-search" className="block text-xs uppercase">
            Artwork / Artist
          </label>
          <Input
            id="seller-search"
            type="search"
            value={m.query}
            onChange={(e) => m.setQuery(e.target.value)}
            placeholder="e.g. Claude Monet"
            maxLength={100}
            className="h-12"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="artwork-type" className="block text-xs uppercase">
            Artwork type
          </label>
          <Select
            value={m.artworkType || "all"}
            onValueChange={(value) =>
              m.setArtworkType(value === "all" ? "" : value)
            }
          >
            <SelectTrigger id="artwork-type" className="h-12 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {sellerArtworkTypes.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="submit"
          disabled={m.busy || (!m.query.trim() && !m.artworkType)}
          className="h-12 px-8"
        >
          {m.busy ? "SEARCHING…" : "SEARCH"}
        </Button>
      </form>

      {m.busy && <LoadingSkeleton label={"Loading artwork…"} layout="cards" />}
      {!results && !m.busy && !m.error && (
        <div className="border px-6 py-16 text-center text-sm text-muted-foreground">
          Search by artwork/artist, select a type, or combine both filters.
        </div>
      )}
      {results && (
        <>
          <p role="status" className="text-xs text-muted-foreground">
            {results.total} artworks · {results.provider}
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.items
              .filter((a) => a.imageUrl && a.isPublicDomain === true)
              .map((artwork) => (
                <ArtworkOption
                  key={artwork.articArtworkId}
                  artwork={artwork}
                  disabled={m.busy}
                  select={() => void m.select(artwork)}
                />
              ))}
          </div>
          {!results.items.some(
            (a) => a.imageUrl && a.isPublicDomain === true,
          ) && <p>No artworks found. Try another search.</p>}
          <LotPagination
            page={results.page}
            totalPages={Math.min(
              100,
              Math.max(1, Math.ceil(results.total / 9)),
            )}
            disabled={m.busy}
            onPageChange={(page) => void m.search(page)}
          />
        </>
      )}
    </section>
  );
}

import { LoadingSkeleton } from "./LoadingSkeleton";
import { sectionTitle } from "./typography";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { LotPagination } from "./LotPagination";
import { LiveDot } from "./LiveDot";
import { navigationItemStyles } from "../../components/ui/navigation-item";
import { useState } from "react";
import { Search } from "lucide-react";
import type { Lot } from "../../api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { useApiQuery, type PageResult } from "../data/queries";
import { useHaus } from "../model";
import { translations } from "../translations";
import { LotCard } from "./LotCard";

export function Catalog({ liveTotal }: { liveTotal?: number }) {
  const { lang } = useHaus();
  const s = translations[lang],
    pt = lang === "PT";
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const lots = useApiQuery<PageResult<Lot>>(
    `/lots?page=${page}&limit=9${filter === "all" ? "" : `&status=${filter}`}`,
    undefined,
    false,
    true,
  );
  const matches =
    lots.data?.items.filter((lot) =>
      `${lot.title} ${lot.items[0]?.artistDisplay || ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    ) || [];
  const totalPages = Math.max(1, Math.ceil((lots.data?.total || 0) / 9));
  function changePage(next: number) {
    setPage(next);
    setQuery("");
  }
  return (
    <section
      id="catalog"
      className="mx-auto max-w-screen-2xl space-y-8 px-6 py-16 md:px-12 md:py-24"
    >
      <div className="flex items-end justify-between gap-6">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            01 / {s.collection}
          </p>
          <h2 className={sectionTitle}>{s.title}</h2>
          <p className="text-sm text-muted-foreground">{s.sub}</p>
        </div>
        <p className="hidden items-center gap-2 whitespace-nowrap text-xs text-muted-foreground sm:flex">
          {liveTotal !== undefined && liveTotal > 0 && <LiveDot />}
          {liveTotal === undefined ? "—" : `${liveTotal} ${s.live}`}
        </p>
      </div>
      <Tabs
        value={filter}
        onValueChange={(value) => {
          setFilter(value);
          changePage(1);
        }}
      >
        <div className="flex flex-col justify-between gap-4 border-y lg:flex-row lg:items-stretch">
          <TabsList
            aria-label={pt ? "Status dos lotes" : "Lot status"}
            className="h-auto w-full flex-wrap justify-start gap-x-6 rounded-none bg-transparent p-0 sm:w-auto"
          >
            {[
              ["all", s.all],
              ["open", s.live],
              ["scheduled", s.upcoming],
              ["closed", pt ? "ENCERRADOS" : "CLOSED"],
            ].map(([id, label]) => (
              <TabsTrigger key={id} value={id} className={navigationItemStyles}>
                {id === "open" && <LiveDot />}
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="relative mb-4 flex lg:mb-0 lg:w-64">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label={pt ? "Buscar lotes" : "Search lots"}
              placeholder={pt ? "Buscar lotes" : "Search lots"}
              className="h-auto min-h-12 pl-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <TabsContent value={filter} className="mt-8" aria-busy={lots.loading}>
          {lots.error ? (
            <Alert variant="destructive" className="space-y-3">
              <AlertDescription>{lots.error}</AlertDescription>
              <Button variant="outline" onClick={lots.refresh}>
                {pt ? "Tentar novamente" : "Retry lots"}
              </Button>
            </Alert>
          ) : lots.loading && !lots.data ? (
            <LoadingSkeleton
              label={pt ? "Carregando lotes…" : "Loading lots…"}
              layout="cards"
            />
          ) : matches.length ? (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((lot) => (
                <LotCard key={lot.id} lot={lot} />
              ))}
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {query
                ? pt
                  ? "NENHUM RESULTADO NESTA PÁGINA"
                  : "NO MATCHES ON THIS PAGE"
                : pt
                  ? "NENHUM LOTE ENCONTRADO"
                  : "NO LOTS FOUND"}
            </p>
          )}
        </TabsContent>
      </Tabs>
      <div className="flex justify-end border-t pt-6">
        <LotPagination
          page={page}
          totalPages={totalPages}
          disabled={lots.loading || !lots.data}
          onPageChange={changePage}
        />
      </div>
    </section>
  );
}

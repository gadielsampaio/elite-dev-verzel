import { sellerPageTitle, sellerSectionTitle } from "./typography";
import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../components/ui/dialog";
import { useSellerStudio } from "../../data/useSellerStudio";
import { dollars } from "../../data/queries";
import { Button } from "../../../components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../../components/ui/tabs";
import { navigationItemStyles } from "../../../components/ui/navigation-item";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { SellerCollection, SellerResults } from "./SellerCollection";
import { CatalogPicker } from "./CatalogPicker";
import { LotForm } from "./LotForm";

export function SellerStudio() {
  const m = useSellerStudio("Painting", "now");
  const creation = useRef<HTMLDivElement>(null);
  function create() {
    m.setTab("create");
    if (!m.results && !m.busy && !m.selected)
      void m.search(1, { q: m.query, type: m.artworkType });
    requestAnimationFrame(() => {
      creation.current?.focus({ preventScroll: true });
      creation.current?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    });
  }
  function finishPublication() {
    m.setPublished(null);
    m.setSelected(null);
    m.setStartMode("now");
    m.setFieldErrors({});
    m.setError("");
    m.setTab("lots");
  }
  if (!m.session || m.session.user.role !== "auctioneer")
    return (
      <section className="mx-auto max-w-screen-2xl space-y-6 px-6 py-24 md:px-12">
        <h1 className={sellerPageTitle}>Seller Studio</h1>
        <Alert>
          <AlertDescription>
            {m.session
              ? "An auctioneer account is required to publish and manage lots."
              : "Sign in as an auctioneer to manage your collection."}
          </AlertDescription>
        </Alert>
        {!m.session && (
          <Button asChild>
            <a href="/#/login">Log in</a>
          </Button>
        )}
      </section>
    );
  const summary = m.summary.data;
  return (
    <section className="mx-auto max-w-screen-2xl space-y-10 px-6 py-16 md:px-12 md:py-24">
      <header className="space-y-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Private area / Auctioneer
        </p>
        <h1 className={sellerPageTitle}>Seller Studio</h1>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Manage your collection, live auctions and final results.
          </p>
          <Button
            disabled={m.busy}
            onClick={create}
            className="h-12 gap-6 px-6 uppercase"
          >
            Create lot +
          </Button>
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-px border-y bg-border sm:grid-cols-4">
        {[
          ["Your lots", summary?.lots],
          ["Live now", summary?.live],
          ["Lots sold", summary?.sold],
          [
            "Total received",
            summary
              ? dollars(summary.totalReceived, summary.currency)
              : undefined,
          ],
        ].map(([label, value]) => (
          <div key={label} className="space-y-3 bg-background p-4 md:p-6">
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {label}
            </dt>
            <dd className="font-display text-2xl">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      {m.summary.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {m.summary.error}
            <Button variant="link" onClick={m.summary.refresh}>
              Retry summary
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <Tabs
        value={m.tab}
        onValueChange={(value) =>
          value === "create" ? create() : m.setTab(value as typeof m.tab)
        }
        className="flex flex-col gap-8"
      >
        <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0">
          {[
            ["lots", "My lots"],
            ["create", "Create a lot"],
            ["results", "Results"],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              id={value === "lots" ? "seller-my-lots-tab" : undefined}
              value={value}
              disabled={m.busy}
              className={navigationItemStyles}
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="lots">
          <SellerCollection create={create} onChanged={m.summary.refresh} />
        </TabsContent>
        <TabsContent value="results">
          <SellerResults />
        </TabsContent>
        <TabsContent
          value="create"
          ref={creation}
          tabIndex={-1}
          forceMount
          hidden={m.tab !== "create"}
          className="scroll-mt-10 space-y-8 data-[state=inactive]:hidden"
        >
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              New auction / Step {m.selected ? "02" : "01"} of 02
            </p>
            <h2 className={sellerSectionTitle}>Create a lot</h2>
          </div>
          {m.error && (!m.selected || m.published) && (
            <Alert variant="destructive">
              <AlertDescription>{m.error}</AlertDescription>
            </Alert>
          )}
          {m.selected ? <LotForm model={m} /> : <CatalogPicker model={m} />}
        </TabsContent>
      </Tabs>
      <Dialog
        open={!!m.published}
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
              Lot published!
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {m.published?.title} is saved. You can manage it in My lots.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid sm:space-x-0">
            <Button
              variant="outline"
              onClick={finishPublication}
              className="h-12 w-full uppercase"
            >
              My lots
            </Button>
            <Button asChild className="h-12 w-full uppercase">
              <a href={`/#/lot/${m.published?.id}`}>View lot</a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

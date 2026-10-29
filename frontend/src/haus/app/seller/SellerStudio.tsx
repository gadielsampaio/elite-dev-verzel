import { useTranslation } from "@/hooks/useTranslation";
import { PublicationDialog } from "./components/PublicationDialog";
import { SellerResults } from "./components/SellerResults";
import { AppLink } from "@/haus/app/routing/AppLink";
import { sellerPageTitle, sellerSectionTitle } from "./typography";
import { useRef } from "react";
import { useSellerStudio } from "../../../hooks/useSellerStudio";
import { dollars } from "../../../utils/money";
import { Button } from "../../../components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../../components/ui/tabs";
import { navigationItemStyles } from "../../../components/ui/navigation-item";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { SellerCollection } from "./components/SellerCollection";
import { CatalogPicker } from "./components/CatalogPicker";
import { LotForm } from "./components/LotForm";

export function SellerStudio() {
  const { t } = useTranslation();
  const studio = useSellerStudio("Painting", "now");
  const creation = useRef<HTMLDivElement>(null);

  function create() {
    studio.setTab("create");
    if (!studio.results && !studio.busy && !studio.selected)
      void studio.search(1, { q: studio.query, type: studio.artworkType });
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
    studio.setPublished(null);
    studio.setSelected(null);
    studio.setStartMode("now");
    studio.setFieldErrors({});
    studio.setError("");
    studio.setTab("lots");
  }

  if (!studio.session || studio.session.user.role !== "auctioneer")
    return (
      <section className="mx-auto max-w-screen-2xl space-y-6 px-6 py-24 md:px-12">
        <h1 className={sellerPageTitle}>{t("Seller Studio")}</h1>
        <Alert>
          <AlertDescription>
            {studio.session
              ? t(
                  "An auctioneer account is required to publish and manage lots.",
                )
              : t("Sign in as an auctioneer to manage your collection.")}
          </AlertDescription>
        </Alert>
        {!studio.session && (
          <Button asChild>
            <AppLink to="/login">{t("Log in")}</AppLink>
          </Button>
        )}
      </section>
    );

  const summary = studio.summary.data;
  return (
    <section className="mx-auto max-w-screen-2xl space-y-10 px-6 py-16 md:px-12 md:py-24">
      <header className="space-y-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("Private area / Auctioneer")}{" "}
        </p>
        <h1 className={sellerPageTitle}>{t("Seller Studio")}</h1>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {t("Manage your collection, live auctions and final results.")}{" "}
          </p>
          <Button
            disabled={studio.busy}
            onClick={create}
            className="h-12 gap-6 px-6 uppercase"
          >
            {t("Create lot +")}{" "}
          </Button>
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-px border-y bg-border sm:grid-cols-4">
        {[
          [t("Your lots"), summary?.lots],
          [t("Live now"), summary?.live],
          [t("Lots sold"), summary?.sold],
          [
            t("Total received"),
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
      {studio.summary.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {t(studio.summary.error)}
            <Button variant="link" onClick={studio.summary.refresh}>
              {t("Retry summary")}{" "}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <Tabs
        value={studio.tab}
        onValueChange={(value) => {
          if (value === "create") return create();
          studio.setTab(value as typeof studio.tab);
        }}
        className="flex flex-col gap-8"
      >
        <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0">
          {[
            ["lots", t("My lots")],
            ["create", t("Create a lot")],
            ["results", t("Results")],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              id={value === "lots" ? "seller-my-lots-tab" : undefined}
              value={value}
              disabled={studio.busy}
              className={navigationItemStyles}
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="lots">
          <SellerCollection
            create={create}
            onChanged={studio.summary.refresh}
          />
        </TabsContent>
        <TabsContent value="results">
          <SellerResults />
        </TabsContent>
        <TabsContent
          value="create"
          ref={creation}
          tabIndex={-1}
          forceMount
          hidden={studio.tab !== "create"}
          className="scroll-mt-10 space-y-8 data-[state=inactive]:hidden"
        >
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("New auction / Step {step} of 02", {
                step: studio.selected ? "02" : "01",
              })}
            </p>
            <h2 className={sellerSectionTitle}>{t("Create a lot")}</h2>
          </div>
          {studio.error && (!studio.selected || studio.published) && (
            <Alert variant="destructive">
              <AlertDescription>{t(studio.error)}</AlertDescription>
            </Alert>
          )}
          {studio.selected ? (
            <LotForm model={studio} />
          ) : (
            <CatalogPicker model={studio} />
          )}
        </TabsContent>
      </Tabs>
      <PublicationDialog
        published={studio.published}
        finishPublication={finishPublication}
      />
    </section>
  );
}

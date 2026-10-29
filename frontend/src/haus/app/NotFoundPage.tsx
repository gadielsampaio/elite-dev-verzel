import { Button } from "../../components/ui/button";
import { useHaus } from "../model";
import { pageTitle } from "./typography";

export function NotFoundPage() {
  const { lang } = useHaus();
  return (
    <section className="flex min-h-[65svh] items-center justify-center px-6 py-20 text-center">
      <div className="max-w-lg space-y-6">
        <p className="text-xs tracking-widest text-muted-foreground">404</p>
        <h1 className={pageTitle}>
          {lang === "PT" ? "Página não encontrada" : "Page not found"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {lang === "PT"
            ? "Esta página não existe ou foi movida."
            : "This page does not exist or has moved."}
        </p>
        <Button asChild className="h-12 uppercase">
          <a href="/#/home">
            {lang === "PT" ? "Voltar aos leilões" : "Back to auctions"}
          </a>
        </Button>
      </div>
    </section>
  );
}

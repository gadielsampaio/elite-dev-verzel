import { useTranslation } from "@/hooks/useTranslation";
import { AppLink } from "@/haus/app/routing/AppLink";
import { Button } from "../../../components/ui/button";
import { pageTitle } from "../typography";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <section className="flex min-h-[65svh] items-center justify-center px-6 py-20 text-center">
      <div className="max-w-lg space-y-6">
        <p className="text-xs tracking-widest text-muted-foreground">404</p>
        <h1 className={pageTitle}>{t("Page not found")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("This page does not exist or has moved.")}
        </p>
        <Button asChild className="h-12 uppercase">
          <AppLink to="/home">{t("Back to auctions")}</AppLink>
        </Button>
      </div>
    </section>
  );
}

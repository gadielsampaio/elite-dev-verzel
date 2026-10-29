import { useTranslation } from "@/hooks/useTranslation";
import { Alert, AlertDescription } from "../../../../components/ui/alert";
import { Button } from "../../../../components/ui/button";
import { pageTitle } from "../../typography";

type Props = {
  error: string;
  onRetry: () => void;
  onSignOut: () => Promise<void>;
};

export function SessionRecovery({ error, onRetry, onSignOut }: Props) {
  const { t } = useTranslation();
  return (
    <section
      aria-labelledby="session-recovery-title"
      className="mx-auto max-w-screen-2xl space-y-8 px-6 py-16 md:px-12 md:py-24"
    >
      <header className="space-y-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("Private area / Account access")}{" "}
        </p>
        <h1 id="session-recovery-title" className={pageTitle}>
          {t("Session unavailable")}{" "}
        </h1>
      </header>
      <div className="max-w-lg space-y-6">
        <Alert variant="destructive">
          <AlertDescription className="break-words">
            {t("Could not restore your session.")} {t(error ?? "")}
          </AlertDescription>
        </Alert>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button size="lg" onClick={onRetry}>
            {t("RETRY")}
          </Button>
          <Button size="lg" variant="outline" onClick={() => void onSignOut()}>
            {t("SIGN OUT")}{" "}
          </Button>
        </div>
      </div>
    </section>
  );
}

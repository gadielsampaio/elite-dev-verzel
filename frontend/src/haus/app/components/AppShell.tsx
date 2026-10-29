import { useTranslation } from "@/hooks/useTranslation";
import type { ReactNode } from "react";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { Toaster } from "../../../components/ui/sonner";
import { usePreferences } from "../../../hooks/usePreferences";
import { useSession } from "../../../hooks/useSession";
import { Header, Footer } from "./Header";

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { theme } = usePreferences();
  const { warning } = useSession();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="hs-page-enter">
        {warning && (
          <div className="mx-auto max-w-screen-2xl px-6 pt-6 md:px-12">
            <Alert variant="destructive">
              <AlertDescription>{t(warning)}</AlertDescription>
            </Alert>
          </div>
        )}
        {children}
      </main>
      <Footer />
      <Toaster theme={theme} position="bottom-right" closeButton />
    </div>
  );
}

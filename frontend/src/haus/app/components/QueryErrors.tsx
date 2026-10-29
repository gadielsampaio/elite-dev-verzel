import { useTranslation } from "@/hooks/useTranslation";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function QueryErrors({ errors }: { errors: string[] }) {
  const { t } = useTranslation();
  return errors.filter(Boolean).map((error, index) => (
    <Alert key={index} variant="destructive">
      <AlertDescription>{t(error ?? "")}</AlertDescription>
    </Alert>
  ));
}

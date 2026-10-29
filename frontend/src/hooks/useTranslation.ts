import { useCallback } from "react";
import { usePreferences } from "./usePreferences";
import { translate } from "../i18n/translate";

export function useTranslation() {
  const { lang } = usePreferences();
  const t = useCallback(
    (message: string, values?: Record<string, string | number>) =>
      translate(lang, message, values),
    [lang],
  );

  return { t, lang };
}

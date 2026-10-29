import { messagesPT, authTranslations } from "../haus/translations";
import type { Language } from "../types/preferences";

const englishMessages = new Map([
  ...Object.entries(messagesPT).map(
    ([english, portuguese]) => [portuguese, english] as const,
  ),
  ...Object.entries(authTranslations.EN).map(
    ([key, english]) =>
      [
        authTranslations.PT[key as keyof typeof authTranslations.PT],
        english,
      ] as const,
  ),
]);

// Unknown API messages remain readable; artwork metadata and API enum values are not translated.
export function translate(
  language: Language,
  message: string,
  values: Record<string, string | number> = {},
) {
  const minimumBid = /^Bid must be at least (\d+(?:\.\d+)?)$/.exec(message);
  if (language === "PT" && minimumBid) {
    return translate(language, "Bid must be at least {amount}", {
      amount: minimumBid[1],
    });
  }

  const text =
    language === "PT"
      ? (Object.hasOwn(messagesPT, message) ? messagesPT[message] : message)
      : (englishMessages.get(message) ?? message);
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name)
      ? String(values[name])
      : placeholder,
  );
}

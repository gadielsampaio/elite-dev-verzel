import { useTranslation } from "@/hooks/useTranslation";
import { useState } from "react";
import type { Lot } from "../types/lot";
export function Artwork({
  lot,
  className,
}: {
  lot: Pick<Lot, "items">;
  className?: string;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const item = lot.items[0];
  return item?.imageUrl && !failed ? (
    <img
      src={item.imageUrl}
      className={className}
      alt={item.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span>{t("Image unavailable")}</span>
  );
}

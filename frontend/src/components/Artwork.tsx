import { useTranslation } from "@/hooks/useTranslation";
import { useState } from "react";
import type { Lot } from "../types/lot";
export function Artwork({
  lot,
  className,
  priority = false,
}: {
  lot: Pick<Lot, "items">;
  className?: string;
  priority?: boolean;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const item = lot.items[0];
  return item?.imageUrl && !failed ? (
    <img
      src={item.imageUrl}
      className={className}
      alt={item.name}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      onError={() => setFailed(true)}
    />
  ) : (
    <span>{t("Image unavailable")}</span>
  );
}

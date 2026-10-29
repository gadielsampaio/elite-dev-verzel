import { useState } from "react";
import type { Lot } from "../api";
export function Artwork({
  lot,
  className,
}: {
  lot: Pick<Lot, "items">;
  className?: string;
}) {
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
    <span>Image unavailable</span>
  );
}

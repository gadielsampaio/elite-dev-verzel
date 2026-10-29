// Only a UUID lot ID can become a return destination; never accept arbitrary URLs.
export function returnLot() {
  const value = new URLSearchParams(location.hash.split("?")[1]).get("lot");
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}
export function lotHref(id: string) {
  return `/#/lot/${encodeURIComponent(id)}`;
}
export function returnToLot(id: string) {
  location.hash = `/lot/${encodeURIComponent(id)}`;
}

export function returnReceipt() {
  const id = new URLSearchParams(location.hash.split("?")[1]).get("receipt");
  return id &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

type LegacyLocation = Pick<Location, "pathname" | "search" | "hash">;

export function legacyLinkTarget({ pathname, search, hash }: LegacyLocation) {
  const path = pathname.replace(/\/$/, "");

  if (path === "/shadcn" || path === "/lots") {
    return `/${search}${hash || "#/home"}`;
  }

  const lot = path.match(/^\/lots\/([^/]+)$/);
  if (lot) return `/${search}#/lot/${lot[1]}`;

  if (/^\/(login|register|wallet|seller|activity|audit)$/.test(path)) {
    return `/${search}#${path}`;
  }

  return null;
}

// Normalize shared legacy links once, before HashRouter reads the URL.
export function restoreLegacyLink() {
  const target = legacyLinkTarget(window.location);
  if (!target) return;

  window.history.replaceState(window.history.state, "", target);
}

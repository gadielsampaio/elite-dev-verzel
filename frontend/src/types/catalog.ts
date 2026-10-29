export type CatalogArtwork = {
  articArtworkId: number;
  name: string;
  imageUrl: string | null;
  isPublicDomain: boolean | null;
  artistDisplay: string | null;
  dateDisplay?: string | null;
  artworkType?: string | null;
  mediumDisplay?: string | null;
  provider?: string;
};

export type CatalogSearchResult = {
  items: CatalogArtwork[];
  page: number;
  total: number;
  provider: string;
};

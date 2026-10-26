export interface CatalogItem {
  articArtworkId: number;
  name: string;
  articImageId: string | null;
  imageUrl: string | null;
  artistDisplay: string | null;
  creditLine: string | null;
  isPublicDomain: boolean | null;
}

export abstract class ExternalItemProvider {
  abstract check(): Promise<void>;
  abstract search(
    query: string,
    page: number,
    limit: number,
  ): Promise<{
    items: CatalogItem[];
    page: number;
    total: number;
    limit: number;
  }>;
}

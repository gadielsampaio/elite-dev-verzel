export interface CatalogItem {
  articArtworkId: number;
  name: string;
  articImageId: string | null;
  imageUrl: string | null;
  printImageUrl: string | null;
  artistDisplay: string | null;
  creditLine: string | null;
  isPublicDomain: boolean | null;
}

export abstract class ExternalItemProvider {
  abstract readonly name: 'mock' | 'cleveland';
  abstract check(): Promise<'up' | 'mocked'>;
  abstract findOne(id: number): Promise<
    CatalogItem & {
      dateDisplay: string | null;
      mediumDisplay: string | null;
      dimensions: string | null;
      artworkType: string | null;
    }
  >;
  abstract search(
    query: string,
    page: number,
    limit: number,
    type?: string,
  ): Promise<{
    items: CatalogItem[];
    page: number;
    total: number;
    limit: number;
  }>;
}

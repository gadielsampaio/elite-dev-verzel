import type { Lot, CatalogArtwork } from "./types";
export const initialLots: Lot[] = [
  {
    id: "lot-1",
    title: "Self-Portrait",
    artist: "Vincent van Gogh",
    year: "1887",
    status: "live",
    image:
      "https://artic-web.imgix.net/null5c3ab45d-ba78-458c-a90d-53a58d86e2ac/Van-Gogh_self-portrait.jpg?rect=0%2C0%2C2365%2C3000&auto=format%2Ccompress&fit=crop&crop=faces%2Ccenter&w=1686&h=2139",
    start: 33000,
    increment: 1000,
    endsAt: Date.now() + 8100000,
    bids: [
      { person: "Collector B", value: 33000 },
      { person: "Collector B", value: 35000 },
    ],
    description: "Self-portrait, painted in Paris, 1887. Oil on canvas.",
  },
  {
    id: "lot-2",
    title: "A Sunday on La Grande Jatte",
    artist: "Georges Seurat",
    year: "1884–1886",
    status: "scheduled",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/4/4d/Georges_Seurat_-_Un_dimanche_apr%C3%A8s-midi_%C3%A0_l%27%C3%8Ele_de_la_Grande_Jatte.jpg",
    start: 42500,
    increment: 1500,
    endsAt: Date.now() + 350000000,
    bids: [],
    description:
      "Pointillist composition from the Art Institute of Chicago collection.",
  },
  {
    id: "lot-3",
    title: "Nighthawks",
    artist: "Edward Hopper",
    year: "1942",
    status: "closed",
    image:
      "https://archinect.gumlet.io/uploads/4p/4pk234ten54ustjs.jpg?auto=compress%2Cformat",
    start: 28000,
    increment: 1000,
    endsAt: Date.now() - 172800000,
    bids: [
      { person: "Collector B", value: 30000 },
      { person: "Collector A", value: 31200 },
    ],
    description: "Nighttime urban diner scene, 1942. Oil on canvas.",
  },
];
export const sellerSample: CatalogArtwork = {
  id: 141639,
  title: "Twilight in the Wilderness",
  artist: "Frederic Edwin Church (American, 1826–1900)",
  year: "1860",
  image: "https://openaccess-cdn.clevelandart.org/1965.233/1965.233_web.jpg",
  medium: "Oil on canvas",
  artworkType: "Painting",
  provider: "cleveland",
  source: "sample",
  isPublicDomain: true,
};

export const sellerArtworkTypes = [
  ["Painting", "Paintings"],
  ["Drawing", "Drawings"],
  ["Sculpture", "Sculptures"],
  ["Photograph", "Photographs"],
  ["Print", "Prints"],
  ["Ceramic", "Ceramics"],
  ["Textile", "Textiles"],
  ["Jewelry", "Jewelry"],
  ["Furniture and woodwork", "Furniture & woodwork"],
];

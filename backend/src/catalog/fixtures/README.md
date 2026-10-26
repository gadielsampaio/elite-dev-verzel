# Art Institute development fixtures

Contract source: [official API documentation](https://api.artic.edu/docs/#quick-start),
reviewed 2026-10-26. Field-selected search uses `data: []` with `pagination`
(`total`, `limit`, `offset`, `current_page`, `total_pages`); detail uses `data: {}`.
`config.iiif_url` identifies the image service. Nullable fields are retained.

[artworks.ts](artworks.ts) contains three curated example detail responses using
collection IDs and recognizable titles. Optional metadata is illustrative, not a
live capture. The mock transport filters requested fields and builds paginated
search envelopes from these records. It does not simulate Elasticsearch ranking.

Both transports pass through `ArticAdapter` validation/normalization. Select
`CATALOG_PROVIDER=mock` or `artic`; real errors never trigger a mock fallback.
A different provider can implement `ExternalItemProvider` without changing the
catalog controller/service. No fixtures are inserted into PostgreSQL.

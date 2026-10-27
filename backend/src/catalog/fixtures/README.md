# Cleveland catalog fixtures

Contract: https://openaccess-api.clevelandart.org/.
Artwork 141639 is a captured example; IDs 900000001/2 are synthetic pagination
and nullable/restricted-image test cases. Mock search uses substring matching.
Both HTTP and mock transports pass through the Cleveland Adapter design pattern.
Select `CATALOG_PROVIDER=cleveland` or `mock`; no automatic fallback.

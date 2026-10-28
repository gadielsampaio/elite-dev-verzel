-- The print JPEG is the highest-resolution browser-ready image we retain.
ALTER TABLE "items" DROP COLUMN "full_image_url";
UPDATE "items" SET "source_snapshot" = "source_snapshot" - 'fullImageUrl'
WHERE "source_snapshot" ? 'fullImageUrl';

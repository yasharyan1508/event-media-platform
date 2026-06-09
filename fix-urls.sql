UPDATE "public"."media"
SET "url" = CONCAT(
  'https://event-media-platform-dev.s3.ap-south-1.amazonaws.com/',
  "s3Key"
)
WHERE "url" NOT LIKE 
  'https://event-media-platform-dev.s3.ap-south-1.amazonaws.com/%'
  AND "s3Key" IS NOT NULL
  AND "s3Key" != '';

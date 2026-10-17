ALTER TABLE `user` ADD `social_links` text;--> statement-breakpoint
-- Move the per-platform columns into the JSON object (empty ones dropped).
UPDATE `user` SET `social_links` = json_remove(
  json_object(
    'website', `portfolio_url`,
    'linkedin', `linkedin_url`,
    'github', `github_url`,
    'x', `twitter_url`,
    'instagram', `instagram_url`,
    'dribbble', `dribbble_url`
  ),
  CASE WHEN coalesce(`portfolio_url`, '') = '' THEN '$.website' ELSE '$._' END,
  CASE WHEN coalesce(`linkedin_url`, '') = '' THEN '$.linkedin' ELSE '$._' END,
  CASE WHEN coalesce(`github_url`, '') = '' THEN '$.github' ELSE '$._' END,
  CASE WHEN coalesce(`twitter_url`, '') = '' THEN '$.x' ELSE '$._' END,
  CASE WHEN coalesce(`instagram_url`, '') = '' THEN '$.instagram' ELSE '$._' END,
  CASE WHEN coalesce(`dribbble_url`, '') = '' THEN '$.dribbble' ELSE '$._' END
)
WHERE coalesce(`portfolio_url`, `linkedin_url`, `github_url`, `twitter_url`, `instagram_url`, `dribbble_url`) IS NOT NULL;

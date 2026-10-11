-- Rate-limit rows are short-lived counters; clearing them lets the unique key
-- index build even if concurrent inserts ever left duplicates.
DELETE FROM `rateLimit`;--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `favorites_resource_idx` ON `favorites` (`resource_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limit_key_idx` ON `rateLimit` (`key`);--> statement-breakpoint
CREATE INDEX `rate_limit_last_request_idx` ON `rateLimit` (`last_request`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_expires_idx` ON `session` (`expires_at`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `verification_expires_idx` ON `verification` (`expires_at`);
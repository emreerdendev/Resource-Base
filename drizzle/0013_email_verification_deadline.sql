ALTER TABLE `user` ADD `verify_deadline` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `suspended_at` integer;--> statement-breakpoint
-- Accounts not verified yet get 7 days from now (not from sign-up) to do it.
UPDATE `user` SET `verify_deadline` = unixepoch() + 7 * 86400 WHERE `email_verified` = 0;

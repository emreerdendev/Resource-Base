CREATE TABLE `cv_likes` (
	`user_id` text NOT NULL,
	`cv_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `cv_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cv_id`) REFERENCES `cvs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cv_likes_cv_idx` ON `cv_likes` (`cv_id`);--> statement-breakpoint
CREATE TABLE `cvs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`field` text NOT NULL,
	`seniority` text NOT NULL,
	`language` text NOT NULL,
	`technologies` text DEFAULT '[]' NOT NULL,
	`summary` text,
	`file_key` text NOT NULL,
	`file_size` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`rejection_reason` text,
	`sanity_submission_id` text,
	`like_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`published_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cvs_user_id_unique` ON `cvs` (`user_id`);--> statement-breakpoint
CREATE INDEX `cvs_status_published_idx` ON `cvs` (`status`,`published_at`);
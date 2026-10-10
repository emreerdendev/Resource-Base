CREATE TABLE `company_applications` (
	`user_id` text NOT NULL,
	`company_id` text NOT NULL,
	`status` text DEFAULT 'saved' NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `company_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `company_applications_user_updated_idx` ON `company_applications` (`user_id`,`updated_at`);
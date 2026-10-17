ALTER TABLE `submissions` ADD `proposed_name` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `proposed_url` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `propose_removal` integer DEFAULT false NOT NULL;
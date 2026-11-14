ALTER TABLE `audit_events` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `files` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `findings` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `inspections` ADD `deleted_at` text;
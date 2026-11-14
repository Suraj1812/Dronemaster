CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_owner_time` ON `audit_events` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`inspection_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`object_key` text NOT NULL,
	`sha256` text NOT NULL,
	`created_at` text NOT NULL,
	`classification` text,
	FOREIGN KEY (`inspection_id`) REFERENCES `inspections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `file_inspection` ON `files` (`inspection_id`);--> statement-breakpoint
CREATE INDEX `file_owner` ON `files` (`owner_id`);--> statement-breakpoint
CREATE TABLE `findings` (
	`id` text PRIMARY KEY NOT NULL,
	`inspection_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`file_id` text,
	`title_en` text NOT NULL,
	`title_it` text DEFAULT '' NOT NULL,
	`detail_en` text NOT NULL,
	`detail_it` text DEFAULT '' NOT NULL,
	`severity` text NOT NULL,
	`reviewed` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`inspection_id`) REFERENCES `inspections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `finding_inspection` ON `findings` (`inspection_id`);--> statement-breakpoint
CREATE INDEX `finding_owner` ON `findings` (`owner_id`);--> statement-breakpoint
CREATE TABLE `inspections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`site` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inspection_owner_created` ON `inspections` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_windows` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);

CREATE INDEX `file_inspection_active_created` ON `files` (`inspection_id`,`owner_id`,`deleted_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `file_owner_active` ON `files` (`owner_id`,`deleted_at`,`inspection_id`);--> statement-breakpoint
CREATE INDEX `finding_inspection_active_created` ON `findings` (`inspection_id`,`owner_id`,`deleted_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `finding_owner_pending` ON `findings` (`owner_id`,`deleted_at`,`reviewed`,`inspection_id`);--> statement-breakpoint
CREATE INDEX `finding_file_active` ON `findings` (`file_id`,`owner_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `inspection_owner_active_updated` ON `inspections` (`owner_id`,`deleted_at`,`updated_at`);--> statement-breakpoint
CREATE INDEX `rate_expiry` ON `rate_windows` (`expires_at`);
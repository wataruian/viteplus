CREATE TABLE `script_locks` (
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`name` text PRIMARY KEY,
	`owner` text NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE TABLE `script_locks` (
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`name` text PRIMARY KEY,
	`owner` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`created_at` integer NOT NULL,
	`email` text NOT NULL UNIQUE,
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `worker_jobs` (
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`dedupe_key` text,
	`function_name` text NOT NULL,
	`id` text PRIMARY KEY,
	`last_error` text,
	`lease_expires_at` integer,
	`lease_owner` text,
	`max_attempts` integer NOT NULL,
	`payload` text NOT NULL,
	`run_at` integer NOT NULL,
	`status` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "worker_jobs_status_check" CHECK(status IN ('pending', 'running', 'succeeded', 'dead'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `worker_jobs_dedupe_idx` ON `worker_jobs` (`function_name`,`dedupe_key`) WHERE dedupe_key IS NOT NULL;--> statement-breakpoint
CREATE INDEX `worker_jobs_pending_idx` ON `worker_jobs` (`function_name`,`run_at`) WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX `worker_jobs_running_idx` ON `worker_jobs` (`function_name`,`lease_expires_at`) WHERE status = 'running';--> statement-breakpoint
CREATE INDEX `worker_jobs_finished_idx` ON `worker_jobs` (`status`,`updated_at`) WHERE status IN ('succeeded', 'dead');
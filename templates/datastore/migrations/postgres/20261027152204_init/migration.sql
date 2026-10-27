CREATE TABLE "script_locks" (
	"expires_at" timestamp with time zone NOT NULL,
	"name" text PRIMARY KEY,
	"owner" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"email" text NOT NULL UNIQUE,
	"id" uuid PRIMARY KEY,
	"name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_jobs" (
	"attempts" integer DEFAULT 0 NOT NULL,
	"dedupe_key" text,
	"function_name" text NOT NULL,
	"id" text PRIMARY KEY,
	"last_error" text,
	"lease_expires_at" timestamp with time zone,
	"lease_owner" text,
	"max_attempts" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"run_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "worker_jobs_status_check" CHECK (status IN ('pending', 'running', 'succeeded', 'dead'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "worker_jobs_dedupe_idx" ON "worker_jobs" ("function_name","dedupe_key") WHERE dedupe_key IS NOT NULL;--> statement-breakpoint
CREATE INDEX "worker_jobs_pending_idx" ON "worker_jobs" ("function_name","run_at") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "worker_jobs_running_idx" ON "worker_jobs" ("function_name","lease_expires_at") WHERE status = 'running';--> statement-breakpoint
CREATE INDEX "worker_jobs_finished_idx" ON "worker_jobs" ("status","updated_at") WHERE status IN ('succeeded', 'dead');
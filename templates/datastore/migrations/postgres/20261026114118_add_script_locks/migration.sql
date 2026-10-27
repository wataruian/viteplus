CREATE TABLE "script_locks" (
	"expires_at" timestamp with time zone NOT NULL,
	"name" text PRIMARY KEY,
	"owner" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);

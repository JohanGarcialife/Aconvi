-- Add type and pinned fields to notice table for Tablón Digital
ALTER TABLE "notice" ADD COLUMN IF NOT EXISTS "type" varchar(32) NOT NULL DEFAULT 'COMUNICADO';
--> statement-breakpoint
ALTER TABLE "notice" ADD COLUMN IF NOT EXISTS "pinned" boolean NOT NULL DEFAULT false;

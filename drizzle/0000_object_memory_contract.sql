CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."ai_run_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."content_object_origin" AS ENUM('atlas-manifest', 'user-upload', 'paper-mapper', 'external-source');--> statement-breakpoint
CREATE TYPE "public"."content_object_type" AS ENUM('concept', 'route', 'demo', 'equation', 'code', 'source', 'source-span', 'claim', 'misconception', 'paper');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."thread_status" AS ENUM('open', 'resolved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('private', 'organization');--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"organization_id" uuid,
	"object_key" text NOT NULL,
	"snapshot_id" uuid,
	"thread_id" uuid,
	"note_id" uuid,
	"purpose" text NOT NULL,
	"status" "ai_run_status" DEFAULT 'queued' NOT NULL,
	"provider" text,
	"model" text,
	"prompt_summary" text,
	"output_summary" text,
	"input_object_keys" jsonb,
	"source_object_keys" jsonb,
	"token_counts" jsonb,
	"error_code" text,
	"error_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "ai_runs_object_required" CHECK ("ai_runs"."object_key" is not null),
	CONSTRAINT "ai_runs_purpose_not_empty" CHECK (length("ai_runs"."purpose") between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "content_object_refs" (
	"object_key" text PRIMARY KEY NOT NULL,
	"object_type" "content_object_type" NOT NULL,
	"origin" "content_object_origin" DEFAULT 'atlas-manifest' NOT NULL,
	"title" text NOT NULL,
	"href" text,
	"domain" text,
	"concept_id" text,
	"status" text,
	"stability" text,
	"manifest_version" text,
	"key_version" text,
	"source_ids" jsonb,
	"object_refs" jsonb,
	"discussion_anchor_id" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone,
	CONSTRAINT "content_object_refs_key_shape" CHECK ("content_object_refs"."object_key" ~ '^(concept|route|demo|equation|code|source|source-span|claim|misconception|paper):[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9-]*){0,5}(#[a-z0-9][a-z0-9-]*)?$' and "content_object_refs"."object_key" !~ '://' and split_part("content_object_refs"."object_key", ':', 1) = "content_object_refs"."object_type"::text),
	CONSTRAINT "content_object_refs_title_not_empty" CHECK (length("content_object_refs"."title") between 1 and 180)
);
--> statement-breakpoint
CREATE TABLE "document_spans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"span_kind" text NOT NULL,
	"page_number" integer,
	"line_start" integer,
	"line_end" integer,
	"char_start" integer,
	"char_end" integer,
	"bbox" jsonb,
	"text_sha256" text,
	"extraction_confidence" numeric(5, 4),
	"parser_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_spans_object_required" CHECK ("document_spans"."object_key" is not null),
	CONSTRAINT "document_spans_object_shape" CHECK ("document_spans"."object_key" like 'source-span:%'),
	CONSTRAINT "document_spans_bbox_size" CHECK ("document_spans"."bbox" is null or octet_length("document_spans"."bbox"::text) <= 8000),
	CONSTRAINT "document_spans_span_kind_not_empty" CHECK (length("document_spans"."span_kind") between 1 and 80),
	CONSTRAINT "document_spans_page_positive" CHECK ("document_spans"."page_number" is null or "document_spans"."page_number" >= 1),
	CONSTRAINT "document_spans_line_order" CHECK ("document_spans"."line_start" is null or "document_spans"."line_end" is null or "document_spans"."line_end" >= "document_spans"."line_start"),
	CONSTRAINT "document_spans_char_order" CHECK ("document_spans"."char_start" is null or "document_spans"."char_end" is null or "document_spans"."char_end" >= "document_spans"."char_start")
);
--> statement-breakpoint
CREATE TABLE "evidence_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"organization_id" uuid,
	"object_key" text NOT NULL,
	"source_object_key" text,
	"source_span_key" text,
	"note_id" uuid,
	"thread_id" uuid,
	"comment_id" uuid,
	"observation_id" uuid,
	"ai_run_id" uuid,
	"claim_text" text,
	"quote_snippet" text,
	"locator" jsonb,
	"confidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_refs_object_required" CHECK ("evidence_refs"."object_key" is not null),
	CONSTRAINT "evidence_refs_source_object_shape" CHECK ("evidence_refs"."source_object_key" is null or "evidence_refs"."source_object_key" like 'source:%'),
	CONSTRAINT "evidence_refs_source_span_shape" CHECK ("evidence_refs"."source_span_key" is null or "evidence_refs"."source_span_key" like 'source-span:%'),
	CONSTRAINT "evidence_refs_locator_size" CHECK ("evidence_refs"."locator" is null or octet_length("evidence_refs"."locator"::text) <= 8000)
);
--> statement-breakpoint
CREATE TABLE "learning_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"organization_id" uuid,
	"snapshot_id" uuid,
	"object_key" text NOT NULL,
	"observation_source" text NOT NULL,
	"observation_kind" text NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"detail" text,
	"next_question" text,
	"measured_state" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "learning_observations_object_required" CHECK ("learning_observations"."object_key" is not null),
	CONSTRAINT "learning_observations_measured_state_size" CHECK ("learning_observations"."measured_state" is null or octet_length("learning_observations"."measured_state"::text) <= 8000),
	CONSTRAINT "learning_observations_label_not_empty" CHECK (length("learning_observations"."label") between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "learning_route_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"organization_id" uuid,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"source" text NOT NULL,
	"mapping_id" text NOT NULL,
	"paper_title" text NOT NULL,
	"input_kind" text NOT NULL,
	"route_object_key" text NOT NULL,
	"current_object_key" text,
	"current_question" text,
	"route_concept_ids" jsonb NOT NULL,
	"route_labels" jsonb NOT NULL,
	"route_concepts" jsonb,
	"source_objects" jsonb,
	"graph_route" jsonb,
	"route_progress" jsonb,
	"primary_equation" jsonb,
	"snapshot_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "learning_route_snapshots_owner_required" CHECK ("learning_route_snapshots"."owner_user_id" is not null),
	CONSTRAINT "learning_route_snapshots_route_object_required" CHECK ("learning_route_snapshots"."route_object_key" is not null),
	CONSTRAINT "learning_route_snapshots_route_object_shape" CHECK ("learning_route_snapshots"."route_object_key" like 'route:%'),
	CONSTRAINT "learning_route_snapshots_visibility_org_required" CHECK ("learning_route_snapshots"."visibility" = 'private' or "learning_route_snapshots"."organization_id" is not null),
	CONSTRAINT "learning_route_snapshots_snapshot_json_size" CHECK (octet_length("learning_route_snapshots"."snapshot_json"::text) <= 24000),
	CONSTRAINT "learning_route_snapshots_mapping_not_empty" CHECK (length("learning_route_snapshots"."mapping_id") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "membership_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_org_id" text,
	"name" text NOT NULL,
	"slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "organizations_name_not_empty" CHECK (length("organizations"."name") between 1 and 180)
);
--> statement-breakpoint
CREATE TABLE "research_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"parent_comment_id" uuid,
	"body" text NOT NULL,
	"body_format" text DEFAULT 'markdown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "research_comments_body_not_empty" CHECK (length("research_comments"."body") between 1 and 12000)
);
--> statement-breakpoint
CREATE TABLE "research_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"organization_id" uuid,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"object_key" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"body_format" text DEFAULT 'markdown' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "research_notes_object_required" CHECK ("research_notes"."object_key" is not null),
	CONSTRAINT "research_notes_visibility_org_required" CHECK ("research_notes"."visibility" = 'private' or "research_notes"."organization_id" is not null),
	CONSTRAINT "research_notes_title_not_empty" CHECK (length("research_notes"."title") between 1 and 180)
);
--> statement-breakpoint
CREATE TABLE "research_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"organization_id" uuid,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"object_key" text NOT NULL,
	"title" text NOT NULL,
	"anchor_question" text NOT NULL,
	"status" "thread_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	CONSTRAINT "research_threads_object_required" CHECK ("research_threads"."object_key" is not null),
	CONSTRAINT "research_threads_visibility_org_required" CHECK ("research_threads"."visibility" = 'private' or "research_threads"."organization_id" is not null),
	CONSTRAINT "research_threads_title_not_empty" CHECK (length("research_threads"."title") between 1 and 180)
);
--> statement-breakpoint
CREATE TABLE "uploaded_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"organization_id" uuid,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"object_key" text NOT NULL,
	"title" text NOT NULL,
	"source_kind" text NOT NULL,
	"original_filename" text,
	"storage_uri" text,
	"mime_type" text,
	"byte_size" bigint,
	"sha256" text NOT NULL,
	"parser_version" text,
	"parser_status" text,
	"source_processing_consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "uploaded_documents_object_required" CHECK ("uploaded_documents"."object_key" is not null),
	CONSTRAINT "uploaded_documents_object_shape" CHECK ("uploaded_documents"."object_key" like 'paper:%'),
	CONSTRAINT "uploaded_documents_visibility_org_required" CHECK ("uploaded_documents"."visibility" = 'private' or "uploaded_documents"."organization_id" is not null),
	CONSTRAINT "uploaded_documents_title_not_empty" CHECK (length("uploaded_documents"."title") between 1 and 220),
	CONSTRAINT "uploaded_documents_sha256_shape" CHECK ("uploaded_documents"."sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text,
	"primary_email" text,
	"display_name" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_clerk_user_id_not_empty" CHECK ("users"."clerk_user_id" is null or length("users"."clerk_user_id") between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	CONSTRAINT "webhook_events_provider_not_empty" CHECK (length("webhook_events"."provider") between 1 and 80)
);
--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_object_key_content_object_refs_object_key_fk" FOREIGN KEY ("object_key") REFERENCES "public"."content_object_refs"("object_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_snapshot_id_learning_route_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."learning_route_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_thread_id_research_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."research_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_note_id_research_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."research_notes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_spans" ADD CONSTRAINT "document_spans_document_id_uploaded_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."uploaded_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_spans" ADD CONSTRAINT "document_spans_object_key_content_object_refs_object_key_fk" FOREIGN KEY ("object_key") REFERENCES "public"."content_object_refs"("object_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_refs" ADD CONSTRAINT "evidence_refs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_refs" ADD CONSTRAINT "evidence_refs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_refs" ADD CONSTRAINT "evidence_refs_object_key_content_object_refs_object_key_fk" FOREIGN KEY ("object_key") REFERENCES "public"."content_object_refs"("object_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_refs" ADD CONSTRAINT "evidence_refs_source_object_key_content_object_refs_object_key_fk" FOREIGN KEY ("source_object_key") REFERENCES "public"."content_object_refs"("object_key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_refs" ADD CONSTRAINT "evidence_refs_source_span_key_content_object_refs_object_key_fk" FOREIGN KEY ("source_span_key") REFERENCES "public"."content_object_refs"("object_key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_refs" ADD CONSTRAINT "evidence_refs_note_id_research_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."research_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_refs" ADD CONSTRAINT "evidence_refs_thread_id_research_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."research_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_refs" ADD CONSTRAINT "evidence_refs_comment_id_research_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."research_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_refs" ADD CONSTRAINT "evidence_refs_observation_id_learning_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."learning_observations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_refs" ADD CONSTRAINT "evidence_refs_ai_run_id_ai_runs_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_observations" ADD CONSTRAINT "learning_observations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_observations" ADD CONSTRAINT "learning_observations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_observations" ADD CONSTRAINT "learning_observations_snapshot_id_learning_route_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."learning_route_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_observations" ADD CONSTRAINT "learning_observations_object_key_content_object_refs_object_key_fk" FOREIGN KEY ("object_key") REFERENCES "public"."content_object_refs"("object_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_route_snapshots" ADD CONSTRAINT "learning_route_snapshots_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_route_snapshots" ADD CONSTRAINT "learning_route_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_route_snapshots" ADD CONSTRAINT "learning_route_snapshots_route_object_key_content_object_refs_object_key_fk" FOREIGN KEY ("route_object_key") REFERENCES "public"."content_object_refs"("object_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_route_snapshots" ADD CONSTRAINT "learning_route_snapshots_current_object_key_content_object_refs_object_key_fk" FOREIGN KEY ("current_object_key") REFERENCES "public"."content_object_refs"("object_key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_comments" ADD CONSTRAINT "research_comments_thread_id_research_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."research_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_comments" ADD CONSTRAINT "research_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_comments" ADD CONSTRAINT "research_comments_parent_comment_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."research_comments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_notes" ADD CONSTRAINT "research_notes_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_notes" ADD CONSTRAINT "research_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_notes" ADD CONSTRAINT "research_notes_object_key_content_object_refs_object_key_fk" FOREIGN KEY ("object_key") REFERENCES "public"."content_object_refs"("object_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_threads" ADD CONSTRAINT "research_threads_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_threads" ADD CONSTRAINT "research_threads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_threads" ADD CONSTRAINT "research_threads_object_key_content_object_refs_object_key_fk" FOREIGN KEY ("object_key") REFERENCES "public"."content_object_refs"("object_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_documents" ADD CONSTRAINT "uploaded_documents_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_documents" ADD CONSTRAINT "uploaded_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_documents" ADD CONSTRAINT "uploaded_documents_object_key_content_object_refs_object_key_fk" FOREIGN KEY ("object_key") REFERENCES "public"."content_object_refs"("object_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_runs_owner_created_idx" ON "ai_runs" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_runs_object_created_idx" ON "ai_runs" USING btree ("object_key","created_at");--> statement-breakpoint
CREATE INDEX "ai_runs_status_idx" ON "ai_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "content_object_refs_object_type_idx" ON "content_object_refs" USING btree ("object_type");--> statement-breakpoint
CREATE INDEX "content_object_refs_domain_concept_idx" ON "content_object_refs" USING btree ("domain","concept_id");--> statement-breakpoint
CREATE INDEX "content_object_refs_retired_at_idx" ON "content_object_refs" USING btree ("retired_at");--> statement-breakpoint
CREATE INDEX "document_spans_document_idx" ON "document_spans" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_spans_object_idx" ON "document_spans" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "document_spans_page_idx" ON "document_spans" USING btree ("page_number");--> statement-breakpoint
CREATE INDEX "evidence_refs_object_idx" ON "evidence_refs" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "evidence_refs_source_object_idx" ON "evidence_refs" USING btree ("source_object_key");--> statement-breakpoint
CREATE INDEX "evidence_refs_source_span_idx" ON "evidence_refs" USING btree ("source_span_key");--> statement-breakpoint
CREATE INDEX "evidence_refs_note_idx" ON "evidence_refs" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "evidence_refs_thread_idx" ON "evidence_refs" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "evidence_refs_comment_idx" ON "evidence_refs" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "evidence_refs_observation_idx" ON "evidence_refs" USING btree ("observation_id");--> statement-breakpoint
CREATE INDEX "evidence_refs_ai_run_idx" ON "evidence_refs" USING btree ("ai_run_id");--> statement-breakpoint
CREATE INDEX "learning_observations_owner_created_idx" ON "learning_observations" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX "learning_observations_object_created_idx" ON "learning_observations" USING btree ("object_key","created_at");--> statement-breakpoint
CREATE INDEX "learning_observations_snapshot_idx" ON "learning_observations" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "learning_route_snapshots_owner_updated_idx" ON "learning_route_snapshots" USING btree ("owner_user_id","updated_at");--> statement-breakpoint
CREATE INDEX "learning_route_snapshots_org_updated_idx" ON "learning_route_snapshots" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX "learning_route_snapshots_route_object_idx" ON "learning_route_snapshots" USING btree ("route_object_key");--> statement-breakpoint
CREATE INDEX "learning_route_snapshots_current_object_idx" ON "learning_route_snapshots" USING btree ("current_object_key");--> statement-breakpoint
CREATE INDEX "learning_route_snapshots_source_idx" ON "learning_route_snapshots" USING btree ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_organization_unique" ON "memberships" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "memberships_organization_role_idx" ON "memberships" USING btree ("organization_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_clerk_org_id_unique" ON "organizations" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "organizations_deleted_at_idx" ON "organizations" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "research_comments_thread_created_idx" ON "research_comments" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "research_comments_author_created_idx" ON "research_comments" USING btree ("author_user_id","created_at");--> statement-breakpoint
CREATE INDEX "research_notes_owner_updated_idx" ON "research_notes" USING btree ("owner_user_id","updated_at");--> statement-breakpoint
CREATE INDEX "research_notes_org_updated_idx" ON "research_notes" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX "research_notes_object_updated_idx" ON "research_notes" USING btree ("object_key","updated_at");--> statement-breakpoint
CREATE INDEX "research_threads_object_updated_idx" ON "research_threads" USING btree ("object_key","updated_at");--> statement-breakpoint
CREATE INDEX "research_threads_created_by_updated_idx" ON "research_threads" USING btree ("created_by_user_id","updated_at");--> statement-breakpoint
CREATE INDEX "research_threads_org_updated_idx" ON "research_threads" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX "research_threads_status_idx" ON "research_threads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "uploaded_documents_owner_created_idx" ON "uploaded_documents" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX "uploaded_documents_org_created_idx" ON "uploaded_documents" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "uploaded_documents_object_idx" ON "uploaded_documents" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "uploaded_documents_sha256_idx" ON "uploaded_documents" USING btree ("sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_unique" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "users_deleted_at_idx" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_unique" ON "webhook_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "webhook_events_processed_at_idx" ON "webhook_events" USING btree ("processed_at");

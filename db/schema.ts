import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { contentObjectTypes, type ContentObjectKey } from '../lib/contentObjectKeys'
import type { ContentObjectManifestObject } from '../lib/contentObjectManifest'
import type { LearningRouteSnapshot, LearningRouteSourceObject } from '../lib/learningRouteSnapshot'
import {
  aiRunStatuses,
  contentObjectOrigins,
  membershipRoles,
  threadStatuses,
  visibilityModes,
  type AiRunStatus,
  type ContentObjectOrigin,
  type MembershipRole,
  type ThreadStatus,
  type VisibilityMode,
} from './objectMemoryTypes'

export const contentObjectTypeEnum = pgEnum('content_object_type', contentObjectTypes)
export const contentObjectOriginEnum = pgEnum('content_object_origin', contentObjectOrigins)
export const visibilityEnum = pgEnum('visibility', visibilityModes)
export const membershipRoleEnum = pgEnum('membership_role', membershipRoles)
export const threadStatusEnum = pgEnum('thread_status', threadStatuses)
export const aiRunStatusEnum = pgEnum('ai_run_status', aiRunStatuses)

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}

const optionalSoftDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}

const ownedVisibilityColumns = {
  ownerUserId: uuid('owner_user_id').notNull(),
  organizationId: uuid('organization_id'),
  visibility: visibilityEnum('visibility').$type<VisibilityMode>().default('private').notNull(),
}

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clerkUserId: text('clerk_user_id'),
    primaryEmail: text('primary_email'),
    displayName: text('display_name'),
    imageUrl: text('image_url'),
    ...timestamps,
    ...optionalSoftDelete,
  },
  (table) => [
    uniqueIndex('users_clerk_user_id_unique').on(table.clerkUserId),
    index('users_deleted_at_idx').on(table.deletedAt),
    check('users_clerk_user_id_not_empty', sql`${table.clerkUserId} is null or length(${table.clerkUserId}) between 1 and 200`),
  ]
)

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clerkOrgId: text('clerk_org_id'),
    name: text('name').notNull(),
    slug: text('slug'),
    ...timestamps,
    ...optionalSoftDelete,
  },
  (table) => [
    uniqueIndex('organizations_clerk_org_id_unique').on(table.clerkOrgId),
    index('organizations_deleted_at_idx').on(table.deletedAt),
    check('organizations_name_not_empty', sql`length(${table.name}) between 1 and 180`),
  ]
)

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    role: membershipRoleEnum('role').$type<MembershipRole>().notNull(),
    ...timestamps,
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('memberships_user_organization_unique').on(table.userId, table.organizationId),
    index('memberships_organization_role_idx').on(table.organizationId, table.role),
  ]
)

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: text('provider').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processingError: text('processing_error'),
  },
  (table) => [
    uniqueIndex('webhook_events_provider_event_unique').on(table.provider, table.providerEventId),
    index('webhook_events_processed_at_idx').on(table.processedAt),
    check('webhook_events_provider_not_empty', sql`length(${table.provider}) between 1 and 80`),
  ]
)

export const contentObjectRefs = pgTable(
  'content_object_refs',
  {
    objectKey: text('object_key').$type<ContentObjectKey>().primaryKey(),
    objectType: contentObjectTypeEnum('object_type').notNull(),
    origin: contentObjectOriginEnum('origin').$type<ContentObjectOrigin>().default('atlas-manifest').notNull(),
    title: text('title').notNull(),
    href: text('href'),
    domain: text('domain'),
    conceptId: text('concept_id'),
    status: text('status'),
    stability: text('stability').$type<ContentObjectManifestObject['stability']>(),
    manifestVersion: text('manifest_version'),
    keyVersion: text('key_version'),
    sourceIds: jsonb('source_ids').$type<readonly string[]>(),
    objectRefs: jsonb('object_refs').$type<readonly ContentObjectKey[]>(),
    discussionAnchorId: text('discussion_anchor_id'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
  },
  (table) => [
    index('content_object_refs_object_type_idx').on(table.objectType),
    index('content_object_refs_domain_concept_idx').on(table.domain, table.conceptId),
    index('content_object_refs_retired_at_idx').on(table.retiredAt),
    check('content_object_refs_key_shape', sql`${table.objectKey} ~ '^(concept|route|demo|equation|code|source|source-span|claim|misconception|paper):[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9-]*){0,5}(#[a-z0-9][a-z0-9-]*)?$' and ${table.objectKey} !~ '://' and split_part(${table.objectKey}, ':', 1) = ${table.objectType}::text`),
    check('content_object_refs_title_not_empty', sql`length(${table.title}) between 1 and 180`),
  ]
)

export const learningRouteSnapshots = pgTable(
  'learning_route_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: ownedVisibilityColumns.ownerUserId.references(() => users.id, { onDelete: 'cascade' }),
    organizationId: ownedVisibilityColumns.organizationId.references(() => organizations.id, { onDelete: 'set null' }),
    visibility: ownedVisibilityColumns.visibility,
    source: text('source').notNull(),
    mappingId: text('mapping_id').notNull(),
    paperTitle: text('paper_title').notNull(),
    inputKind: text('input_kind').notNull(),
    routeObjectKey: text('route_object_key').$type<ContentObjectKey>().notNull().references(() => contentObjectRefs.objectKey, { onDelete: 'restrict' }),
    currentObjectKey: text('current_object_key').$type<ContentObjectKey>().references(() => contentObjectRefs.objectKey, { onDelete: 'set null' }),
    currentQuestion: text('current_question'),
    routeConceptIds: jsonb('route_concept_ids').$type<readonly string[]>().notNull(),
    routeLabels: jsonb('route_labels').$type<readonly string[]>().notNull(),
    routeConcepts: jsonb('route_concepts').$type<LearningRouteSnapshot['routeConcepts']>(),
    sourceObjects: jsonb('source_objects').$type<readonly LearningRouteSourceObject[]>(),
    graphRoute: jsonb('graph_route').$type<LearningRouteSnapshot['graphRoute']>(),
    routeProgress: jsonb('route_progress').$type<LearningRouteSnapshot['routeProgress']>(),
    primaryEquation: jsonb('primary_equation').$type<LearningRouteSnapshot['primaryEquation']>(),
    snapshotJson: jsonb('snapshot_json').$type<LearningRouteSnapshot>().notNull(),
    ...timestamps,
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    index('learning_route_snapshots_owner_updated_idx').on(table.ownerUserId, table.updatedAt),
    index('learning_route_snapshots_org_updated_idx').on(table.organizationId, table.updatedAt),
    index('learning_route_snapshots_route_object_idx').on(table.routeObjectKey),
    index('learning_route_snapshots_current_object_idx').on(table.currentObjectKey),
    index('learning_route_snapshots_source_idx').on(table.source),
    check('learning_route_snapshots_owner_required', sql`${table.ownerUserId} is not null`),
    check('learning_route_snapshots_route_object_required', sql`${table.routeObjectKey} is not null`),
    check('learning_route_snapshots_route_object_shape', sql`${table.routeObjectKey} like 'route:%'`),
    check('learning_route_snapshots_visibility_org_required', sql`${table.visibility} = 'private' or ${table.organizationId} is not null`),
    check('learning_route_snapshots_snapshot_json_size', sql`octet_length(${table.snapshotJson}::text) <= 24000`),
    check('learning_route_snapshots_mapping_not_empty', sql`length(${table.mappingId}) between 1 and 80`),
  ]
)

export const learningObservations = pgTable(
  'learning_observations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    snapshotId: uuid('snapshot_id').references(() => learningRouteSnapshots.id, { onDelete: 'set null' }),
    objectKey: text('object_key').$type<ContentObjectKey>().notNull().references(() => contentObjectRefs.objectKey, { onDelete: 'restrict' }),
    observationSource: text('observation_source').notNull(),
    observationKind: text('observation_kind').notNull(),
    label: text('label').notNull(),
    value: text('value').notNull(),
    detail: text('detail'),
    nextQuestion: text('next_question'),
    measuredState: jsonb('measured_state').$type<Record<string, unknown>>(),
    ...timestamps,
    ...optionalSoftDelete,
  },
  (table) => [
    index('learning_observations_owner_created_idx').on(table.ownerUserId, table.createdAt),
    index('learning_observations_object_created_idx').on(table.objectKey, table.createdAt),
    index('learning_observations_snapshot_idx').on(table.snapshotId),
    check('learning_observations_object_required', sql`${table.objectKey} is not null`),
    check('learning_observations_measured_state_size', sql`${table.measuredState} is null or octet_length(${table.measuredState}::text) <= 8000`),
    check('learning_observations_label_not_empty', sql`length(${table.label}) between 1 and 120`),
  ]
)

export const researchNotes = pgTable(
  'research_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    visibility: visibilityEnum('visibility').$type<VisibilityMode>().default('private').notNull(),
    objectKey: text('object_key').$type<ContentObjectKey>().notNull().references(() => contentObjectRefs.objectKey, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    bodyFormat: text('body_format').default('markdown').notNull(),
    status: text('status').default('active').notNull(),
    ...timestamps,
    ...optionalSoftDelete,
  },
  (table) => [
    index('research_notes_owner_updated_idx').on(table.ownerUserId, table.updatedAt),
    index('research_notes_org_updated_idx').on(table.organizationId, table.updatedAt),
    index('research_notes_object_updated_idx').on(table.objectKey, table.updatedAt),
    check('research_notes_object_required', sql`${table.objectKey} is not null`),
    check('research_notes_visibility_org_required', sql`${table.visibility} = 'private' or ${table.organizationId} is not null`),
    check('research_notes_title_not_empty', sql`length(${table.title}) between 1 and 180`),
  ]
)

export const researchThreads = pgTable(
  'research_threads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    visibility: visibilityEnum('visibility').$type<VisibilityMode>().default('private').notNull(),
    objectKey: text('object_key').$type<ContentObjectKey>().notNull().references(() => contentObjectRefs.objectKey, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    anchorQuestion: text('anchor_question').notNull(),
    status: threadStatusEnum('status').$type<ThreadStatus>().default('open').notNull(),
    ...timestamps,
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    index('research_threads_object_updated_idx').on(table.objectKey, table.updatedAt),
    index('research_threads_created_by_updated_idx').on(table.createdByUserId, table.updatedAt),
    index('research_threads_org_updated_idx').on(table.organizationId, table.updatedAt),
    index('research_threads_status_idx').on(table.status),
    check('research_threads_object_required', sql`${table.objectKey} is not null`),
    check('research_threads_visibility_org_required', sql`${table.visibility} = 'private' or ${table.organizationId} is not null`),
    check('research_threads_title_not_empty', sql`length(${table.title}) between 1 and 180`),
  ]
)

export const researchComments = pgTable(
  'research_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    threadId: uuid('thread_id').notNull().references(() => researchThreads.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    parentCommentId: uuid('parent_comment_id'),
    body: text('body').notNull(),
    bodyFormat: text('body_format').default('markdown').notNull(),
    ...timestamps,
    ...optionalSoftDelete,
  },
  (table) => [
    index('research_comments_thread_created_idx').on(table.threadId, table.createdAt),
    index('research_comments_author_created_idx').on(table.authorUserId, table.createdAt),
    foreignKey({
      columns: [table.parentCommentId],
      foreignColumns: [table.id],
      name: 'research_comments_parent_comment_id_fk',
    }).onDelete('set null'),
    check('research_comments_body_not_empty', sql`length(${table.body}) between 1 and 12000`),
  ]
)

export const aiRuns = pgTable(
  'ai_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    objectKey: text('object_key').$type<ContentObjectKey>().notNull().references(() => contentObjectRefs.objectKey, { onDelete: 'restrict' }),
    snapshotId: uuid('snapshot_id').references(() => learningRouteSnapshots.id, { onDelete: 'set null' }),
    threadId: uuid('thread_id').references(() => researchThreads.id, { onDelete: 'set null' }),
    noteId: uuid('note_id').references(() => researchNotes.id, { onDelete: 'set null' }),
    purpose: text('purpose').notNull(),
    status: aiRunStatusEnum('status').$type<AiRunStatus>().default('queued').notNull(),
    provider: text('provider'),
    model: text('model'),
    promptSummary: text('prompt_summary'),
    outputSummary: text('output_summary'),
    inputObjectKeys: jsonb('input_object_keys').$type<readonly ContentObjectKey[]>(),
    sourceObjectKeys: jsonb('source_object_keys').$type<readonly ContentObjectKey[]>(),
    tokenCounts: jsonb('token_counts').$type<Record<string, number>>(),
    errorCode: text('error_code'),
    errorSummary: text('error_summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('ai_runs_owner_created_idx').on(table.ownerUserId, table.createdAt),
    index('ai_runs_object_created_idx').on(table.objectKey, table.createdAt),
    index('ai_runs_status_idx').on(table.status),
    check('ai_runs_object_required', sql`${table.objectKey} is not null`),
    check('ai_runs_purpose_not_empty', sql`length(${table.purpose}) between 1 and 120`),
  ]
)

export const evidenceRefs = pgTable(
  'evidence_refs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    objectKey: text('object_key').$type<ContentObjectKey>().notNull().references(() => contentObjectRefs.objectKey, { onDelete: 'restrict' }),
    sourceObjectKey: text('source_object_key').$type<ContentObjectKey>().references(() => contentObjectRefs.objectKey, { onDelete: 'set null' }),
    sourceSpanKey: text('source_span_key').$type<ContentObjectKey>().references(() => contentObjectRefs.objectKey, { onDelete: 'set null' }),
    noteId: uuid('note_id').references(() => researchNotes.id, { onDelete: 'cascade' }),
    threadId: uuid('thread_id').references(() => researchThreads.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id').references(() => researchComments.id, { onDelete: 'cascade' }),
    observationId: uuid('observation_id').references(() => learningObservations.id, { onDelete: 'cascade' }),
    aiRunId: uuid('ai_run_id').references(() => aiRuns.id, { onDelete: 'cascade' }),
    claimText: text('claim_text'),
    quoteSnippet: text('quote_snippet'),
    locator: jsonb('locator').$type<Record<string, unknown>>(),
    confidence: text('confidence'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('evidence_refs_object_idx').on(table.objectKey),
    index('evidence_refs_source_object_idx').on(table.sourceObjectKey),
    index('evidence_refs_source_span_idx').on(table.sourceSpanKey),
    index('evidence_refs_note_idx').on(table.noteId),
    index('evidence_refs_thread_idx').on(table.threadId),
    index('evidence_refs_comment_idx').on(table.commentId),
    index('evidence_refs_observation_idx').on(table.observationId),
    index('evidence_refs_ai_run_idx').on(table.aiRunId),
    check('evidence_refs_object_required', sql`${table.objectKey} is not null`),
    check('evidence_refs_source_object_shape', sql`${table.sourceObjectKey} is null or ${table.sourceObjectKey} like 'source:%'`),
    check('evidence_refs_source_span_shape', sql`${table.sourceSpanKey} is null or ${table.sourceSpanKey} like 'source-span:%'`),
    check('evidence_refs_locator_size', sql`${table.locator} is null or octet_length(${table.locator}::text) <= 8000`),
  ]
)

export const uploadedDocuments = pgTable(
  'uploaded_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    visibility: visibilityEnum('visibility').$type<VisibilityMode>().default('private').notNull(),
    objectKey: text('object_key').$type<ContentObjectKey>().notNull().references(() => contentObjectRefs.objectKey, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    sourceKind: text('source_kind').notNull(),
    originalFilename: text('original_filename'),
    storageUri: text('storage_uri'),
    mimeType: text('mime_type'),
    byteSize: bigint('byte_size', { mode: 'number' }),
    sha256: text('sha256').notNull(),
    parserVersion: text('parser_version'),
    parserStatus: text('parser_status'),
    sourceProcessingConsentAt: timestamp('source_processing_consent_at', { withTimezone: true }),
    ...timestamps,
    ...optionalSoftDelete,
  },
  (table) => [
    index('uploaded_documents_owner_created_idx').on(table.ownerUserId, table.createdAt),
    index('uploaded_documents_org_created_idx').on(table.organizationId, table.createdAt),
    index('uploaded_documents_object_idx').on(table.objectKey),
    index('uploaded_documents_sha256_idx').on(table.sha256),
    check('uploaded_documents_object_required', sql`${table.objectKey} is not null`),
    check('uploaded_documents_object_shape', sql`${table.objectKey} like 'paper:%'`),
    check('uploaded_documents_visibility_org_required', sql`${table.visibility} = 'private' or ${table.organizationId} is not null`),
    check('uploaded_documents_title_not_empty', sql`length(${table.title}) between 1 and 220`),
    check('uploaded_documents_sha256_shape', sql`${table.sha256} ~ '^[a-f0-9]{64}$'`),
  ]
)

export const documentSpans = pgTable(
  'document_spans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id').notNull().references(() => uploadedDocuments.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').$type<ContentObjectKey>().notNull().references(() => contentObjectRefs.objectKey, { onDelete: 'restrict' }),
    spanKind: text('span_kind').notNull(),
    pageNumber: integer('page_number'),
    lineStart: integer('line_start'),
    lineEnd: integer('line_end'),
    charStart: integer('char_start'),
    charEnd: integer('char_end'),
    bbox: jsonb('bbox').$type<Record<string, unknown>>(),
    textSha256: text('text_sha256'),
    extractionConfidence: numeric('extraction_confidence', { precision: 5, scale: 4 }),
    parserVersion: text('parser_version'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('document_spans_document_idx').on(table.documentId),
    index('document_spans_object_idx').on(table.objectKey),
    index('document_spans_page_idx').on(table.pageNumber),
    check('document_spans_object_required', sql`${table.objectKey} is not null`),
    check('document_spans_object_shape', sql`${table.objectKey} like 'source-span:%'`),
    check('document_spans_bbox_size', sql`${table.bbox} is null or octet_length(${table.bbox}::text) <= 8000`),
    check('document_spans_span_kind_not_empty', sql`length(${table.spanKind}) between 1 and 80`),
    check('document_spans_page_positive', sql`${table.pageNumber} is null or ${table.pageNumber} >= 1`),
    check('document_spans_line_order', sql`${table.lineStart} is null or ${table.lineEnd} is null or ${table.lineEnd} >= ${table.lineStart}`),
    check('document_spans_char_order', sql`${table.charStart} is null or ${table.charEnd} is null or ${table.charEnd} >= ${table.charStart}`),
  ]
)

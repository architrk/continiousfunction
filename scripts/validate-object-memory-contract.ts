/* eslint-disable @typescript-eslint/no-var-requires */

// Validation script for the repo-only object-memory database contract.
// Designed to run via: npm run validate:object-memory

;(() => {
  const fs = require('node:fs') as typeof import('node:fs')
  const path = require('node:path') as typeof import('node:path')

  type Severity = 'error' | 'warn'
  type Issue = {
    severity: Severity
    code: string
    message: string
    file?: string
  }

  const issues: Issue[] = []
  const quiet = process.argv.includes('--quiet')

  const error = (code: string, message: string, file?: string) => issues.push({ severity: 'error', code, message, file })
  const warn = (code: string, message: string, file?: string) => issues.push({ severity: 'warn', code, message, file })

  const requiredTables = [
    'users',
    'organizations',
    'memberships',
    'webhook_events',
    'content_object_refs',
    'learning_route_snapshots',
    'learning_observations',
    'research_notes',
    'research_threads',
    'research_comments',
    'ai_runs',
    'evidence_refs',
    'uploaded_documents',
    'document_spans',
  ]

  const objectAttachedTables = [
    'learning_observations',
    'research_notes',
    'research_threads',
    'ai_runs',
    'evidence_refs',
    'uploaded_documents',
    'document_spans',
  ]

  const ownerScopedTables = [
    'learning_route_snapshots',
    'learning_observations',
    'research_notes',
    'ai_runs',
    'uploaded_documents',
  ]

  const requiredFiles = [
    'db/schema.ts',
    'db/objectMemoryTypes.ts',
    'db/objectMemoryMappers.ts',
    'db/README.md',
    'drizzle.config.ts',
    'drizzle/0000_object_memory_contract.sql',
    'drizzle/meta/0000_snapshot.json',
    'drizzle/meta/_journal.json',
    'content/_generated/content-object-manifest.json',
  ]

  const exists = (filePath: string) => fs.existsSync(path.join(process.cwd(), filePath))
  const read = (filePath: string) => fs.readFileSync(path.join(process.cwd(), filePath), 'utf8')

  for (const file of requiredFiles) {
    if (!exists(file)) error('MISSING_FILE', `${file} is required for object-memory contract validation`, file)
  }

  if (issues.some((issue) => issue.severity === 'error')) finish()

  const migrationPath = 'drizzle/0000_object_memory_contract.sql'
  const schemaPath = 'db/schema.ts'
  const mapperPath = 'db/objectMemoryMappers.ts'
  const readmePath = 'db/README.md'
  const configPath = 'drizzle.config.ts'

  const migration = read(migrationPath)
  const schema = read(schemaPath)
  const mapper = read(mapperPath)
  const readme = read(readmePath)
  const config = read(configPath)
  const packageJson = JSON.parse(read('package.json'))
  const manifest = JSON.parse(read('content/_generated/content-object-manifest.json'))

  if (!migration.includes('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')) {
    error('UUID_EXTENSION_UNDOCUMENTED', 'migration should make gen_random_uuid() executable with pgcrypto', migrationPath)
  }

  for (const table of requiredTables) {
    if (!migration.includes(`CREATE TABLE "${table}"`)) {
      error('MISSING_TABLE', `migration is missing ${table}`, migrationPath)
    }
  }

  for (const table of objectAttachedTables) {
    const block = tableBlock(migration, table)
    if (!block.includes('"object_key"')) {
      error('MISSING_OBJECT_KEY', `${table} must attach to content_object_refs by object_key`, migrationPath)
    }
  }

  for (const table of ownerScopedTables) {
    const block = tableBlock(migration, table)
    if (!block.includes('"owner_user_id" uuid NOT NULL')) {
      error('MISSING_OWNER', `${table} must use app-owned owner_user_id`, migrationPath)
    }
  }

  for (const expected of [
    'CREATE UNIQUE INDEX "users_clerk_user_id_unique"',
    'CREATE UNIQUE INDEX "organizations_clerk_org_id_unique"',
    'CREATE UNIQUE INDEX "memberships_user_organization_unique"',
    'CREATE UNIQUE INDEX "webhook_events_provider_event_unique"',
    '"object_key" text PRIMARY KEY NOT NULL',
    '"route_object_key" text NOT NULL',
    '"object_key" text NOT NULL',
    '"content_object_refs_key_shape" CHECK',
    "object_key\" !~ '://'",
    'split_part("content_object_refs"."object_key", \':\', 1) = "content_object_refs"."object_type"::text',
    'learning_route_snapshots_visibility_org_required',
    'learning_route_snapshots_route_object_shape',
    'research_notes_visibility_org_required',
    'research_threads_visibility_org_required',
    'uploaded_documents_visibility_org_required',
    'uploaded_documents_object_shape',
    'document_spans_object_shape',
    'evidence_refs_source_object_shape',
    'evidence_refs_source_span_shape',
    'learning_route_snapshots_snapshot_json_size',
    'learning_observations_measured_state_size',
    'evidence_refs_locator_size',
    'document_spans_bbox_size',
    'CREATE INDEX "learning_route_snapshots_current_object_idx"',
    'CREATE INDEX "learning_route_snapshots_route_object_idx"',
    'CREATE INDEX "learning_observations_object_created_idx"',
    'CREATE INDEX "research_notes_object_updated_idx"',
    'CREATE INDEX "research_threads_object_updated_idx"',
    'CREATE INDEX "evidence_refs_source_span_idx"',
    'CREATE INDEX "document_spans_object_idx"',
  ]) {
    if (!migration.includes(expected)) {
      error('MISSING_INDEX_OR_CONSTRAINT', `migration must include ${expected}`, migrationPath)
    }
  }

  for (const forbidden of ['DATABASE_URL', 'NEXT_PUBLIC_DATABASE_URL', 'process.env', '{{', '${']) {
    if (migration.includes(forbidden)) {
      error('ENV_DEPENDENT_MIGRATION', `migration must not contain ${forbidden}`, migrationPath)
    }
  }

  if (!config.includes("schema: './db/schema.ts'") || !config.includes("out: './drizzle'") || !config.includes("dialect: 'postgresql'")) {
    error('DRIZZLE_CONFIG_SHAPE', 'drizzle.config.ts must point at db/schema.ts, drizzle/, and postgresql', configPath)
  }
  if (/DATABASE_URL|process\.env/.test(config)) {
    error('DRIZZLE_CONFIG_ENV_IMPORT', 'drizzle.config.ts must not require DATABASE_URL for schema generation', configPath)
  }

  if (!schema.includes('content_object_refs') || !schema.includes('learning_route_snapshots') || !schema.includes('jsonb')) {
    error('SCHEMA_INCOMPLETE', 'db/schema.ts must define the object refs, route snapshots, and compact JSONB fields', schemaPath)
  }
  if (/NEXT_PUBLIC_DATABASE_URL|CLERK_SECRET_KEY|ClerkProvider|@clerk/.test(schema + mapper)) {
    error('RUNTIME_SURFACE_LEAK', 'db contract files must not import Clerk or browser-visible database values', schemaPath)
  }

  if (!packageJson.scripts?.['db:generate']?.includes('drizzle-kit generate --config=drizzle.config.ts')) {
    error('DB_GENERATE_SCRIPT', 'package.json must expose db:generate through drizzle-kit and drizzle.config.ts', 'package.json')
  }
  if (packageJson.scripts?.['validate:object-memory'] !== 'ts-node --transpileOnly scripts/validate-object-memory-contract.ts') {
    error('VALIDATE_SCRIPT', 'package.json must expose validate:object-memory', 'package.json')
  }

  for (const forbiddenPath of [
    'middleware.ts',
    'middleware.js',
    'app/api',
    'pages/sign-in',
    'pages/sign-up',
    'pages/me',
    'pages/profile',
  ]) {
    if (exists(forbiddenPath)) {
      error('PREMATURE_RUNTIME_SURFACE', `${forbiddenPath} must not be added in the schema-only object-memory slice`, forbiddenPath)
    }
  }

  validateContractOnlyApiRoutes()

  const manifestIssues = validateManifestSeedability(manifest)
  for (const message of manifestIssues) {
    error('MANIFEST_SEEDABILITY', message, 'content/_generated/content-object-manifest.json')
  }

  const sampleRouteIssues = validateSampleRouteSnapshotMapping()
  for (const message of sampleRouteIssues) {
    error('ROUTE_SNAPSHOT_MAPPING', message, mapperPath)
  }

  for (const phrase of [
    'repo-owned',
    'Postgres stores',
    'object_key',
    'no database client',
    'DATABASE_URL_UNPOOLED',
  ]) {
    if (!readme.includes(phrase)) {
      warn('README_CONTRACT_DETAIL', `db/README.md should mention ${phrase}`, readmePath)
    }
  }

  finish()

  function tableBlock(sql: string, table: string) {
    const start = sql.indexOf(`CREATE TABLE "${table}"`)
    if (start < 0) return ''
    const rest = sql.slice(start)
    const end = rest.indexOf(');')
    return end >= 0 ? rest.slice(0, end) : rest
  }

  function validateContractOnlyApiRoutes() {
    const apiRoot = path.join(process.cwd(), 'pages/api')
    if (!fs.existsSync(apiRoot)) return

    const allowedApiRoutes = new Set([
      'pages/api/me/learning-route-snapshots.ts',
      'pages/api/community/roadmap-suggestions.ts',
      'pages/api/learning/adaptive-loop.ts',
    ])
    const discovered = walkFiles(apiRoot)
      .map((filePath) => path.relative(process.cwd(), filePath).replace(/\\/g, '/'))
      .filter((filePath) => /\.(ts|tsx|js|jsx)$/.test(filePath))

    for (const filePath of discovered) {
      if (!allowedApiRoutes.has(filePath)) {
        error('PREMATURE_RUNTIME_SURFACE', `${filePath} is not part of the contract-only object-memory API allowance`, filePath)
      }
    }

    for (const routePath of allowedApiRoutes) {
      if (!exists(routePath)) {
        error('CONTRACT_ONLY_API_ROUTE', `${routePath} must exist when pages/api is present`, routePath)
        continue
      }

      const routeSource = read(routePath)
      if (!routeSource.includes('persisted: false') || !routeSource.includes("serverMode: 'contract-only'")) {
        error('CONTRACT_ONLY_API_ROUTE', `${routePath} must remain contract-only and non-persistent`, routePath)
      }
      if (/drizzle\(|DATABASE_URL|CLERK_SECRET_KEY|@clerk/.test(routeSource)) {
        error('CONTRACT_ONLY_API_ROUTE', `${routePath} must not directly wire Clerk, DATABASE_URL, or a Drizzle client yet`, routePath)
      }
    }
  }

  function walkFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    return entries.flatMap((entry) => {
      const entryPath = path.join(dir, entry.name)
      return entry.isDirectory() ? walkFiles(entryPath) : [entryPath]
    })
  }

  function validateManifestSeedability(value: any) {
    const messages: string[] = []
    const validTypes = new Set([
      'concept',
      'route',
      'demo',
      'equation',
      'code',
      'source',
      'source-span',
      'claim',
      'misconception',
      'paper',
    ])

    if (!value || typeof value !== 'object' || !Array.isArray(value.objects)) {
      return ['manifest must contain an objects array']
    }
    if (value.version !== 'cf-content-object-manifest-v1') messages.push('manifest version must match cf-content-object-manifest-v1')
    if (value.keyVersion !== 'cf-content-object-key-v1') messages.push('manifest keyVersion must match cf-content-object-key-v1')

    const seen = new Set<string>()
    for (const [index, object] of value.objects.entries()) {
      if (!object || typeof object !== 'object') {
        messages.push(`objects[${index}] must be an object`)
        continue
      }
      if (typeof object.key !== 'string' || !contentObjectKeyType(object.key, validTypes)) {
        messages.push(`objects[${index}].key is not seedable`)
        continue
      }
      if (seen.has(object.key)) messages.push(`duplicate object key ${object.key}`)
      seen.add(object.key)

      const type = object.key.slice(0, object.key.indexOf(':'))
      if (object.type !== type) messages.push(`objects[${index}] type ${object.type} does not match key ${object.key}`)
      if (typeof object.title !== 'string' || object.title.length === 0 || object.title.length > 180) {
        messages.push(`objects[${index}] title must be a bounded seed title`)
      }
      if (object.href && typeof object.href === 'string' && !object.href.startsWith('/') && !object.href.startsWith('#')) {
        messages.push(`objects[${index}] href must remain an internal snapshot, not identity`)
      }
      if (Array.isArray(object.objectRefs)) {
        for (const ref of object.objectRefs) {
          if (typeof ref !== 'string' || !contentObjectKeyType(ref, validTypes)) {
            messages.push(`objects[${index}] objectRefs must be content object keys`)
          }
        }
      }
    }

    return messages
  }

  function contentObjectKeyType(value: string, validTypes: Set<string>) {
    const separator = value.indexOf(':')
    if (separator <= 0) return false
    const type = value.slice(0, separator)
    if (!validTypes.has(type)) return false
    if (value.length > 260 || /[\u0000-\u001F\u007F\\\s]/.test(value)) return false
    return /^[a-z0-9-]+:[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*){0,5}(?:#[a-z0-9][a-z0-9-]*)?$/.test(value)
  }

  function validateSampleRouteSnapshotMapping() {
    const messages: string[] = []
    const ownerUserId = '11111111-1111-4111-8111-111111111111'
    const currentObjectKey = 'concept:optimization/adam'
    const routeObjectKey = 'route:domains/optimization/adam'
    const sample = {
      version: 'cf-route-snapshot-v1',
      source: 'concept-notebook',
      paperTitle: 'Adam optimizer notebook',
      inputKind: 'concept',
      mappingId: 'adam-notebook-route',
      routeLabels: ['Adam'],
      routeConceptIds: ['adam'],
      currentQuestion: 'Which moment correction changes the early update?',
      currentObject: {
        type: 'concept',
        objectKey: currentObjectKey,
        title: 'Adam',
        href: '/domains/optimization/adam',
      },
      lastObservation: {
        label: 'Prediction',
        value: 'Bias correction changes early steps',
        source: 'prediction-checkpoint',
        updatedAt: '2026-05-06T00:00:00.000Z',
      },
      createdAt: '2026-05-06T00:00:00.000Z',
    }

    if (!ownerUserId || !currentObjectKey || JSON.stringify(sample).length > 24000) {
      messages.push('sample route snapshot must be compact and owner-scoped')
    }
    if (!contentObjectKeyType(routeObjectKey, new Set(['route']))) {
      messages.push('sample route snapshot must derive a valid route_object_key')
    }
    if (sample.currentObject.objectKey !== currentObjectKey) {
      messages.push('sample route snapshot must map currentObject.objectKey instead of href')
    }
    if (!sample.lastObservation || !sample.lastObservation.source || !sample.lastObservation.value) {
      messages.push('sample route snapshot must expose a measured observation candidate')
    }

    return messages
  }

  function finish(): never {
    const errors = issues.filter((issue) => issue.severity === 'error')
    const warnings = issues.filter((issue) => issue.severity === 'warn')

    if (!quiet) {
      for (const issue of issues) {
        const prefix = issue.severity === 'error' ? 'FAIL' : 'WARN'
        const file = issue.file ? ` ${issue.file}` : ''
        console[issue.severity === 'error' ? 'error' : 'warn'](`[object-memory] ${prefix} ${issue.code}${file}: ${issue.message}`)
      }
    }

    if (errors.length > 0) {
      console.error(`\n[object-memory] ${errors.length} blocking issue(s), ${warnings.length} warning(s).`)
      process.exit(1)
    }

    console.log(`[object-memory] Contract ready. ${warnings.length} warning(s).`)
    process.exit(0)
  }
})()

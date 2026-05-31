const fs = require('fs')
const { execFileSync } = require('child_process')

const REQUIRED_FILES = [
  'DEPLOYMENT_GUIDE.md',
  'content/_agent/DEPLOYMENT_HANDOFF.md',
  'content/_agent/PLATFORM_FOUNDATION.md',
  '.env.example',
  'vercel.json',
  'next.config.mjs',
  'package.json',
]

const REQUIRED_ENV_KEYS = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SECRET',
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'OPENAI_API_KEY',
]

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'))
}

function readText(path) {
  return fs.readFileSync(path, 'utf8')
}

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

function createReporter() {
  const warnings = []
  const failures = []

  return {
    pass(message) {
      console.log(`[deploy-readiness] OK ${message}`)
    },
    warn(message) {
      warnings.push(message)
      console.warn(`[deploy-readiness] WARN ${message}`)
    },
    fail(message) {
      failures.push(message)
      console.error(`[deploy-readiness] FAIL ${message}`)
    },
    finish() {
      if (failures.length > 0) {
        console.error(`\n[deploy-readiness] ${failures.length} blocking issue(s), ${warnings.length} warning(s).`)
        process.exit(1)
      }

      console.log(`\n[deploy-readiness] Ready for first Vercel import. ${warnings.length} warning(s).`)
    },
  }
}

function requireIncludes(reporter, label, value, expected) {
  if (value.includes(expected)) {
    reporter.pass(`${label} includes ${expected}`)
  } else {
    reporter.fail(`${label} must include ${expected}`)
  }
}

function main() {
  const reporter = createReporter()

  for (const file of REQUIRED_FILES) {
    if (fs.existsSync(file)) {
      reporter.pass(`${file} exists`)
    } else {
      reporter.fail(`${file} is missing`)
    }
  }

  const packageJson = readJson('package.json')
  const vercelJson = readJson('vercel.json')
  const envExample = readText('.env.example')
  const nextConfig = readText('next.config.mjs')
  const deploymentGuide = readText('DEPLOYMENT_GUIDE.md')
  const deploymentHandoff = readText('content/_agent/DEPLOYMENT_HANDOFF.md')
  const platformFoundation = readText('content/_agent/PLATFORM_FOUNDATION.md')

  if (packageJson.private === true) {
    reporter.pass('package.json marks the project private')
  } else {
    reporter.fail('package.json must keep "private": true')
  }

  const packageRepoUrl = packageJson.repository?.url ?? ''
  requireIncludes(reporter, 'package.json repository.url', packageRepoUrl, 'continiousfunction-private')
  requireIncludes(reporter, 'package.json bugs.url', packageJson.bugs?.url ?? '', 'continiousfunction-private')
  requireIncludes(reporter, 'package.json homepage', packageJson.homepage ?? '', 'continiousfunction-private')

  if (packageJson.scripts?.build === 'next build') {
    reporter.pass('package build script is normal Next build')
  } else {
    reporter.fail('package build script must be "next build" for Vercel')
  }

  if (packageJson.scripts?.['build:static']?.includes('CF_STATIC_EXPORT=1')) {
    reporter.pass('package build:static script gates static export behind CF_STATIC_EXPORT=1')
  } else {
    reporter.fail('package build:static must set CF_STATIC_EXPORT=1')
  }

  if (packageJson.scripts?.['verify:deployment-readiness'] === 'node scripts/verify-deployment-readiness.js && npm run validate:object-memory') {
    reporter.pass('package verify:deployment-readiness includes object-memory contract validation')
  } else {
    reporter.fail('package verify:deployment-readiness must run deployment and object-memory validation')
  }

  if (packageJson.scripts?.['validate:object-memory'] === 'ts-node --transpileOnly scripts/validate-object-memory-contract.ts') {
    reporter.pass('package validate:object-memory script is registered')
  } else {
    reporter.fail('package validate:object-memory script is missing')
  }

  if (vercelJson.framework === 'nextjs') {
    reporter.pass('vercel.json framework is nextjs')
  } else {
    reporter.fail('vercel.json framework must be nextjs')
  }

  if (vercelJson.buildCommand === 'npm run build') {
    reporter.pass('vercel.json buildCommand is npm run build')
  } else {
    reporter.fail('vercel.json buildCommand must be npm run build')
  }

  const csp = vercelJson.headers?.[0]?.headers?.find((header) => header.key === 'Content-Security-Policy')?.value ?? ''
  for (const directive of ['default-src', 'object-src', 'frame-ancestors', 'connect-src', 'worker-src']) {
    requireIncludes(reporter, 'vercel.json CSP', csp, directive)
  }

  if (process.env.CF_STATIC_EXPORT) {
    reporter.fail('CF_STATIC_EXPORT is set in the current environment; Vercel production must leave it unset')
  } else {
    reporter.pass('CF_STATIC_EXPORT is not set in the current environment')
  }

  if (nextConfig.includes("process.env.CF_STATIC_EXPORT === '1'") && nextConfig.includes("output: isStaticExport ? 'export' : undefined")) {
    reporter.pass('next.config.mjs keeps static export opt-in only')
  } else {
    reporter.fail('next.config.mjs must keep static export behind CF_STATIC_EXPORT=1')
  }

  for (const key of REQUIRED_ENV_KEYS) {
    if (envExample.includes(`${key}=`)) {
      reporter.pass(`.env.example includes ${key}`)
    } else {
      reporter.fail(`.env.example is missing ${key}`)
    }
  }

  for (const doc of [
    ['DEPLOYMENT_GUIDE.md', deploymentGuide],
    ['content/_agent/DEPLOYMENT_HANDOFF.md', deploymentHandoff],
    ['content/_agent/PLATFORM_FOUNDATION.md', platformFoundation],
  ]) {
    requireIncludes(reporter, doc[0], doc[1], 'architrk/continiousfunction-private')
    requireIncludes(reporter, doc[0], doc[1], 'Vercel')
    requireIncludes(reporter, doc[0], doc[1], 'Clerk')
    requireIncludes(reporter, doc[0], doc[1], 'Neon')
  }

  const privateRemote = git(['remote', 'get-url', 'private-origin'])
  if (privateRemote.includes('continiousfunction-private')) {
    reporter.pass('private-origin points at continiousfunction-private')
  } else {
    reporter.fail('private-origin remote must point at continiousfunction-private')
  }

  const originRemote = git(['remote', 'get-url', 'origin'])
  if (originRemote && !originRemote.includes('continiousfunction-private')) {
    reporter.warn(`origin points at ${originRemote}; deploy from private-origin, not origin`)
  }

  const branch = git(['branch', '--show-current'])
  if (branch === 'private/research-learning-loop-20260505' || branch === 'main' || branch === 'staging') {
    reporter.pass(`current branch ${branch} is an expected deployment branch`)
  } else {
    reporter.warn(`current branch ${branch || '<unknown>'} is not one of the documented deployment branches`)
  }

  const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
  if (upstream.includes('private-origin/')) {
    reporter.pass(`upstream ${upstream} uses private-origin`)
  } else {
    reporter.warn(`upstream ${upstream || '<none>'} is not private-origin`)
  }

  const dirty = git(['status', '--short'])
  if (dirty) {
    reporter.warn('working tree has local changes; commit and push before using the exact branch for Vercel import')
  } else {
    reporter.pass('working tree is clean')
  }

  reporter.finish()
}

main()

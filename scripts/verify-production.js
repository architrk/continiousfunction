const DEFAULT_ROUTES = [
  { path: '/', label: 'homepage' },
  { path: '/pillars/optimization/', label: 'pillar route' },
  { path: '/foundations/adam/', label: 'legacy route' },
  { path: '/domains/linear-algebra/vector-spaces/', label: 'filesystem content route' },
]

const REQUIRED_HEADERS = [
  {
    name: 'content-security-policy',
    validate: (value) => Boolean(value && value.includes('default-src') && value.includes('object-src')),
    help: 'expected the deployed CSP from vercel.json or the active static-host header config, not only a host-level upgrade-insecure-requests policy',
  },
  {
    name: 'strict-transport-security',
    validate: (value) => Boolean(value && value.includes('max-age=')),
    help: 'missing HSTS',
  },
  {
    name: 'x-content-type-options',
    validate: (value) => value?.toLowerCase() === 'nosniff',
    help: 'missing nosniff protection',
  },
  {
    name: 'x-frame-options',
    validate: (value) => Boolean(value && ['sameorigin', 'deny'].includes(value.toLowerCase())),
    help: 'missing frame embedding protection',
  },
  {
    name: 'referrer-policy',
    validate: (value) => Boolean(value),
    help: 'missing referrer policy',
  },
  {
    name: 'permissions-policy',
    validate: (value) => Boolean(value),
    help: 'missing permissions policy',
  },
]

function usage() {
  console.error('Usage: npm run verify:production -- https://your-domain/')
  process.exit(1)
}

function normalizeBaseUrl(raw) {
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    usage()
  }

  parsed.hash = ''
  parsed.search = ''
  return parsed.toString().replace(/\/+$/, '')
}

function parseRoutes() {
  const raw = process.env.CF_VERIFY_PATHS?.trim()
  if (!raw) return DEFAULT_ROUTES

  return raw
    .split(',')
    .map((path) => path.trim())
    .filter(Boolean)
    .map((path) => ({
      path: path.startsWith('/') ? path : `/${path}`,
      label: path,
    }))
}

async function request(url) {
  const init = {
    method: 'HEAD',
    redirect: 'follow',
    headers: {
      'user-agent': 'continuousfunction-production-verifier/1.0',
      accept: 'text/html,*/*',
    },
  }

  const head = await fetch(url, init)
  if (head.status !== 405) return head

  return fetch(url, {
    ...init,
    method: 'GET',
  })
}

async function main() {
  const baseArg = process.argv[2] ?? process.env.CF_VERIFY_URL
  if (!baseArg) usage()

  const baseUrl = normalizeBaseUrl(baseArg)
  const routes = parseRoutes()

  console.log(`[verify] Checking deployment at ${baseUrl}`)

  let failed = false

  const root = await request(`${baseUrl}/`)
  console.log(`[verify] homepage status ${root.status}`)

  for (const check of REQUIRED_HEADERS) {
    const value = root.headers.get(check.name)
    const ok = check.validate(value)
    console.log(`[verify] header ${check.name}: ${value ?? '<missing>'}`)
    if (!ok) {
      failed = true
      console.error(`[verify] FAIL ${check.name}: ${check.help}`)
    }
  }

  for (const route of routes) {
    const url = new URL(route.path, `${baseUrl}/`).toString()
    const response = await request(url)
    const contentType = response.headers.get('content-type') ?? '<missing>'
    console.log(`[verify] route ${route.label}: ${response.status} ${url} (${contentType})`)

    if (!response.ok) {
      failed = true
      console.error(`[verify] FAIL ${route.label}: expected 200 OK`)
    }
  }

  if (failed) {
    console.error('\n[verify] Deployment verification failed.')
    console.error('[verify] Likely causes:')
    console.error('[verify] 1. The active deployment is stale or came from the wrong branch/repo.')
    console.error('[verify] 2. Vercel is not using the committed vercel.json headers.')
    console.error('[verify] 3. A static mirror is missing .htaccess, _next/, or domains/ in the web root.')
    console.error('[verify] Recommended next checks:')
    console.error('[verify] - Confirm the live deployment came from the private repo and intended branch.')
    console.error('[verify] - Confirm the production host is serving the latest commit.')
    console.error('[verify] - For a static mirror, verify the remote web root and .htaccess.')
    process.exit(1)
  }

  console.log('\n[verify] Deployment looks current and the hardened headers are present.')
}

main().catch((error) => {
  console.error('[verify] Unexpected error:', error)
  process.exit(1)
})

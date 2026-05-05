#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const failures = []

const toAbs = (rel) => path.join(root, rel)
const exists = (rel) => fs.existsSync(toAbs(rel))
const read = (rel) => fs.readFileSync(toAbs(rel), 'utf8')

const fail = (message, rel, detail) => {
  failures.push({ message, rel, detail })
}

const assertFileHas = (rel, needle, message) => {
  const source = read(rel)
  if (!source.includes(needle)) fail(message, rel, `Expected to find: ${needle}`)
}

const assertFileDoesNotMatch = (rel, pattern, message) => {
  const source = read(rel)
  const match = pattern.exec(source)
  if (match) fail(message, rel, `Matched: ${match[0]}`)
}

const walk = (dirRel, exts, out = []) => {
  const dir = toAbs(dirRel)
  if (!fs.existsSync(dir)) return out

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(dirRel, entry.name)
    if (entry.isDirectory()) {
      if (!['.git', '.next', 'node_modules', 'out', 'coverage'].includes(entry.name)) {
        walk(rel, exts, out)
      }
    } else if (exts.has(path.extname(entry.name))) {
      out.push(rel)
    }
  }

  return out
}

const allRepoFiles = () =>
  [
    ...walk('.', new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.yaml', '.yml', '.md', '.mdx', '.sh'])),
  ].filter((rel) => !rel.startsWith('package-lock.json'))

const deployFiles = [
  '.github/workflows/deploy-hostinger.yml',
  'DEPLOYMENT_GUIDE.md',
  'scripts/deploy-hostinger.sh',
  '.vscode/sftp.json.example',
].filter(exists)

for (const rel of deployFiles) {
  assertFileDoesNotMatch(rel, /\bftp:ssl-allow\s+no\b/i, 'Plain FTP TLS disabling is forbidden')
  assertFileDoesNotMatch(rel, /(^|[^a-z])ftp:\/\//i, 'Use ftps:// or sftp://, never plaintext ftp://')
  assertFileDoesNotMatch(rel, /\bprotocol\b\s*[:=]\s*["']?ftp(?=["'\s,}\n]|$)/i, 'Deployment protocol must not be plaintext ftp')
  assertFileDoesNotMatch(rel, /\bCF_FTP_ALLOW_INSECURE\b/i, 'Do not add an insecure FTP escape hatch')
}

assertFileHas(
  '.github/workflows/deploy-hostinger.yml',
  'protocol: ftps',
  'GitHub Actions deploy must explicitly require FTPS',
)
assertFileHas(
  '.github/workflows/deploy-hostinger.yml',
  "if: steps.deploy-config.outputs.configured == 'true'",
  'Deploy step must stay guarded by a secrets-present check',
)

for (const rel of walk('.github/workflows', new Set(['.yml', '.yaml']))) {
  const source = read(rel)
  const usesRe = /^\s*uses:\s+([^@\s]+)@([^\s#]+)/gm
  let match
  while ((match = usesRe.exec(source))) {
    const [, action, ref] = match
    if (!/^[a-f0-9]{40}$/i.test(ref)) {
      fail('GitHub Actions must be pinned to immutable commit SHAs', rel, `Found ${action}@${ref}`)
    }
  }
}

const domainRoute = 'pages/domains/[domain]/[slug].tsx'
assertFileHas(domainRoute, 'compileSafeMarkdownToHtml', 'Domain concept route must render content through the safe markdown pipeline')
assertFileDoesNotMatch(domainRoute, /@mdx-js\/mdx|@mdx-js\/react|providerImportSource/, 'Domain concept route must not compile or execute MDX directly')

const safeMdx = 'lib/safeMdx.ts'
assertFileHas(safeMdx, "format: 'md'", 'Content markdown must be compiled as inert markdown, not executable MDX')
assertFileHas(safeMdx, "import('rehype-sanitize')", 'Content markdown must use rehype-sanitize')
assertFileHas(safeMdx, 'sanitizeRenderedHtml', 'Content markdown must keep the residual HTML sanitizer')
assertFileDoesNotMatch(safeMdx, /providerImportSource/, 'Safe markdown pipeline must not enable MDX component execution')

const foundationsRoute = 'pages/foundations/[id].tsx'
assertFileHas(foundationsRoute, 'sanitizeRenderedHtml', 'Legacy foundations route must sanitize rendered KaTeX HTML')
assertFileHas(foundationsRoute, 'getSafeExternalHref', 'Legacy foundations route must filter external paper links')

const htaccess = 'public/.htaccess'
assertFileHas(htaccess, 'Strict-Transport-Security', 'Static deploy must send HSTS')
assertFileHas(htaccess, 'Content-Security-Policy', 'Static deploy must send a Content Security Policy')
assertFileHas(htaccess, "default-src 'self'", 'CSP must default to same-origin')
assertFileHas(htaccess, "object-src 'none'", 'CSP must block plugin/object content')
assertFileHas(htaccess, "frame-ancestors 'none'", 'CSP must block framing')
assertFileHas(htaccess, 'X-Content-Type-Options "nosniff"', 'Static deploy must prevent MIME sniffing')
assertFileHas(htaccess, 'X-Frame-Options "DENY"', 'Static deploy must deny legacy framing')
assertFileHas(htaccess, 'Referrer-Policy "strict-origin-when-cross-origin"', 'Static deploy must keep a strict referrer policy')
assertFileHas(htaccess, 'Permissions-Policy', 'Static deploy must restrict browser capabilities')

const productionSources = ['data', 'pages', 'components', 'content', 'lib']
  .flatMap((dir) => walk(dir, new Set(['.ts', '.tsx', '.js', '.jsx', '.mdx', '.yaml', '.yml'])))

for (const rel of productionSources) {
  assertFileDoesNotMatch(rel, /\burl\s*:\s*['"]http:\/\//i, 'Production content links should use HTTPS URLs')
}

for (const rel of [...productionSources, ...walk('pages', new Set(['.mdx'])), ...walk('components', new Set(['.mdx']))]) {
  const lines = read(rel).split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('target="_blank"') && !lines[i].includes("target='_blank'")) continue

    const nearby = lines.slice(i, Math.min(i + 6, lines.length)).join('\n')
    if (!/rel=["'][^"']*\bnoopener\b[^"']*\bnoreferrer\b[^"']*["']/.test(nearby)) {
      fail('External links opened in a new tab must include rel="noopener noreferrer"', rel, `Line ${i + 1}`)
    }
  }
}

const allowedDangerousHtmlFiles = new Set([domainRoute, foundationsRoute])
const sourceFiles = ['pages', 'components', 'lib'].flatMap((dir) => walk(dir, new Set(['.ts', '.tsx', '.js', '.jsx'])))
for (const rel of sourceFiles) {
  const source = read(rel)
  if (!source.includes('dangerouslySetInnerHTML')) continue

  if (!allowedDangerousHtmlFiles.has(rel)) {
    fail('New dangerouslySetInnerHTML call needs an explicit sanitizer review and allowlist entry', rel)
  }

  if (rel === domainRoute && !source.includes('compileSafeMarkdownToHtml')) {
    fail('Domain dangerouslySetInnerHTML must receive HTML from compileSafeMarkdownToHtml', rel)
  }

  if (rel === foundationsRoute && !source.includes('renderLatex')) {
    fail('Foundations dangerouslySetInnerHTML should stay limited to sanitized KaTeX rendering', rel)
  }
}

const secretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
]

for (const rel of allRepoFiles()) {
  const source = read(rel)
  for (const pattern of secretPatterns) {
    const match = pattern.exec(source)
    if (match) {
      fail('Potential committed secret detected', rel, `Matched: ${match[0].slice(0, 24)}...`)
    }
  }
}

if (failures.length > 0) {
  console.error('\nSecurity regression check failed:\n')
  for (const item of failures) {
    console.error(`- ${item.message}`)
    console.error(`  file: ${item.rel}`)
    if (item.detail) console.error(`  ${item.detail}`)
  }
  process.exit(1)
}

console.log('Security regression check passed.')

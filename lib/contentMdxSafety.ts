const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n?/
const FENCED_CODE_RE = /```[\s\S]*?```/g
const INLINE_CODE_RE = /`[^`\n]+`/g
const DISPLAY_MATH_RE = /\$\$[\s\S]*?\$\$/g
const INLINE_MATH_RE = /\$[^$\n]+\$/g
const VIZ_PLACEHOLDER_RE = /\{\s*\/\*\s*viz\.tsx component renders here if it exists\s*\*\/\s*\}/g
const HTML_OR_JSX_RE = /<\/?[A-Za-z][\w:-]*\b/
const IMPORT_EXPORT_RE = /^\s*(?:import|export)\s/m
const BRACE_EXPR_RE = /(^|[^\\])[{}]/
const HTML_COMMENT_RE = /<!--|-->/
const MARKDOWN_LINK_RE = /\[[^\]]*]\(([^)]+)\)/g

const allowedUrlTarget = (rawTarget: string): boolean => {
  const target = rawTarget.trim().split(/\s+/, 1)[0]?.replace(/^<|>$/g, '') ?? ''
  if (!target) return true
  if (target.startsWith('/')) return true
  if (target.startsWith('#')) return true
  if (target.startsWith('./')) return true
  if (target.startsWith('../')) return true

  const protocolMatch = /^([a-zA-Z][a-zA-Z\d+.-]*):/.exec(target)
  if (!protocolMatch) return false

  const protocol = protocolMatch[1].toLowerCase()
  return protocol === 'http' || protocol === 'https' || protocol === 'mailto'
}

const stripIgnoredSegments = (raw: string): string => {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(FRONTMATTER_RE, '')
    .replace(VIZ_PLACEHOLDER_RE, '')
    .replace(FENCED_CODE_RE, ' ')
    .replace(INLINE_CODE_RE, ' ')
    .replace(DISPLAY_MATH_RE, ' ')
    .replace(INLINE_MATH_RE, ' ')
}

export const sanitizeContentMdxSource = (raw: string): string => {
  return raw.replace(/\r\n/g, '\n').replace(VIZ_PLACEHOLDER_RE, '')
}

export const getContentMdxSafetyErrors = (raw: string): string[] => {
  const stripped = stripIgnoredSegments(raw)
  const errors: string[] = []

  if (IMPORT_EXPORT_RE.test(stripped)) {
    errors.push('import/export statements are not allowed in content.mdx')
  }

  if (HTML_OR_JSX_RE.test(stripped) || HTML_COMMENT_RE.test(stripped)) {
    errors.push('raw HTML/JSX is not allowed in content.mdx')
  }

  if (BRACE_EXPR_RE.test(stripped)) {
    errors.push('MDX expressions/comments are not allowed in content.mdx')
  }

  MARKDOWN_LINK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = MARKDOWN_LINK_RE.exec(stripped))) {
    if (!allowedUrlTarget(match[1])) {
      errors.push(`link target uses a disallowed protocol or relative form: ${match[1].trim()}`)
    }
  }

  return errors
}

export const assertSafeContentMdx = (raw: string, filePath?: string): void => {
  const errors = getContentMdxSafetyErrors(raw)
  if (errors.length === 0) return

  const prefix = filePath ? `Unsafe content.mdx syntax in ${filePath}` : 'Unsafe content.mdx syntax'
  throw new Error(`${prefix}: ${errors.join('; ')}`)
}

import sanitizeHtml from 'sanitize-html'

const unique = <T,>(values: T[]): T[] => Array.from(new Set(values))

const safeCssLength = /^-?(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:em|ex|px|rem|%)?)$/i
const safeCssColor =
  /^(?:#[0-9a-f]{3,8}|black|white|currentcolor|transparent|inherit|var\(--[a-z0-9_-]+\))$/i

const mathMlTags = [
  'math',
  'semantics',
  'mrow',
  'mi',
  'mn',
  'mo',
  'msup',
  'msub',
  'msubsup',
  'mfrac',
  'msqrt',
  'mroot',
  'mtext',
  'mspace',
  'mtable',
  'mtr',
  'mtd',
  'annotation',
]

export const sanitizeRenderedHtml = (html: string): string =>
  sanitizeHtml(html, {
    allowedTags: unique([...sanitizeHtml.defaults.allowedTags, ...mathMlTags]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'aria-hidden', 'aria-label', 'title'],
      a: ['href', 'name', 'target', 'rel', 'title'],
      annotation: ['encoding'],
      code: ['class'],
      div: ['class'],
      math: ['xmlns'],
      pre: ['class'],
      span: ['class', 'aria-hidden', 'style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
    allowProtocolRelative: false,
    allowedStyles: {
      '*': {
        color: [safeCssColor],
        'background-color': [safeCssColor],
      },
      span: {
        height: [safeCssLength],
        'margin-left': [safeCssLength],
        'margin-right': [safeCssLength],
        position: [/^relative$/i],
        top: [safeCssLength],
        'vertical-align': [safeCssLength],
      },
    },
    disallowedTagsMode: 'discard',
  })

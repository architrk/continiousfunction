import {
  buildConceptContentObjectKey,
  contentObjectKeyForConceptFragmentRef,
  isContentObjectKey,
  parseContentObjectKey,
} from './contentObjectKeys'

describe('content object keys', () => {
  it('accepts typed atlas object keys', () => {
    expect(isContentObjectKey('concept:attention-transformers/rope')).toBe(true)
    expect(isContentObjectKey('equation:attention-transformers/rope#math-object-1')).toBe(true)
    expect(isContentObjectKey('source-span:llm-systems/llm-serving#yu-2022-orca')).toBe(true)
    expect(isContentObjectKey('route:paths/attention-serving')).toBe(true)
  })

  it('rejects URLs, unsafe strings, unknown types, and empty fragments', () => {
    expect(isContentObjectKey('/domains/attention-transformers/rope/#math-object-1')).toBe(false)
    expect(isContentObjectKey('https://continuous-function.local/domains/attention-transformers/rope')).toBe(false)
    expect(isContentObjectKey('//continuous-function.local/domains/attention-transformers/rope')).toBe(false)
    expect(isContentObjectKey('concept:attention-transformers/RoPE')).toBe(false)
    expect(isContentObjectKey('concept:attention-transformers/ro pe')).toBe(false)
    expect(isContentObjectKey('concept:attention-transformers\\rope')).toBe(false)
    expect(isContentObjectKey('widget:attention-transformers/rope')).toBe(false)
    expect(isContentObjectKey('equation:attention-transformers/rope#')).toBe(false)
    expect(isContentObjectKey(`concept:attention-transformers/${'x'.repeat(260)}`)).toBe(false)
  })

  it('parses and builds concept-scoped object keys without treating href as identity', () => {
    expect(buildConceptContentObjectKey('demo', 'llm-systems', 'llm-serving', 'interactive-demo')).toBe(
      'demo:llm-systems/llm-serving#interactive-demo'
    )

    expect(parseContentObjectKey('source-span:llm-systems/llm-serving#yu-2022-orca')).toEqual({
      type: 'source-span',
      path: 'llm-systems/llm-serving',
      pathSegments: ['llm-systems', 'llm-serving'],
      fragment: 'yu-2022-orca',
    })
  })

  it('maps legacy concept fragment refs onto canonical content object keys', () => {
    expect(contentObjectKeyForConceptFragmentRef('attention-transformers', 'flash-attention', '#math-object-1')).toBe(
      'equation:attention-transformers/flash-attention#math-object-1'
    )
    expect(contentObjectKeyForConceptFragmentRef('attention-transformers', 'flash-attention', '#code-witness-1')).toBe(
      'code:attention-transformers/flash-attention#code-witness-1'
    )
    expect(contentObjectKeyForConceptFragmentRef('attention-transformers', 'flash-attention', '#interactive-demo')).toBe(
      'demo:attention-transformers/flash-attention#interactive-demo'
    )
    expect(
      contentObjectKeyForConceptFragmentRef(
        'attention-transformers',
        'flash-attention',
        '#source-span-dao-2022-flashattention'
      )
    ).toBe('source-span:attention-transformers/flash-attention#dao-2022-flashattention')

    expect(contentObjectKeyForConceptFragmentRef('attention-transformers', 'flash-attention', '#math-object-0')).toBeNull()
    expect(contentObjectKeyForConceptFragmentRef('attention-transformers', 'flash-attention', '#math-object-01')).toBeNull()
    expect(contentObjectKeyForConceptFragmentRef('attention-transformers', 'flash-attention', '#math-object-foo')).toBeNull()
    expect(contentObjectKeyForConceptFragmentRef('attention-transformers', 'flash-attention', '#code-witness-0')).toBeNull()
    expect(contentObjectKeyForConceptFragmentRef('attention-transformers', 'flash-attention', '#code-witness-01')).toBeNull()
  })
})

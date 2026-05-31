import type { ReactNode } from 'react'
import { conceptObjectSpanLabel, type ConceptObjectSpan } from '@/lib/conceptObjectSpans'
import { sanitizeRenderedHtml } from '@/lib/htmlSafety'

type Props = {
  id: string
  step: string
  title: string
  summary: string
  tone?: 'intuition' | 'math' | 'code' | 'demo'
  html?: string
  objectSpans?: ConceptObjectSpan[]
  objectReturnAction?: {
    href: string
    label: string
    detail: string
  }
  aiActions?: ReactNode
  children?: ReactNode
  emptyState?: ReactNode
}

export default function ConceptSection({
  id,
  step,
  title,
  summary,
  tone = 'intuition',
  html,
  objectSpans = [],
  objectReturnAction,
  aiActions,
  children,
  emptyState,
}: Props) {
  const hasHtml = Boolean(html?.trim())
  const hasChildren = Boolean(children)
  const isDemoSection = tone === 'demo'
  const safeHtml = hasHtml ? sanitizeRenderedHtml(html ?? '') : ''

  return (
    <section id={id} className={`concept-section ${tone}`}>
      <header className="section-header">
        <div className="section-step">{step}</div>
        <div className="section-copy">
          <p className="section-kicker">{step}</p>
          <h2>{title}</h2>
          <p className="section-summary">{summary}</p>
        </div>
      </header>

      {!isDemoSection && aiActions ? <div className="section-ai-actions">{aiActions}</div> : null}

      {objectSpans.length ? (
        <div className="object-span-index" aria-label={`${title} objects`}>
          {objectSpans.map((span) => (
            <a key={span.domId} id={span.domId} href={`#${span.domId}`}>
              <span>{conceptObjectSpanLabel(span)}</span>
              <strong>{span.kind === 'equation' ? 'Inspect equation object' : span.snippet}</strong>
              {span.kind === 'equation' ? (
                <em className="object-span-preview">{span.snippet}</em>
              ) : span.language ? (
                <em>{span.language}</em>
              ) : null}
            </a>
          ))}
          {objectReturnAction ? (
            <a className="object-span-return-action" href={objectReturnAction.href}>
              <span>{objectReturnAction.label}</span>
              <strong>{objectReturnAction.detail}</strong>
            </a>
          ) : null}
        </div>
      ) : null}

      {!isDemoSection && hasHtml ? (
        <div className="section-body content-html" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      ) : null}

      {hasChildren ? <div className="section-extra">{children}</div> : null}

      {isDemoSection && aiActions ? <div className="section-ai-actions after-demo">{aiActions}</div> : null}

      {isDemoSection && hasHtml ? (
        <div className="section-body content-html after-demo" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      ) : null}

      {!hasHtml && !hasChildren ? (
        <div className="empty-state">
          {emptyState ?? 'This part of the concept is still being expanded.'}
        </div>
      ) : null}

      <style jsx>{`
        .concept-section {
          padding: 1.5rem;
          border-radius: 24px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background:
            radial-gradient(circle at top left, rgba(31, 75, 153, 0.08), transparent 30%),
            radial-gradient(circle at bottom right, rgba(194, 74, 45, 0.07), transparent 36%),
            rgba(255, 251, 245, 0.96);
          box-shadow: 0 16px 32px rgba(9, 17, 27, 0.06);
        }

        .section-header {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 1rem;
          align-items: start;
        }

        .section-step {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          font-family: var(--font-mono);
          font-size: 0.82rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #f8f3ea;
          background: #1b2430;
          box-shadow: 0 12px 24px rgba(27, 36, 48, 0.18);
        }

        .section-kicker {
          margin: 0 0 0.3rem;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #1f6f78;
        }

        h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.45rem, 2vw, 2rem);
          line-height: 1.08;
          letter-spacing: -0.02em;
          color: #18212b;
        }

        .section-summary {
          margin: 0.7rem 0 0;
          max-width: 62ch;
          color: #51606d;
          line-height: 1.7;
        }

        .section-body {
          margin-top: 1.2rem;
          color: #24303d;
          line-height: 1.75;
        }

        .section-ai-actions {
          margin-top: 1rem;
        }

        .section-ai-actions.after-demo,
        .section-body.after-demo {
          margin-top: 1rem;
        }

        .object-span-index {
          display: grid;
          gap: 0.45rem;
          margin-top: 1rem;
        }

        .object-span-index a {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 0.55rem;
          align-items: baseline;
          min-width: 0;
          padding: 0.58rem 0.68rem;
          border-left: 3px solid rgba(31, 75, 153, 0.42);
          background: rgba(255, 251, 245, 0.68);
          color: inherit;
          text-decoration: none;
        }

        .object-span-index a:target {
          outline: 2px solid rgba(31, 111, 120, 0.32);
          outline-offset: 2px;
          background: rgba(247, 252, 250, 0.95);
        }

        .object-span-index .object-span-return-action {
          border-left-color: rgba(194, 74, 45, 0.48);
          background:
            linear-gradient(90deg, rgba(194, 74, 45, 0.12), rgba(31, 111, 120, 0.08)),
            rgba(255, 251, 245, 0.92);
        }

        .object-span-index span,
        .object-span-index em {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #1f6f78;
          font-style: normal;
          white-space: nowrap;
        }

        .object-span-index strong {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          min-width: 0;
          overflow: hidden;
          color: #263342;
          font-size: 0.88rem;
          line-height: 1.42;
          overflow-wrap: anywhere;
        }

        .object-span-index .object-span-preview {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          min-width: 0;
          overflow: hidden;
          white-space: normal;
          text-transform: none;
          letter-spacing: 0;
          color: #51606d;
          overflow-wrap: anywhere;
        }

        .section-extra {
          margin-top: 1.2rem;
        }

        .empty-state {
          margin-top: 1.2rem;
          padding: 1rem 1.1rem;
          border-radius: 18px;
          border: 1px dashed rgba(27, 36, 48, 0.16);
          background: rgba(255, 251, 245, 0.72);
          color: #576572;
        }

        .math .section-step {
          background: #1f4b99;
        }

        .code .section-step {
          background: #8b5e34;
        }

        .demo .section-step {
          background: #1f6f78;
        }

        .content-html :global(h3),
        .content-html :global(h4) {
          margin-top: 1.4rem;
          margin-bottom: 0.55rem;
          color: #18212b;
          font-family: var(--font-display);
          letter-spacing: -0.01em;
        }

        .content-html :global(p),
        .content-html :global(ul),
        .content-html :global(ol),
        .content-html :global(blockquote),
        .content-html :global(table) {
          margin-top: 0;
          margin-bottom: 1rem;
          color: #2f3d4b;
        }

        .content-html :global(ul),
        .content-html :global(ol) {
          padding-left: 1.35rem;
        }

        .content-html :global(li) {
          color: #2f3d4b;
        }

        .content-html :global(li + li) {
          margin-top: 0.35rem;
        }

        .content-html :global(a) {
          color: #1f4b99;
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 0.14em;
        }

        .content-html :global(strong) {
          color: #17202a;
        }

        .content-html :global(code) {
          padding: 0.12rem 0.34rem;
          border-radius: 7px;
          background: rgba(27, 36, 48, 0.08);
          color: #213040;
          font-family: var(--font-mono);
          font-size: 0.92em;
        }

        .content-html :global(pre) {
          margin: 1rem 0;
          padding: 1rem;
          border-radius: 18px;
          overflow-x: auto;
          background: #18212b;
          border: 1px solid rgba(27, 36, 48, 0.12);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .content-html :global(pre code) {
          padding: 0;
          border-radius: 0;
          background: transparent;
          color: #eef3f8;
          display: block;
          line-height: 1.65;
        }

        .content-html :global(blockquote) {
          padding: 0.85rem 1rem;
          border-left: 3px solid rgba(31, 111, 120, 0.45);
          background: rgba(31, 111, 120, 0.08);
          color: #41505c;
          border-radius: 0 16px 16px 0;
        }

        .content-html :global(table) {
          width: 100%;
          border-collapse: collapse;
          overflow: hidden;
          border-radius: 16px;
          border: 1px solid rgba(27, 36, 48, 0.08);
        }

        .content-html :global(th),
        .content-html :global(td) {
          padding: 0.75rem;
          border-bottom: 1px solid rgba(27, 36, 48, 0.08);
          text-align: left;
        }

        .content-html :global(th) {
          background: rgba(27, 36, 48, 0.05);
          color: #17202a;
          font-family: var(--font-mono);
          font-size: 0.76rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .content-html :global(.katex-display) {
          overflow-x: auto;
          overflow-y: hidden;
          padding-bottom: 0.25rem;
        }

        @media (max-width: 720px) {
          .concept-section {
            padding: 1.15rem;
            border-radius: 20px;
          }

          .concept-section.demo {
            margin-inline: -0.45rem;
            padding-inline: 0.72rem;
          }

          .object-span-index a {
            grid-template-columns: 1fr;
          }

          .section-header {
            grid-template-columns: 1fr;
            gap: 0.8rem;
          }

          .section-step {
            width: 40px;
            height: 40px;
          }
        }
      `}</style>
    </section>
  )
}

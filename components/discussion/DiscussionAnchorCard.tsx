import type { DiscussionAnchor, DiscussionThreadPlaceholder } from '@/lib/discussionAnchors'
import { discussionAnchorDomId, isSafeDiscussionExternalUrl } from '@/lib/discussionAnchors'

type DiscussionAnchorCardProps = {
  anchor: DiscussionAnchor
  thread: DiscussionThreadPlaceholder
  variant?: 'panel' | 'compact' | 'inline'
  showAnchorId?: boolean
}

function objectTypeLabel(value: string) {
  return value.replaceAll('-', ' ')
}

export default function DiscussionAnchorCard({
  anchor,
  thread,
  variant = 'panel',
  showAnchorId = false,
}: DiscussionAnchorCardProps) {
  const externalHref =
    thread.state === 'external' && isSafeDiscussionExternalUrl(thread.externalThreadUrl)
      ? thread.externalThreadUrl
      : null

  return (
    <article id={discussionAnchorDomId(anchor.id)} className={`discussion-anchor-card ${variant}`}>
      <div className="anchor-topline">
        <span>{objectTypeLabel(anchor.objectType)}</span>
        {anchor.contextLabel ? <em>{anchor.contextLabel}</em> : null}
      </div>

      <h4>{anchor.title}</h4>

      <div className="seed-block">
        <span>Attached question</span>
        <p>{thread.seedPrompt}</p>
      </div>

      <div className="thread-status">
        {externalHref ? (
          <a href={externalHref} target="_blank" rel="noopener noreferrer">
            Open configured discussion link
          </a>
        ) : (
          <span>Question attached to this object. Discussion is not live in this static preview.</span>
        )}
      </div>

      {showAnchorId ? <code>{anchor.id}</code> : null}

      <style jsx>{`
        .discussion-anchor-card {
          display: grid;
          gap: 0.6rem;
          min-width: 0;
          padding: 0.82rem;
          border: 1px solid rgba(27, 36, 48, 0.09);
          border-radius: 8px;
          background: rgba(255, 251, 245, 0.82);
        }

        .discussion-anchor-card.compact {
          padding: 0.72rem;
        }

        .discussion-anchor-card.inline {
          border-color: rgba(31, 111, 120, 0.14);
          background: rgba(247, 252, 250, 0.72);
        }

        .anchor-topline {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          align-items: center;
        }

        .anchor-topline span,
        .seed-block span {
          font-family: var(--font-mono);
          font-size: 0.66rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .anchor-topline span {
          width: max-content;
          max-width: 100%;
          padding: 0.22rem 0.42rem;
          border-radius: 999px;
          background: rgba(31, 111, 120, 0.1);
          color: #1f6f78;
        }

        .anchor-topline em {
          color: #65717d;
          font-size: 0.82rem;
          font-style: normal;
          line-height: 1.35;
        }

        h4 {
          margin: 0;
          color: #151d27;
          font-size: 1rem;
          line-height: 1.28;
          overflow-wrap: break-word;
        }

        h4::before {
          content: none;
          display: none;
        }

        .seed-block {
          display: grid;
          gap: 0.28rem;
          min-width: 0;
        }

        .seed-block span {
          color: #c24a2d;
        }

        .seed-block p {
          margin: 0;
          color: #455361;
          line-height: 1.55;
          overflow-wrap: break-word;
        }

        .thread-status {
          display: flex;
          min-width: 0;
        }

        .thread-status span,
        .thread-status a {
          min-width: 0;
          color: #52606c;
          font-size: 0.86rem;
          font-weight: 650;
          line-height: 1.42;
          overflow-wrap: break-word;
        }

        .thread-status a {
          color: #1f4b99;
          text-decoration: none;
        }

        .thread-status a:hover {
          color: #151d27;
          text-shadow: none;
        }

        code {
          width: fit-content;
          max-width: 100%;
          padding: 0.36rem 0.45rem;
          border-radius: 8px;
          background: rgba(27, 36, 48, 0.06);
          color: #33404d;
          font-size: 0.74rem;
          line-height: 1.35;
          white-space: normal;
          overflow-wrap: anywhere;
        }
      `}</style>
    </article>
  )
}

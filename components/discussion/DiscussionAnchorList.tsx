import type { DiscussionAnchorListItem } from '@/lib/discussionAnchors'
import { isDiscussionAnchorListItem } from '@/lib/discussionAnchors'
import DiscussionAnchorCard from './DiscussionAnchorCard'

type DiscussionAnchorListProps = {
  eyebrow?: string
  title?: string
  intro?: string
  items: DiscussionAnchorListItem[]
  variant?: 'panel' | 'compact'
  showAnchorIds?: boolean
}

export default function DiscussionAnchorList({
  eyebrow = 'Object Discussion',
  title = 'Questions attached to exact objects',
  intro,
  items,
  variant = 'panel',
  showAnchorIds = false,
}: DiscussionAnchorListProps) {
  const safeItems = items.filter(isDiscussionAnchorListItem)
  if (!safeItems.length) return null

  return (
    <section className={`discussion-anchor-list ${variant}`} aria-label={title}>
      <div className="discussion-heading">
        <p>{eyebrow}</p>
        <h3>{title}</h3>
        {intro ? <span>{intro}</span> : null}
      </div>

      <div className="discussion-items">
        {safeItems.map((item) => (
          <DiscussionAnchorCard
            key={item.anchor.id}
            anchor={item.anchor}
            thread={item.thread}
            variant={variant === 'compact' ? 'compact' : 'panel'}
            showAnchorId={showAnchorIds}
          />
        ))}
      </div>

      <style jsx>{`
        .discussion-anchor-list {
          display: grid;
          gap: 0.8rem;
          min-width: 0;
          padding: 0.95rem;
          border: 1px solid rgba(27, 36, 48, 0.09);
          border-radius: 20px;
          background: rgba(255, 251, 245, 0.84);
          box-shadow: 0 16px 32px rgba(27, 36, 48, 0.05);
        }

        .discussion-anchor-list.compact {
          padding: 0.82rem;
          border-radius: 18px;
          box-shadow: none;
        }

        .discussion-heading {
          display: grid;
          gap: 0.35rem;
          min-width: 0;
        }

        .discussion-heading p {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        .discussion-heading h3 {
          margin: 0;
          color: #151d27;
          font-size: clamp(1.2rem, 2vw, 1.5rem);
          line-height: 1.1;
          overflow-wrap: break-word;
        }

        .discussion-heading h3::before {
          content: none;
          display: none;
        }

        .discussion-heading span {
          color: #52606c;
          line-height: 1.55;
          overflow-wrap: break-word;
        }

        .discussion-items {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 0.6rem;
          min-width: 0;
        }

        @media (max-width: 640px) {
          .discussion-anchor-list {
            padding: 0.78rem;
            border-radius: 16px;
          }

          .discussion-items {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}

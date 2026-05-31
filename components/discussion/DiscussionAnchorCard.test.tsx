import React from 'react'
import { render, screen } from '@testing-library/react'
import {
  DISCUSSION_ANCHOR_VERSION,
  DISCUSSION_THREAD_PLACEHOLDER_VERSION,
  type DiscussionAnchor,
  type DiscussionThreadPlaceholder,
} from '@/lib/discussionAnchors'
import DiscussionAnchorCard from './DiscussionAnchorCard'

const anchor: DiscussionAnchor = {
  version: DISCUSSION_ANCHOR_VERSION,
  id: 'claim/attention-serving/what-is-compressed',
  objectType: 'claim',
  surface: 'attention-serving',
  title: 'KV compression claim',
  contextLabel: 'Paper claim',
}

const placeholderThread: DiscussionThreadPlaceholder = {
  version: DISCUSSION_THREAD_PLACEHOLDER_VERSION,
  anchorId: anchor.id,
  state: 'placeholder',
  seedPrompt: 'What exactly is being compressed?',
}

describe('DiscussionAnchorCard', () => {
  it('renders object type, title, prompt, status, and optional anchor id', () => {
    render(<DiscussionAnchorCard anchor={anchor} thread={placeholderThread} showAnchorId />)

    expect(screen.getByText('claim')).toBeInTheDocument()
    expect(screen.getByText('KV compression claim')).toBeInTheDocument()
    expect(screen.getByText('What exactly is being compressed?')).toBeInTheDocument()
    expect(screen.getByText('Question attached to this object. Discussion is not live in this static preview.')).toBeInTheDocument()
    expect(screen.getByText('claim/attention-serving/what-is-compressed')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /open configured discussion link/i })).not.toBeInTheDocument()
  })

  it('renders safe external thread links only for external placeholders', () => {
    render(
      <DiscussionAnchorCard
        anchor={anchor}
        thread={{
          ...placeholderThread,
          state: 'external',
          externalThreadUrl: 'https://discuss.example.com/t/kv-compression/123',
        }}
      />
    )

    const link = screen.getByRole('link', { name: /open configured discussion link/i })
    expect(link).toHaveAttribute('href', 'https://discuss.example.com/t/kv-compression/123')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})

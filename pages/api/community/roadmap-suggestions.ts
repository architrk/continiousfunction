import type { NextApiRequest, NextApiResponse } from 'next'
import {
  buildCommunityRoadmapReviewPacket,
  type CommunityRoadmapReviewPacket,
  type CommunityRoadmapSuggestionInput,
} from '@/lib/communityRoadmapIntake'

type ApiResponse = {
  ok: boolean
  persisted: false
  serverMode: 'contract-only'
  packet: CommunityRoadmapReviewPacket
}

function statusCodeForPacket(packet: CommunityRoadmapReviewPacket) {
  return packet.status === 'ready-for-review' ? 200 : 422
}

export default function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse | { error: string }>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed. Use POST.' })
    return
  }

  const packet = buildCommunityRoadmapReviewPacket((req.body ?? {}) as CommunityRoadmapSuggestionInput)

  res.status(statusCodeForPacket(packet)).json({
    ok: packet.acceptedForReview,
    persisted: false,
    serverMode: 'contract-only',
    packet,
  })
}

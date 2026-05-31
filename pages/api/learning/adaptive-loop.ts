import type { NextApiRequest, NextApiResponse } from 'next'
import {
  buildAdaptiveLearningLoopPacket,
  type AdaptiveLearningLoopInput,
  type AdaptiveLearningLoopPacket,
} from '@/lib/adaptiveLearningLoop'

type ApiResponse = {
  ok: boolean
  persisted: false
  serverMode: 'contract-only'
  packet: AdaptiveLearningLoopPacket
}

function statusCodeForPacket(packet: AdaptiveLearningLoopPacket) {
  switch (packet.status) {
    case 'ready':
      return 200
    case 'empty':
      return 200
    case 'needs-object':
      return 422
    case 'blocked-low-signal':
      return 422
    default:
      return 500
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse | { error: string }>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed. Use POST.' })
    return
  }

  const packet = buildAdaptiveLearningLoopPacket((req.body ?? {}) as AdaptiveLearningLoopInput)

  res.status(statusCodeForPacket(packet)).json({
    ok: packet.ready,
    persisted: false,
    serverMode: 'contract-only',
    packet,
  })
}

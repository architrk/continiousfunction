import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveAccountMemoryAuth, type AccountMemoryAuthResolution } from '@/lib/accountMemoryAuth'
import {
  prepareAccountLearnerMemoryImport,
  type AccountLearnerMemoryImportResult,
} from '@/lib/accountLearnerMemoryServer'

type ApiBody = {
  snapshot?: unknown
}

type ApiResponse = {
  ok: boolean
  persisted: false
  serverMode: 'contract-only'
  auth: Pick<AccountMemoryAuthResolution, 'status' | 'source' | 'reason'>
  result: AccountLearnerMemoryImportResult
}

function statusCodeForResult(result: AccountLearnerMemoryImportResult, auth: AccountMemoryAuthResolution) {
  if (auth.status === 'invalid-dev-owner') return 500
  if (auth.status === 'clerk-mirror-required' && result.status === 'auth-required') return 409

  switch (result.status) {
    case 'invalid':
      return 400
    case 'blocked':
      return 422
    case 'auth-required':
      return 401
    case 'write-ready':
      return 501
    default:
      return 500
  }
}

function resultWithAuthReason(
  result: AccountLearnerMemoryImportResult,
  auth: AccountMemoryAuthResolution
): AccountLearnerMemoryImportResult {
  if (result.status !== 'auth-required') return result

  return {
    ...result,
    reason: auth.reason,
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse | { error: string }>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed. Use POST.' })
    return
  }

  const body = (req.body ?? {}) as ApiBody
  const auth = resolveAccountMemoryAuth(req)
  const result = prepareAccountLearnerMemoryImport(body.snapshot, auth.ownership)
  const resultForResponse = resultWithAuthReason(result, auth)
  const statusCode = statusCodeForResult(resultForResponse, auth)

  res.status(statusCode).json({
    ok: result.status === 'write-ready',
    persisted: false,
    serverMode: 'contract-only',
    auth: {
      status: auth.status,
      source: auth.source,
      reason: auth.reason,
    },
    result:
      resultForResponse.status === 'write-ready'
        ? {
            ...resultForResponse,
            reason:
              'The route snapshot is DB-shaped and write-ready, but the live Clerk/Neon persistence adapter is not connected yet.',
          }
        : resultForResponse,
  })
}

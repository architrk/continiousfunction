import type { ObjectMemoryOwnership } from '../db/objectMemoryTypes'

export type AccountMemoryAuthStatus =
  | 'app-user-ready'
  | 'missing-session'
  | 'clerk-mirror-required'
  | 'invalid-dev-owner'

export type AccountMemoryAuthSource = 'dev-env' | 'clerk-session' | 'none'

export type AccountMemoryAuthResolution = {
  status: AccountMemoryAuthStatus
  source: AccountMemoryAuthSource
  reason: string
  ownership?: ObjectMemoryOwnership
}

export type AccountMemoryAuthRequest = {
  headers?: Record<string, string | string[] | undefined>
}

type AccountMemoryAuthEnv = Record<string, string | undefined> & {
  CF_DEV_ACCOUNT_MEMORY_OWNER_ID?: string
  CF_DEV_ACCOUNT_MEMORY_ORGANIZATION_ID?: string
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function firstHeader(request: AccountMemoryAuthRequest, name: string) {
  const headers = request.headers ?? {}
  const value = headers[name] ?? headers[name.toLowerCase()]
  if (Array.isArray(value)) return value[0]
  return value
}

function normalizeUuid(value: string | undefined) {
  const normalized = value?.trim()
  return normalized && uuidPattern.test(normalized) ? normalized : null
}

function invalidDevOwner(reason: string): AccountMemoryAuthResolution {
  return {
    status: 'invalid-dev-owner',
    source: 'dev-env',
    reason,
  }
}

export function resolveAccountMemoryAuth(
  request: AccountMemoryAuthRequest,
  env: AccountMemoryAuthEnv = process.env
): AccountMemoryAuthResolution {
  const devOwnerRaw = env.CF_DEV_ACCOUNT_MEMORY_OWNER_ID?.trim()
  if (devOwnerRaw) {
    const ownerUserId = normalizeUuid(devOwnerRaw)
    if (!ownerUserId) {
      return invalidDevOwner('CF_DEV_ACCOUNT_MEMORY_OWNER_ID must be an app-owned UUID from the users table.')
    }

    const organizationRaw = env.CF_DEV_ACCOUNT_MEMORY_ORGANIZATION_ID?.trim()
    const organizationId = organizationRaw ? normalizeUuid(organizationRaw) : null
    if (organizationRaw && !organizationId) {
      return invalidDevOwner('CF_DEV_ACCOUNT_MEMORY_ORGANIZATION_ID must be an app-owned UUID from the organizations table.')
    }

    return {
      status: 'app-user-ready',
      source: 'dev-env',
      reason: 'Development app-owned user is configured for account-memory contract checks.',
      ownership: {
        ownerUserId,
        organizationId,
        visibility: organizationId ? 'organization' : 'private',
      },
    }
  }

  const clerkUserId = firstHeader(request, 'x-clerk-user-id') ?? firstHeader(request, 'x-clerk-auth-user-id')
  if (clerkUserId) {
    return {
      status: 'clerk-mirror-required',
      source: 'clerk-session',
      reason: 'A Clerk session must be resolved to an app-owned users.id before learner memory can be written.',
    }
  }

  return {
    status: 'missing-session',
    source: 'none',
    reason: 'No app-owned user session is available for account memory yet.',
  }
}

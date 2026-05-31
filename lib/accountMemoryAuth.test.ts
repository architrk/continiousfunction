import { resolveAccountMemoryAuth } from './accountMemoryAuth'

const ownerUserId = '11111111-1111-4111-8111-111111111111'
const organizationId = '22222222-2222-4222-8222-222222222222'

describe('account memory auth boundary', () => {
  it('returns missing-session when no app-owned identity is available', () => {
    const auth = resolveAccountMemoryAuth({}, {})

    expect(auth.status).toBe('missing-session')
    expect(auth.source).toBe('none')
    expect(auth.ownership).toBeUndefined()
  })

  it('does not treat a Clerk id as the learner-memory owner', () => {
    const auth = resolveAccountMemoryAuth(
      {
        headers: {
          'x-clerk-user-id': 'user_123',
        },
      },
      {}
    )

    expect(auth.status).toBe('clerk-mirror-required')
    expect(auth.source).toBe('clerk-session')
    expect(auth.ownership).toBeUndefined()
    expect(auth.reason).toContain('app-owned')
  })

  it('rejects malformed development owner ids', () => {
    const auth = resolveAccountMemoryAuth({}, { CF_DEV_ACCOUNT_MEMORY_OWNER_ID: 'user_123' })

    expect(auth.status).toBe('invalid-dev-owner')
    expect(auth.source).toBe('dev-env')
    expect(auth.ownership).toBeUndefined()
  })

  it('returns private app ownership from a valid development owner id', () => {
    const auth = resolveAccountMemoryAuth({}, { CF_DEV_ACCOUNT_MEMORY_OWNER_ID: ownerUserId })

    expect(auth.status).toBe('app-user-ready')
    expect(auth.ownership).toEqual({
      ownerUserId,
      organizationId: null,
      visibility: 'private',
    })
  })

  it('returns organization-scoped app ownership when a valid development organization id is configured', () => {
    const auth = resolveAccountMemoryAuth(
      {},
      {
        CF_DEV_ACCOUNT_MEMORY_OWNER_ID: ownerUserId,
        CF_DEV_ACCOUNT_MEMORY_ORGANIZATION_ID: organizationId,
      }
    )

    expect(auth.status).toBe('app-user-ready')
    expect(auth.ownership).toEqual({
      ownerUserId,
      organizationId,
      visibility: 'organization',
    })
  })

  it('rejects malformed development organization ids', () => {
    const auth = resolveAccountMemoryAuth(
      {},
      {
        CF_DEV_ACCOUNT_MEMORY_OWNER_ID: ownerUserId,
        CF_DEV_ACCOUNT_MEMORY_ORGANIZATION_ID: 'org_123',
      }
    )

    expect(auth.status).toBe('invalid-dev-owner')
    expect(auth.reason).toContain('CF_DEV_ACCOUNT_MEMORY_ORGANIZATION_ID')
  })
})

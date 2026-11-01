import { describe, it, expect } from 'bun:test'
import { getCandidateProfileFromDb, getAllCandidateAttributes } from '../storage/db.js'

describe('candidateProfile database dynamic extraction', () => {
  it('loads candidate profile from dynamic database table', async () => {
    const profile = await getCandidateProfileFromDb()

    expect(profile).toBeDefined()
    expect(profile.personal).toBeDefined()
    expect(profile.personal.fullName.length).toBeGreaterThan(0)
    expect(profile.personal.email).toContain('@')
    expect(profile.experience.length).toBeGreaterThan(0)
    expect(profile.education).toBeDefined()
  })

  it('loads candidate attributes ledger from candidate_profile_attributes', async () => {
    const attrs = await getAllCandidateAttributes()

    expect(Array.isArray(attrs)).toBe(true)
    expect(attrs.length).toBeGreaterThan(0)

    const hasFullName = attrs.some(a => a.key === 'full_name' || a.key === 'name')
    expect(hasFullName).toBe(true)
  })
})

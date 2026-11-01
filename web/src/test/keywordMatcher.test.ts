import { describe, it, expect } from 'bun:test'
import { matchAndTailor } from '../generator/keywordMatcher.js'

describe('keywordMatcher', () => {
  it('detects Golang keywords from JD text', () => {
    const jd = 'We are seeking a Backend Engineer with Go, Golang, and microservices experience.'
    const result = matchAndTailor('Golang Developer', jd)

    expect(result.primaryRole).toBe('Golang Developer')
    expect(result.matchedKeywords).toContain('Go')
    expect(result.matchedKeywords).toContain('Golang')
    expect(result.matchedKeywords).toContain('Microservices')
    expect(result.tailoredSkills.languages).toContain('Golang')
  })

  it('detects Data Engineering tech stack', () => {
    const jd = 'Building ETL pipelines using Apache Airflow, PostgreSQL, and Metabase dashboards.'
    const result = matchAndTailor('Data Engineer', jd)

    expect(result.matchedKeywords).toContain('Apache Airflow')
    expect(result.matchedKeywords).toContain('Metabase')
    expect(result.matchedKeywords).toContain('PostgreSQL')
    expect(result.tailoredSummary).toContain('Data Engineer')
  })

  it('generates a 4-paragraph cover letter structure matching ATS standards', () => {
    const jd = 'Full Stack Engineer with TypeScript and Node.js skills.'
    const result = matchAndTailor('Full Stack Engineer', jd)

    expect(result.coverLetterParagraphs.length).toBeGreaterThanOrEqual(3)
    expect(result.coverLetterParagraphs[0]).toContain('Full Stack Engineer')
  })
})

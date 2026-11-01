import type { JobRecord } from '../types'

export function isJobInStage(status: string, stage: 'review' | 'pending' | 'submitted' | 'dropped' | 'all'): boolean {
  const st = (status || '').toUpperCase()
  if (stage === 'review') {
    return st === 'PENDING_HUMAN' || st === 'CRAWLED' || st === 'SKIPPED' || st === 'SKIPPED_SALARY'
  }
  if (stage === 'pending') {
    return st === 'APPROVED' || st === 'FAILED'
  }
  if (stage === 'submitted') {
    return (
      st === 'APPLIED' ||
      st === 'SUBMITTED (NOT VERIFY-ABLE)' ||
      st === 'APPLYING' ||
      st === 'INTERVIEW' ||
      st === 'OFFER' ||
      st === 'OFFER_ACCEPTED' ||
      st === 'OFFER_DECLINED'
    )
  }
  if (stage === 'dropped') {
    return st === 'DROPPED' || st === 'REJECTED'
  }
  return true
}

export function sortJobsList(
  jobs: JobRecord[],
  sortColumn: 'role' | 'company' | 'created_at' | null,
  sortDirection: 'asc' | 'desc'
): JobRecord[] {
  if (!sortColumn) return [...jobs]

  return [...jobs].sort((a, b) => {
    let valA = ''
    let valB = ''
    if (sortColumn === 'role') {
      valA = (a.title || '').toLowerCase()
      valB = (b.title || '').toLowerCase()
    } else if (sortColumn === 'company') {
      valA = (a.company || '').toLowerCase()
      valB = (b.company || '').toLowerCase()
    } else if (sortColumn === 'created_at') {
      valA = a.created_at || ''
      valB = b.created_at || ''
      if (!valA && valB) return 1
      if (valA && !valB) return -1
    }
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1
    return 0
  })
}

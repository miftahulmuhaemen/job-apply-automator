import { D1_DATABASE_ID, D1_DATABASE_NAME } from './cloudflareClient.js'

export { D1_DATABASE_ID, D1_DATABASE_NAME }

export function escapeSqlString(val: any): string {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'number') return val.toString()
  if (typeof val === 'boolean') return val ? '1' : '0'
  const str = String(val).replace(/'/g, "''")
  return `'${str}'`
}

export * from './repositories/candidateProfileRepo.js'
export * from './repositories/jobsLedgerRepo.js'
export * from './repositories/companiesRepo.js'
export * from './repositories/websitesRepo.js'
export * from './repositories/criteriaRepo.js'
export * from './repositories/systemRepo.js'

import http from 'node:http'
import { getCompanies, getCompanyJobs } from '../storage/db.js'
import { sendJson } from './routeUtils.js'

export async function handleCompaniesRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string
): Promise<boolean> {
  if (pathname === '/api/companies' && req.method === 'GET') {
    try {
      const companies = await getCompanies()
      sendJson(res, 200, { success: true, count: companies.length, data: companies })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  const companyJobsMatch = pathname.match(/^\/api\/companies\/([^\/]+)\/jobs$/)
  if (companyJobsMatch && req.method === 'GET') {
    const companyName = decodeURIComponent(companyJobsMatch[1])
    try {
      const jobs = await getCompanyJobs(companyName)
      sendJson(res, 200, { success: true, company: companyName, count: jobs.length, data: jobs })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  return false
}

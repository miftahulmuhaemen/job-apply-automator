import type { CandidateProfile } from '../storage/db.js'

export interface MatchResult {
  primaryRole: string
  matchedKeywords: string[]
  tailoredSkills: {
    languages: string[]
    backend: string[]
    infra: string[]
  }
  tailoredSummary: string
  tailoredHighlights: { company: string; role: string; location: string; period: string; points: string[] }[]
  coverLetterParagraphs: string[]
}

const TECH_KEYWORD_MAP: Record<string, string[]> = {
  golang: ['Go', 'Golang', 'Gin', 'Fiber', 'Goroutines', 'Microservices'],
  typescript: ['TypeScript', 'JavaScript', 'Node.js', 'NestJS', 'Express', 'React', 'Next.js'],
  python: ['Python', 'FastAPI', 'Pandas', 'ETL'],
  dataEngineering: ['Apache Airflow', 'Metabase', 'ETL Pipelines', 'Data Warehousing', 'GCP Pub/Sub'],
  rust: ['Rust', 'Systems Programming', 'Concurrency'],
  php: ['PHP', 'Laravel', 'REST APIs'],
  database: ['SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis'],
  devops: ['Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'CI/CD'],
  noCode: ['n8n', 'Workflow Automation', 'Cursor', 'Low-code']
}

export function matchAndTailor(jobTitle: string, jdText: string, profile?: CandidateProfile): MatchResult {
  const lowerJd = jdText.toLowerCase()
  const lowerTitle = jobTitle.toLowerCase()

  const matchedKeywords: string[] = []
  for (const [key, terms] of Object.entries(TECH_KEYWORD_MAP)) {
    for (const term of terms) {
      if (lowerJd.includes(term.toLowerCase())) {
        if (!matchedKeywords.includes(term)) {
          matchedKeywords.push(term)
        }
      }
    }
  }

  // Detect domain orientation
  const isDataEng = lowerTitle.includes('data') || lowerJd.includes('airflow') || lowerJd.includes('data warehouse') || lowerJd.includes('etl')
  const isGolang = lowerTitle.includes('go') || lowerJd.includes('golang') || lowerJd.includes('gin')
  const isPhp = lowerTitle.includes('php') || lowerJd.includes('laravel')
  const isRust = lowerTitle.includes('rust')
  const isTypescript = lowerTitle.includes('typescript') || lowerTitle.includes('node') || lowerTitle.includes('frontend') || lowerTitle.includes('fullstack')

  // Filter languages strictly by relevance to JD
  const relevantLanguages: string[] = []
  if (isGolang || lowerJd.includes('go') || lowerJd.includes('golang')) relevantLanguages.push('Golang')
  if (isTypescript || lowerJd.includes('typescript') || lowerJd.includes('javascript') || lowerJd.includes('node')) {
    relevantLanguages.push('TypeScript', 'JavaScript')
  }
  if (isPhp) relevantLanguages.push('PHP')
  if (isRust) relevantLanguages.push('Rust')
  if (isDataEng || lowerJd.includes('python')) relevantLanguages.push('Python')
  if (relevantLanguages.length === 0) {
    // Default fallback to candidate's primary backend languages
    relevantLanguages.push('Golang', 'TypeScript', 'SQL')
  } else {
    relevantLanguages.push('SQL')
  }

  // Filter backend & database tools strictly
  const relevantBackend: string[] = []
  if (relevantLanguages.includes('Golang')) relevantBackend.push('Go (net/http, Gin)', 'Microservices')
  if (relevantLanguages.includes('TypeScript')) relevantBackend.push('Node.js (NestJS, Express)', 'REST APIs')
  relevantBackend.push('PostgreSQL', 'MySQL', 'Redis')

  // Filter infra & data tools strictly
  const relevantInfra: string[] = ['Docker', 'Kubernetes', 'CI/CD (GitHub Actions)', 'Cloud (AWS, GCP, Azure)']
  if (isDataEng) {
    relevantInfra.unshift('Apache Airflow', 'Metabase', 'ETL Pipelines', 'Data Warehousing')
  }

  // Dynamic tailored professional summary (strictly anti-slop, no irrelevant stack leaks)
  const primaryStack = relevantLanguages.slice(0, 3).join(', ')
  const tailoredSummary = `Results-oriented Software & Data Engineer with 5 years of professional experience engineering distributed backend services, high-throughput APIs, and cloud infrastructure. Proficient in ${primaryStack}, with a proven track record delivering resilient microservices, optimizing database transactions, and managing containerized Kubernetes deployments.`

  const expList = profile?.experience || [
    {
      company: 'Blue Sky Tech (Bythen AI)',
      role: 'Data and Backend Engineer',
      location: 'Remote',
      startDate: '2025-03',
      endDate: '2026-06',
      highlights: [
        'Architected foundational analytical Data Warehouse using star schema, orchestrating scheduled batch pipelines in Python/Airflow to aggregate millions of operational records into Metabase dashboards.',
        'Engineered core Go microservices and event-driven task queue backed by GCP Pub/Sub and webhook callbacks, decoupling long-running GPU generative rendering clusters from API gateways.',
        'Embedded automated data quality assertions with Great Expectations in Airflow DAGs, preventing corrupt schema metrics and upstream pipeline failures.'
      ]
    },
    {
      company: 'Feedloop AI',
      role: 'Software Engineer',
      location: 'Remote',
      startDate: '2022-12',
      endDate: '2024-11',
      highlights: [
        'Engineered an integrated AI legal document analysis platform to parse dense multi-page laws (100+ pages), detect cross-regulatory contradictions, and provide automated compliance insights for new legislation.',
        'Collaborated with the engineering team to administer 3 production Kubernetes clusters across GKE and AKS, conducting daily cluster monitoring, service incident triage, and PostgreSQL database migrations to achieve a 20% reduction in downtime.',
        'Delivered full-stack platforms for 5 enterprise clients using Feedloop proprietary low-code engine (Qore) and Google Cloud Functions, accelerating delivery velocity by 30%.'
      ]
    },
    {
      company: 'PT Arkan Jaya Nusantara',
      role: 'Software Engineer',
      location: 'Indonesia',
      startDate: '2021-01',
      endDate: '2022-11',
      highlights: [
        'Integrated multiple disparate medical peripheral devices (pulse oximeters, blood pressure monitors, single-lead ECG) into a unified continuous vital-sign monitoring platform.',
        'Built an event-driven telemetry ingestion engine in Go and MongoDB time-series storage with automated peripheral reconnection state machines, improving transmission reliability by 25%.',
        'Developed high-performance clinician workstation interfaces in React and TypeScript with canvas-based ECG waveform streaming, and established CI/CD Docker deployment pipelines.'
      ]
    }
  ]

  // Tailor experience highlights
  const tailoredHighlights = expList.map((exp) => {
    let points = exp.highlights.map((pt) => {
      // If NOT a data engineering JD, sanitize Metabase/Airflow from general backend bullets
      if (!isDataEng) {
        return pt
          .replace('into Metabase dashboards and operational reporting.', 'into operational analytics and reporting services.')
          .replace('in Python/SQL, reducing ingestion latency', 'in SQL and Go worker routines, reducing latency')
      }
      return pt
    })

    return {
      company: exp.company,
      role: exp.role,
      location: exp.location || 'Indonesia',
      period: `${exp.startDate} - ${exp.endDate}`,
      points
    }
  })

  // Dynamic cover letter matching JD focus
  const leadTech = matchedKeywords.slice(0, 4).join(', ') || primaryStack
  const coverLetterParagraphs = [
    `I am writing to express my interest in the ${jobTitle} role. With 5 years of software engineering experience focusing on ${leadTech}, I build production systems that prioritize reliable data handling, clean architecture, and measurable performance.`,
    `In my recent work across Feedloop AI and Bythen AI, I engineered core backend components using Golang and Node.js, managed Kubernetes clusters across GCP and Azure at Feedloop, and architected analytical ingestion pipelines processing millions of records at Bythen. I enjoy designing clean RESTful APIs, resolving bottlenecks, and automating operational workflows.`,
    `I am available immediately (ASAP notice period) and look forward to discussing how my technical background in ${matchedKeywords[0] || primaryStack} aligns with your engineering goals.`
  ]

  return {
    primaryRole: jobTitle,
    matchedKeywords,
    tailoredSkills: {
      languages: Array.from(new Set(relevantLanguages)),
      backend: Array.from(new Set(relevantBackend)),
      infra: Array.from(new Set(relevantInfra))
    },
    tailoredSummary,
    tailoredHighlights,
    coverLetterParagraphs
  }
}

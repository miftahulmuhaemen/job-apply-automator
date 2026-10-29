import { spawn, execFile, ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { getCliAgentSettings, updateCliAgentSettings } from '../storage/db.js'
import candidateProfile from '../../../data/candidateProfile.json' with { type: 'json' }

export interface AgentModel {
  id: string
  name: string
}

export interface CliAgentStatus {
  enabled: boolean
  available: boolean
  version?: string
  binaryPath: string
  currentModel: string
  timeoutSeconds: number
  activeProcessesCount: number
  activePids: number[]
  availableModels: AgentModel[]
  error?: string
}

export interface AgentInvocationResult {
  success: boolean
  data?: any
  rawOutput: string
  latencyMs: number
  error?: string
}

// Active child process registry to track and eliminate zombies
const activeAgentProcesses = new Map<number, ChildProcess>()

// Global process hygiene: cleanup any running agy subagent processes on host exit
function reapLingeringProcesses() {
  if (activeAgentProcesses.size > 0) {
    console.log(`[CLI AGENT] Reaping ${activeAgentProcesses.size} active child process(es) on exit...`)
    for (const [pid, proc] of activeAgentProcesses.entries()) {
      try {
        proc.kill('SIGKILL')
      } catch {}
    }
    activeAgentProcesses.clear()
  }
}

process.on('exit', reapLingeringProcesses)
process.on('SIGINT', reapLingeringProcesses)
process.on('SIGTERM', reapLingeringProcesses)

/**
 * Checks system readiness for the Antigravity CLI (agy)
 */
export async function checkCliAgentStatus(): Promise<CliAgentStatus> {
  const settings = getCliAgentSettings()
  const binaryPath = settings.binary

  const status: CliAgentStatus = {
    enabled: settings.enabled,
    available: false,
    binaryPath,
    currentModel: settings.model,
    timeoutSeconds: settings.timeout_seconds,
    activeProcessesCount: activeAgentProcesses.size,
    activePids: Array.from(activeAgentProcesses.keys()),
    availableModels: []
  }

  // 1. Check binary existence
  if (!fs.existsSync(binaryPath)) {
    status.error = `Binary not found at path: ${binaryPath}`
    return status
  }

  // 2. Fetch version
  try {
    const versionOutput = await new Promise<string>((resolve, reject) => {
      execFile(binaryPath, ['--version'], { timeout: 5000 }, (err, stdout) => {
        if (err) reject(err)
        else resolve(stdout.trim())
      })
    })
    status.version = versionOutput
    status.available = true
  } catch (err: any) {
    status.error = `Failed to execute agy --version: ${err.message}`
    return status
  }

  // 3. Fetch available models
  try {
    const modelsOutput = await new Promise<string>((resolve, reject) => {
      execFile(binaryPath, ['models'], { timeout: 10000 }, (err, stdout) => {
        if (err) reject(err)
        else resolve(stdout)
      })
    })

    const parsedModels: AgentModel[] = []
    const lines = modelsOutput.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('⠋') || trimmed.startsWith('Fetching')) continue
      const match = trimmed.match(/^([a-zA-Z0-9\.\-_]+)\s+(.+)$/)
      if (match) {
        parsedModels.push({ id: match[1], name: match[2].trim() })
      }
    }
    status.availableModels = parsedModels
  } catch (err: any) {
    // Non-fatal fallback with standard Antigravity CLI models
    status.availableModels = [
      { id: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)' },
      { id: 'gemini-3.8-flash-medium', name: 'Gemini 3.8 Flash (Medium)' },
      { id: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (Low)' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Thinking)' },
      { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 (Thinking)' },
      { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B (Medium)' }
    ]
  }

  return status
}

/**
 * Spawns an isolated non-interactive agy task with hard timeouts and guaranteed process cleanup
 */
export async function invokeCliAgent(
  prompt: string,
  options?: {
    model?: string
    timeoutSeconds?: number
    expectJson?: boolean
  }
): Promise<AgentInvocationResult> {
  const settings = getCliAgentSettings()
  if (!settings.enabled) {
    return {
      success: false,
      rawOutput: '',
      latencyMs: 0,
      error: 'CLI Agent is currently disabled in scheduler settings'
    }
  }

  const model = options?.model || settings.model || 'gemini-3.8-flash-high'
  const timeoutMs = (options?.timeoutSeconds || settings.timeout_seconds || 60) * 1000
  const expectJson = options?.expectJson ?? true
  const binaryPath = settings.binary

  const startTime = Date.now()

  return new Promise<AgentInvocationResult>((resolve) => {
    const args = [
      '-p',
      prompt,
      '--model',
      model,
      '--output-format',
      'json',
      '--dangerously-skip-permissions'
    ]

    let stdoutData = ''
    let stderrData = ''
    let isSettled = false

    const proc = spawn(binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    })

    const pid = proc.pid
    if (pid) {
      activeAgentProcesses.set(pid, proc)
    }

    // Safety timeout: terminates child process cleanly if it exceeds the limit
    const timer = setTimeout(() => {
      if (isSettled) return
      console.warn(`[CLI AGENT] Process (PID ${pid}) exceeded timeout of ${timeoutMs / 1000}s. Terminating...`)
      terminateProcess(proc)
      isSettled = true
      activeAgentProcesses.delete(pid!)
      resolve({
        success: false,
        rawOutput: stdoutData,
        latencyMs: Date.now() - startTime,
        error: `Agent CLI execution timed out after ${timeoutMs / 1000} seconds`
      })
    }, timeoutMs)

    proc.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString()
    })

    proc.stderr.on('data', (chunk) => {
      stderrData += chunk.toString()
    })

    proc.on('error', (err) => {
      if (isSettled) return
      clearTimeout(timer)
      isSettled = true
      if (pid) activeAgentProcesses.delete(pid)
      resolve({
        success: false,
        rawOutput: stdoutData,
        latencyMs: Date.now() - startTime,
        error: `Process spawn error: ${err.message}`
      })
    })

    proc.on('close', (code) => {
      if (isSettled) return
      clearTimeout(timer)
      isSettled = true
      if (pid) activeAgentProcesses.delete(pid)

      const latencyMs = Date.now() - startTime

      // agy outputs JSON envelope: { status: "SUCCESS", response: "...", ... }
      let parsedEnvelope: any = null
      let innerText = stdoutData.trim()

      try {
        parsedEnvelope = JSON.parse(stdoutData)
        if (parsedEnvelope && parsedEnvelope.response) {
          innerText = parsedEnvelope.response.trim()
        }
      } catch {}

      if (code !== 0 && (!parsedEnvelope || parsedEnvelope.status !== 'SUCCESS')) {
        return resolve({
          success: false,
          rawOutput: stdoutData,
          latencyMs,
          error: stderrData || `CLI agent exited with status code ${code}`
        })
      }

      // If expecting structured JSON output from the model
      if (expectJson) {
        let cleanJsonStr = innerText
        // Strip markdown code fences if model wrapped response in ```json ... ```
        const fenceMatch = cleanJsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        if (fenceMatch) {
          cleanJsonStr = fenceMatch[1].trim()
        } else {
          // If no code fence, extract substring from first { or [ to matching last } or ]
          const firstBrace = cleanJsonStr.indexOf('{')
          const firstBracket = cleanJsonStr.indexOf('[')
          let startIdx = -1
          let endIdx = -1

          if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            startIdx = firstBrace
            endIdx = cleanJsonStr.lastIndexOf('}')
          } else if (firstBracket !== -1) {
            startIdx = firstBracket
            endIdx = cleanJsonStr.lastIndexOf(']')
          }

          if (startIdx !== -1 && endIdx > startIdx) {
            cleanJsonStr = cleanJsonStr.slice(startIdx, endIdx + 1).trim()
          }
        }

        try {
          const parsedData = JSON.parse(cleanJsonStr)
          return resolve({
            success: true,
            data: parsedData,
            rawOutput: stdoutData,
            latencyMs
          })
        } catch (err: any) {
          return resolve({
            success: false,
            data: null,
            rawOutput: stdoutData,
            latencyMs,
            error: `Failed to parse agent JSON response: ${err.message}`
          })
        }
      }

      return resolve({
        success: true,
        data: innerText,
        rawOutput: stdoutData,
        latencyMs
      })
    })
  })
}

/**
 * Strict progressive process termination: SIGTERM -> 2s -> SIGKILL
 */
function terminateProcess(proc: ChildProcess) {
  try {
    proc.kill('SIGTERM')
    setTimeout(() => {
      try {
        if (!proc.killed) {
          proc.kill('SIGKILL')
        }
      } catch {}
    }, 2000)
  } catch {}
}

/* =========================================================
   SPECIALIZED ATS & UNKNOWN PLATFORM EXPLORATION ROUTINES
   ========================================================= */

export interface ParsedAtsJobListing {
  title: string
  company: string
  location: string
  salary: string
  experienceRequired: string
  techStack: string[]
  responsibilitiesSummary: string
  applyUrlOrActionSelector: string
}

/**
 * Analyzes unstructured DOM/HTML from an unknown portal to extract job specifications
 */
export async function parseUnknownJobPage(
  pageUrl: string,
  rawContentSnippet: string
): Promise<ParsedAtsJobListing | null> {
  const prompt = `You are an automated ATS Job Ingestion Agent. Analyze the following webpage content from an unknown job posting URL (${pageUrl}).

Extract the following job information and return ONLY a valid JSON object matching this schema:
{
  "title": "Exact Role Title",
  "company": "Company Name",
  "location": "Job Location or Remote",
  "salary": "Listed compensation or Undisclosed",
  "experienceRequired": "e.g. 3+ years or Not specified",
  "techStack": ["Language1", "Framework1", "Tool1"],
  "responsibilitiesSummary": "Clean verbatim summary of key duties without filler",
  "applyUrlOrActionSelector": "The CSS selector or link to submit/apply"
}

Webpage content snippet:
"""
${rawContentSnippet.slice(0, 8000)}
"""`

  const result = await invokeCliAgent(prompt, { expectJson: true })
  if (result.success && result.data && result.data.title) {
    return result.data as ParsedAtsJobListing
  }
  return null
}

export interface FormFieldMapping {
  selector: string
  fieldName: string
  fieldType: 'text' | 'select' | 'checkbox' | 'radio' | 'file'
  candidateProfileKey: string
  proposedValue: string
}

/**
 * Maps input fields on an unknown ATS application form to candidateProfile.json
 */
export async function mapUnknownApplicationForm(
  formAccessibilityOrHtml: string
): Promise<FormFieldMapping[]> {
  const prompt = `You are an ATS Form Mapper Agent. Below is the simplified HTML / accessibility tree of an unknown job application form.
Candidate Profile details:
- Full Name: ${candidateProfile.personal.fullName}
- Email: ${candidateProfile.personal.email}
- Phone: ${candidateProfile.personal.phone}
- Location: ${candidateProfile.personal.location}
- LinkedIn: ${candidateProfile.personal.linkedin}
- GitHub: ${candidateProfile.personal.github}
- Portfolio: ${candidateProfile.personal.portfolio}
- Work Experience: 5 years Software/Data Engineer (Golang, TypeScript, Node.js, Kubernetes)

Map each detected form input to the candidate's profile.
Return ONLY a JSON array of objects:
[
  {
    "selector": "CSS selector or element identifier",
    "fieldName": "Label or placeholder",
    "fieldType": "text | select | checkbox | radio | file",
    "candidateProfileKey": "e.g. personal.fullName or custom",
    "proposedValue": "Value to input"
  }
]

Form DOM/Tree:
"""
${formAccessibilityOrHtml.slice(0, 8000)}
"""`

  const result = await invokeCliAgent(prompt, { expectJson: true })
  if (result.success && Array.isArray(result.data)) {
    return result.data as FormFieldMapping[]
  }
  return []
}

/**
 * Contextual screening Q&A synthesizer for custom employer questions
 */
export async function answerScreeningQuestionWithAgent(
  question: string,
  jobTitle: string,
  company: string
): Promise<string> {
  const prompt = `You are an automated ATS screening assistant acting strictly on behalf of Miftahul Muhaemen.
Candidate Persona & Verified Background:
- Full Legal Name: Miftahul Muhaemen
- Professional Experience: 5 Years (Software & Data Engineering: Golang, TypeScript, Python, Kubernetes, PostgreSQL)
- Highest Education: Bachelor of Computer Science (S1 Ilmu Komputer), Universitas Lambung Mangkurat (ULM), GPA 3.48 / 4.0
- Current Status: Single, Unemployed (Actively looking), Notice Period: Immediately / ASAP
- Work Arrangements: Open to all (Remote, Hybrid, On-site). Minimum 3 months contract or full-time (No internships).

Candidate Verified Story Bank (Select strictly by relevance to Job Title & Question):
1. Infrastructure Triage & Database Migrations: At Feedloop AI, collaborated with the engineering team to triage production service incidents and execute PostgreSQL database migrations across 3 Kubernetes clusters (GKE/AKS). Note: Database migrations and incident triage were performed exclusively at Feedloop AI collaboratively with the team; never alone, and never at Bythen AI.
2. Data Warehouse & Decoupled Pipelines: At Bythen AI, architected analytical star-schema Data Warehouse, Airflow batch DAGs with Great Expectations data quality assertions, and Go microservices with GCP Pub/Sub to decouple GPU rendering clusters.
3. Legal AI Intelligence Platform: Built integrated AI document analyzer at Feedloop AI parsing 100+ page regulatory documents, identifying conflicts across multi-tiered legislation, and providing risk analysis for lawmakers.
4. Peripheral Device Integration: Integrated disparate mini-devices (medical sensors, ECG, oximeters) into a single unified real-time monitoring platform in Go (protocol integration, never claim reverse-engineering).

Employer / Role Context:
- Company: ${company}
- Target Job Title: ${jobTitle}
- Screening Question: "${question}"

Instructions:
- Provide a direct, professional, factual answer in 1 to 3 sentences.
- Match technical examples to the target discipline (e.g., do not cite database migrations for frontend UI questions).
- Zero AI buzzwords, zero generic fluff, zero hyperbole.
- Output ONLY the answer text.`

  const result = await invokeCliAgent(prompt, { expectJson: false })
  if (result.success && typeof result.data === 'string') {
    return result.data.trim()
  }
  return 'Qualified software engineer with 5 years experience in production distributed systems, cloud infrastructure, and data platforms. Immediately available.'
}

export const generateCandidateScreeningAnswer = answerScreeningQuestionWithAgent

export interface ExtractedJobSpec {
  techStack: string[]
  benefits: string[]
  experienceReq: string | null
  salaryRaw: string | null
  roleSummary: string
}

/**
 * Extracts technologies, benefits, and experience requirements dynamically via AGY (Zero Hardcoded Dictionaries)
 */
export async function analyzeJobSpecificationWithAgent(
  jobTitle: string,
  company: string,
  rawText: string
): Promise<ExtractedJobSpec | null> {
  const prompt = `You are an automated ATS Job Specification Extraction Agent.
Analyze the following job description for the role of "${jobTitle}" at "${company}".

Extract the required technical tools, itemized perks/benefits, experience requirement, and a clean role summary.
Return ONLY a valid JSON object matching this schema:
{
  "techStack": ["Exact technology 1", "Framework 2", "Database 3", "Cloud Tool 4"],
  "benefits": ["Benefit 1", "Benefit 2"],
  "experienceReq": "e.g. 5+ years backend engineering or null",
  "salaryRaw": "Extracted salary string if explicitly listed in text, or null",
  "roleSummary": "1-2 sentence concise executive overview of core technical responsibilities"
}

Strict Rules:
- Include all programming languages (e.g. Ruby, Go, Python, TypeScript, Java, Rust, PHP), frameworks (e.g. Ruby on Rails, Express, React, Gin, Django, NestJS), databases (e.g. PostgreSQL, Redis, MySQL), and platforms (e.g. Kubernetes, Docker, AWS, GCP).
- Do not invent unmentioned tools. Extract strictly from text.
- Return ONLY valid JSON, no markdown commentary.

Job Posting Text:
"""
${rawText.slice(0, 10000)}
"""`

  const result = await invokeCliAgent(prompt, { expectJson: true, timeoutSeconds: 90, model: 'gemini-3.8-flash-low' })
  if (result.success && result.data) {
    const rawTech = result.data.techStack || result.data.tech_stack || []
    const rawBenefits = result.data.benefits || result.data.perks || []
    const rawExp = result.data.experienceReq || result.data.experience_req || result.data.experience || null
    const rawSal = result.data.salaryRaw || result.data.salary_raw || result.data.salary || null
    const rawSummary = result.data.roleSummary || result.data.role_summary || result.data.summary || ''

    return {
      techStack: Array.isArray(rawTech) ? rawTech.filter((t: any) => typeof t === 'string' && t.trim().length > 0) : [],
      benefits: Array.isArray(rawBenefits) ? rawBenefits.filter((b: any) => typeof b === 'string' && b.trim().length > 0) : [],
      experienceReq: rawExp ? String(rawExp) : null,
      salaryRaw: rawSal ? String(rawSal) : null,
      roleSummary: rawSummary ? String(rawSummary) : ''
    }
  }
  return null
}

export interface TailoredNarrativeResult {
  tailoredSummary: string
  coverLetter: string
}

/**
 * Generates role-tailored summary and 3-paragraph cover letter grounded in candidateProfile.json
 */
export async function generateTailoredNarrativeWithAgent(
  jobTitle: string,
  company: string,
  jdText: string,
  techStack?: string[]
): Promise<TailoredNarrativeResult | null> {
  const p = candidateProfile.personal
  const prompt = `You are an expert ATS Resume and Cover Letter Synthesizer representing candidate ${p.fullName}.
Candidate Verified Background (Strict Factual Grounding - Zero Plausible Fakes):
- Name: ${p.fullName}
- Experience: 5 years Software & Data Engineering
- Primary Tech: Golang, TypeScript, Node.js, Python, PostgreSQL, Redis, Docker, Kubernetes, GCP, Azure, Airflow
- Verified Experience:
  1. Blue Sky Tech (Bythen AI, 2025-2026): Data & Backend Engineer. Architected analytical star-schema Data Warehouse, Airflow ETL batch DAGs with Great Expectations, Go microservices with GCP Pub/Sub to decouple GPU rendering clusters.
  2. Feedloop AI (2022-2024): Software Engineer. Built AI legal document intelligence platform. Collaborated with engineering team on daily Kubernetes monitoring, service incident triage, and PostgreSQL database migrations across 3 clusters (GKE/AKS). (Note: incident triage and database migrations were strictly collaborative with the team, never claimed solo).
  3. PT Arkan Jaya Nusantara (2021-2022): Software Engineer. Integrated disparate medical peripheral devices (oximeters, blood pressure, ECG waveforms) into a real-time Go telemetry ingestion engine and React dashboard.
- Education: S1 Ilmu Komputer (Bachelor of Computer Science), Universitas Lambung Mangkurat, GPA 3.48
- Availability: Immediately / ASAP

Target Employer & Role:
- Company: ${company}
- Role Title: ${jobTitle}
- Discovered Tech Stack: ${techStack?.join(', ') || 'Software Engineering'}

Job Description Context:
"""
${jdText.slice(0, 6000)}
"""

Task:
Generate two tailored narratives:
1. "tailoredSummary": A dense, ATS-optimized 2-3 sentence professional resume summary directly connecting candidate's verified Go/Node/Data/Kubernetes experience to ${company}'s role requirements.
2. "coverLetter": A professional, non-templated 3-paragraph cover letter tailored specifically to ${company} and the ${jobTitle} role:
   - Paragraph 1: Express strong technical interest in ${company}'s mission, citing specific technologies required.
   - Paragraph 2: Highlight 1-2 directly relevant verified achievements (e.g. Bythen AI or Feedloop AI) showing alignment with their exact technical stack and challenges.
   - Paragraph 3: State immediate availability (ASAP notice period), enthusiasm to contribute to their engineering goals, and call to action.

Rules:
- Never invent unlisted technical skills, companies, or solo ownership.
- Zero generic AI cliches ("thrilled to apply", "delve into", "in today's fast-paced environment", "game-changer").
- Output ONLY valid JSON:
{
  "tailoredSummary": "...",
  "coverLetter": "..."
}`

  const result = await invokeCliAgent(prompt, { expectJson: true, timeoutSeconds: 90, model: 'gemini-3.8-flash-low' })
  if (result.success && result.data) {
    const summary = result.data.tailoredSummary || result.data.tailored_summary || result.data.summary
    const letter = result.data.coverLetter || result.data.cover_letter
    if (summary && letter) {
      return {
        tailoredSummary: String(summary).trim(),
        coverLetter: String(letter).trim()
      }
    }
  }
  return null
}



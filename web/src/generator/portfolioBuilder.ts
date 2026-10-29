import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import candidateProfile from '../../../data/candidateProfile.json' with { type: 'json' }
import { uploadToR2 } from '../storage/r2Storage.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface PortfolioBuildResult {
  pdfPath: string
  filename: string
  filesize: number
}

/**
 * Builds a comprehensive, authentic technical Portfolio PDF for Miftahul Muhaemen
 * based strictly on verified systems in data/candidateProfile.json and data/candidate_profile_master.md.
 */
export async function buildCandidatePortfolioPdf(): Promise<PortfolioBuildResult> {
  const p = candidateProfile.personal
  const edu = candidateProfile.education
  const certs = candidateProfile.certifications

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Engineering Portfolio - ${p.fullName}</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #18181b;
      background: #ffffff;
      line-height: 1.5;
      font-size: 10.5pt;
    }
    .header {
      border-bottom: 2px solid #18181b;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .name {
      font-size: 24pt;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #09090b;
      text-transform: uppercase;
    }
    .title {
      font-size: 12pt;
      font-weight: 600;
      color: #52525b;
      margin-top: 2px;
    }
    .contact-bar {
      margin-top: 8px;
      font-size: 9pt;
      color: #71717a;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .contact-bar a {
      color: #18181b;
      text-decoration: none;
      font-weight: 500;
    }
    .section-title {
      font-size: 11pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #09090b;
      border-bottom: 1px solid #d4d4d8;
      padding-bottom: 4px;
      margin-top: 18px;
      margin-bottom: 12px;
    }
    .project-card {
      border: 1px solid #e4e4e7;
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 14px;
      background: #fafafa;
      page-break-inside: avoid;
    }
    .project-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 4px;
    }
    .project-title {
      font-size: 11.5pt;
      font-weight: 700;
      color: #09090b;
    }
    .project-meta {
      font-size: 8.5pt;
      font-weight: 600;
      color: #71717a;
    }
    .project-stack {
      font-size: 8.5pt;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #27272a;
      background: #f4f4f5;
      padding: 3px 6px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 6px;
    }
    .project-desc {
      font-size: 9.5pt;
      color: #3f3f46;
      margin-bottom: 6px;
    }
    .bullet-list {
      list-style-type: disc;
      padding-left: 18px;
      font-size: 9pt;
      color: #27272a;
    }
    .bullet-list li {
      margin-bottom: 3px;
    }
    .skills-grid {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 6px 12px;
      font-size: 9pt;
      margin-bottom: 12px;
    }
    .skill-category {
      font-weight: 700;
      color: #09090b;
    }
    .skill-values {
      color: #3f3f46;
    }
    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>

  <!-- PAGE 1: Header, Executive Narrative, Flagship System 1 & 2 -->
  <div class="header">
    <div class="name">${p.fullName}</div>
    <div class="title">Software &amp; Data Engineer • 5 Years Professional Experience</div>
    <div class="contact-bar">
      <span>Email: <a href="mailto:${p.email}">${p.email}</a></span>
      <span>Phone/WA: ${p.phone}</span>
      <span>Location: ${p.location}</span>
      <span>Portfolio: <a href="${p.portfolio}">${p.portfolio}</a></span>
      <span>GitHub: <a href="${p.github}">${p.github}</a></span>
      <span>LinkedIn: <a href="${p.linkedin}">linkedin.com/in/miftahulmuhaemen</a></span>
    </div>
  </div>

  <div class="section-title">Executive Technical Profile</div>
  <div class="project-desc" style="font-size: 9.5pt; line-height: 1.6; margin-bottom: 14px;">
    Results-oriented Software &amp; Data Engineer with 5 years of professional track record designing resilient backend services, high-throughput RESTful APIs, distributed asynchronous task workers, and analytical data warehouses. Proven experience across Go (net/http, Echo v4, Gin), PostgreSQL transaction optimization, and multi-cloud Kubernetes orchestration (GKE, AKS) with zero downtime migrations.
  </div>

  <div class="section-title">Core Technical Skills</div>
  <div class="skills-grid">
    <div class="skill-category">Languages</div>
    <div class="skill-values">Golang (1.20–1.24), TypeScript, JavaScript (Node.js/Bun), Python, SQL, Rust, PHP</div>

    <div class="skill-category">Backend &amp; APIs</div>
    <div class="skill-values">Go (net/http, Echo v4, Gin, Fiber), Node.js (NestJS, Express), RESTful APIs, WebSockets, Microservices</div>

    <div class="skill-category">Databases &amp; Cache</div>
    <div class="skill-values">PostgreSQL (Query Planning, CTEs, B-Trees, Migrations), MySQL, Redis, MongoDB, SQLite (WAL mode)</div>

    <div class="skill-category">Data &amp; Messaging</div>
    <div class="skill-values">Apache Airflow, GCP Pub/Sub, Great Expectations, Star Schema Data Warehouses, Metabase</div>

    <div class="skill-category">DevOps &amp; Cloud</div>
    <div class="skill-values">Docker (Multi-stage builds), Kubernetes (GKE, AKS, HPA, Helm), GitHub Actions CI/CD, AWS, GCP, Azure</div>
  </div>

  <div class="section-title">Flagship Engineering Projects</div>

  <!-- Project 1: Koperasi KHMB -->
  <div class="project-card">
    <div class="project-header">
      <div class="project-title">1. Koperasi KHMB — Offline-First Point of Sale &amp; Inventory Engine</div>
      <div class="project-meta">Production System • https://koperasi-khmb.cloud</div>
    </div>
    <div class="project-stack">Go (Echo v4) • React • TypeScript • PostgreSQL • Dexie.js (IndexedDB) • WebSerial / WebUSB • Docker</div>
    <div class="project-desc">
      Architected and deployed an active production offline-first point-of-sale system for retail operations, allowing cashiers to conduct uninterrupted transactions during network failures with automatic background delta sync.
    </div>
    <ul class="bullet-list">
      <li><strong>Offline-First Resilience</strong>: Engineered local transaction buffering using client IndexedDB (Dexie.js), paired with an idempotent background sync protocol that reconciles offline batches against the PostgreSQL master without duplicate entries.</li>
      <li><strong>High-Performance Database Design</strong>: Designed B-tree indexes with <code>varchar_pattern_ops</code> for instantaneous barcode/SKU search and single-pass CTEs calculating end-of-day revenue reconciliations in milliseconds.</li>
      <li><strong>Hardware &amp; Security Integration</strong>: Implemented direct browser hardware integration with ESC/POS receipt printers via WebSerial and WebUSB APIs, alongside secure JWT role-based access control separating cashier terminals from admin operations.</li>
    </ul>
  </div>

  <!-- Project 2: Feedloop AI Legal Intelligence -->
  <div class="project-card">
    <div class="project-header">
      <div class="project-title">2. Feedloop AI — Legal Document Intelligence Platform &amp; Multi-Cloud K8s</div>
      <div class="project-meta">Dec 2022 – Nov 2024 • Feedloop AI</div>
    </div>
    <div class="project-stack">Go • Node.js • Kubernetes (GKE, AKS) • PostgreSQL • AWS Bedrock • Qore Low-Code • Docker</div>
    <div class="project-desc">
      Engineered an enterprise AI platform that ingests dense multi-page legislation (100+ pages per statute) to detect contradictory clauses and provide automated compliance insights for legislative drafting.
    </div>
    <ul class="bullet-list">
      <li><strong>Document Intelligence Pipeline</strong>: Built an ingestion and semantic retrieval pipeline using token-overlapped chunking and vector embeddings, orchestrating foundation models via AWS Bedrock with an automated failover to ensure high availability for legal teams.</li>
      <li><strong>Infrastructure Triage &amp; Database Migrations</strong>: Collaborated with the engineering team to administer 3 multi-cloud Kubernetes clusters (GKE and AKS). Triaged service degradation incidents and safely executed production PostgreSQL schema migrations, achieving a 20% reduction in downtime.</li>
      <li><strong>Enterprise Low-Code Delivery</strong>: Delivered full-stack portals for 5 enterprise clients using Feedloop's proprietary low-code engine (Qore) and Google Cloud Functions, accelerating delivery velocity by 30%.</li>
    </ul>
  </div>

  <div class="page-break"></div>

  <!-- PAGE 2: Flagship System 3 & 4, Certifications, Academic Research -->
  <div class="section-title">Flagship Engineering Projects (Continued)</div>

  <!-- Project 3: Bythen AI -->
  <div class="project-card">
    <div class="project-header">
      <div class="project-title">3. Blue Sky Tech (Bythen AI) — Analytical Data Warehouse &amp; Async Workers</div>
      <div class="project-meta">Mar 2025 – Jun 2026 • Bythen AI</div>
    </div>
    <div class="project-stack">Python • Apache Airflow • Go • PostgreSQL • GCP Pub/Sub • Great Expectations • Docker</div>
    <div class="project-desc">
      Architected a foundational analytical Data Warehouse using star schema dimensional modeling, orchestrating scheduled batch pipelines to process millions of operational records.
    </div>
    <ul class="bullet-list">
      <li><strong>Decoupled Asynchronous Workers</strong>: Engineered core Go microservices and event-driven task queues backed by GCP Pub/Sub and webhook callbacks, successfully decoupling long-running GPU generative rendering workloads from client API gateways.</li>
      <li><strong>Automated Data Quality Assertions</strong>: Embedded Great Expectations assertions directly inside Airflow DAGs, validating schema conformance and null thresholds to catch corrupted ingestion metrics before dashboard ingestion.</li>
      <li><strong>Analytical Dashboards</strong>: Aggregated cross-service operational metrics into Metabase dashboards, enabling executive visibility into customer usage patterns and infrastructure compute costs.</li>
    </ul>
  </div>

  <!-- Project 4: ULM Thesis & Computer Vision -->
  <div class="project-card">
    <div class="project-header">
      <div class="project-title">4. Deep Learning UAV Computer Vision — Pothole &amp; Road Damage Detection</div>
      <div class="project-meta">Peer-Reviewed Journal Publication • DOI: 10.20527/jdsse.v1i01.3</div>
    </div>
    <div class="project-stack">Python • TensorFlow • SSD ResNet-50 FPN • UAV Drone Aerial Video • Computer Vision</div>
    <div class="project-desc">
      Authored undergraduate thesis and published peer-reviewed journal paper in the Journal of Data Science and Software Engineering (JDSSE) on autonomous aerial infrastructure inspection.
    </div>
    <ul class="bullet-list">
      <li><strong>Neural Network Architecture</strong>: Implemented Single Shot MultiBox Detector (SSD) with ResNet-50 Feature Pyramid Network (FPN) to accurately detect road surface anomalies from aerial drone video footage under variable altitude and lighting.</li>
      <li><strong>Dataset Annotation &amp; Pipeline</strong>: Collected, preprocessed, and augmented aerial image sequences, achieving high mean Average Precision (mAP) and demonstrating practical automated municipal road auditing.</li>
    </ul>
  </div>

  <div class="section-title">Academic Background &amp; Industry Certifications</div>
  <div class="project-card">
    <div class="project-header">
      <div class="project-title">${edu.institution} — ${edu.degree}</div>
      <div class="project-meta">Graduated: ${edu.graduationDate} • GPA: ${edu.gpa} / 4.0</div>
    </div>
    <div class="project-desc">
      Fakultas Matematika dan Ilmu Pengetahuan Alam (FMIPA) • Program Studi Ilmu Komputer (Computer Science).
    </div>
    <div style="margin-top: 8px;">
      <div style="font-size: 9.5pt; font-weight: 700; color: #09090b; margin-bottom: 4px;">Verified Professional Certifications:</div>
      <ul class="bullet-list">
        ${certs.map(c => `<li><strong>${c.name}</strong> — ${c.issuer} (${c.year})</li>`).join('')}
      </ul>
    </div>
  </div>

  <div class="project-card" style="border-left: 3px solid #18181b;">
    <div style="font-size: 9pt; color: #52525b;">
      <strong>Verification Notice</strong>: All architectural accomplishments, production systems, and metrics documented in this portfolio represent authentic engineering systems built and administered by Miftahul Muhaemen. Repositories and live demonstrations are accessible via <a href="${p.portfolio}" style="color: #09090b; font-weight: 600;">${p.portfolio}</a> and <a href="${p.github}" style="color: #09090b; font-weight: 600;">${p.github}</a>.
    </div>
  </div>

</body>
</html>`

  const OUTPUT_DIR = path.resolve(__dirname, '../../../output/documents')
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  const ASSETS_DIR = path.resolve(__dirname, '../../../data/assets')
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true })
  }

  const filename = `${p.fullName.replace(/\s+/g, '_')}_Portfolio.pdf`
  const pdfPath = path.join(OUTPUT_DIR, filename)
  const assetPath = path.join(ASSETS_DIR, 'portfolio.pdf')

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '18mm',
        bottom: '18mm',
        left: '16mm',
        right: '16mm'
      }
    })

    // Also copy to data/assets/portfolio.pdf for persistent storage
    fs.copyFileSync(pdfPath, assetPath)

    const buffer = fs.readFileSync(pdfPath)
    // Upload to R2: assets/portfolio.pdf
    await uploadToR2('assets/portfolio.pdf', pdfPath, 'application/pdf')

    return {
      pdfPath,
      filename,
      filesize: buffer.length
    }
  } finally {
    await browser.close()
  }
}

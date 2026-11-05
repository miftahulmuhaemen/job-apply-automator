<script lang="ts">
  import { onMount } from 'svelte'
  import { ChevronDown, ChevronRight, Download, Copy, Check, FileText, Briefcase, Mail } from 'lucide-svelte'
  import type { JobRecord } from '$lib/types'

  interface Props {
    job: JobRecord
  }

  const { job }: Props = $props()

  let openResume = $state(true)
  let openPortfolio = $state(true)
  let openCoverLetter = $state(true)

  let coverLetterText = $state<string | null>(null)
  let loadingCoverLetter = $state(false)
  let copied = $state(false)

  async function loadDocuments() {
    loadingCoverLetter = true
    try {
      const res = await fetch(`/api/jobs/${job.id}/documents`)
      const json = await res.json()
      if (json.success && json.coverLetter) {
        coverLetterText = json.coverLetter
      } else {
        coverLetterText = `Dear Hiring Team at ${job.company},

I am writing to express my strong enthusiasm and apply for the ${job.title} position at ${job.company}. Having closely followed your track record delivering transformative software platforms, I am very excited by the opportunity to contribute directly to your high-impact engineering squads.

With over 5 years of professional software engineering experience, I specialize in building high-throughput backend services in Golang (Go 1.22) and crafting clean, responsive user interfaces in React.js and TypeScript.

As demonstrated on my personal portfolio (https://muhaemen.my.id), my latest flagship production build is the Point of Sale & Inventory System for Koperasi KHMB (https://muhaemen.my.id/025_koperasi_khmb/):
• Fullstack Architecture: Paired a high-performance Go Echo v4 REST backend with an offline-first React/TypeScript client (Vite, Tailwind CSS, IndexedDB).
• High-Reliability Data Synchronization: Implemented local transaction buffers with background delta sync and idempotency keys to guarantee zero data loss during network disruptions.
• Relational Query Optimization: Utilized PostgreSQL Common Table Expressions (CTEs) and indexed pattern operators to cut daily inventory report latency by over 70%.
• Hardware & Peripheral Integration: Intercepted USB/Bluetooth HID barcode scanner keystrokes and drove ESC/POS thermal printing natively via WebSerial and WebUSB.

In addition to this production POS system, my prior software engineering tenure across Feedloop AI and PT Arkan Jaya Nusantara equipped me with extensive hands-on experience designing distributed microservices, managing containerized deployments with Docker and Kubernetes, and establishing automated CI/CD pipelines.

I am available to join immediately (ASAP notice period) and am fully prepared to work onsite in Jakarta. Attached to this email, please find my tailored Curriculum Vitae (CV) and Portfolio PDF detailing my technical background, architectural projects, and cloud certifications.

I would welcome the opportunity to discuss how my fullstack engineering skills, product mindset, and enthusiasm can support ${job.company}'s upcoming roadmap. Thank you very much for your time and consideration.

Warm regards,

Miftahul Muhaemen
Fullstack & Backend Engineer
miftahulmuhaemen@gmail.com | +62 896-7717-6035
Portfolio: https://muhaemen.my.id
GitHub: https://github.com/miftahulmuhaemen
LinkedIn: https://www.linkedin.com/in/miftahulmuhaemen/`
      }
    } catch {
      coverLetterText = `Dear Hiring Team at ${job.company},

I am writing to express my strong enthusiasm and apply for the ${job.title} position at ${job.company}. Having closely followed your track record delivering transformative software platforms, I am very excited by the opportunity to contribute directly to your high-impact engineering squads.

With over 5 years of professional software engineering experience, I specialize in building high-throughput backend services in Golang (Go 1.22) and crafting clean, responsive user interfaces in React.js and TypeScript.

As demonstrated on my personal portfolio (https://muhaemen.my.id), my latest flagship production build is the Point of Sale & Inventory System for Koperasi KHMB (https://muhaemen.my.id/025_koperasi_khmb/):
• Fullstack Architecture: Paired a high-performance Go Echo v4 REST backend with an offline-first React/TypeScript client (Vite, Tailwind CSS, IndexedDB).
• High-Reliability Data Synchronization: Implemented local transaction buffers with background delta sync and idempotency keys to guarantee zero data loss during network disruptions.
• Relational Query Optimization: Utilized PostgreSQL Common Table Expressions (CTEs) and indexed pattern operators to cut daily inventory report latency by over 70%.
• Hardware & Peripheral Integration: Intercepted USB/Bluetooth HID barcode scanner keystrokes and drove ESC/POS thermal printing natively via WebSerial and WebUSB.

In addition to this production POS system, my prior software engineering tenure across Feedloop AI and PT Arkan Jaya Nusantara equipped me with extensive hands-on experience designing distributed microservices, managing containerized deployments with Docker and Kubernetes, and establishing automated CI/CD pipelines.

I am available to join immediately (ASAP notice period). Attached to this email, please find my tailored Curriculum Vitae (CV) and Portfolio PDF detailing my technical background, architectural projects, and cloud certifications.

I would welcome the opportunity to discuss how my fullstack engineering skills, product mindset, and enthusiasm can support ${job.company}'s upcoming roadmap. Thank you very much for your time and consideration.

Warm regards,

Miftahul Muhaemen
Fullstack & Backend Engineer
miftahulmuhaemen@gmail.com | +62 896-7717-6035
Portfolio: https://muhaemen.my.id
GitHub: https://github.com/miftahulmuhaemen
LinkedIn: https://www.linkedin.com/in/miftahulmuhaemen/`
    } finally {
      loadingCoverLetter = false
    }
  }

  async function copyCoverLetter() {
    if (!coverLetterText) return
    try {
      await navigator.clipboard.writeText(coverLetterText)
      copied = true
      setTimeout(() => { copied = false }, 2000)
    } catch {}
  }

  onMount(() => {
    loadDocuments()
  })
</script>

<div class="tailored-files-panel">
  <!-- Top Banner -->
  <div class="intro-card">
    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
      <div>
        <div style="font-weight: 700; color: #f4f4f5; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
          Tailored Application Dossier
        </div>
        <div style="font-size: 12px; color: #a1a1aa; margin-top: 2px;">
          All candidate assets customized specifically for <strong>{job.title}</strong> at <strong>{job.company}</strong>.
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button
          type="button"
          class="btn-toggle-all"
          onclick={() => {
            const allOpen = openResume && openPortfolio && openCoverLetter
            openResume = !allOpen
            openPortfolio = !allOpen
            openCoverLetter = !allOpen
          }}
        >
          {openResume && openPortfolio && openCoverLetter ? 'Collapse All' : 'Expand All'}
        </button>
      </div>
    </div>
  </div>

  <!-- Accordion Section 1: Tailored Resume -->
  <div class="accordion-card">
    <div
      class="accordion-header"
      onclick={() => openResume = !openResume}
      role="button"
      tabindex="0"
      onkeydown={(e) => e.key === 'Enter' && (openResume = !openResume)}
    >
      <div class="accordion-title-left">
        {#if openResume}
          <ChevronDown size={16} />
        {:else}
          <ChevronRight size={16} />
        {/if}
        <FileText size={16} style="color: #ffffff;" />
        <span class="accordion-heading">1. Tailored Resume (PDF)</span>
        <span class="badge-tag">Role-Targeted</span>
      </div>
      <div class="accordion-actions" onclick={(e) => e.stopPropagation()} role="presentation">
        <a
          href={`/api/jobs/${job.id}/pdf`}
          download={`${job.company}_Tailored_Resume.pdf`}
          class="btn-action-zinc"
          target="_blank"
        >
          <Download size={13} /> Download Resume
        </a>
      </div>
    </div>

    {#if openResume}
      <div class="accordion-body">
        <iframe
          src={`/api/jobs/${job.id}/pdf`}
          title={`${job.company} Tailored Resume`}
          class="pdf-preview-frame"
        ></iframe>
      </div>
    {/if}
  </div>

  <!-- Accordion Section 2: Tailored Portfolio -->
  <div class="accordion-card">
    <div
      class="accordion-header"
      onclick={() => openPortfolio = !openPortfolio}
      role="button"
      tabindex="0"
      onkeydown={(e) => e.key === 'Enter' && (openPortfolio = !openPortfolio)}
    >
      <div class="accordion-title-left">
        {#if openPortfolio}
          <ChevronDown size={16} />
        {:else}
          <ChevronRight size={16} />
        {/if}
        <Briefcase size={16} style="color: #ffffff;" />
        <span class="accordion-heading">2. Tailored Portfolio (PDF)</span>
        <span class="badge-tag">Role &amp; Stack Match</span>
      </div>
      <div class="accordion-actions" onclick={(e) => e.stopPropagation()} role="presentation">
        <a
          href={`/api/jobs/${job.id}/portfolio-pdf`}
          download={`${job.company}_Tailored_Portfolio.pdf`}
          class="btn-action-zinc"
          target="_blank"
        >
          <Download size={13} /> Download Portfolio
        </a>
      </div>
    </div>

    {#if openPortfolio}
      <div class="accordion-body">
        <div class="portfolio-meta-callout">
          <strong>Featured Flagship Proof:</strong> Point of Sale &amp; Inventory System Koperasi KHMB (Go 1.22 + Echo v4, React/TypeScript, IndexedDB offline sync, PostgreSQL CTEs, Docker, ESC/POS hardware integration).
        </div>
        <iframe
          src={`/api/jobs/${job.id}/portfolio-pdf`}
          title={`${job.company} Tailored Portfolio`}
          class="pdf-preview-frame"
        ></iframe>
      </div>
    {/if}
  </div>

  <!-- Accordion Section 3: Tailored Cover Letter -->
  <div class="accordion-card">
    <div
      class="accordion-header"
      onclick={() => openCoverLetter = !openCoverLetter}
      role="button"
      tabindex="0"
      onkeydown={(e) => e.key === 'Enter' && (openCoverLetter = !openCoverLetter)}
    >
      <div class="accordion-title-left">
        {#if openCoverLetter}
          <ChevronDown size={16} />
        {:else}
          <ChevronRight size={16} />
        {/if}
        <Mail size={16} style="color: #ffffff;" />
        <span class="accordion-heading">3. Tailored Cover Letter / Professional Email</span>
        <span class="badge-tag">Enthusiastic Narrative</span>
      </div>
      <div class="accordion-actions" onclick={(e) => e.stopPropagation()} role="presentation">
        <button
          type="button"
          class="btn-action-zinc"
          onclick={copyCoverLetter}
          disabled={!coverLetterText}
        >
          {#if copied}
            <Check size={13} style="color: #ffffff;" /> Copied!
          {:else}
            <Copy size={13} /> Copy to Clipboard
          {/if}
        </button>
      </div>
    </div>

    {#if openCoverLetter}
      <div class="accordion-body">
        <div class="cover-letter-view">
          {coverLetterText || 'Loading tailored cover letter...'}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .tailored-files-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .intro-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 12px 16px;
  }

  .btn-toggle-all {
    background: #27272a;
    border: 1px solid #3f3f46;
    color: #e4e4e7;
    font-size: 11px;
    font-weight: 500;
    padding: 5px 10px;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-toggle-all:hover {
    background: #3f3f46;
  }

  .accordion-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    overflow: hidden;
  }

  .accordion-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
    background: #18181b;
  }
  .accordion-header:hover {
    background: #202024;
  }

  .accordion-title-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .accordion-heading {
    font-size: 13px;
    font-weight: 600;
    color: #f4f4f5;
  }

  .badge-tag {
    font-size: 10px;
    font-weight: 600;
    background: #27272a;
    color: #a1a1aa;
    border: 1px solid #3f3f46;
    padding: 2px 7px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .accordion-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-action-zinc {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #27272a;
    border: 1px solid #3f3f46;
    color: #f4f4f5;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.15s, border-color 0.15s;
  }
  .btn-action-zinc:hover:not(:disabled) {
    background: #3f3f46;
    border-color: #52525b;
    color: #ffffff;
  }
  .btn-action-zinc:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .accordion-body {
    padding: 12px 16px 16px 16px;
    border-top: 1px solid #27272a;
    background: #09090b;
  }

  .portfolio-meta-callout {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    color: #a1a1aa;
    margin-bottom: 12px;
    line-height: 1.4;
  }
  .portfolio-meta-callout strong {
    color: #f4f4f5;
  }

  .pdf-preview-frame {
    width: 100%;
    height: 520px;
    border: 1px solid #27272a;
    border-radius: 6px;
    background: #ffffff;
  }

  .cover-letter-view {
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 18px 20px;
    font-size: 13px;
    line-height: 1.7;
    color: #f4f4f5;
    white-space: pre-wrap;
    font-family: inherit;
    max-height: 480px;
    overflow-y: auto;
  }
</style>

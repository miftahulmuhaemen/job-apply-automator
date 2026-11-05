<script lang="ts">
  import { onMount } from 'svelte'
  import { Mail, Copy, Check, Download, ExternalLink, Send, CheckCircle2 } from 'lucide-svelte'
  import type { JobRecord } from '$lib/types'

  interface Props {
    job: JobRecord
    jobUuid: string
    onapplied?: () => void
  }

  const { job, jobUuid, onapplied }: Props = $props()

  let loading = $state(false)
  let coverLetterText = $state<string | null>(null)
  let copiedField = $state<'email' | 'subject' | 'body' | null>(null)
  let markingApplied = $state(false)
  let markAppliedSuccess = $state(false)

  // Extract recipient from mailto: or portal
  const recipientEmail = $derived.by(() => {
    if (job.job_url && job.job_url.startsWith('mailto:')) {
      return job.job_url.replace('mailto:', '').split('?')[0].trim()
    }
    if (job.portal && job.portal.includes('@')) {
      return job.portal.trim()
    }
    return 'join@radyalabs.com'
  })

  const subjectLine = $derived(`[${job.title || 'Fullstack Developer'}] — Miftahul Muhaemen`)

  const mailtoLink = $derived.by(() => {
    const encSubject = encodeURIComponent(subjectLine)
    const encBody = encodeURIComponent(coverLetterText || '')
    return `mailto:${recipientEmail}?subject=${encSubject}&body=${encBody}`
  })

  async function loadDocuments() {
    loading = true
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

I am available to join immediately (ASAP notice period) and am fully prepared to work onsite in Jakarta. Attached to this email, please find my tailored Curriculum Vitae (CV) and Portfolio PDF detailing my technical background, architectural projects, and cloud certifications.

I would welcome the opportunity to discuss how my fullstack engineering skills, product mindset, and enthusiasm can support ${job.company}'s upcoming roadmap. Thank you very much for your time and consideration.

Warm regards,

Miftahul Muhaemen
Fullstack & Backend Engineer
miftahulmuhaemen@gmail.com | +62 896-7717-6035
Portfolio: https://muhaemen.my.id
GitHub: https://github.com/miftahulmuhaemen
LinkedIn: https://www.linkedin.com/in/miftahulmuhaemen/`
    } finally {
      loading = false
    }
  }

  async function copyToClipboard(text: string, field: 'email' | 'subject' | 'body') {
    try {
      await navigator.clipboard.writeText(text)
      copiedField = field
      setTimeout(() => { copiedField = null }, 2000)
    } catch {}
  }

  async function handleMarkAsApplied() {
    markingApplied = true
    try {
      const res = await fetch(`/api/jobs/${job.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'APPLIED',
          note: `Applied directly via email to ${recipientEmail} with tailored CV & Portfolio`
        })
      })
      const json = await res.json()
      if (json.success) {
        markAppliedSuccess = true
        if (onapplied) onapplied()
      }
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      markingApplied = false
    }
  }

  onMount(() => {
    loadDocuments()
  })
</script>

<div class="email-submission-panel">
  <!-- Banner Explanation -->
  <div class="info-card">
    <div style="display: flex; align-items: center; gap: 8px;">
      <Mail size={16} style="color: #a1a1aa;" />
      <span style="font-weight: 600; color: #f4f4f5; font-size: 13px;">Direct Email Submission Hub</span>
    </div>
    <p style="margin: 6px 0 0 0; font-size: 12px; color: #a1a1aa; line-height: 1.5;">
      This position accepts applications directly via email. Copy the verified recipient address, subject line, and tailored ATS cover letter below, or click <strong>Open in Email Client</strong>. Download and attach the tailored CV and Portfolio prepared automatically.
    </p>
  </div>

  <!-- Row 1: Target Email Address -->
  <div class="field-card">
    <div class="field-label">1. TARGET RECIPIENT EMAIL</div>
    <div class="field-content-row">
      <code class="code-box">{recipientEmail}</code>
      <button
        type="button"
        class="btn-zinc-secondary"
        onclick={() => copyToClipboard(recipientEmail, 'email')}
      >
        {#if copiedField === 'email'}
          <Check size={13} style="color: #ffffff;" /> Copied!
        {:else}
          <Copy size={13} /> Copy Email
        {/if}
      </button>
    </div>
  </div>

  <!-- Row 2: Subject Line -->
  <div class="field-card">
    <div class="field-label">2. EMAIL SUBJECT (OFFICIAL FORMAT)</div>
    <div class="field-content-row">
      <code class="code-box">{subjectLine}</code>
      <button
        type="button"
        class="btn-zinc-secondary"
        onclick={() => copyToClipboard(subjectLine, 'subject')}
      >
        {#if copiedField === 'subject'}
          <Check size={13} style="color: #ffffff;" /> Copied!
        {:else}
          <Copy size={13} /> Copy Subject
        {/if}
      </button>
    </div>
  </div>

  <!-- Row 3: Attachments Download -->
  <div class="field-card">
    <div class="field-label">3. ATTACHMENT FILES (READY TO DOWNLOAD & ATTACH)</div>
    <div style="display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap;">
      <a
        href={`/api/jobs/${job.id}/pdf`}
        download={`${job.company}_Tailored_Resume.pdf`}
        class="btn-zinc-secondary"
        target="_blank"
      >
        <Download size={14} /> Download Tailored CV / Resume (PDF)
      </a>
      <a
        href={`/api/jobs/${job.id}/portfolio-pdf`}
        download={`${job.company}_Tailored_Portfolio.pdf`}
        class="btn-zinc-secondary"
        target="_blank"
      >
        <Download size={14} /> Download Tailored Portfolio (PDF)
      </a>
    </div>
  </div>

  <!-- Row 4: Tailored Cover Letter / Email Body -->
  <div class="field-card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <div class="field-label" style="margin-bottom: 0;">4. EMAIL BODY / TAILORED COVER LETTER</div>
      <button
        type="button"
        class="btn-zinc-secondary"
        disabled={!coverLetterText}
        onclick={() => copyToClipboard(coverLetterText || '', 'body')}
      >
        {#if copiedField === 'body'}
          <Check size={13} style="color: #ffffff;" /> Copied!
        {:else}
          <Copy size={13} /> Copy Cover Letter
        {/if}
      </button>
    </div>
    <textarea
      readonly
      class="body-textarea"
      rows={8}
      value={coverLetterText || 'Loading tailored cover letter...'}
    ></textarea>
  </div>

  <!-- Row 5: Action Buttons -->
  <div class="actions-row">
    <a
      href={mailtoLink}
      class="btn-zinc-secondary"
      target="_blank"
      rel="noreferrer"
    >
      <Send size={14} /> Open in Email Client (Gmail / Default Mail)
    </a>

    <button
      type="button"
      class="btn-zinc-primary"
      disabled={markingApplied || markAppliedSuccess || job.status === 'APPLIED'}
      onclick={handleMarkAsApplied}
    >
      {#if markAppliedSuccess || job.status === 'APPLIED'}
        <CheckCircle2 size={14} style="color: #09090b;" /> Sent (Status: APPLIED)
      {:else}
        <Check size={14} /> Mark as Sent / Applied
      {/if}
    </button>
  </div>
</div>

<style>
  .email-submission-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .info-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 12px 14px;
  }

  .field-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 12px 14px;
  }

  .field-label {
    font-size: 11px;
    font-weight: 700;
    color: #71717a;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .field-content-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .code-box {
    flex: 1;
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 8px 12px;
    font-family: monospace;
    font-size: 13px;
    color: #e4e4e7;
    white-space: nowrap;
    overflow-x: auto;
  }

  .btn-zinc-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #27272a;
    border: 1px solid #3f3f46;
    color: #f4f4f5;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    text-decoration: none;
    transition: background 0.15s, border-color 0.15s;
  }
  .btn-zinc-secondary:hover:not(:disabled) {
    background: #3f3f46;
    border-color: #52525b;
    color: #ffffff;
  }
  .btn-zinc-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-zinc-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #ffffff;
    border: 1px solid #ffffff;
    color: #09090b;
    padding: 9px 16px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-zinc-primary:hover:not(:disabled) {
    background: #f4f4f5;
  }
  .btn-zinc-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .body-textarea {
    width: 100%;
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 10px 12px;
    color: #e4e4e7;
    font-size: 12px;
    line-height: 1.6;
    font-family: inherit;
    resize: vertical;
  }
  .body-textarea:focus {
    outline: none;
    border-color: #52525b;
  }

  .actions-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding-top: 4px;
    flex-wrap: wrap;
  }
</style>

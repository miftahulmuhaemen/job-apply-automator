<script lang="ts">
  import { onMount } from 'svelte'
  import { Mail, Copy, Check, ExternalLink, Send, FileText, Sparkles, CheckCircle2, AlertCircle } from 'lucide-svelte'
  import type { JobRecord } from '$lib/types'

  interface Props {
    job: JobRecord
    jobUuid: string
    onapplied?: () => void
  }

  const { job, jobUuid, onapplied }: Props = $props()

  let loading = $state(false)
  let coverLetterText = $state<string>('')
  let customSubject = $state<string>('')
  let copiedField = $state<'email' | 'subject' | 'body' | null>(null)
  
  // Gmail API state
  let sendingGmail = $state(false)
  let creatingDraft = $state(false)
  let actionResult = $state<{ type: 'success' | 'error'; message: string } | null>(null)

  let candidateName = $state<string>('')

  // Extract recipient from mailto: or portal
  const recipientEmail = $derived.by(() => {
    if (job.job_url && job.job_url.startsWith('mailto:')) {
      return job.job_url.replace('mailto:', '').split('?')[0].trim()
    }
    if (job.portal && job.portal.includes('@')) {
      return job.portal.trim()
    }
    return ''
  })

  const defaultSubject = $derived(`[${job.title || 'Candidate Application'}]${candidateName ? ` — ${candidateName}` : ''}`)

  const mailtoLink = $derived.by(() => {
    const encSubject = encodeURIComponent(customSubject || defaultSubject)
    const encBody = encodeURIComponent(coverLetterText || '')
    return `mailto:${recipientEmail}?subject=${encSubject}&body=${encBody}`
  })

  let resumeExists = $state<boolean>(false)
  let portfolioExists = $state<boolean>(true)

  // Attached files derived from job specifications with live existence state
  const attachedFiles = $derived.by(() => {
    const safeComp = (job.company || 'Company').replace(/[^a-zA-Z0-9]/g, '_')
    const safeTitle = (job.title || 'Role').replace(/[^a-zA-Z0-9]/g, '_')
    return [
      {
        name: `${safeComp}_${safeTitle}_Resume.pdf`,
        label: 'Resume (PDF)',
        type: 'resume',
        exists: resumeExists,
        url: `/api/jobs/${job.id}/pdf`
      },
      {
        name: `${safeComp}_${safeTitle}_Portfolio.pdf`,
        label: 'Portfolio (PDF)',
        type: 'portfolio',
        exists: portfolioExists,
        url: `/api/jobs/${job.id}/portfolio-pdf`
      }
    ]
  })

  async function loadDocuments() {
    loading = true
    try {
      const res = await fetch(`/api/jobs/${job.id}/documents`)
      const json = await res.json()
      if (json.success) {
        resumeExists = Boolean(json.resumeExists)
        portfolioExists = Boolean(json.portfolioExists ?? true)
        if (json.coverLetter) {
          coverLetterText = json.coverLetter
        }
      } else {
        resumeExists = false
        portfolioExists = false
      }
      customSubject = defaultSubject
    } catch {
      resumeExists = false
      portfolioExists = false
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

  async function handleGmailAction(mode: 'send' | 'draft') {
    if (mode === 'send') {
      sendingGmail = true
    } else {
      creatingDraft = true
    }
    actionResult = null

    try {
      const res = await fetch(`/api/jobs/${job.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email: recipientEmail,
          subject: customSubject || defaultSubject,
          body: coverLetterText,
          mode
        })
      })
      const json = await res.json()
      if (json.success) {
        actionResult = {
          type: 'success',
          message: json.message || (mode === 'send' ? 'Email sent successfully via Gmail API!' : 'Draft created in Gmail!')
        }
        if (mode === 'send' && onapplied) {
          onapplied()
        }
      } else {
        actionResult = {
          type: 'error',
          message: json.error || 'Failed to dispatch Gmail request'
        }
      }
    } catch (err: any) {
      actionResult = {
        type: 'error',
        message: err.message || 'Network error communicating with Gmail dispatch service'
      }
    } finally {
      sendingGmail = false
      creatingDraft = false
    }
  }

  onMount(async () => {
    try {
      const cached = sessionStorage.getItem('candidate_full_name')
      if (cached) {
        candidateName = cached
      } else {
        const res = await fetch('/api/candidate/attributes')
        if (res.ok) {
          const data = await res.json()
          const name = data?.profile?.personal?.full_name || ''
          if (name) {
            candidateName = name
            sessionStorage.setItem('candidate_full_name', name)
          }
        }
      }
    } catch (_) {}
    loadDocuments()
  })
</script>

<div class="email-submission-panel">
  <!-- Interactive Gmail Dispatch Hub Header -->
  <div class="header-card">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <Mail size={16} style="color: #ffffff;" />
          <span style="font-weight: 600; color: #f4f4f5; font-size: 13px;">Gmail Direct Dispatch & Application Preview</span>
        </div>
        <p style="margin: 6px 0 0 0; font-size: 12px; color: #a1a1aa; line-height: 1.5;">
          Review the synthesized Vector RAG application before dispatching. You can send directly via the authorized <strong>Gmail API</strong>, stage a draft to review inside Gmail, or open in your local mail client.
        </p>
      </div>

      {#if job.status === 'APPLIED'}
        <div class="status-pill-applied">
          <CheckCircle2 size={13} />
          <span>Status: APPLIED</span>
        </div>
      {/if}
    </div>

    <!-- Alert / Result Message Banner -->
    {#if actionResult}
      <div class={actionResult.type === 'success' ? 'alert-success' : 'alert-error'}>
        {#if actionResult.type === 'success'}
          <CheckCircle2 size={15} style="color: #ffffff;" />
        {:else}
          <AlertCircle size={15} style="color: #ef4444;" />
        {/if}
        <span>{actionResult.message}</span>
      </div>
    {/if}
  </div>

  <!-- Email Envelope Composition Form -->
  <div class="composer-card">
    <!-- Recipient & Subject Header Fields -->
    <div class="envelope-row">
      <span class="envelope-label">To</span>
      <div class="envelope-content">
        <code class="code-recipient">{recipientEmail}</code>
        <button
          type="button"
          class="btn-zinc-icon"
          title="Copy recipient email"
          onclick={() => copyToClipboard(recipientEmail, 'email')}
        >
          {#if copiedField === 'email'}
            <Check size={13} style="color: #ffffff;" />
          {:else}
            <Copy size={13} />
          {/if}
        </button>
      </div>
    </div>

    <div class="envelope-row">
      <span class="envelope-label">Subject</span>
      <div class="envelope-content">
        <input
          type="text"
          class="subject-input"
          bind:value={customSubject}
          placeholder={defaultSubject}
        />
        <button
          type="button"
          class="btn-zinc-icon"
          title="Copy subject line"
          onclick={() => copyToClipboard(customSubject || defaultSubject, 'subject')}
        >
          {#if copiedField === 'subject'}
            <Check size={13} style="color: #ffffff;" />
          {:else}
            <Copy size={13} />
          {/if}
        </button>
      </div>
    </div>

    <!-- Attached Files Strip with Direct Review Link and Honest State -->
    <div class="envelope-row">
      <span class="envelope-label">Attached</span>
      <div class="attachments-list">
        {#each attachedFiles as file}
          <div class="attachment-chip" class:chip-missing={!file.exists}>
            {#if file.exists}
              <FileText size={13} style="color: #a1a1aa;" />
              <span class="attachment-name">{file.name}</span>
              <span class="attachment-badge badge-ready">Ready</span>
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                class="btn-review-chip"
                title="Review {file.label} in new tab"
              >
                <ExternalLink size={11} /> Review
              </a>
            {:else}
              <AlertCircle size={13} style="color: #ef4444;" />
              <span class="attachment-name unready-name">{file.name}</span>
              <span class="attachment-badge badge-missing">Missing / Not Generated</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    {#if !resumeExists}
      <div class="attachment-warning-banner">
        <AlertCircle size={14} style="color: #ef4444; flex-shrink: 0;" />
        <span>Tailored ATS Resume PDF has not been compiled yet. It will <strong>NOT</strong> be attached to this application email. Please generate it in <strong>Tailored Files</strong> before sending.</span>
      </div>
    {/if}

    <!-- Email Body / Vector RAG Cover Letter Preview & Editor -->
    <div class="body-container">
      <div class="body-header">
        <div style="display: flex; align-items: center; gap: 6px;">
          <Sparkles size={13} style="color: #a1a1aa;" />
          <span style="font-size: 11px; font-weight: 600; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px;">
            Application Body (Vector RAG Synthesized)
          </span>
        </div>
        <button
          type="button"
          class="btn-zinc-secondary"
          disabled={!coverLetterText}
          onclick={() => copyToClipboard(coverLetterText || '', 'body')}
        >
          {#if copiedField === 'body'}
            <Check size={13} style="color: #ffffff;" /> Copied!
          {:else}
            <Copy size={13} /> Copy Body
          {/if}
        </button>
      </div>

      <textarea
        class="body-textarea"
        rows={12}
        bind:value={coverLetterText}
        placeholder="Loading application body..."
      ></textarea>
    </div>

    <!-- Action Dispatch Bar -->
    <div class="composer-actions">
      <div class="left-actions">
        <a
          href={mailtoLink}
          class="btn-zinc-secondary"
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={13} /> Open in Mail App
        </a>
      </div>

      <div class="right-actions">
        <button
          type="button"
          class="btn-zinc-secondary"
          disabled={creatingDraft || sendingGmail || !resumeExists || !coverLetterText || coverLetterText.length < 100}
          title={!resumeExists ? "Resume PDF must be generated before drafting email" : ""}
          onclick={() => handleGmailAction('draft')}
        >
          {#if creatingDraft}
            <span class="spinner"></span> Creating Draft...
          {:else}
            <Mail size={13} /> Create Draft in Gmail
          {/if}
        </button>

        <button
          type="button"
          class="btn-zinc-primary"
          disabled={sendingGmail || creatingDraft || job.status === 'APPLIED' || !resumeExists || !coverLetterText || coverLetterText.length < 100}
          title={!resumeExists ? "Resume PDF must be generated before sending" : ""}
          onclick={() => handleGmailAction('send')}
        >
          {#if sendingGmail}
            <span class="spinner-dark"></span> Sending Application...
          {:else if job.status === 'APPLIED'}
            <CheckCircle2 size={14} style="color: #09090b;" /> Already Applied
          {:else}
            <Send size={14} /> Send via Gmail API
          {/if}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .email-submission-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .header-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 14px 16px;
  }

  .status-pill-applied {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #27272a;
    border: 1px solid #3f3f46;
    color: #f4f4f5;
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 600;
  }

  .alert-success {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #18181b;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    padding: 9px 12px;
    margin-top: 12px;
    font-size: 12px;
    color: #f4f4f5;
  }

  .alert-error {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    padding: 9px 12px;
    margin-top: 12px;
    font-size: 12px;
    color: #ef4444;
  }

  .composer-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .envelope-row {
    display: grid;
    grid-template-columns: 80px 1fr;
    align-items: center;
    gap: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #27272a;
  }

  .envelope-label {
    font-size: 11px;
    font-weight: 600;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .envelope-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .code-recipient {
    flex: 1;
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 5px;
    padding: 6px 10px;
    font-family: monospace;
    font-size: 12px;
    color: #e4e4e7;
  }

  .subject-input {
    flex: 1;
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 5px;
    padding: 7px 10px;
    font-size: 12px;
    color: #f4f4f5;
    outline: none;
    transition: border-color 0.15s;
  }
  .subject-input:focus {
    border-color: #52525b;
  }

  .attachments-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .attachment-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 5px;
    padding: 5px 9px;
    font-size: 11px;
    color: #e4e4e7;
  }

  .attachment-name {
    font-family: monospace;
    color: #d4d4d8;
  }
  .attachment-name.unready-name {
    color: #71717a;
    text-decoration: line-through;
  }

  .attachment-badge {
    background: #27272a;
    color: #a1a1aa;
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    text-transform: uppercase;
    font-weight: 600;
  }
  .attachment-badge.badge-ready {
    background: #18181b;
    color: #f4f4f5;
    border: 1px solid #3f3f46;
  }
  .attachment-badge.badge-missing {
    background: #271717;
    color: #ef4444;
    border: 1px solid #7f1d1d;
  }

  .attachment-chip.chip-missing {
    border-color: #7f1d1d;
    background: #181111;
  }

  .btn-review-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 4px;
    font-size: 10.5px;
    color: #ffffff;
    text-decoration: none;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    margin-left: 2px;
  }
  .btn-review-chip:hover {
    background: #3f3f46;
    border-color: #52525b;
  }

  .attachment-warning-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #18181b;
    border: 1px solid #7f1d1d;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 11.5px;
    color: #fca5a5;
    margin-top: 6px;
    margin-bottom: 6px;
    line-height: 1.4;
  }

  .body-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }

  .body-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .body-textarea {
    width: 100%;
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 12px 14px;
    color: #f4f4f5;
    font-size: 12px;
    line-height: 1.6;
    font-family: inherit;
    resize: vertical;
    outline: none;
    transition: border-color 0.15s;
  }
  .body-textarea:focus {
    border-color: #52525b;
  }

  .composer-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding-top: 8px;
    flex-wrap: wrap;
  }

  .left-actions, .right-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-zinc-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: #27272a;
    border: 1px solid #3f3f46;
    color: #a1a1aa;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .btn-zinc-icon:hover {
    background: #3f3f46;
    color: #ffffff;
  }

  .btn-zinc-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #27272a;
    border: 1px solid #3f3f46;
    color: #f4f4f5;
    padding: 7px 12px;
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
    padding: 8px 16px;
    font-size: 12px;
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

  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  .spinner-dark {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(9, 9, 11, 0.3);
    border-top-color: #09090b;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte'
  import type { JobRecord } from '$lib/types'
  import Tabs from '../ui/Tabs.svelte'
  import { X, ExternalLink } from 'lucide-svelte'
  import SpecificationsTab from './dossier/SpecificationsTab.svelte'
  import FormPreviewTab from './dossier/FormPreviewTab.svelte'
  import BenefitsTab from './dossier/BenefitsTab.svelte'
  import ResumeTab from './dossier/ResumeTab.svelte'
  import CoverLetterTab from './dossier/CoverLetterTab.svelte'
  import SubmissionProofTab from './dossier/SubmissionProofTab.svelte'
  import AuditTrailTab from './dossier/AuditTrailTab.svelte'
  import EmailSubmissionTab from './dossier/EmailSubmissionTab.svelte'
  import TailoredFilesTab from './dossier/TailoredFilesTab.svelte'

  let {
    job,
    initialTab = 0,
    onclose,
    onswitchview
  }: {
    job: JobRecord
    initialTab?: number
    onclose: () => void
    onswitchview?: (view: string) => void
  } = $props()

  const isEmailJob = $derived(
    (job.portal || '').toLowerCase().includes('email') ||
    (job.job_url || '').toLowerCase().startsWith('mailto:')
  )

  let activeTab = $state(0)
  $effect(() => {
    activeTab = initialTab
  })
  const jobUuid = $derived(job.uuid || String(job.id))

  // Tab 4: Cover Letter State
  let loadingCoverLetter = $state(false)
  let coverLetterText = $state<string | null>(null)
  let coverLetterCopied = $state(false)

  // Tab 5: Submission Retry State
  let retryingSubmission = $state(false)
  let submissionMessage = $state<string | null>(null)

  // Derived Counts
  const benefitCount = $derived.by(() => {
    if (!job.benefits) return 0
    return job.benefits.split(/\r?\n|;/g).filter(b => b.trim().length > 0).length
  })

  const historyCount = $derived.by(() => {
    if (!job.histories) return 0
    try {
      const parsed = JSON.parse(job.histories)
      return Array.isArray(parsed) ? parsed.length : 0
    } catch {
      return 0
    }
  })

  async function fetchCoverLetter() {
    if (coverLetterText) return
    loadingCoverLetter = true
    try {
      const res = await fetch(`/api/jobs/${jobUuid}/documents`)
      const json = await res.json()
      if (json.success && json.coverLetter) {
        coverLetterText = json.coverLetter
      } else {
        coverLetterText = json.error || 'No cover letter generated for this role.'
      }
    } catch (err: any) {
      coverLetterText = `Error loading cover letter: ${err.message}`
    } finally {
      loadingCoverLetter = false
    }
  }

  async function handleCopyCoverLetter() {
    if (!coverLetterText) return
    try {
      await navigator.clipboard.writeText(coverLetterText)
      coverLetterCopied = true
      setTimeout(() => { coverLetterCopied = false }, 2500)
    } catch {}
  }

  async function handleRetrySubmission() {
    retryingSubmission = true
    submissionMessage = null
    try {
      const res = await fetch(`/api/jobs/${jobUuid}/submit`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        submissionMessage = 'Application submitted successfully!'
      } else {
        submissionMessage = `Submission failed: ${json.error || 'Server error'}`
      }
    } catch (err: any) {
      submissionMessage = `Connection error: ${err.message}`
    } finally {
      retryingSubmission = false
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose()
  }

  function calculatePostingLapse(postedAt?: string, createdAt?: string): { days: number; label: string; dateFormatted: string } | null {
    const raw = postedAt || createdAt
    if (!raw) return null
    const d = new Date(raw)
    if (isNaN(d.getTime())) return null
    const diffMs = Date.now() - d.getTime()
    const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
    
    const dateFormatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

    let label = ''
    if (diffDays === 0) {
      label = 'Posted today'
    } else if (diffDays === 1) {
      label = '1 day lapse (yesterday)'
    } else {
      label = `${diffDays} days lapse`
    }

    return { days: diffDays, label, dateFormatted }
  }

  function calculateRecruiterActive(lastActiveAt?: string): string | null {
    if (!lastActiveAt) return null
    const d = new Date(lastActiveAt)
    if (isNaN(d.getTime())) return null
    const diffMs = Date.now() - d.getTime()
    const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
    if (diffDays === 0) return 'Recruiter active today'
    if (diffDays === 1) return 'Recruiter active yesterday'
    return `Recruiter active ${diffDays} days ago`
  }

  const postingLapse = $derived(calculatePostingLapse(job.posted_at, job.created_at))
  const recruiterActiveText = $derived(calculateRecruiterActive(job.last_active_at))

  onMount(() => {
    if (activeTab === 4) fetchCoverLetter()
  })

  $effect(() => {
    if (activeTab === 4 && !coverLetterText && !loadingCoverLetter) {
      fetchCoverLetter()
    }
  })
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={onclose} role="presentation">
  <div class="modal-panel modal-wide" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    
    <!-- Modal Header -->
    <div class="modal-header">
      <div>
        <div class="modal-category">JOB DOSSIER</div>
        <h2 class="modal-title">{job.title}</h2>
        <div class="modal-subtitle">
          {job.company} &bull; {job.portal} &bull; {job.location || 'Indonesia'}
        </div>
        {#if postingLapse}
          <div class="modal-lapse">
            {postingLapse.days} {postingLapse.days === 1 ? 'day' : 'days'} lapse &bull; Posted {postingLapse.dateFormatted}{#if recruiterActiveText} &bull; {recruiterActiveText}{/if}{#if job.triage_decision === 'PROCESSING'} &bull; <span style="color: #a1a1aa;">Synthesizing assets in background...</span>{:else if job.triage_decision === 'READY'} &bull; <span style="color: #a1a1aa;">Assets tailored</span>{/if}
          </div>
        {/if}
      </div>
      <button type="button" class="btn-icon" onclick={onclose} aria-label="Close dialog">
        <X size={18} />
      </button>
    </div>

    <!-- Tabs Navigation Bar -->
    <div style="padding: 12px 20px 0 20px; border-bottom: 1px solid #27272a; background: #18181b;">
      <Tabs
        value={String(activeTab)}
        items={[
          { id: '0', label: 'Specifications' },
          { id: '1', label: isEmailJob ? 'Email Submission' : 'Form Fill Preview' },
          { id: '2', label: 'Benefits & Perks', count: benefitCount },
          { id: '3', label: 'Tailored Files' },
          { id: '4', label: 'Submission Proof' },
          { id: '5', label: 'Audit Trail', count: historyCount }
        ]}
        onchange={(id) => activeTab = parseInt(id, 10)}
      />
    </div>

    <!-- Modal Body Content -->
    <div class="modal-body">
      {#if activeTab === 0}
        <SpecificationsTab {job} />
      {:else if activeTab === 1}
        {#if isEmailJob}
          <EmailSubmissionTab
            {job}
            {jobUuid}
            onapplied={() => {
              job.status = 'APPLIED'
            }}
          />
        {:else}
          <FormPreviewTab
            {job}
            {jobUuid}
            {onclose}
            {onswitchview}
          />
        {/if}
      {:else if activeTab === 2}
        <BenefitsTab benefitsRaw={job.benefits} />
      {:else if activeTab === 3}
        <TailoredFilesTab {job} />
      {:else if activeTab === 4}
        <SubmissionProofTab
          {job}
          {jobUuid}
          {retryingSubmission}
          {submissionMessage}
          onretry={handleRetrySubmission}
        />
      {:else if activeTab === 5}
        <AuditTrailTab {job} />
      {/if}
    </div>

    <!-- Modal Footer -->
    <div class="modal-footer">
      <button type="button" class="btn-primary" onclick={onclose}>
        Close
      </button>
    </div>

  </div>
</div>

<style>
  .modal-wide {
    max-width: 960px;
    width: 95vw;
    height: 90vh;
  }
  .modal-category {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #a1a1aa;
    margin-bottom: 3px;
  }
  .modal-title {
    font-size: 18px;
    font-weight: 700;
    color: #ffffff;
  }
  .modal-subtitle {
    font-size: 13px;
    color: #ffffff;
    font-weight: 500;
    margin-top: 3px;
  }
  .modal-lapse {
    font-size: 12px;
    color: #f4f4f5;
    margin-top: 4px;
    line-height: 1.4;
  }
  .btn-primary {
    background-color: #ffffff;
    color: #09090b;
    border: 1px solid #ffffff;
    font-weight: 600;
    padding: 7px 14px;
    border-radius: 6px;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-primary:hover {
    background-color: #f4f4f5;
  }
  .btn-secondary {
    background-color: #27272a;
    color: #f4f4f5;
    border: 1px solid #3f3f46;
    padding: 7px 14px;
    border-radius: 6px;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .btn-secondary:hover {
    background-color: #3f3f46;
  }
</style>

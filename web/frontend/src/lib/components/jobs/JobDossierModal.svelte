<script lang="ts">
  import { onMount } from 'svelte'
  import type { JobRecord } from '$lib/types'
  import Tabs from '../ui/Tabs.svelte'
  import Accordion from '../ui/Accordion.svelte'
  import AccordionItem from '../ui/AccordionItem.svelte'
  import {
    X,
    ExternalLink,
    Download,
    Copy,
    Check,
    AlertTriangle,
    FileText,
    ShieldAlert,
    RefreshCw,
    Upload,
    Clock,
    DollarSign,
    CheckCircle,
    ChevronRight
  } from 'lucide-svelte'

  interface FormFieldItem {
    key: string
    label: string
    value: string
    required: boolean
    source: string
    status: string
  }

  interface FormPreviewGroup {
    groupName: string
    fields: FormFieldItem[]
  }

  interface ExpectedSalaryBid {
    monthlyFormatted: string
    currency: string
    minimum: number
    maximum: number
    specificBidAmount: number
    specificFormatted: string
    basis: string
    strategy: string
  }

  interface FormPreviewData {
    expectedSalaryBid: ExpectedSalaryBid
    groups: FormPreviewGroup[]
    isBlocked: boolean
    unresolvedRequiredCount: number
    unresolvedKeys: string[]
  }

  interface HistoryItem {
    timestamp: string
    from_status?: string
    to_status: string
    note?: string
  }

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

  let activeTab = $state(0)
  $effect(() => {
    activeTab = initialTab
  })
  const jobUuid = $derived(job.uuid || String(job.id))

  // Tab 1: Form Preview State
  let loadingPreview = $state(false)
  let previewError = $state<string | null>(null)
  let previewData = $state<FormPreviewData | null>(null)
  let photoUploading = $state(false)
  let photoStatus = $state('')
  let portfolioGenerating = $state(false)
  let portfolioStatus = $state('')
  let openAccordionGroups = $state<Record<number, boolean>>({})

  function toggleAccordionGroup(index: number) {
    openAccordionGroups[index] = !openAccordionGroups[index]
  }

  function expandAllGroups() {
    if (!previewData) return
    const next: Record<number, boolean> = {}
    previewData.groups.forEach((_, idx) => { next[idx] = true })
    openAccordionGroups = next
  }

  function collapseAllGroups() {
    openAccordionGroups = {}
  }

  $effect(() => {
    if (previewData && Object.keys(openAccordionGroups).length === 0) {
      const initialOpen: Record<number, boolean> = {}
      previewData.groups.forEach((g, idx) => {
        const hasMissing = g.fields.some(f => f.required && (f.value.includes('[MISSING') || f.value.includes('[NOT SPECIFIED')))
        if (idx === 0 || hasMissing) {
          initialOpen[idx] = true
        }
      })
      openAccordionGroups = initialOpen
    }
  })

  // Tab 4: Cover Letter State
  let loadingCoverLetter = $state(false)
  let coverLetterText = $state<string | null>(null)
  let coverLetterCopied = $state(false)

  // Tab 5: Submission Retry State
  let retryingSubmission = $state(false)
  let submissionMessage = $state<string | null>(null)

  // Parsed Q&A
  const qaPairs = $derived.by(() => {
    const qList = (job.screening_questions || '').split(';').map(s => s.trim()).filter(Boolean)
    const aList = (job.candidate_answers || '').split(';').map(s => s.trim()).filter(Boolean)
    const maxLen = Math.max(qList.length, aList.length)
    const pairs: Array<{ question: string; answer: string }> = []
    for (let i = 0; i < maxLen; i++) {
      pairs.push({
        question: qList[i] || `Screening Question #${i + 1}`,
        answer: aList[i] || 'Proficient / Qualified'
      })
    }
    return pairs
  })

  // Parsed Benefits
  const benefitItems = $derived.by(() => {
    const raw = job.benefits || ''
    if (!raw) return []
    return raw
      .split(/\r?\n|;/g)
      .map(b => b.replace(/^[\s\-\*•\u2022\d\.\)]+/, '').trim())
      .filter(b => b.length > 0)
  })

  // Parsed Tech Stack
  const techStackList = $derived.by(() => {
    if (!job.tech_stack) return []
    return job.tech_stack.split(',').map(t => t.trim()).filter(Boolean)
  })

  // Parsed Histories
  const historyList = $derived.by(() => {
    if (!job.histories) return []
    try {
      const parsed = JSON.parse(job.histories)
      return Array.isArray(parsed) ? (parsed as HistoryItem[]) : []
    } catch {
      return []
    }
  })

  // Missing fields for Form Preview
  const missingFields = $derived.by(() => {
    if (!previewData) return []
    const list: string[] = []
    previewData.groups.forEach(g => {
      g.fields.forEach(f => {
        if (f.required && (f.value.includes('[MISSING') || f.value.includes('[NOT SPECIFIED'))) {
          list.push(f.label)
        }
      })
    })
    return list
  })

  async function fetchFormPreview() {
    loadingPreview = true
    previewError = null
    try {
      const res = await fetch(`/api/jobs/${jobUuid}/form-preview`)
      const json = await res.json()
      if (json.success && json.data) {
        previewData = json.data
      } else {
        previewError = json.error || 'Failed to load form fill preview'
      }
    } catch (err: any) {
      previewError = err.message
    } finally {
      loadingPreview = false
    }
  }

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

  async function handlePhotoUpload(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files && input.files[0]
    if (!file) return

    photoUploading = true
    photoStatus = 'Uploading candidate photo...'
    try {
      const res = await fetch('/api/candidate/photo', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'image/jpeg',
          'X-File-Name': file.name
        },
        body: file
      })
      const data = await res.json()
      if (data.success) {
        photoStatus = 'Photo uploaded successfully!'
        await fetchFormPreview()
      } else {
        photoStatus = 'Upload failed: ' + (data.error || 'Server error')
      }
    } catch (err: any) {
      photoStatus = 'Upload error: ' + err.message
    } finally {
      photoUploading = false
    }
  }

  async function handleGeneratePortfolio() {
    portfolioGenerating = true
    portfolioStatus = 'Compiling authentic portfolio PDF...'
    try {
      const res = await fetch('/api/candidate/portfolio/generate', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        portfolioStatus = 'Portfolio compiled successfully!'
        await fetchFormPreview()
      } else {
        portfolioStatus = 'Generation failed: ' + (data.error || 'Server error')
      }
    } catch (err: any) {
      portfolioStatus = 'Generation error: ' + err.message
    } finally {
      portfolioGenerating = false
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

  onMount(() => {
    if (activeTab === 1) fetchFormPreview()
    if (activeTab === 4) fetchCoverLetter()
  })

  $effect(() => {
    if (activeTab === 1 && !previewData && !loadingPreview && !previewError) {
      fetchFormPreview()
    }
    if (activeTab === 4 && !coverLetterText && !loadingCoverLetter) {
      fetchCoverLetter()
    }
  })
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={onclose} role="presentation">
  <div class="modal-panel modal-wide" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    
    <!-- Modal Header -->
    <div class="modal-header">
      <div>
        <div class="modal-category">JOB DOSSIER</div>
        <h2 class="modal-title">{job.title}</h2>
        <div class="modal-subtitle">
          {job.company} &bull; {job.portal} &bull; {job.location || 'Indonesia'}
        </div>
      </div>
      <button type="button" class="btn-icon" onclick={onclose} aria-label="Close dialog">
        <X size={18} />
      </button>
    </div>

    <!-- Tabs Navigation Bar (Authentic Shadcn Segmented Control) -->
    <div style="padding: 12px 20px 0 20px; border-bottom: 1px solid #27272a; background: #18181b;">
      <Tabs
        value={String(activeTab)}
        items={[
          { id: '0', label: 'Specifications' },
          { id: '1', label: 'Form Fill Preview' },
          { id: '2', label: 'Benefits & Perks', count: benefitItems.length },
          { id: '3', label: 'Tailored Resume (PDF)' },
          { id: '4', label: 'Cover Letter' },
          { id: '5', label: 'Submission Proof' },
          { id: '6', label: 'Audit Trail', count: historyList.length }
        ]}
        onchange={(id) => activeTab = parseInt(id, 10)}
      />
    </div>

    <!-- Modal Body Content -->
    <div class="modal-body">
      
      <!-- TAB 0: Specifications -->
      {#if activeTab === 0}
        <div class="modal-grid">
          <div class="modal-grid-item">
            <div class="modal-grid-label">Experience Required</div>
            <div class="modal-grid-value">{job.experience_req || 'Not specified'}</div>
          </div>
          <div class="modal-grid-item">
            <div class="modal-grid-label">Listed Salary</div>
            <div class="modal-grid-value">{job.salary_raw || 'Undisclosed'}</div>
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-section-title">Reliable Market Salary Benchmark</div>
          <div style="font-size: 15px; font-weight: 700; color: #ffffff;">
            {job.market_salary_benchmark || 'Under Survey'}
          </div>
          <div style="font-size: 12px; color: #a1a1aa; margin-top: 3px;">
            Source: {job.benchmark_source || 'Industry Standard'}
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-section-title">Detected Technologies</div>
          {#if techStackList.length > 0}
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
              {#each techStackList as tag}
                <span class="tech-tag">{tag}</span>
              {/each}
            </div>
          {:else}
            <div style="color: #a1a1aa; font-size: 12px; margin-top: 4px;">General / Not specified</div>
          {/if}
        </div>

        <div class="modal-section">
          <div class="modal-section-title">Verbatim Job Specifications &amp; Responsibilities</div>
          <div class="verbatim-box">
            {job.full_description || job.requirements_summary || 'No detailed specifications found.'}
          </div>
        </div>

        {#if qaPairs.length > 0}
          <div class="modal-section">
            <div class="modal-section-title">Pre-Screening Questions &amp; Form Answers</div>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">
              {#each qaPairs as pair}
                <div class="qa-card">
                  <div class="qa-q">{pair.question}</div>
                  <div class="qa-a">Proposed Answer: {pair.answer}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

      <!-- TAB 1: Form Fill Preview -->
      {:else if activeTab === 1}
        {#if loadingPreview}
          <div style="padding: 40px; text-align: center; color: #a1a1aa;">
            <RefreshCw size={20} class="spin" style="margin-bottom: 8px;" />
            <div>Resolving form fill preview against live application requirements...</div>
          </div>
        {:else if previewError}
          <div class="alert-box alert-error">
            <AlertTriangle size={16} />
            <div>Could not generate form preview: {previewError}</div>
          </div>
        {:else if previewData}
          <!-- Missing Prerequisites Alert -->
          {#if missingFields.length > 0}
            <div class="alert-box alert-warning">
              <div>
                <div style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #ffffff; margin-bottom: 4px;">
                  Missing Portal Prerequisites ({missingFields.length})
                </div>
                <div style="font-size: 12px; color: #d4d4d8; line-height: 1.5;">
                  This employer form mandates required files or inputs that are not present in your candidate profile. Application cannot proceed until these are supplied:
                </div>
                <ul style="margin: 8px 0 0 18px; font-size: 12px; color: #ffffff;">
                  {#each missingFields as item}
                    <li>{item}</li>
                  {/each}
                </ul>
              </div>
            </div>
          {/if}

          <!-- Expected Salary Bid Banner -->
          <div class="card-box" style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
              <div>
                <div class="box-caption">Calculated Monthly Salary Expectation Bid</div>
                <div style="font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 2px;">
                  {previewData.expectedSalaryBid.monthlyFormatted}
                </div>
                <div style="font-size: 12px; color: #a1a1aa; margin-top: 4px;">
                  {previewData.expectedSalaryBid.basis} &bull; {previewData.expectedSalaryBid.strategy}
                </div>
              </div>
              <div style="text-align: right; font-size: 12px;">
                <div class="box-caption">Employer Listed Range</div>
                <div style="color: #ffffff; font-weight: 600; margin-top: 3px; font-size: 13px;">
                  {job.salary_raw || 'Undisclosed'}
                </div>
              </div>
            </div>
          </div>

          <!-- Action Required Banner if Blocked -->
          {#if previewData.isBlocked}
            <div class="card-box" style="border-color: #71717a; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap;">
              <div>
                <div style="font-size: 12.5px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.04em;">
                  Action Required: Submission &amp; Approval Blocked
                </div>
                <div style="font-size: 12px; color: #a1a1aa; margin-top: 3px;">
                  {previewData.unresolvedRequiredCount} mandatory application field(s) are NOT SPECIFIED in Candidate Profile.
                </div>
              </div>
              {#if onswitchview}
                <button
                  type="button"
                  class="btn-primary"
                  onclick={() => { onclose(); onswitchview('profile') }}
                >
                  Resolve in Profile Table
                </button>
              {/if}
            </div>
          {/if}

          <!-- Form Preview Groups Accordion (Authentic Flush Shadcn Accordion) -->
          <div class="accordion-container" style="border: 1px solid #27272a; border-radius: 8px; padding: 12px 16px; background: #18181b;">
            <div class="accordion-topbar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #27272a;">
              <span class="accordion-topbar-title" style="font-size: 12px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.04em;">Application Form Sections ({previewData.groups.length})</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <button type="button" class="btn-text-action" onclick={expandAllGroups}>Expand All</button>
                <span style="color: #3f3f46;">&bull;</span>
                <button type="button" class="btn-text-action" onclick={collapseAllGroups}>Collapse All</button>
              </div>
            </div>

            <Accordion>
              {#each previewData.groups as group, groupIndex}
                {@const missingInGroup = group.fields.filter(f => f.required && (f.value.includes('[MISSING') || f.value.includes('[NOT SPECIFIED'))).length}
                {@const isOpen = openAccordionGroups[groupIndex] ?? false}

                <AccordionItem
                  title={group.groupName}
                  badge={missingInGroup > 0 ? `${missingInGroup} missing` : 'Resolved'}
                  subtitle={`${group.fields.length} ${group.fields.length === 1 ? 'field' : 'fields'}`}
                  open={isOpen}
                  ontoggle={() => toggleAccordionGroup(groupIndex)}
                >
                  <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
                      {#each group.fields as field}
                        {@const isMissing = field.required && (field.value.includes('[MISSING') || field.value.includes('[NOT SPECIFIED'))}
                        <div class="form-preview-row" class:row-missing={isMissing}>
                          <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                              <span style="font-weight: 600; color: #f4f4f5; font-size: 13px;">{field.label}</span>
                              {#if field.required}
                                <span class="required-tag">Required</span>
                              {/if}
                            </div>
                            <div style="font-size: 12.5px; color: {isMissing ? '#ffffff' : '#d4d4d8'}; word-break: break-word;">
                              {field.value}
                            </div>

                            <!-- Special Candidate Photo Action -->
                            {#if field.key === 'photo_file' || field.key === 'photo'}
                              <div style="margin-top: 10px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <label class="btn-secondary" style="font-size: 11px; cursor: pointer;">
                                  <Upload size={12} />
                                  {isMissing ? 'Upload Candidate Photo (JPEG/PNG max 4MB)' : 'Replace Photo'}
                                  <input type="file" accept="image/jpeg,image/png" onchange={handlePhotoUpload} style="display: none;" />
                                </label>
                                {#if !isMissing}
                                  <a href="/api/candidate/photo" target="_blank" rel="noreferrer" style="font-size: 11px; color: #f4f4f5; text-decoration: underline;">
                                    View Candidate Photo
                                  </a>
                                {/if}
                                {#if photoStatus}
                                  <span style="font-size: 11px; color: #a1a1aa;">{photoStatus}</span>
                                {/if}
                              </div>
                            {/if}

                            <!-- Special Portfolio PDF Action -->
                            {#if field.key === 'portfolio_pdf' || field.key === 'portfolio'}
                              <div style="margin-top: 10px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <button
                                  type="button"
                                  class="btn-secondary"
                                  style="font-size: 11px;"
                                  disabled={portfolioGenerating}
                                  onclick={handleGeneratePortfolio}
                                >
                                  <FileText size={12} />
                                  {isMissing ? 'Construct Portfolio PDF' : 'Reconstruct Portfolio'}
                                </button>
                                {#if !isMissing}
                                  <a href="/api/candidate/portfolio" target="_blank" rel="noreferrer" style="font-size: 11px; color: #f4f4f5; text-decoration: underline;">
                                    View Portfolio PDF
                                  </a>
                                {/if}
                                {#if portfolioStatus}
                                  <span style="font-size: 11px; color: #a1a1aa;">{portfolioStatus}</span>
                                {/if}
                              </div>
                            {/if}
                          </div>

                          <div class="source-tag">
                            {field.source.replace('_', ' ')}
                          </div>
                        </div>
                      {/each}
                    </div>
                  </AccordionItem>
              {/each}
            </Accordion>
          </div>
        {/if}

      <!-- TAB 2: Benefits & Perks -->
      {:else if activeTab === 2}
        <div class="modal-section">
          <div class="modal-section-title">Itemized Compensation &amp; Perks Package</div>
          {#if benefitItems.length > 0}
            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
              {#each benefitItems as item}
                <div class="perk-card">
                  <span style="color: #71717a; font-size: 14px; line-height: 1.4; user-select: none;">&bull;</span>
                  <span style="color: #f4f4f5; font-size: 13px;">{item}</span>
                </div>
              {/each}
            </div>
          {:else}
            <div class="card-box" style="color: #a1a1aa; font-size: 13px; margin-top: 8px;">
              No specific perks or benefits itemized by employer.
            </div>
          {/if}
        </div>

      <!-- TAB 3: Tailored Resume (PDF) -->
      {:else if activeTab === 3}
        <div class="modal-section">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
            <div>
              <div class="modal-section-title" style="margin-bottom: 2px;">ATS-Optimized Tailored Resume</div>
              <div style="font-size: 12px; color: #a1a1aa;">
                Generated with matched keywords tailored to {job.company}.
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <a
                href="/api/jobs/{jobUuid}/pdf"
                download
                class="btn-primary"
                style="text-decoration: none;"
              >
                <Download size={13} /> Download PDF
              </a>
              <a
                href="/api/jobs/{jobUuid}/pdf"
                target="_blank"
                rel="noreferrer"
                class="btn-secondary"
                style="text-decoration: none;"
              >
                <ExternalLink size={13} /> Open PDF &nearr;
              </a>
            </div>
          </div>

          <div class="pdf-container">
            <iframe
              src="/api/jobs/{jobUuid}/pdf"
              title="Tailored Resume Preview"
              style="width: 100%; height: 540px; border: none; background: #ffffff;"
            ></iframe>
          </div>
        </div>

      <!-- TAB 4: Cover Letter -->
      {:else if activeTab === 4}
        <div class="modal-section">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
            <div>
              <div class="modal-section-title" style="margin-bottom: 2px;">Tailored Cover Letter</div>
              <div style="font-size: 12px; color: #a1a1aa;">
                Customized narrative for {job.company} based on candidate profile.
              </div>
            </div>
            <button
              type="button"
              class="btn-secondary"
              onclick={handleCopyCoverLetter}
              disabled={!coverLetterText}
            >
              {#if coverLetterCopied}
                <Check size={13} /> Copied!
              {:else}
                <Copy size={13} /> Copy to Clipboard
              {/if}
            </button>
          </div>

          {#if loadingCoverLetter}
            <div style="padding: 40px; text-align: center; color: #a1a1aa;">
              <RefreshCw size={20} class="spin" style="margin-bottom: 8px;" />
              <div>Loading tailored cover letter...</div>
            </div>
          {:else}
            <div class="cover-letter-box">
              {coverLetterText || 'No cover letter generated yet.'}
            </div>
          {/if}
        </div>

      <!-- TAB 5: Submission Proof & Roadblock Diagnostics -->
      {:else if activeTab === 5}
        <div class="modal-section">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
            <div>
              <div class="modal-section-title" style="margin-bottom: 2px;">
                Submission Verification &amp; Roadblock Diagnostics
              </div>
              <div style="font-size: 12px; color: #a1a1aa;">
                Visual evidence, prerequisite gates, and confirmation captured directly from live session.
              </div>
            </div>
            {#if job.applied_at}
              <div style="font-size: 12px; color: #a1a1aa;">Submitted: {job.applied_at}</div>
            {/if}
          </div>

          <!-- Roadblock Diagnostic Alert Banner -->
          {#if job.status === 'FAILED' || job.last_error || job.roadblock_url}
            <div class="alert-box alert-error" style="flex-direction: column; align-items: stretch; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <span class="badge" style="border-color: #52525b; color: #ffffff;">
                  SUBMISSION ROADBLOCK DETECTED
                </span>
                {#if job.roadblock_url}
                  <a
                    href={job.roadblock_url}
                    target="_blank"
                    rel="noreferrer"
                    class="btn-primary"
                    style="text-decoration: none; padding: 4px 10px; font-size: 11px;"
                  >
                    Open Roadblock Page &nearr;
                  </a>
                {/if}
              </div>
              <div style="font-size: 13px; font-weight: 600; color: #ffffff; line-height: 1.5; margin-bottom: 8px;">
                {job.last_error || 'Submission halted by platform requirement.'}
              </div>
              {#if job.roadblock_url}
                <div style="font-size: 11.5px; color: #a1a1aa; background: #09090b; padding: 8px 10px; border-radius: 4px; border: 1px solid #27272a; word-break: break-all; margin-bottom: 10px;">
                  Prerequisite URL: <a href={job.roadblock_url} target="_blank" rel="noreferrer" style="color: #ffffff; text-decoration: underline;">{job.roadblock_url}</a>
                </div>
              {/if}
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <button
                  type="button"
                  class="btn-secondary"
                  onclick={handleRetrySubmission}
                  disabled={retryingSubmission}
                  style="font-size: 11.5px; padding: 5px 12px;"
                >
                  <RefreshCw size={12} class={retryingSubmission ? 'spin' : ''} />
                  Retry Pre-Scripted Submission
                </button>
                <a
                  href={job.job_url}
                  target="_blank"
                  rel="noreferrer"
                  class="btn-secondary"
                  style="text-decoration: none; font-size: 11.5px; padding: 5px 12px;"
                >
                  Open Portal Listing &nearr;
                </a>
                {#if submissionMessage}
                  <span style="font-size: 12px; color: #f4f4f5;">{submissionMessage}</span>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Unverifiable Portal Notice -->
          {#if job.status === 'SUBMITTED (NOT VERIFY-ABLE)'}
            <div class="card-box" style="margin-bottom: 16px;">
              <div style="margin-bottom: 6px;">
                <span class="badge" style="border-color: #52525b; color: #ffffff;">SUBMITTED (NOT VERIFY-ABLE)</span>
              </div>
              <div style="font-size: 12.5px; color: #d4d4d8; line-height: 1.5;">
                Application was submitted on <strong>{job.portal}</strong>. This portal does not expose a public web application history ledger (verification requires their mobile application). Final form submit receipt modal was captured below.
              </div>
            </div>
          {/if}

          <!-- Target Portal Box -->
          <div class="card-box" style="margin-bottom: 16px;">
            <div class="box-caption">Target Portal</div>
            <div style="font-size: 13.5px; font-weight: 600; color: #ffffff; margin-top: 2px;">
              <a href={job.job_url} target="_blank" rel="noreferrer" style="color: #ffffff; text-decoration: underline;">
                {job.portal} &bull; Open Listing &nearr;
              </a>
            </div>
          </div>

          <!-- Screenshot Preview -->
          <div class="screenshot-box">
            <img
              src="/api/jobs/{jobUuid}/roadblock-screenshot"
              alt="Submission Session Screenshot"
              style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 0 auto;"
              onerror={(e) => {
                const target = e.currentTarget as HTMLElement
                if (target && target.parentElement) {
                  target.parentElement.innerHTML = '<div style="padding: 40px; color: #a1a1aa; font-size: 13px; text-align: center;">No external confirmation screenshot captured yet for this role. Submit the application to generate live proof.</div>'
                }
              }}
            />
          </div>
        </div>

      <!-- TAB 6: Audit Trail -->
      {:else if activeTab === 6}
        <div class="modal-section">
          <div class="modal-section-title">Lifecycle Audit Trail &amp; Status Transitions</div>
          <p style="font-size: 13px; color: #a1a1aa; margin-bottom: 16px;">
            Every status transition, triage decision, and soft-delete action is cryptographically tracked in SQLite <code style="color: #ffffff;">jobs_ledger.histories</code>.
          </p>

          {#if historyList.length > 0}
            <div class="timeline">
              {#each historyList as item}
                <div class="timeline-item">
                  <div class="timeline-dot"></div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span class="badge">{item.to_status}</span>
                    <span style="font-size: 11px; color: #71717a;">{item.timestamp}</span>
                  </div>
                  <div style="font-size: 12.5px; color: #f4f4f5; margin-top: 4px;">
                    {item.note || 'No notes attached.'}
                  </div>
                  {#if item.from_status}
                    <div style="font-size: 11px; color: #a1a1aa; margin-top: 4px;">
                      Transitioned from: {item.from_status}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <div class="card-box" style="color: #a1a1aa; font-size: 13px;">
              No history records found for this entry.
            </div>
          {/if}
        </div>
      {/if}

    </div>

    <!-- Modal Footer -->
    <div class="modal-footer">
      <a
        href={job.job_url}
        target="_blank"
        rel="noreferrer"
        class="btn-secondary"
        style="text-decoration: none;"
      >
        <ExternalLink size={13} /> Official Post
      </a>
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
    font-size: 12.5px;
    color: #a1a1aa;
    margin-top: 2px;
  }



  /* Grid */
  .modal-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }
  .modal-grid-item {
    background: var(--bg-app);
    padding: 12px 14px;
    border-radius: 6px;
    border: 1px solid var(--border-active);
  }
  .modal-grid-label {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 700;
    color: #a1a1aa;
    margin-bottom: 4px;
  }
  .modal-grid-value {
    font-weight: 700;
    color: #ffffff;
    font-size: 14px;
  }

  .modal-section {
    margin-bottom: 22px;
  }
  .modal-section-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #f4f4f5;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .tech-tag {
    background: #27272a;
    border: 1px solid #3f3f46;
    color: #f4f4f5;
    font-size: 11.5px;
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 500;
  }

  .verbatim-box {
    background: var(--bg-app);
    border: 1px solid var(--border-active);
    border-radius: 6px;
    padding: 16px;
    font-size: 13px;
    line-height: 1.6;
    color: #ffffff;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 400px;
    overflow-y: auto;
  }

  .qa-card {
    background: var(--bg-app);
    border: 1px solid var(--border-active);
    border-radius: 6px;
    padding: 12px 14px;
  }
  .qa-q {
    font-weight: 700;
    color: #ffffff;
    font-size: 13px;
    margin-bottom: 6px;
  }
  .qa-a {
    font-size: 12.5px;
    color: #f4f4f5;
    background: #18181b;
    padding: 8px 12px;
    border-radius: 4px;
    border-left: 3px solid #ffffff;
  }

  .card-box {
    background: #18181b;
    border: 1px solid var(--border-active);
    border-radius: 6px;
    padding: 14px 16px;
  }
  .box-caption {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #a1a1aa;
    font-weight: 700;
  }

  .alert-box {
    border-radius: 6px;
    padding: 14px 16px;
    display: flex;
    gap: 12px;
  }
  .alert-warning {
    background: #18181b;
    border: 1px solid #71717a;
  }
  .alert-error {
    background: #18181b;
    border: 1px solid #52525b;
  }

  .form-preview-row {
    background: #18181b;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    padding: 12px 14px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .row-missing {
    border-color: #52525b;
    background: #202024;
  }

  .required-tag {
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 700;
    background: #27272a;
    border: 1px solid #52525b;
    color: #ffffff;
    padding: 1px 5px;
    border-radius: 3px;
  }

  .source-tag {
    font-size: 10.5px;
    color: #a1a1aa;
    text-transform: uppercase;
    flex-shrink: 0;
    background: #27272a;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid var(--border-active);
  }

  .perk-card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 14px;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    line-height: 1.5;
  }

  .pdf-container {
    border: 1px solid var(--border-active);
    border-radius: 6px;
    overflow: hidden;
    height: 540px;
    background: #ffffff;
  }

  .cover-letter-box {
    background: var(--bg-app);
    border: 1px solid var(--border-active);
    border-radius: 6px;
    padding: 18px;
    font-size: 13.5px;
    line-height: 1.7;
    color: #ffffff;
    white-space: pre-wrap;
    max-height: 520px;
    overflow-y: auto;
  }

  .screenshot-box {
    border: 1px solid var(--border-active);
    border-radius: 6px;
    overflow: hidden;
    background: #000000;
    padding: 8px;
    min-height: 120px;
  }

  .timeline {
    display: flex;
    flex-direction: column;
    gap: 14px;
    position: relative;
    padding-left: 20px;
  }
  .timeline::before {
    content: '';
    position: absolute;
    top: 6px;
    bottom: 6px;
    left: 6px;
    width: 2px;
    background-color: var(--border-active);
  }
  .timeline-item {
    position: relative;
    background: var(--bg-app);
    border: 1px solid var(--border-active);
    border-radius: 6px;
    padding: 12px 14px;
  }
  .timeline-dot {
    position: absolute;
    left: -20px;
    top: 16px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #ffffff;
    border: 2px solid var(--bg-app);
  }

  /* Accordion Styles */
  .accordion-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .accordion-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
    padding: 0 2px;
  }
  .accordion-topbar-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #a1a1aa;
  }
  .btn-text-action {
    background: transparent;
    border: none;
    font-size: 11.5px;
    color: #a1a1aa;
    cursor: pointer;
    font-family: inherit;
    padding: 0;
  }
  .btn-text-action:hover {
    color: #ffffff;
    text-decoration: underline;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte'
  import { ChevronDown, ChevronRight, Download, Copy, Check, FileText, Briefcase, Mail, Sparkles, ExternalLink, AlertCircle, RotateCcw, Loader2 } from 'lucide-svelte'
  import type { JobRecord } from '$lib/types'

  interface Props {
    job: JobRecord
  }

  const { job }: Props = $props()

  let openEvidence = $state(false)
  let openResume = $state(false)
  let openPortfolio = $state(false)
  let openCoverLetter = $state(false)

  let coverLetterText = $state<string | null>(null)
  let loadingCoverLetter = $state(false)
  let synthesizing = $state(false)
  let regeneratingResume = $state(false)
  let regeneratingPortfolio = $state(false)
  let regeneratingCoverLetter = $state(false)
  let synthesizeMessage = $state<string | null>(null)
  let copied = $state(false)

  let matchedEvidence = $state<Array<{
    id: string
    title: string
    type: string
    score: number
    scorePercent: string
    summary: string
    demoUrl?: string
  }>>([])
  let matchScore = $state<number | null>(null)
  let matchScorePercent = $state<string | null>(null)
  let resumeExists = $state<boolean>(true)
  let coverLetterExists = $state<boolean>(true)

  async function loadDocuments() {
    loadingCoverLetter = true
    try {
      const res = await fetch(`/api/jobs/${job.id}/documents`)
      const json = await res.json()
      if (json.success) {
        coverLetterText = json.coverLetter || null
        coverLetterExists = Boolean(json.coverLetterExists ?? json.coverLetter)
        resumeExists = Boolean(json.resumeExists ?? true)
        if (json.matchedEvidence) matchedEvidence = json.matchedEvidence
        if (json.matchScore !== undefined) matchScore = json.matchScore
        if (json.matchScorePercent) matchScorePercent = json.matchScorePercent
      } else {
        coverLetterText = null
        coverLetterExists = false
        resumeExists = false
      }
    } catch {
      coverLetterText = null
      coverLetterExists = false
      resumeExists = false
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

  async function handleTriggerSynthesis() {
    synthesizing = true
    synthesizeMessage = null
    try {
      const res = await fetch(`/api/jobs/${job.id}/synthesize`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        synthesizeMessage = 'Background synthesis triggered. Polling for generated assets...'
        // Poll for completion after 1.5s
        setTimeout(async () => {
          await loadDocuments()
          synthesizing = false
          synthesizeMessage = null
        }, 2000)
      } else {
        synthesizeMessage = `Failed: ${json.error || 'Server error'}`
        synthesizing = false
      }
    } catch (e: any) {
      synthesizeMessage = `Error: ${e.message}`
      synthesizing = false
    }
  }

  async function handleRegenerate(target: 'resume' | 'portfolio' | 'cover_letter') {
    if (target === 'resume') regeneratingResume = true
    if (target === 'portfolio') regeneratingPortfolio = true
    if (target === 'cover_letter') regeneratingCoverLetter = true

    try {
      const ep = target === 'cover_letter' ? 'cover-letter' : target
      const res = await fetch(`/api/jobs/${job.id}/generate/${ep}`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        if (target === 'resume') {
          resumeExists = true
          await loadDocuments()
        } else if (target === 'portfolio') {
          await loadDocuments()
        } else {
          setTimeout(async () => {
            await loadDocuments()
          }, 2000)
        }
      }
    } catch (e) {
      console.error(`Failed to regenerate ${target}:`, e)
    } finally {
      if (target === 'resume') regeneratingResume = false
      if (target === 'portfolio') regeneratingPortfolio = false
      if (target === 'cover_letter') regeneratingCoverLetter = false
    }
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
          Application Dossier
        </div>
        <div style="font-size: 12px; color: #a1a1aa; margin-top: 2px;">
          Candidate assets compiled for <strong>{job.title}</strong> at <strong>{job.company}</strong>.
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button
          type="button"
          class="btn-toggle-all"
          onclick={() => {
            const allOpen = openEvidence && openResume && openPortfolio && openCoverLetter
            openEvidence = !allOpen
            openResume = !allOpen
            openPortfolio = !allOpen
            openCoverLetter = !allOpen
          }}
        >
          {openEvidence && openResume && openPortfolio && openCoverLetter ? 'Collapse All' : 'Expand All'}
        </button>
      </div>
    </div>
  </div>

  <!-- Semantic Vector Evidence Accordion (Cloudflare Vectorize) -->
  {#if matchedEvidence.length > 0}
    <div class="accordion-card">
      <div
        class="accordion-header"
        onclick={() => openEvidence = !openEvidence}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && (openEvidence = !openEvidence)}
      >
        <div class="accordion-title-left">
          {#if openEvidence}
            <ChevronDown size={16} />
          {:else}
            <ChevronRight size={16} />
          {/if}
          <Sparkles size={16} style="color: #ffffff;" />
          <span class="accordion-heading">Semantic Knowledge Match &bull; Vectorize RAG Evidence</span>
        </div>
        {#if matchScorePercent}
          <div class="accordion-actions">
            <span class="match-badge">{matchScorePercent} Alignment</span>
          </div>
        {/if}
      </div>

      {#if openEvidence}
        <div class="accordion-body" style="background: #18181b;">
          <div class="evidence-desc" style="margin-bottom: 12px;">
            Top candidate knowledge chunks retrieved via cosine similarity for <strong>{job.title}</strong> at <strong>{job.company}</strong> and injected into this application dossier:
          </div>
          <div class="evidence-grid">
            {#each matchedEvidence as item}
              <div class="evidence-item">
                <div class="evidence-item-top">
                  <span class="evidence-item-badge">{item.type}</span>
                  <span class="evidence-item-title">{item.title}</span>
                  <span class="evidence-item-score">{item.scorePercent}</span>
                </div>
                <div class="evidence-item-summary">{item.summary}</div>
                {#if item.demoUrl}
                  <a href={item.demoUrl} target="_blank" rel="noreferrer" class="evidence-item-link">
                    <ExternalLink size={11} /> Project Demo
                  </a>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}

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
        <span class="accordion-heading">1. Resume (PDF)</span>
      </div>
      <div class="accordion-actions" onclick={(e) => e.stopPropagation()} role="presentation">
        <button
          type="button"
          class="btn-action-zinc"
          onclick={() => handleRegenerate('resume')}
          disabled={regeneratingResume}
        >
          {#if regeneratingResume}
            <Loader2 size={13} class="spin" /> Regenerating...
          {:else}
            <RotateCcw size={13} /> Re-generate Resume
          {/if}
        </button>
        <a
          href={`/api/jobs/${job.id}/pdf`}
          download={`${job.company}_Resume.pdf`}
          class="btn-action-zinc"
          target="_blank"
        >
          <Download size={13} /> Download Resume
        </a>
      </div>
    </div>

    {#if openResume}
      <div class="accordion-body">
        {#if resumeExists}
          <iframe
            src={`/api/jobs/${job.id}/pdf`}
            title={`${job.company} Resume`}
            class="pdf-preview-frame"
          ></iframe>
        {:else}
          <div class="asset-unready-callout">
            <AlertCircle size={16} style="color: #a1a1aa; flex-shrink: 0;" />
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #f4f4f5; font-size: 13px;">Tailored Resume PDF Not Generated</div>
              <div style="color: #a1a1aa; font-size: 12px; margin-top: 3px; line-height: 1.4;">
                No compiled tailored ATS resume exists for this vacancy yet (missing <code>{job.company.replace(/[^a-zA-Z0-9]/g, '_')}_{job.title.replace(/[^a-zA-Z0-9]/g, '_')}_Resume.pdf</code>). Pre-generation or compilation has not occurred for this job.
              </div>
              <div style="margin-top: 10px;">
                <button
                  type="button"
                  class="btn-resynthesize"
                  onclick={() => handleRegenerate('resume')}
                  disabled={regeneratingResume}
                >
                  {#if regeneratingResume}
                    <Loader2 size={13} class="spin" />
                    <span>Compiling ATS Resume PDF...</span>
                  {:else}
                    <RotateCcw size={13} />
                    <span>Generate Resume Now</span>
                  {/if}
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Accordion Section 2: Portfolio -->
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
        <span class="accordion-heading">2. Portfolio (PDF)</span>
      </div>
      <div class="accordion-actions" onclick={(e) => e.stopPropagation()} role="presentation">
        <button
          type="button"
          class="btn-action-zinc"
          onclick={() => handleRegenerate('portfolio')}
          disabled={regeneratingPortfolio}
        >
          {#if regeneratingPortfolio}
            <Loader2 size={13} class="spin" /> Regenerating...
          {:else}
            <RotateCcw size={13} /> Re-generate Portfolio
          {/if}
        </button>
        <a
          href={`/api/jobs/${job.id}/portfolio-pdf`}
          download={`${job.company}_Portfolio.pdf`}
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
          <strong>Featured Production Proof:</strong> Production Fullstack System &amp; Cloud Infrastructure Architecture • High-throughput REST backend, responsive frontend, offline sync, and containerized deployment.
        </div>
        <iframe
          src={`/api/jobs/${job.id}/portfolio-pdf`}
          title={`${job.company} Portfolio`}
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
        <span class="accordion-heading">3. Cover Letter / Professional Email</span>
        <span class="badge-tag">Enthusiastic Narrative</span>
      </div>
      <div class="accordion-actions" onclick={(e) => e.stopPropagation()} role="presentation">
        <button
          type="button"
          class="btn-action-zinc"
          onclick={() => handleRegenerate('cover_letter')}
          disabled={regeneratingCoverLetter}
        >
          {#if regeneratingCoverLetter}
            <Loader2 size={13} class="spin" /> Synthesizing...
          {:else}
            <RotateCcw size={13} /> Re-generate Cover Letter
          {/if}
        </button>
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
        {#if coverLetterExists && coverLetterText}
          <div class="cover-letter-view">
            {coverLetterText}
          </div>
        {:else}
          <div class="asset-unready-callout">
            <AlertCircle size={16} style="color: #a1a1aa; flex-shrink: 0;" />
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #f4f4f5; font-size: 13px;">Cover Letter Not Yet Synthesized</div>
              <div style="color: #a1a1aa; font-size: 12px; margin-top: 3px; line-height: 1.4;">
                The tailored cover letter for this vacancy is not present on disk. Background synthesis is pending or has not completed.
              </div>
              <div style="margin-top: 10px;">
                <button
                  type="button"
                  class="btn-resynthesize"
                  onclick={handleTriggerSynthesis}
                  disabled={synthesizing}
                >
                  {#if synthesizing}
                    <Loader2 size={13} class="spin" />
                    <span>Synthesizing in background...</span>
                  {:else}
                    <RotateCcw size={13} />
                    <span>Re-synthesize Assets</span>
                  {/if}
                </button>
              </div>
              {#if synthesizeMessage}
                <div style="font-size: 11.5px; color: #d4d4d8; margin-top: 6px;">
                  {synthesizeMessage}
                </div>
              {/if}
            </div>
          </div>
        {/if}
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

  .asset-unready-callout {
    background: #18181b;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    padding: 16px 20px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .asset-unready-callout code {
    background: #27272a;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11.5px;
    color: #f4f4f5;
  }

  .btn-resynthesize {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 5px;
    color: #f4f4f5;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    font-family: inherit;
  }
  .btn-resynthesize:hover:not(:disabled) {
    background: #3f3f46;
    border-color: #52525b;
    color: #ffffff;
  }
  .btn-resynthesize:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

  /* Semantic Vector Evidence Card */
  .evidence-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .evidence-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .evidence-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .evidence-title {
    font-size: 11px;
    font-weight: 700;
    color: #f4f4f5;
    letter-spacing: 0.5px;
  }

  .match-badge {
    margin-left: auto;
    font-size: 11px;
    font-weight: 600;
    background: #27272a;
    color: #f4f4f5;
    border: 1px solid #3f3f46;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .evidence-desc {
    font-size: 12px;
    color: #a1a1aa;
    line-height: 1.4;
  }

  .evidence-desc strong {
    color: #f4f4f5;
  }

  .evidence-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 10px;
  }

  .evidence-item {
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .evidence-item-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .evidence-item-badge {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    background: #27272a;
    color: #a1a1aa;
    border: 1px solid #3f3f46;
    padding: 1px 5px;
    border-radius: 3px;
  }

  .evidence-item-title {
    font-size: 12px;
    font-weight: 600;
    color: #f4f4f5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .evidence-item-score {
    font-size: 10px;
    font-weight: 600;
    color: #a1a1aa;
  }

  .evidence-item-summary {
    font-size: 11px;
    color: #a1a1aa;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .evidence-item-link {
    font-size: 11px;
    color: #f4f4f5;
    text-decoration: underline;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
  }
</style>

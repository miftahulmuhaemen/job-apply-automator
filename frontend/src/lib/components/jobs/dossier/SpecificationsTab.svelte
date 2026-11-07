<script lang="ts">
  import type { JobRecord } from '$lib/types'

  interface Props {
    job: JobRecord
    techStackList?: string[]
    qaPairs?: Array<{ question: string; answer: string }>
  }

  let { job, techStackList = [], qaPairs = [] }: Props = $props()

  const resolvedTechStack = $derived.by(() => {
    if (techStackList && techStackList.length > 0) return techStackList
    if (job.tech_stack_detected) {
      return job.tech_stack_detected.split(',').map(s => s.trim()).filter(Boolean)
    }
    return []
  })

  const resolvedQaPairs = $derived(qaPairs || [])
</script>

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
  {#if resolvedTechStack.length > 0}
    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
      {#each resolvedTechStack as tag}
        <span class="tech-tag">{tag}</span>
      {/each}
    </div>
  {:else}
    <div style="color: #a1a1aa; font-size: 12px; margin-top: 4px;">General / Not specified</div>
  {/if}
</div>

{#if job.company_overview}
  <div class="modal-section">
    <div class="modal-section-title">Company Overview</div>
    <div class="company-overview-box">
      {job.company_overview}
    </div>
  </div>
{/if}

<div class="modal-section">
  <div class="modal-section-title">Verbatim Job Specifications &amp; Responsibilities</div>
  <div class="verbatim-box">
    {job.full_description || job.requirements_summary || 'No detailed specifications found.'}
  </div>
</div>

{#if resolvedQaPairs.length > 0}
  <div class="modal-section">
    <div class="modal-section-title">Pre-Screening Questions &amp; Form Answers</div>
    <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">
      {#each resolvedQaPairs as pair}
        <div class="qa-card">
          <div class="qa-q">{pair.question}</div>
          <div class="qa-a">Proposed Answer: {pair.answer}</div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .modal-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin-bottom: 20px;
  }
  .modal-grid-item {
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    padding: 12px 14px;
  }
  .modal-grid-label {
    font-size: 11px;
    color: #a1a1aa;
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .modal-grid-value {
    font-size: 13px;
    color: #f4f4f5;
    font-weight: 500;
  }
  .modal-section {
    margin-bottom: 24px;
  }
  .modal-section-title {
    font-size: 13px;
    font-weight: 700;
    color: #f4f4f5;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .tech-tag {
    background: #27272a;
    border: 1px solid #3f3f46;
    color: #f4f4f5;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }
  .verbatim-box,
  .company-overview-box {
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 14px;
    font-size: 12px;
    line-height: 1.6;
    color: #d4d4d8;
    white-space: pre-wrap;
    max-height: 320px;
    overflow-y: auto;
  }
  .qa-card {
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    padding: 12px 14px;
  }
  .qa-q {
    font-size: 12px;
    font-weight: 600;
    color: #f4f4f5;
    margin-bottom: 4px;
  }
  .qa-a {
    font-size: 12px;
    color: #a1a1aa;
  }
</style>

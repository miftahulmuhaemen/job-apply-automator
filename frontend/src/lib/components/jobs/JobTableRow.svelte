<script lang="ts">
  import { Check, Trash2, Play, RotateCcw, AlertCircle, FileText, Loader2 } from 'lucide-svelte'
  import ActionPopover from '../ui/ActionPopover.svelte'
  import Checkbox from '../ui/Checkbox.svelte'
  import type { JobRecord } from '../types'
  import { JOB_STATUS } from '../../constants'

  let {
    job,
    isChecked,
    visibleColumns,
    activeErrorJobId,
    ontoggleselect,
    onopenmodal,
    onupdatestatus,
    ondirectsubmit,
    ontoggleerrorhint
  }: {
    job: JobRecord
    isChecked: boolean
    visibleColumns: { portal: boolean; salary: boolean; crawledAt: boolean; status: boolean }
    activeErrorJobId: number | null
    ontoggleselect: (id: number) => void
    onopenmodal: (job: JobRecord, tab?: number) => void
    onupdatestatus: (id: number, status: string, note?: string) => void
    ondirectsubmit: (id: number) => void
    ontoggleerrorhint: (id: number) => void
  } = $props()

  const st = $derived((job.status || 'CRAWLED').toUpperCase())
  const isEmailJob = $derived(
    (job.portal || '').toLowerCase().includes('email') ||
    (job.job_url || '').toLowerCase().startsWith('mailto:')
  )

  function formatYYMMDD(val?: string | null): string {
    if (!val) return '-'
    try {
      const d = new Date(val)
      if (isNaN(d.getTime())) {
        const parts = val.split(/[-T /]/)
        if (parts.length >= 3) {
          const yy = parts[0].slice(-2)
          const mm = parts[1].padStart(2, '0')
          const dd = parts[2].padStart(2, '0')
          return `${yy}/${mm}/${dd}`
        }
        return '-'
      }
      const yy = String(d.getFullYear()).slice(-2)
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yy}/${mm}/${dd}`
    } catch {
      return '-'
    }
  }
</script>

<tr class:row-selected={isChecked}>
  <!-- 1. Checkbox -->
  <td style="width: 44px; text-align: center;">
    <Checkbox
      checked={isChecked}
      onchange={() => ontoggleselect(job.id)}
      ariaLabel={`Select ${job.title}`}
    />
  </td>

  <!-- 2. Role (Dynamic fluid width) -->
  <td style="min-width: 240px;">
    <div
      class="role-title"
      onclick={() => onopenmodal(job, 0)}
      role="button"
      tabindex="0"
      onkeydown={(e) => e.key === 'Enter' && onopenmodal(job, 0)}
    >
      {job.title}
    </div>
    <div class="role-subtext">{job.location || 'Indonesia'}</div>
  </td>

  <!-- 3. Company -->
  <td style="width: 180px;">
    <div class="company-name">{job.company}</div>
  </td>

  <!-- 4. Details & Official Post -->
  <td style="text-align: center; width: 130px;">
    <div class="details-btn-group">
      <button
        type="button"
        class="btn-detail-action"
        onclick={() => onopenmodal(job, 0)}
      >
        Detail
      </button>
      {#if !isEmailJob && job.job_url && !job.job_url.toLowerCase().startsWith('mailto:')}
        <a
          href={job.job_url}
          target="_blank"
          rel="noreferrer"
          class="btn-post-action"
          title="Open official posting"
        >
          Post
        </a>
      {/if}
    </div>
  </td>

  <!-- 5. Actions -->
  <td style="text-align: center; width: 60px;">
    <ActionPopover title="Change status for {job.title}">
      {#snippet children()}
        <div class="popover-header">{job.company}</div>

        {#if st === JOB_STATUS.PENDING_HUMAN || st === 'CRAWLED' || st === 'SKIPPED' || st === 'SKIPPED_SALARY'}
          <button type="button" onclick={() => onupdatestatus(job.id, JOB_STATUS.APPROVED)}>
            <Check size={13} /> Approve (Move to Apply)
          </button>
          <button type="button" class="danger" onclick={() => onupdatestatus(job.id, JOB_STATUS.DROPPED)}>
            <Trash2 size={13} /> Drop (Archive)
          </button>
        {:else if st === JOB_STATUS.APPROVED}
          <button type="button" onclick={() => ondirectsubmit(job.id)}>
            <Play size={13} fill="currentColor" /> Run &amp; Submit
          </button>
          <button type="button" onclick={() => onupdatestatus(job.id, JOB_STATUS.APPLIED)}>
            <Check size={13} /> Mark as Applied
          </button>
          <button type="button" class="danger" onclick={() => onupdatestatus(job.id, JOB_STATUS.DROPPED)}>
            <Trash2 size={13} /> Drop (Archive)
          </button>
        {:else if st === 'FAILED'}
          <button type="button" onclick={() => ondirectsubmit(job.id)}>
            <RotateCcw size={13} /> Retry Submission
          </button>
          <button type="button" class="danger" onclick={() => onupdatestatus(job.id, JOB_STATUS.DROPPED)}>
            <Trash2 size={13} /> Drop (Archive)
          </button>
        {:else if st === JOB_STATUS.APPLIED || st === JOB_STATUS.SUBMITTED_UNVERIFIED}
          <button type="button" onclick={() => onupdatestatus(job.id, 'INTERVIEW')}>
            <Check size={13} /> Advance to Interview
          </button>
          <button type="button" onclick={() => onupdatestatus(job.id, 'OFFER')}>
            <Check size={13} /> Advance to Offer
          </button>
          <button type="button" class="danger" onclick={() => onupdatestatus(job.id, JOB_STATUS.DROPPED)}>
            <Trash2 size={13} /> Drop Application
          </button>
        {:else if st === 'INTERVIEW'}
          <button type="button" onclick={() => onupdatestatus(job.id, 'OFFER')}>
            <Check size={13} /> Advance to Offer
          </button>
          <button type="button" class="danger" onclick={() => onupdatestatus(job.id, JOB_STATUS.DROPPED)}>
            <Trash2 size={13} /> Drop / Rejected
          </button>
        {:else if st === 'OFFER'}
          <button type="button" onclick={() => onupdatestatus(job.id, 'OFFER_ACCEPTED')}>
            <Check size={13} /> Accept Offer
          </button>
          <button type="button" class="danger" onclick={() => onupdatestatus(job.id, 'OFFER_DECLINED')}>
            <Trash2 size={13} /> Decline Offer
          </button>
        {:else if st === JOB_STATUS.DROPPED || st === 'REJECTED' || st === 'OFFER_DECLINED'}
          <button type="button" onclick={() => onupdatestatus(job.id, JOB_STATUS.PENDING_HUMAN)}>
            <RotateCcw size={13} /> Restore to Review
          </button>
        {/if}
      {/snippet}
    </ActionPopover>
  </td>

  <!-- 6. Portal -->
  {#if visibleColumns.portal}
    <td style="width: 120px;">
      <span class="portal-text">{job.portal || 'Generic'}</span>
    </td>
  {/if}

  <!-- 7. Salary (Fixed 200px) -->
  {#if visibleColumns.salary}
    <td style="width: 200px;">
      <span class="salary-text">{job.salary_raw || 'Undisclosed'}</span>
    </td>
  {/if}

  <!-- 8. Crawled At -->
  {#if visibleColumns.crawledAt}
    <td style="width: 110px; font-size: 11.5px; color: #a1a1aa; white-space: nowrap;">
      {formatYYMMDD(job.created_at)}
    </td>
  {/if}

  <!-- 9. Status Badge -->
  {#if visibleColumns.status}
    <td style="width: 140px; text-align: center; position: relative;">
      {#if job.triage_decision === 'PROCESSING'}
        <span class="status-badge status-synthesizing" title="Synthesizing tailored application assets in background">
          <Loader2 size={11} class="spin" />
          SYNTHESIZING
        </span>
      {:else}
        <span
          class="status-badge"
          class:status-applied={st === 'APPLIED'}
          class:status-dropped={st === 'DROPPED' || st === 'REJECTED'}
          class:status-failed={st === 'FAILED'}
        >
          {job.status || 'CRAWLED'}
        </span>
      {/if}

      {#if job.last_error && (st === 'FAILED' || st === 'SKIPPED' || st === 'SKIPPED_SALARY')}
        <button
          type="button"
          class="btn-error-hint"
          title="View error diagnostic"
          onclick={(e) => { e.stopPropagation(); ontoggleerrorhint(job.id) }}
        >
          <AlertCircle size={11} />
        </button>

        {#if activeErrorJobId === job.id}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="error-popover" onclick={(e) => e.stopPropagation()}>
            <div class="error-popover-title">Last Diagnostic Note</div>
            <div class="error-popover-body">{job.last_error}</div>
          </div>
        {/if}
      {/if}
    </td>
  {/if}
</tr>

<style>
  tr {
    transition: background-color 0.15s;
  }
  tr:hover td {
    background-color: #18181b;
  }
  tr.row-selected td {
    background-color: #1a1a1e;
  }
  td {
    padding: 12px 14px;
    border-bottom: 1px solid #27272a;
    color: #f4f4f5;
    vertical-align: middle;
  }

  .role-title {
    font-weight: 600;
    color: #ffffff;
    cursor: pointer;
    line-height: 1.35;
    white-space: normal;
    word-break: normal;
    overflow-wrap: break-word;
    transition: color 0.15s;
  }
  .role-title:hover {
    text-decoration: underline;
  }

  .role-subtext {
    font-size: 11.5px;
    color: #71717a;
    margin-top: 2px;
  }

  .company-name {
    font-weight: 500;
    color: #f4f4f5;
    white-space: normal;
    word-break: break-word;
  }

  .portal-text {
    font-size: 13px;
    color: #f4f4f5;
    white-space: normal;
    word-break: break-word;
  }

  .salary-text {
    font-size: 11.5px;
    color: #d4d4d8;
    white-space: normal;
    word-break: break-word;
    line-height: 1.3;
    display: inline-block;
  }

  .details-btn-group {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    justify-content: center;
  }

  .btn-detail-action,
  .btn-post-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 9px;
    background-color: #27272a;
    color: #f4f4f5;
    border: 1px solid #3f3f46;
    border-radius: 4px;
    font-size: 11.5px;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    transition: background-color 0.15s, border-color 0.15s, color 0.15s;
    font-family: inherit;
    white-space: nowrap;
    line-height: 1.2;
  }

  .btn-detail-action:hover,
  .btn-post-action:hover {
    background-color: #3f3f46;
    border-color: #52525b;
    color: #ffffff;
  }

  .status-badge {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    background-color: #27272a;
    color: #f4f4f5;
    border: 1px solid #3f3f46;
    white-space: nowrap;
  }
  .status-synthesizing {
    background-color: #18181b;
    color: #a1a1aa;
    border-color: #3f3f46;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .status-applied {
    background-color: #ffffff;
    color: #09090b;
    border-color: #ffffff;
  }
  .status-failed {
    border-color: #71717a;
    color: #f4f4f5;
  }
  .status-dropped {
    opacity: 0.65;
  }

  .btn-error-hint {
    background: transparent;
    border: none;
    color: #a1a1aa;
    cursor: pointer;
    padding: 2px;
    vertical-align: middle;
    margin-left: 4px;
  }
  .btn-error-hint:hover {
    color: #ffffff;
  }

  .error-popover {
    position: absolute;
    right: 14px;
    top: 100%;
    margin-top: 4px;
    background: #18181b;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    padding: 8px 12px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.8);
    z-index: 40;
    min-width: 220px;
    max-width: 300px;
    text-align: left;
  }
  .error-popover-title {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    color: #a1a1aa;
    margin-bottom: 4px;
  }
  .error-popover-body {
    font-size: 11.5px;
    color: #f4f4f5;
    line-height: 1.4;
    word-break: break-word;
  }

  .popover-header {
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 600;
    color: #71717a;
    text-transform: uppercase;
    border-bottom: 1px solid #27272a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>

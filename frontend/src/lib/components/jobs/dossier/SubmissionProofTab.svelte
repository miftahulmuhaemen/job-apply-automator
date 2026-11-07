<script lang="ts">
  import { RefreshCw } from 'lucide-svelte'
  import type { JobRecord } from '$lib/types'

  interface Props {
    job: JobRecord
    jobUuid: string
    retryingSubmission: boolean
    submissionMessage: string | null
    onretry: () => void
  }

  const {
    job,
    jobUuid,
    retryingSubmission,
    submissionMessage,
    onretry
  }: Props = $props()
</script>

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
          onclick={onretry}
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

<style>
  .modal-section {
    margin-bottom: 22px;
  }
  .modal-section-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #ffffff;
    margin-bottom: 8px;
  }
  .card-box {
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 14px 16px;
  }
  .box-caption {
    font-size: 11px;
    text-transform: uppercase;
    color: #71717a;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    background: #18181b;
    border: 1px solid #27272a;
    color: #f4f4f5;
  }
  .alert-box {
    padding: 14px 16px;
    border-radius: 6px;
    display: flex;
    gap: 12px;
  }
  .alert-error {
    background: #18181b;
    border: 1px solid #3f3f46;
  }
  .screenshot-box {
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 12px;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
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
  .btn-secondary:hover:not(:disabled) {
    background-color: #3f3f46;
  }
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>

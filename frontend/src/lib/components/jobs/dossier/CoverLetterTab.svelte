<script lang="ts">
  import { Copy, Check, RefreshCw } from 'lucide-svelte'

  interface Props {
    company: string
    coverLetterText: string | null
    loadingCoverLetter: boolean
    oncopy: () => void
    copied: boolean
  }

  const {
    company,
    coverLetterText,
    loadingCoverLetter,
    oncopy,
    copied
  }: Props = $props()
</script>

<div class="modal-section">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
    <div>
      <div class="modal-section-title" style="margin-bottom: 2px;">Tailored Cover Letter</div>
      <div style="font-size: 12px; color: #a1a1aa;">
        Customized narrative for {company} based on candidate profile.
      </div>
    </div>
    <button
      type="button"
      class="btn-secondary"
      onclick={oncopy}
      disabled={!coverLetterText}
    >
      {#if copied}
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
  .cover-letter-box {
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 24px;
    font-size: 13.5px;
    line-height: 1.7;
    color: #f4f4f5;
    white-space: pre-wrap;
    font-family: inherit;
    max-height: 540px;
    overflow-y: auto;
  }
  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>

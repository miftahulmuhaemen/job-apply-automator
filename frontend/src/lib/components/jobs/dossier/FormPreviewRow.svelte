<script lang="ts">
  import type { FormFieldItem } from './types'
  import { Upload, FileText } from 'lucide-svelte'

  interface Props {
    field: FormFieldItem
    photoStatus: string | null
    portfolioStatus: string | null
    portfolioGenerating: boolean
    handlePhotoUpload: (e: Event) => void
    handleGeneratePortfolio: () => void
  }

  const {
    field,
    photoStatus,
    portfolioStatus,
    portfolioGenerating,
    handlePhotoUpload,
    handleGeneratePortfolio
  }: Props = $props()

  const isMissing = $derived(
    field.required && (field.value.includes('[MISSING') || field.value.includes('[NOT SPECIFIED'))
  )
</script>

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

<style>
  .form-preview-row {
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 12px 14px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .row-missing {
    border-color: #52525b;
    background: #18181b;
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
    border: 1px solid #3f3f46;
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
</style>

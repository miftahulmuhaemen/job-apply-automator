<script lang="ts">
  import { onMount } from 'svelte'
  import type { JobRecord } from '$lib/types'
  import type { FormPreviewData } from './types'
  import Accordion from '../../ui/Accordion.svelte'
  import AccordionItem from '../../ui/AccordionItem.svelte'
  import FormPreviewRow from './FormPreviewRow.svelte'
  import { RefreshCw, AlertTriangle } from 'lucide-svelte'

  interface Props {
    job: JobRecord
    jobUuid: string
    onclose: () => void
    onswitchview?: (view: string) => void
  }

  let { job, jobUuid, onclose, onswitchview }: Props = $props()

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

  onMount(() => {
    fetchFormPreview()
  })
</script>

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
              <FormPreviewRow
                {field}
                {photoStatus}
                {portfolioStatus}
                {portfolioGenerating}
                {handlePhotoUpload}
                {handleGeneratePortfolio}
              />
            {/each}
          </div>
        </AccordionItem>
      {/each}
    </Accordion>
  </div>
{/if}

<style>
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
  .alert-box {
    padding: 14px 16px;
    border-radius: 6px;
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }
  .alert-warning {
    background: #18181b;
    border: 1px solid #71717a;
  }
  .alert-error {
    background: #18181b;
    border: 1px solid #3f3f46;
  }
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
  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>

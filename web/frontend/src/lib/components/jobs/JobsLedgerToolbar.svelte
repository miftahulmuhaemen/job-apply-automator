<script lang="ts">
  import { Search, Check, Trash2, Play, RotateCcw } from 'lucide-svelte'
  import StageFilterPopover from '../ui/StageFilterPopover.svelte'
  import ColumnsVisibilityPopover from '../ui/ColumnsVisibilityPopover.svelte'

  let {
    currentStage,
    counts,
    searchQuery = $bindable(),
    selectedCount,
    visibleColumns,
    onstagechange,
    oncolumntoggle,
    ondeselect,
    onbatchstatus,
    onbatchsubmit
  }: {
    currentStage: 'review' | 'pending' | 'submitted' | 'dropped' | 'all'
    counts: { review: number; pending: number; submitted: number; dropped: number; all: number }
    searchQuery: string
    selectedCount: number
    visibleColumns: { portal: boolean; salary: boolean; crawledAt: boolean; status: boolean }
    onstagechange: (stage: 'review' | 'pending' | 'submitted' | 'dropped' | 'all') => void
    oncolumntoggle: (id: string) => void
    ondeselect: () => void
    onbatchstatus: (status: string) => void
    onbatchsubmit: () => void
  } = $props()
</script>

<div class="toolbar-left-aligned">
  <!-- Stage Filter Dropdown Popover -->
  <StageFilterPopover
    value={currentStage}
    items={[
      { id: 'review', label: 'Review Queue', count: counts.review },
      { id: 'pending', label: 'Pending Jobs', count: counts.pending },
      { id: 'submitted', label: 'Submitted Ledger', count: counts.submitted },
      { id: 'dropped', label: 'Filtered', count: counts.dropped },
      { id: 'all', label: 'All Postings', count: counts.all }
    ]}
    onchange={(val) => onstagechange(val as any)}
    ariaLabel="Filter jobs by stage"
  />

  <!-- Search Input -->
  <div class="search-input-wrapper">
    <Search size={14} class="search-icon" />
    <input
      type="text"
      placeholder="Search role, company, portal..."
      bind:value={searchQuery}
      class="input-base search-input"
    />
  </div>

  <!-- Columns Visibility Popover Inline Left-Aligned -->
  <ColumnsVisibilityPopover
    columns={[
      { id: 'portal', label: 'Portal', visible: visibleColumns.portal },
      { id: 'salary', label: 'Salary', visible: visibleColumns.salary },
      { id: 'crawledAt', label: 'Crawled At', visible: visibleColumns.crawledAt },
      { id: 'status', label: 'Status', visible: visibleColumns.status }
    ]}
    ontoggle={oncolumntoggle}
  />

  <!-- Inline Batch Actions Cluster -->
  {#if selectedCount > 0}
    <div class="batch-cluster-inline">
      <span class="batch-count-badge">
        <span>{selectedCount}</span>&nbsp;selected
      </span>
      <button
        type="button"
        class="btn-batch-deselect"
        onclick={ondeselect}
        title="Clear selection"
      >
        Deselect
      </button>

      {#if currentStage === 'review'}
        <button
          type="button"
          class="btn-primary"
          style="font-size: 11.5px; padding: 4px 10px;"
          onclick={() => onbatchstatus('APPROVED')}
        >
          <Check size={13} /> Approve ({selectedCount})
        </button>
        <button
          type="button"
          class="btn-secondary"
          style="font-size: 11.5px; padding: 4px 10px;"
          onclick={() => onbatchstatus('DROPPED')}
        >
          <Trash2 size={13} /> Drop ({selectedCount})
        </button>
      {:else if currentStage === 'pending'}
        <button
          type="button"
          class="btn-primary"
          style="font-size: 11.5px; padding: 4px 10px;"
          onclick={onbatchsubmit}
        >
          <Play size={13} fill="currentColor" /> Run &amp; Submit ({selectedCount})
        </button>
        <button
          type="button"
          class="btn-secondary"
          style="font-size: 11.5px; padding: 4px 10px;"
          onclick={() => onbatchstatus('DROPPED')}
        >
          <Trash2 size={13} /> Drop ({selectedCount})
        </button>
      {:else if currentStage === 'dropped'}
        <button
          type="button"
          class="btn-primary"
          style="font-size: 11.5px; padding: 4px 10px;"
          onclick={() => onbatchstatus('PENDING_HUMAN')}
        >
          <RotateCcw size={13} /> Restore to Review ({selectedCount})
        </button>
      {:else}
        <button
          type="button"
          class="btn-primary"
          style="font-size: 11.5px; padding: 4px 10px;"
          onclick={() => onbatchstatus('APPROVED')}
        >
          Approve ({selectedCount})
        </button>
        <button
          type="button"
          class="btn-secondary"
          style="font-size: 11.5px; padding: 4px 10px;"
          onclick={() => onbatchstatus('DROPPED')}
        >
          Drop ({selectedCount})
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .toolbar-left-aligned {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 10px;
    padding: 12px 24px;
    border-bottom: 1px solid #27272a;
    background-color: #09090b;
    flex-wrap: wrap;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  :global(.search-icon) {
    position: absolute;
    left: 10px;
    color: #71717a;
    pointer-events: none;
  }

  .search-input {
    padding-left: 32px;
    height: 32px;
    width: 220px;
    font-size: 12.5px;
    background-color: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    color: #f4f4f5;
  }
  .search-input:focus {
    outline: none;
    border-color: #52525b;
  }

  .batch-cluster-inline {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #27272a;
    padding: 2px 8px;
    border-radius: 6px;
    border: 1px solid #3f3f46;
  }

  .batch-count-badge {
    font-size: 11.5px;
    color: #f4f4f5;
    font-weight: 600;
  }

  .btn-batch-deselect {
    background: transparent;
    border: none;
    color: #a1a1aa;
    font-size: 11px;
    cursor: pointer;
    text-decoration: underline;
    padding: 0 4px;
    font-family: inherit;
  }
  .btn-batch-deselect:hover {
    color: #ffffff;
  }
</style>

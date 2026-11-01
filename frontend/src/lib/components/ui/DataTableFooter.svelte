<script lang="ts">
  let {
    selectedCount = 0,
    totalCount,
    currentPage,
    totalPages,
    showSelection = false,
    onprev,
    onnext
  }: {
    selectedCount?: number
    totalCount: number
    currentPage: number
    totalPages: number
    showSelection?: boolean
    onprev: () => void
    onnext: () => void
  } = $props()
</script>

<div class="table-footer-bar">
  <div class="footer-selection-count">
    {#if showSelection}
      {selectedCount} of {totalCount} row(s) selected.
    {:else}
      Showing {totalCount} total entries
    {/if}
  </div>
  <div class="footer-pagination-controls">
    <span class="page-indicator">Page {currentPage} of {totalPages}</span>
    <button
      type="button"
      class="btn-pagination"
      disabled={currentPage <= 1}
      onclick={onprev}
    >
      Previous
    </button>
    <button
      type="button"
      class="btn-pagination"
      disabled={currentPage >= totalPages}
      onclick={onnext}
    >
      Next
    </button>
  </div>
</div>

<style>
  .table-footer-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    background-color: #09090b;
    border-top: 1px solid #27272a;
    font-size: 12.5px;
    color: #a1a1aa;
    flex-shrink: 0;
  }

  .footer-selection-count {
    font-weight: 500;
    color: #a1a1aa;
  }

  .footer-pagination-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .page-indicator {
    font-size: 11.5px;
    color: #71717a;
  }

  .btn-pagination {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 30px;
    padding: 0 12px;
    background-color: #18181b;
    color: #f4f4f5;
    border: 1px solid #27272a;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s, border-color 0.15s, color 0.15s;
  }
  .btn-pagination:hover:not(:disabled) {
    background-color: #27272a;
    border-color: #3f3f46;
    color: #ffffff;
  }
  .btn-pagination:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>

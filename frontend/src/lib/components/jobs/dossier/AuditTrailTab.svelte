<script lang="ts">
  interface HistoryItem {
    from_status?: string
    to_status: string
    timestamp: string
    note?: string
  }

  interface Props {
    historiesRaw?: string | null
  }

  const { historiesRaw = null }: Props = $props()

  const historyList = $derived.by(() => {
    if (!historiesRaw) return []
    try {
      const parsed = JSON.parse(historiesRaw)
      return Array.isArray(parsed) ? (parsed as HistoryItem[]) : []
    } catch {
      return []
    }
  })
</script>

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
  .timeline {
    border-left: 2px solid #27272a;
    padding-left: 20px;
    margin-left: 6px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .timeline-item {
    position: relative;
  }
  .timeline-dot {
    position: absolute;
    left: -26px;
    top: 3px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ffffff;
    border: 2px solid #09090b;
  }
</style>

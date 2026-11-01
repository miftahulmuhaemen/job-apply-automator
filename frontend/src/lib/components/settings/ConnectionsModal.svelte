<script lang="ts">
  import { onMount } from 'svelte'

  let { onclose }: { onclose: () => void } = $props()

  let loading = $state(true)
  let storageData = $state<any>(null)
  let errorMessage = $state<string | null>(null)

  async function loadStorageStatus() {
    try {
      const res = await fetch('/api/storage/status')
      const json = await res.json()
      if (json.success) {
        storageData = json
        errorMessage = null
      } else {
        errorMessage = json.error || 'Failed to query Cloudflare storage status'
      }
    } catch (err: any) {
      errorMessage = err.message || 'Network request failed'
    } finally {
      loading = false
    }
  }

  onMount(() => {
    loadStorageStatus()
  })

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose()
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={onclose}>
  <div class="modal-card" onclick={(e) => e.stopPropagation()}>
    <!-- Header -->
    <div class="modal-header">
      <div class="modal-title">Infrastructure Connections</div>
      <div class="modal-subtitle">Live health status and storage utilization for Cloudflare D1 and R2.</div>
    </div>

    {#if loading}
      <div class="loading-state">Connecting to Cloudflare API...</div>
    {:else}
      <div class="connections-list">
        <!-- 1. Cloudflare D1 Database -->
        <div class="connection-card">
          <div class="card-header">
            <div>
              <div class="card-title">Cloudflare D1 Database</div>
              <div class="card-meta">Database: <strong>{storageData?.d1?.database || 'amiya'}</strong></div>
            </div>
            <!-- Static Status Indicator (Zero Bliping) -->
            <span class="status-badge {storageData?.d1 ? 'status-connected' : 'status-disconnected'}">
              {storageData?.d1 ? 'Connected' : 'Not Connected'}
            </span>
          </div>

          <div class="metrics-grid">
            <div class="metric-item">
              <span class="metric-label">Allocated Tables</span>
              <span class="metric-val">{storageData?.d1?.num_tables || 9}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Database Size</span>
              <span class="metric-val">{storageData?.d1?.file_size_formatted || '260 KB'}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Region</span>
              <span class="metric-val">{storageData?.d1?.region || 'APAC'}</span>
            </div>
          </div>
        </div>

        <!-- 2. Cloudflare R2 Bucket -->
        <div class="connection-card">
          <div class="card-header">
            <div>
              <div class="card-title">Cloudflare R2 Storage</div>
              <div class="card-meta">Bucket: <strong>{storageData?.r2?.bucket || 'amiya'}</strong></div>
            </div>
            <!-- Static Status Indicator (Zero Bliping) -->
            <span class="status-badge {storageData?.r2 ? 'status-connected' : 'status-disconnected'}">
              {storageData?.r2 ? 'Connected' : 'Not Connected'}
            </span>
          </div>

          <div class="metrics-grid">
            <div class="metric-item">
              <span class="metric-label">Stored Objects</span>
              <span class="metric-val">{storageData?.r2?.object_count || 0}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Total Size</span>
              <span class="metric-val">{storageData?.r2?.total_formatted || '0 MB'}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Screenshots</span>
              <span class="metric-val">{storageData?.r2?.categories?.screenshots?.count || 0}</span>
            </div>
          </div>
        </div>

        {#if errorMessage}
          <div class="error-notice">{errorMessage}</div>
        {/if}
      </div>

      <!-- Footer Buttons -->
      <div class="modal-footer">
        <button
          type="button"
          class="btn-primary"
          onclick={onclose}
        >
          Done
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 16px;
  }

  .modal-card {
    background-color: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    width: 100%;
    max-width: 460px;
    padding: 24px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.8);
    color: #f4f4f5;
  }

  .modal-card .modal-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    gap: 4px;
    padding: 0;
    border-bottom: none;
    margin-bottom: 20px;
  }

  .modal-title {
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    line-height: 1.3;
    text-align: left;
    width: 100%;
  }

  .modal-subtitle {
    font-size: 12px;
    color: #a1a1aa;
    line-height: 1.4;
    text-align: left;
    width: 100%;
  }

  .connections-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .connection-card {
    background-color: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 14px;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .card-title {
    font-size: 13px;
    font-weight: 600;
    color: #ffffff;
  }

  .card-meta {
    font-size: 11.5px;
    color: #71717a;
    margin-top: 2px;
  }

  .status-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .status-connected {
    background-color: #27272a;
    color: #ffffff;
    border: 1px solid #3f3f46;
  }

  .status-disconnected {
    background-color: #18181b;
    color: #71717a;
    border: 1px solid #27272a;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    border-top: 1px solid #27272a;
    padding-top: 10px;
  }

  .metric-item {
    display: flex;
    flex-direction: column;
  }

  .metric-label {
    font-size: 10.5px;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .metric-val {
    font-size: 13px;
    font-weight: 600;
    color: #f4f4f5;
    margin-top: 2px;
  }

  .error-notice {
    font-size: 11.5px;
    color: #a1a1aa;
    background-color: #27272a;
    border: 1px solid #3f3f46;
    padding: 8px 10px;
    border-radius: 4px;
  }

  .modal-card .modal-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
    padding: 0;
    border-top: none;
    background: transparent;
    margin-top: 24px;
  }

  .btn-primary {
    height: 32px;
    padding: 0 14px;
    background-color: #ffffff;
    color: #09090b;
    border: 1px solid #ffffff;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s;
  }
  .btn-primary:hover {
    background-color: #f4f4f5;
  }

  .loading-state {
    padding: 40px 0;
    text-align: center;
    color: #71717a;
    font-size: 12.5px;
  }
</style>

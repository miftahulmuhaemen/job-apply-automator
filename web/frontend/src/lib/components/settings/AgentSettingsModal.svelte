<script lang="ts">
  import { onMount } from 'svelte'

  let { onclose }: { onclose: () => void } = $props()

  let loading = $state(true)
  let saving = $state(false)
  let testing = $state(false)
  let selectedModel = $state('default')
  let currentCliBinary = $state('/home/sahana/.local/bin/agy')
  let availableModels = $state<{ id: string; name: string }[]>([])
  let saveMessage = $state<string | null>(null)

  // Connection test state (static, zero bliping)
  let connectionTested = $state(false)
  let isConnected = $state(false)
  let testLatency = $state<number | null>(null)
  let testError = $state<string | null>(null)

  onMount(async () => {
    try {
      const res = await fetch('/api/agent/status')
      const json = await res.json()
      if (json.success && json.data) {
        selectedModel = json.data.currentModel || 'default'
        currentCliBinary = json.data.binaryPath || '/home/sahana/.local/bin/agy'
        availableModels = json.data.availableModels || []
      }
    } catch (err) {
      console.error('Failed to load agent settings:', err)
    } finally {
      loading = false
    }
  })

  async function handleTestConnection() {
    testing = true
    testError = null
    connectionTested = false
    try {
      const res = await fetch('/api/agent/diagnose', { method: 'POST' })
      const json = await res.json()
      connectionTested = true
      if (json.success) {
        isConnected = true
        testLatency = json.latencyMs || null
      } else {
        isConnected = false
        testError = json.error || 'Connection timed out or failed'
      }
    } catch (err: any) {
      connectionTested = true
      isConnected = false
      testError = err.message || 'Network request failed'
    } finally {
      testing = false
    }
  }

  async function handleSave() {
    saving = true
    saveMessage = null
    try {
      const res = await fetch('/api/agent/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          binary: currentCliBinary
        })
      })
      const json = await res.json()
      if (json.success) {
        saveMessage = 'Agent settings saved successfully'
        setTimeout(() => onclose(), 600)
      } else {
        saveMessage = json.error || 'Failed to update agent settings'
      }
    } catch (err: any) {
      saveMessage = err.message || 'Network error'
    } finally {
      saving = false
    }
  }

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
      <div class="modal-title">Agent Settings</div>
      <div class="modal-subtitle">Configure autonomous agent engine model and verify connectivity.</div>
    </div>

    {#if loading}
      <div class="loading-state">Loading agent configuration from Cloudflare D1...</div>
    {:else}
      <div class="form-body">
        <!-- 1. Agent Model Selection -->
        <div class="form-group">
          <label class="field-label" for="agent-model-select">Agent Model &amp; Effort</label>
          <select
            id="agent-model-select"
            class="input-base"
            bind:value={selectedModel}
          >
            <option value="default">Default (Use AGY CLI Active Model)</option>
            {#each availableModels as m}
              <option value={m.id}>{m.name}</option>
            {/each}
          </select>
          <div class="field-desc">
            When set to <strong>Default</strong>, the system uses the native model configured in AGY without forcing overrides.
          </div>
        </div>

        <!-- 2. Test Connection Panel -->
        <div class="test-connection-panel">
          <div class="diagnostic-info">
            <div class="field-label" style="margin-bottom: 2px;">Agent Connection Diagnostic</div>
            <div class="field-desc" style="margin-top: 0;">Test CLI binary responsiveness via ping/pong handshake.</div>
          </div>

          <div class="test-action-row">
            <button
              type="button"
              class="btn-secondary"
              style="height: 30px; font-size: 11.5px; padding: 0 12px;"
              disabled={testing}
              onclick={handleTestConnection}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          <!-- Static Status Indicator (Zero Bliping) -->
          <div class="status-result-row">
            <span class="status-label">Engine Status:</span>
            {#if !connectionTested}
              <span class="status-value status-untested">Not Checked</span>
            {:else if isConnected}
              <span class="status-value status-connected">Connected {testLatency ? `(${testLatency}ms)` : ''}</span>
            {:else}
              <span class="status-value status-disconnected">Not Connected</span>
            {/if}
          </div>

          {#if testError}
            <div class="diagnostic-error-note">{testError}</div>
          {/if}
        </div>

        {#if saveMessage}
          <div class="save-status-note">{saveMessage}</div>
        {/if}
      </div>

      <!-- Footer Buttons -->
      <div class="modal-footer">
        <button
          type="button"
          class="btn-secondary"
          onclick={onclose}
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn-primary"
          disabled={saving}
          onclick={handleSave}
        >
          {saving ? 'Saving...' : 'Save Changes'}
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
    max-width: 440px;
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

  .form-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: #f4f4f5;
    margin-bottom: 4px;
    display: block;
  }

  .field-desc {
    font-size: 11px;
    color: #71717a;
    margin-top: 4px;
    line-height: 1.35;
  }

  .input-base {
    width: 100%;
    height: 34px;
    background-color: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 0 10px;
    font-size: 12.5px;
    color: #ffffff;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
  }
  .input-base:focus {
    border-color: #52525b;
  }

  .test-connection-panel {
    background-color: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 12px;
  }

  .status-result-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
  .status-label { color: #71717a; }
  .status-value { font-weight: 600; }
  .status-untested { color: #71717a; }
  .status-connected { color: #ffffff; }
  .status-disconnected { color: #a1a1aa; }

  .diagnostic-error-note {
    font-size: 11px;
    color: #a1a1aa;
    margin-top: 8px;
    line-height: 1.35;
    word-break: break-word;
    border-top: 1px solid #27272a;
    padding-top: 6px;
  }

  .save-status-note {
    font-size: 11.5px;
    color: #ffffff;
    padding: 6px 10px;
    background-color: #27272a;
    border-radius: 4px;
    border: 1px solid #3f3f46;
  }

  .test-action-row {
    margin: 10px 0 12px 0;
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
  .btn-primary:hover:not(:disabled) {
    background-color: #f4f4f5;
  }
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    height: 32px;
    padding: 0 14px;
    background-color: #27272a;
    color: #f4f4f5;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s, border-color 0.15s;
  }
  .btn-secondary:hover {
    background-color: #3f3f46;
    border-color: #52525b;
  }

  .loading-state {
    padding: 40px 0;
    text-align: center;
    color: #71717a;
    font-size: 12.5px;
  }
</style>

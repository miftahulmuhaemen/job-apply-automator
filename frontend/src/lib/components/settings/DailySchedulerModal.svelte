<script lang="ts">
  import { onMount } from 'svelte'
  import { HelpCircle } from 'lucide-svelte'
  import Switch from '../ui/Switch.svelte'
  import Select from '../ui/Select.svelte'

  let { onclose }: { onclose: () => void } = $props()

  let loading = $state(true)
  let saving = $state(false)
  let enabled = $state(true)
  let executionFrequency = $state<'daily' | 'weekly' | 'biweekly' | 'monthly'>('daily')
  let scheduleTime = $state('08:30')
  let maxApplications = $state(20)
  let portals = $state('Jobstreet,LinkedIn')
  let saveMessage = $state<string | null>(null)

  onMount(async () => {
    try {
      const res = await fetch('/api/scheduler')
      const json = await res.json()
      if (json.success && json.data) {
        enabled = Boolean(json.data.enabled)
        scheduleTime = json.data.schedule_time || '08:30'
        maxApplications = json.data.max_daily_applications !== undefined ? json.data.max_daily_applications : 20
        if (json.data.portals) {
          portals = json.data.portals
          // Extract frequency if encoded e.g. "freq:weekly|Jobstreet,LinkedIn"
          const match = portals.match(/^freq:(daily|weekly|biweekly|monthly)\|(.*)$/)
          if (match) {
            executionFrequency = match[1] as any
            portals = match[2]
          }
        }
      }
    } catch (err) {
      console.error('Failed to load scheduler settings:', err)
    } finally {
      loading = false
    }
  })

  async function handleSave() {
    saving = true
    saveMessage = null
    try {
      const encodedPortals = `freq:${executionFrequency}|${portals}`
      const res = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          schedule_time: scheduleTime,
          max_daily_applications: Number(maxApplications),
          portals: encodedPortals
        })
      })
      const json = await res.json()
      if (json.success) {
        saveMessage = 'Settings saved successfully'
        setTimeout(() => onclose(), 600)
      } else {
        saveMessage = json.error || 'Failed to save settings'
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
      <div class="modal-title">Daily Scheduler</div>
      <div class="modal-subtitle">Configure background crawl frequency, trigger time, and batch limits.</div>
    </div>

    {#if loading}
      <div class="loading-state">Loading settings from Cloudflare D1...</div>
    {:else}
      <div class="form-body">
        <!-- 1. Enable Toggle -->
        <div class="form-row-switch">
          <div class="switch-info">
            <div class="field-label">Enable Scheduled Run</div>
            <div class="field-desc">Automatically trigger crawling sessions based on schedule.</div>
          </div>
          <Switch
            checked={enabled}
            onchange={(val) => enabled = val}
            ariaLabel="Toggle scheduled crawler run"
          />
        </div>

        <!-- 2. Execution Frequency & Time (Side by Side) -->
        <div class="form-row-grid">
          <div>
            <label class="field-label" for="frequency-select">Execution Frequency</label>
            <Select
              value={executionFrequency}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'biweekly', label: 'Biweekly' },
                { value: 'monthly', label: 'Monthly' }
              ]}
              width="100%"
              ariaLabel="Execution Frequency"
              onchange={(val) => executionFrequency = val as any}
            />
            <div class="field-desc">Cadence of crawl executions.</div>
          </div>

          <div>
            <label class="field-label" for="time-input">Execution Time</label>
            <input
              id="time-input"
              type="time"
              class="input-base"
              bind:value={scheduleTime}
            />
            <div class="field-desc">System time (24h) to trigger.</div>
          </div>
        </div>

        <!-- 3. Batch Processing Limit -->
        <div class="form-group">
          <div style="display: flex; align-items: center; gap: 6px;">
            <label class="field-label" for="limit-input" style="margin-bottom: 0;">Batch Processing Limit</label>
            <span class="tooltip-wrapper" title="Default is 20 jobs. Set to 0 for unlimited crawling.">
              <HelpCircle size={13} class="help-icon" />
            </span>
          </div>
          <input
            id="limit-input"
            type="number"
            min="0"
            max="1000"
            class="input-base"
            bind:value={maxApplications}
            style="margin-top: 6px;"
          />
          <div class="field-desc">
            Maximum jobs processed per execution cycle. Set to <strong>0</strong> for unlimited.
          </div>
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

  .form-row-switch {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background-color: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
  }

  .switch-info {
    flex: 1;
    padding-right: 12px;
  }

  .form-row-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
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

  .tooltip-wrapper {
    display: inline-flex;
    align-items: center;
    cursor: help;
  }

  :global(.help-icon) {
    color: #71717a;
  }
  :global(.help-icon):hover {
    color: #ffffff;
  }

  .save-status-note {
    font-size: 11.5px;
    color: #ffffff;
    padding: 6px 10px;
    background-color: #27272a;
    border-radius: 4px;
    border: 1px solid #3f3f46;
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

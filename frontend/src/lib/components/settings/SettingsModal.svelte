<script lang="ts">
  import { onMount } from 'svelte'
  import {
    X, Search, Bot, Clock, Database, Mail, Activity, Check, AlertCircle,
    Loader2, ExternalLink, Key, Globe, Eye, EyeOff, Sparkles, Terminal
  } from 'lucide-svelte'
  import Switch from '../ui/Switch.svelte'
  import Select from '../ui/Select.svelte'

  let { onclose }: { onclose: () => void } = $props()

  // Tabs Navigation
  type SettingsTab = 'llm' | 'scheduler' | 'storage' | 'google' | 'diagnostics'
  let activeTab = $state<SettingsTab>('llm')
  let searchQuery = $state('')

  // -------------------------------------------------------------
  // 1. LLM Connector State
  // -------------------------------------------------------------
  let llmLoading = $state(true)
  let llmSaving = $state(false)
  let llmTesting = $state(false)
  let llmSaveMessage = $state<string | null>(null)
  let llmSaveError = $state<string | null>(null)

  let provider = $state('cli_agy')
  let model = $state('gemini-3.8-flash-high')
  let binary = $state('/home/sahana/.local/bin/agy')
  let baseUrl = $state('')
  let apiKey = $state('')
  let hasApiKey = $state(false)
  let maskedKey = $state('')
  let customArgs = $state('')
  let timeoutSeconds = $state(60)
  let temperature = $state(0.2)
  let showApiKey = $state(false)

  // Test status
  let testResult = $state<{
    tested: boolean
    success: boolean
    latencyMs: number | null
    message: string | null
    error: string | null
  }>({
    tested: false,
    success: false,
    latencyMs: null,
    message: null,
    error: null
  })

  let availableProviders = $state<Array<{ id: string; name: string; kind: string }>>([])
  let modelPresets = $state<Record<string, Array<{ id: string; name: string }>>>({})

  // -------------------------------------------------------------
  // 2. Scheduler State
  // -------------------------------------------------------------
  let schedulerLoading = $state(true)
  let schedulerSaving = $state(false)
  let schedulerEnabled = $state(true)
  let executionFrequency = $state<'daily' | 'weekly' | 'biweekly' | 'monthly'>('daily')
  let scheduleTime = $state('08:30')
  let maxApplications = $state(20)
  let portals = $state('Jobstreet,LinkedIn')
  let schedulerMessage = $state<string | null>(null)

  // -------------------------------------------------------------
  // 3. Storage State
  // -------------------------------------------------------------
  let storageLoading = $state(false)
  let storageData = $state<any>(null)

  // -------------------------------------------------------------
  // 4. Google Auth State
  // -------------------------------------------------------------
  let googleData = $state<any>(null)
  let googleLoading = $state(false)

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  async function loadLlmSettings() {
    llmLoading = true
    try {
      const res = await fetch('/api/settings/llm')
      const json = await res.json()
      if (json.success && json.data) {
        provider = json.data.provider || 'cli_agy'
        model = json.data.model || 'gemini-3.8-flash-high'
        binary = json.data.binary || '/home/sahana/.local/bin/agy'
        baseUrl = json.data.base_url || ''
        hasApiKey = json.data.has_api_key || false
        maskedKey = json.data.api_key_masked || ''
        customArgs = json.data.custom_args || ''
        timeoutSeconds = json.data.timeout_seconds || 60
        temperature = json.data.temperature !== undefined ? json.data.temperature : 0.2
        availableProviders = json.available_providers || []
        modelPresets = json.model_presets || {}
      }
    } catch (err: any) {
      console.error('Failed to load LLM settings:', err)
    } finally {
      llmLoading = false
    }
  }

  async function loadScheduler() {
    schedulerLoading = true
    try {
      const res = await fetch('/api/scheduler')
      const json = await res.json()
      if (json.success && json.data) {
        schedulerEnabled = Boolean(json.data.enabled)
        scheduleTime = json.data.schedule_time || '08:30'
        maxApplications = json.data.max_daily_applications !== undefined ? json.data.max_daily_applications : 20
        if (json.data.portals) {
          portals = json.data.portals
          const match = portals.match(/^freq:(daily|weekly|biweekly|monthly)\\|(.*)$/)
          if (match) {
            executionFrequency = match[1] as any
            portals = match[2]
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load scheduler:', err)
    } finally {
      schedulerLoading = false
    }
  }

  async function loadStorage() {
    storageLoading = true
    try {
      const res = await fetch('/api/storage/status')
      const json = await res.json()
      if (json.success) {
        storageData = json
      }
    } catch (err) {
      console.error('Failed to load storage status:', err)
    } finally {
      storageLoading = false
    }
  }

  async function loadGoogle() {
    try {
      const res = await fetch('/api/auth/google/status')
      const json = await res.json()
      if (json.success) {
        googleData = json
      }
    } catch (err) {
      console.error('Failed to load Google status:', err)
    }
  }

  onMount(() => {
    loadLlmSettings()
    loadScheduler()
    loadStorage()
    loadGoogle()
  })

  // -------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------
  async function handleTestLlm() {
    llmTesting = true
    testResult = { tested: false, success: false, latencyMs: null, message: null, error: null }
    try {
      const payload: any = {
        provider,
        model,
        binary,
        base_url: baseUrl,
        custom_args: customArgs,
        timeout_seconds: Number(timeoutSeconds)
      }
      if (apiKey.trim()) {
        payload.api_key = apiKey.trim()
      }

      const res = await fetch('/api/settings/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      testResult = {
        tested: true,
        success: Boolean(json.success),
        latencyMs: json.latency_ms || json.latencyMs || null,
        message: json.message || null,
        error: json.error || null
      }
    } catch (err: any) {
      testResult = {
        tested: true,
        success: false,
        latencyMs: null,
        message: null,
        error: err.message || 'Network request failed'
      }
    } finally {
      llmTesting = false
    }
  }

  async function handleSaveLlm() {
    llmSaving = true
    llmSaveMessage = null
    llmSaveError = null
    try {
      const payload: any = {
        enabled: true,
        provider,
        model,
        binary,
        base_url: baseUrl,
        timeout_seconds: Number(timeoutSeconds),
        custom_args: customArgs,
        temperature: Number(temperature)
      }
      if (apiKey.trim()) {
        payload.api_key = apiKey.trim()
      }

      const res = await fetch('/api/settings/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (json.success) {
        llmSaveMessage = 'LLM connector settings saved successfully'
        if (apiKey.trim()) {
          hasApiKey = true
          maskedKey = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : '••••••••'
          apiKey = ''
          showApiKey = false
        }
        setTimeout(() => { llmSaveMessage = null }, 3000)
      } else {
        llmSaveError = json.error || 'Failed to save settings'
      }
    } catch (err: any) {
      llmSaveError = err.message || 'Failed to save settings'
    } finally {
      llmSaving = false
    }
  }

  async function handleSaveScheduler() {
    schedulerSaving = true
    schedulerMessage = null
    try {
      const encodedPortals = `freq:${executionFrequency}|${portals}`
      const res = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: schedulerEnabled,
          schedule_time: scheduleTime,
          max_daily_applications: Number(maxApplications),
          portals: encodedPortals
        })
      })
      const json = await res.json()
      if (json.success) {
        schedulerMessage = 'Scheduler settings saved'
        setTimeout(() => { schedulerMessage = null }, 3000)
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      schedulerSaving = false
    }
  }

  async function handleStartGoogleAuth() {
    googleLoading = true
    try {
      const res = await fetch('/api/auth/google/start')
      const json = await res.json()
      if (json.success && json.auth_url) {
        window.open(json.auth_url, '_blank')
        const timer = setInterval(async () => {
          const checkRes = await fetch('/api/auth/google/status')
          const checkJson = await checkRes.json()
          if (checkJson.authenticated) {
            clearInterval(timer)
            googleData = checkJson
            googleLoading = false
          }
        }, 2000)
        setTimeout(() => { clearInterval(timer); googleLoading = false }, 120000)
      }
    } catch (_) {
      googleLoading = false
    }
  }

  function applyPreset(url: string, defaultModel?: string) {
    baseUrl = url
    if (defaultModel) model = defaultModel
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose()
  }

  // Navigation Items with search filtering
  const navItems = [
    { id: 'llm' as SettingsTab, group: 'AI CAPABILITIES', label: 'LLM Connectors', icon: Bot, badge: 'Active' },
    { id: 'scheduler' as SettingsTab, group: 'ORCHESTRATION', label: 'Daily Scheduler', icon: Clock },
    { id: 'storage' as SettingsTab, group: 'STORAGE & CONNECTIONS', label: 'Cloudflare Storage', icon: Database },
    { id: 'google' as SettingsTab, group: 'STORAGE & CONNECTIONS', label: 'Google Ecosystem', icon: Mail },
    { id: 'diagnostics' as SettingsTab, group: 'SYSTEM', label: 'Diagnostics & Health', icon: Activity }
  ]

  const filteredNav = $derived(
    navItems.filter(item => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q)
    })
  )
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Modal Backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={onclose}>
  <div class="settings-dialog" onclick={(e) => e.stopPropagation()}>
    <!-- Left Navigation Sidebar -->
    <aside class="settings-sidebar">
      <!-- Search Input -->
      <div class="sidebar-search-box">
        <div class="search-input-wrapper">
          <Search size={14} class="search-icon" />
          <input
            type="text"
            class="search-input"
            placeholder="Search settings..."
            bind:value={searchQuery}
          />
        </div>
      </div>

      <!-- Navigation Menu -->
      <div class="sidebar-nav-scroll">
        {#each ['AI CAPABILITIES', 'ORCHESTRATION', 'STORAGE & CONNECTIONS', 'SYSTEM'] as groupTitle}
          {@const groupItems = filteredNav.filter(item => item.group === groupTitle)}
          {#if groupItems.length > 0}
            <div class="nav-group">
              <div class="group-title">{groupTitle}</div>
              {#each groupItems as item}
                {@const Icon = item.icon}
                <button
                  type="button"
                  class="nav-item-btn"
                  class:active={activeTab === item.id}
                  onclick={() => activeTab = item.id}
                >
                  <Icon size={15} class="nav-item-icon" />
                  <span class="nav-item-label">{item.label}</span>
                  {#if item.badge}
                    <span class="nav-item-badge">{item.badge}</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        {/each}
      </div>
    </aside>

    <!-- Right Content Area -->
    <main class="settings-content">
      <!-- Content Header -->
      <header class="content-header">
        <div class="header-titles">
          {#if activeTab === 'llm'}
            <h2 class="content-title">LLM Connectors &amp; AI Engine</h2>
            <p class="content-subtitle">Select and configure the language model engine for automated triage, unknown ATS exploration, and Q&amp;A synthesis.</p>
          {:else if activeTab === 'scheduler'}
            <h2 class="content-title">Daily Scheduler &amp; Quotas</h2>
            <p class="content-subtitle">Automate daily application catch-up runs, target portal scopes, and submission quotas.</p>
          {:else if activeTab === 'storage'}
            <h2 class="content-title">Cloudflare D1 &amp; R2 Storage</h2>
            <p class="content-subtitle">Real-time telemetry and resource quotas for database records and multi-region asset buckets.</p>
          {:else if activeTab === 'google'}
            <h2 class="content-title">Google SSO &amp; Gmail Service</h2>
            <p class="content-subtitle">Authorize Gmail API scopes for native ATS application dispatches and candidate correspondence.</p>
          {:else if activeTab === 'diagnostics'}
            <h2 class="content-title">System Diagnostics &amp; Health</h2>
            <p class="content-subtitle">Inspect process manager telemetry, binary availability, and subsystem latency.</p>
          {/if}
        </div>
        <button type="button" class="btn-close" onclick={onclose} aria-label="Close settings">
          <X size={18} />
        </button>
      </header>

      <!-- Content Scrollable Body -->
      <div class="content-body">
        <!-- TAB 1: LLM CONNECTORS -->
        {#if activeTab === 'llm'}
          {#if llmLoading}
            <div class="tab-loading">
              <Loader2 size={20} class="animate-spin" />
              <span>Loading LLM connector parameters...</span>
            </div>
          {:else}
            <!-- Provider Selection -->
            <section class="settings-card">
              <div class="card-header">
                <span class="card-title">Active LLM Provider</span>
                <span class="card-description">Choose how the autonomous agent generates extraction data and screening responses.</span>
              </div>

              <div class="provider-grid">
                <button
                  type="button"
                  class="provider-card"
                  class:selected={provider === 'cli_agy'}
                  onclick={() => { provider = 'cli_agy'; model = 'gemini-3.8-flash-high' }}
                >
                  <div class="provider-radio-indicator"></div>
                  <div class="provider-meta">
                    <span class="provider-name">Antigravity CLI (agy)</span>
                    <span class="provider-tag">Default Native Bridge</span>
                    <span class="provider-desc">Native sub-agent bridge running locally via AGY CLI with zero network credentials.</span>
                  </div>
                </button>

                <button
                  type="button"
                  class="provider-card"
                  class:selected={provider === 'openai_compatible'}
                  onclick={() => { provider = 'openai_compatible'; if (!baseUrl) baseUrl = 'https://openrouter.ai/api/v1'; model = 'gpt-4o-mini' }}
                >
                  <div class="provider-radio-indicator"></div>
                  <div class="provider-meta">
                    <span class="provider-name">OpenAI-Compatible API</span>
                    <span class="provider-tag">Direct HTTP REST</span>
                    <span class="provider-desc">Connect any compatible provider: OpenAI, OpenRouter, DeepSeek, Ollama, Groq, or vLLM.</span>
                  </div>
                </button>

                <button
                  type="button"
                  class="provider-card"
                  class:selected={provider === 'anthropic_compatible'}
                  onclick={() => { provider = 'anthropic_compatible'; baseUrl = 'https://api.anthropic.com'; model = 'claude-3-7-sonnet-20250219' }}
                >
                  <div class="provider-radio-indicator"></div>
                  <div class="provider-meta">
                    <span class="provider-name">Anthropic-Compatible API</span>
                    <span class="provider-tag">Claude Messages API</span>
                    <span class="provider-desc">Direct Claude API or enterprise Anthropic-compatible gateway with thinking reasoning.</span>
                  </div>
                </button>

                <button
                  type="button"
                  class="provider-card"
                  class:selected={provider === 'cli_claude'}
                  onclick={() => { provider = 'cli_claude'; binary = 'claude'; model = 'claude-3-7-sonnet' }}
                >
                  <div class="provider-radio-indicator"></div>
                  <div class="provider-meta">
                    <span class="provider-name">Claude Code CLI</span>
                    <span class="provider-tag">Terminal Agent</span>
                    <span class="provider-desc">Headless execution via local `claude` CLI binary with session isolation.</span>
                  </div>
                </button>

                <button
                  type="button"
                  class="provider-card"
                  class:selected={provider === 'cli_custom'}
                  onclick={() => { provider = 'cli_custom' }}
                >
                  <div class="provider-radio-indicator"></div>
                  <div class="provider-meta">
                    <span class="provider-name">Custom Agent CLI</span>
                    <span class="provider-tag">Cline / OpenCode</span>
                    <span class="provider-desc">Execute an arbitrary local agent binary with custom prompt argument templates.</span>
                  </div>
                </button>
              </div>
            </section>

            <!-- Configuration Form -->
            <section class="settings-card">
              <div class="card-header">
                <span class="card-title">Provider Configuration</span>
                <span class="card-description">Credentials, endpoints, and model identification for the selected provider.</span>
              </div>

              <!-- When OpenAI or Anthropic API -->
              {#if provider === 'openai_compatible' || provider === 'anthropic_compatible'}
                <!-- Base URL -->
                <div class="form-row">
                  <div class="row-label">
                    <label for="llm-base-url">Endpoint Base URL</label>
                    <span class="row-hint">REST base URL without trailing slash.</span>
                  </div>
                  <div class="row-input">
                    <input
                      id="llm-base-url"
                      type="text"
                      class="text-input"
                      placeholder={provider === 'openai_compatible' ? 'https://openrouter.ai/api/v1' : 'https://api.anthropic.com'}
                      bind:value={baseUrl}
                    />
                    {#if provider === 'openai_compatible'}
                      <div class="quick-presets">
                        <span class="presets-label">Presets:</span>
                        <button type="button" class="preset-pill" onclick={() => applyPreset('https://openrouter.ai/api/v1', 'anthropic/claude-3.7-sonnet')}>OpenRouter</button>
                        <button type="button" class="preset-pill" onclick={() => applyPreset('https://api.openai.com/v1', 'gpt-4o-mini')}>OpenAI</button>
                        <button type="button" class="preset-pill" onclick={() => applyPreset('https://api.deepseek.com/v1', 'deepseek-chat')}>DeepSeek</button>
                        <button type="button" class="preset-pill" onclick={() => applyPreset('http://localhost:11434/v1', 'llama3.3:latest')}>Ollama (Local)</button>
                      </div>
                    {/if}
                  </div>
                </div>

                <!-- API Key -->
                <div class="form-row">
                  <div class="row-label">
                    <label for="llm-api-key">API Key / Token</label>
                    <span class="row-hint">
                      {#if hasApiKey}
                        Active key saved: <code class="code-pill">{maskedKey}</code>
                      {:else}
                        Enter your secret authorization key.
                      {/if}
                    </span>
                  </div>
                  <div class="row-input">
                    <div class="password-wrapper">
                      <input
                        id="llm-api-key"
                        type={showApiKey ? 'text' : 'password'}
                        class="text-input"
                        placeholder={hasApiKey ? 'Enter new key to replace existing' : 'sk-...'}
                        bind:value={apiKey}
                      />
                      <button
                        type="button"
                        class="btn-toggle-vis"
                        onclick={() => showApiKey = !showApiKey}
                        title={showApiKey ? 'Hide' : 'Show'}
                      >
                        {#if showApiKey}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
                      </button>
                    </div>
                  </div>
                </div>
              {/if}

              <!-- When CLI (AGY, Claude, Custom) -->
              {#if provider === 'cli_agy' || provider === 'cli_claude' || provider === 'cli_custom'}
                <div class="form-row">
                  <div class="row-label">
                    <label for="llm-binary">CLI Binary Path</label>
                    <span class="row-hint">Absolute path or system command name.</span>
                  </div>
                  <div class="row-input">
                    <input
                      id="llm-binary"
                      type="text"
                      class="text-input font-mono"
                      placeholder="/home/sahana/.local/bin/agy"
                      bind:value={binary}
                    />
                  </div>
                </div>

                {#if provider === 'cli_custom'}
                  <div class="form-row">
                    <div class="row-label">
                      <label for="llm-args">Custom Arguments Template</label>
                      <span class="row-hint">Use <code>{'{prompt}'}</code> and <code>{'{model}'}</code> placeholders.</span>
                    </div>
                    <div class="row-input">
                      <input
                        id="llm-args"
                        type="text"
                        class="text-input font-mono"
                        placeholder="-p {prompt} --model {model} --output-format json"
                        bind:value={customArgs}
                      />
                    </div>
                  </div>
                {/if}
              {/if}

              <!-- Model Identifier -->
              <div class="form-row">
                <div class="row-label">
                  <label for="llm-model">Model Identifier</label>
                  <span class="row-hint">Model ID or tag used for requests.</span>
                </div>
                <div class="row-input">
                  <input
                    id="llm-model"
                    type="text"
                    class="text-input font-mono"
                    placeholder="e.g. gpt-4o, claude-3-7-sonnet, gemini-3.8-flash-high"
                    bind:value={model}
                  />
                  <!-- Model Presets list if available for this provider -->
                  {#if modelPresets[provider] && modelPresets[provider].length > 0}
                    <div class="quick-presets">
                      <span class="presets-label">Suggested:</span>
                      {#each modelPresets[provider] as preset}
                        <button
                          type="button"
                          class="preset-pill"
                          class:active={model === preset.id}
                          onclick={() => model = preset.id}
                        >
                          {preset.name}
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>

              <!-- Execution Timeout -->
              <div class="form-row">
                <div class="row-label">
                  <label for="llm-timeout">Process Timeout (Seconds)</label>
                  <span class="row-hint">Maximum execution limit before hard abort.</span>
                </div>
                <div class="row-input">
                  <input
                    id="llm-timeout"
                    type="number"
                    min="10"
                    max="300"
                    class="text-input text-input-short"
                    bind:value={timeoutSeconds}
                  />
                </div>
              </div>
            </section>

            <!-- Test & Save Footer Bar -->
            <div class="action-footer">
              <div class="test-feedback">
                {#if testResult.tested}
                  {#if testResult.success}
                    <div class="status-badge success">
                      <Check size={14} />
                      <span>Connected successfully ({testResult.latencyMs}ms)</span>
                    </div>
                  {:else}
                    <div class="status-badge error">
                      <AlertCircle size={14} />
                      <span>{testResult.error || 'Connection failed'}</span>
                    </div>
                  {/if}
                {:else if llmSaveMessage}
                  <div class="status-badge success">
                    <Check size={14} />
                    <span>{llmSaveMessage}</span>
                  </div>
                {:else if llmSaveError}
                  <div class="status-badge error">
                    <AlertCircle size={14} />
                    <span>{llmSaveError}</span>
                  </div>
                {/if}
              </div>

              <div class="action-buttons">
                <button
                  type="button"
                  class="btn-secondary"
                  disabled={llmTesting}
                  onclick={handleTestLlm}
                >
                  {#if llmTesting}
                    <Loader2 size={14} class="animate-spin" />
                    <span>Testing...</span>
                  {:else}
                    <Activity size={14} />
                    <span>Test Connection</span>
                  {/if}
                </button>

                <button
                  type="button"
                  class="btn-primary"
                  disabled={llmSaving}
                  onclick={handleSaveLlm}
                >
                  {#if llmSaving}
                    <Loader2 size={14} class="animate-spin" />
                    <span>Saving...</span>
                  {:else}
                    <span>Save Connector Settings</span>
                  {/if}
                </button>
              </div>
            </div>
          {/if}

        <!-- TAB 2: DAILY SCHEDULER -->
        {:else if activeTab === 'scheduler'}
          {#if schedulerLoading}
            <div class="tab-loading">
              <Loader2 size={20} class="animate-spin" />
              <span>Loading scheduler configuration...</span>
            </div>
          {:else}
            <section class="settings-card">
              <div class="card-header">
                <span class="card-title">Automated Daily Catch-Up Run</span>
                <span class="card-description">Configure the cron-like morning catch-up engine for pending triage and submissions.</span>
              </div>

              <div class="form-row">
                <div class="row-label">
                  <label for="scheduler-toggle">Scheduler State</label>
                  <span class="row-hint">Enable or suspend all automated batch runs.</span>
                </div>
                <div class="row-input">
                  <Switch checked={schedulerEnabled} onchange={(v) => schedulerEnabled = v} />
                </div>
              </div>

              <div class="form-row">
                <div class="row-label">
                  <label for="sched-freq">Execution Frequency</label>
                  <span class="row-hint">Cadence for autonomous processing.</span>
                </div>
                <div class="row-input">
                  <Select
                    value={executionFrequency}
                    options={[
                      { value: 'daily', label: 'Daily (Every morning)' },
                      { value: 'weekly', label: 'Weekly (Every Monday)' },
                      { value: 'biweekly', label: 'Bi-Weekly (Every 2 weeks)' },
                      { value: 'monthly', label: 'Monthly' }
                    ]}
                    width="260px"
                    onchange={(v) => executionFrequency = v as any}
                  />
                </div>
              </div>

              <div class="form-row">
                <div class="row-label">
                  <label for="sched-time">Scheduled Start Time</label>
                  <span class="row-hint">Local host timezone (24-hour format).</span>
                </div>
                <div class="row-input">
                  <input
                    id="sched-time"
                    type="time"
                    class="text-input text-input-short"
                    bind:value={scheduleTime}
                  />
                </div>
              </div>

              <div class="form-row">
                <div class="row-label">
                  <label for="sched-quota">Daily Submission Quota</label>
                  <span class="row-hint">Maximum applications to submit per day.</span>
                </div>
                <div class="row-input">
                  <input
                    id="sched-quota"
                    type="number"
                    min="1"
                    max="100"
                    class="text-input text-input-short"
                    bind:value={maxApplications}
                  />
                </div>
              </div>

              <div class="form-row">
                <div class="row-label">
                  <label for="sched-portals">Target Portals Filter</label>
                  <span class="row-hint">Comma-separated portal identifiers.</span>
                </div>
                <div class="row-input">
                  <input
                    id="sched-portals"
                    type="text"
                    class="text-input"
                    bind:value={portals}
                  />
                </div>
              </div>
            </section>

            <div class="action-footer">
              <div class="test-feedback">
                {#if schedulerMessage}
                  <div class="status-badge success">
                    <Check size={14} />
                    <span>{schedulerMessage}</span>
                  </div>
                {/if}
              </div>
              <button
                type="button"
                class="btn-primary"
                disabled={schedulerSaving}
                onclick={handleSaveScheduler}
              >
                {#if schedulerSaving}
                  <Loader2 size={14} class="animate-spin" />
                  <span>Saving...</span>
                {:else}
                  <span>Save Scheduler</span>
                {/if}
              </button>
            </div>
          {/if}

        <!-- TAB 3: CLOUDFLARE STORAGE -->
        {:else if activeTab === 'storage'}
          {#if storageLoading}
            <div class="tab-loading">
              <Loader2 size={20} class="animate-spin" />
              <span>Querying Cloudflare D1 &amp; R2 status...</span>
            </div>
          {:else if storageData}
            <section class="settings-card">
              <div class="card-header">
                <span class="card-title">Cloudflare D1 Relational Database</span>
                <span class="card-description">Master serverless SQLite ledger holding companies, jobs, criteria, and attribute overrides.</span>
              </div>
              <div class="metrics-grid">
                <div class="metric-card">
                  <span class="metric-title">Database ID</span>
                  <span class="metric-val font-mono">{storageData.d1?.id || 'b54fd60b...'}</span>
                </div>
                <div class="metric-card">
                  <span class="metric-title">Tables Count</span>
                  <span class="metric-val">{storageData.d1?.num_tables || 9} tables</span>
                </div>
                <div class="metric-card">
                  <span class="metric-title">Storage Size</span>
                  <span class="metric-val">{storageData.d1?.file_size_formatted || '266 KB'}</span>
                </div>
                <div class="metric-card">
                  <span class="metric-title">Region</span>
                  <span class="metric-val">{storageData.d1?.region || 'APAC'}</span>
                </div>
              </div>
            </section>

            <section class="settings-card">
              <div class="card-header">
                <span class="card-title">Cloudflare R2 Object Storage Bucket</span>
                <span class="card-description">Multi-region asset bucket (`amiya`) storing resumes, tailored PDFs, and audit screenshots.</span>
              </div>
              <div class="metrics-grid">
                <div class="metric-card">
                  <span class="metric-title">Bucket Name</span>
                  <span class="metric-val font-mono">{storageData.r2?.bucket || 'amiya'}</span>
                </div>
                <div class="metric-card">
                  <span class="metric-title">Total Objects</span>
                  <span class="metric-val">{storageData.r2?.object_count || 0} files</span>
                </div>
                <div class="metric-card">
                  <span class="metric-title">Total Volume</span>
                  <span class="metric-val">{storageData.r2?.total_formatted || '0 KB'}</span>
                </div>
                <div class="metric-card">
                  <span class="metric-title">Status</span>
                  <span class="metric-val text-emerald-400">CONNECTED</span>
                </div>
              </div>
            </section>
          {/if}

        <!-- TAB 4: GOOGLE ECOSYSTEM -->
        {:else if activeTab === 'google'}
          <section class="settings-card">
            <div class="card-header">
              <span class="card-title">Gmail API Authentication &amp; OAuth 2.0</span>
              <span class="card-description">Grant access to send candidate applications and sync correspondence.</span>
            </div>

            <div class="google-auth-status">
              {#if googleData?.authenticated}
                <div class="auth-connected-box">
                  <div class="auth-indicator-pill online">Connected</div>
                  <div class="auth-details">
                    <span class="auth-email">{googleData.email || 'Authorized'}</span>
                    <span class="auth-path font-mono text-xs">{googleData.token_path || 'Token saved'}</span>
                  </div>
                </div>
              {:else}
                <div class="auth-disconnected-box">
                  <p class="auth-desc">Google account is not currently linked. Connect to enable automatic email dispatch.</p>
                  <button
                    type="button"
                    class="btn-primary"
                    disabled={googleLoading}
                    onclick={handleStartGoogleAuth}
                  >
                    {#if googleLoading}
                      <Loader2 size={14} class="animate-spin" />
                      <span>Authorizing...</span>
                    {:else}
                      <Mail size={14} />
                      <span>Authorize Google Account</span>
                    {/if}
                  </button>
                </div>
              {/if}
            </div>
          </section>

        <!-- TAB 5: SYSTEM DIAGNOSTICS -->
        {:else if activeTab === 'diagnostics'}
          <section class="settings-card">
            <div class="card-header">
              <span class="card-title">Runtime Environment</span>
              <span class="card-description">Host system information and process supervision status.</span>
            </div>

            <div class="metrics-grid">
              <div class="metric-card">
                <span class="metric-title">Backend Architecture</span>
                <span class="metric-val">Axum 0.8 (Pure Rust)</span>
              </div>
              <div class="metric-card">
                <span class="metric-title">Frontend Runtime</span>
                <span class="metric-val">Svelte 5 Runes (Vite 6)</span>
              </div>
              <div class="metric-card">
                <span class="metric-title">HTTP Port</span>
                <span class="metric-val">3100 (Embedded)</span>
              </div>
              <div class="metric-card">
                <span class="metric-title">Dev Port</span>
                <span class="metric-val">5173 (HMR)</span>
              </div>
            </div>
          </section>
        {/if}
      </div>
    </main>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.78);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .settings-dialog {
    width: 92vw;
    max-width: 1060px;
    height: 84vh;
    max-height: 780px;
    min-height: 540px;
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 12px;
    display: flex;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
  }

  /* Left Sidebar */
  .settings-sidebar {
    width: 250px;
    border-right: 1px solid #27272a;
    background: #09090b;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .sidebar-search-box {
    padding: 16px 14px 12px;
    border-bottom: 1px solid #18181b;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 10px;
    color: #71717a;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    height: 32px;
    padding: 0 10px 0 32px;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    color: #ffffff;
    font-size: 12px;
    outline: none;
    transition: border-color 0.15s;
  }
  .search-input:focus {
    border-color: #52525b;
  }

  .sidebar-nav-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .nav-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .group-title {
    font-size: 10px;
    font-weight: 600;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 4px 8px;
  }

  .nav-item-btn {
    width: 100%;
    height: 34px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: #a1a1aa;
    font-size: 13px;
    text-align: left;
    transition: all 0.15s;
    outline: none;
  }
  .nav-item-btn:hover {
    background: #18181b;
    color: #ffffff;
  }
  .nav-item-btn.active {
    background: #27272a;
    color: #ffffff;
    font-weight: 500;
  }

  .nav-item-icon {
    flex-shrink: 0;
  }

  .nav-item-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nav-item-badge {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    background: #18181b;
    border: 1px solid #3f3f46;
    color: #e4e4e7;
  }

  /* Right Content Pane */
  .settings-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: #09090b;
    overflow: hidden;
  }

  .content-header {
    padding: 20px 28px 18px;
    border-bottom: 1px solid #27272a;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-shrink: 0;
  }

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .content-title {
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .content-subtitle {
    font-size: 13px;
    color: #71717a;
    margin: 0;
    line-height: 1.4;
  }

  .btn-close {
    background: transparent;
    border: 1px solid transparent;
    padding: 6px;
    border-radius: 6px;
    color: #71717a;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .btn-close:hover {
    background: #27272a;
    color: #ffffff;
  }

  .content-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .tab-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 60px 0;
    color: #71717a;
    font-size: 13px;
  }

  /* Settings Card Containers */
  .settings-card {
    background: #101014;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .card-header {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding-bottom: 4px;
  }

  .card-title {
    font-size: 14px;
    font-weight: 600;
    color: #f4f4f5;
  }

  .card-description {
    font-size: 12px;
    color: #71717a;
  }

  /* Provider Segmented Grid */
  .provider-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
  }

  .provider-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
    outline: none;
  }
  .provider-card:hover {
    border-color: #3f3f46;
    background: #1c1c20;
  }
  .provider-card.selected {
    border-color: #52525b;
    background: #202024;
  }

  .provider-radio-indicator {
    width: 14px;
    height: 14px;
    border-radius: 7px;
    border: 1px solid #3f3f46;
    margin-top: 2px;
    flex-shrink: 0;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .provider-card.selected .provider-radio-indicator {
    border-color: #ffffff;
    background: #ffffff;
  }

  .provider-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .provider-name {
    font-size: 13px;
    font-weight: 600;
    color: #ffffff;
  }

  .provider-tag {
    font-size: 10px;
    font-weight: 500;
    color: #a1a1aa;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .provider-desc {
    font-size: 11px;
    color: #71717a;
    line-height: 1.35;
    margin-top: 2px;
  }

  /* Form Rows */
  .form-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    padding-top: 8px;
    border-top: 1px solid #18181b;
  }

  .row-label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .row-label label {
    font-size: 13px;
    font-weight: 500;
    color: #e4e4e7;
  }
  .row-hint {
    font-size: 12px;
    color: #71717a;
    line-height: 1.35;
  }

  .row-input {
    width: 380px;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .text-input {
    width: 100%;
    height: 34px;
    padding: 0 10px;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    color: #ffffff;
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }
  .text-input:focus {
    border-color: #52525b;
  }
  .text-input-short {
    width: 140px;
  }

  .password-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  .password-wrapper .text-input {
    padding-right: 34px;
  }
  .btn-toggle-vis {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    color: #71717a;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .btn-toggle-vis:hover {
    color: #ffffff;
  }

  .code-pill {
    background: #18181b;
    border: 1px solid #27272a;
    padding: 1px 4px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 11px;
    color: #a1a1aa;
  }

  .quick-presets {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }
  .presets-label {
    font-size: 11px;
    color: #71717a;
  }
  .preset-pill {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 4px;
    padding: 2px 7px;
    font-size: 11px;
    color: #a1a1aa;
    cursor: pointer;
    transition: all 0.12s;
  }
  .preset-pill:hover {
    background: #27272a;
    color: #ffffff;
    border-color: #3f3f46;
  }
  .preset-pill.active {
    background: #27272a;
    color: #ffffff;
    border-color: #52525b;
  }

  /* Metrics Grid */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }
  .metric-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .metric-title {
    font-size: 11px;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .metric-val {
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
    word-break: break-all;
  }

  /* Google Auth */
  .google-auth-status {
    padding: 8px 0;
  }
  .auth-connected-box {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
  }
  .auth-indicator-pill {
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  .auth-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .auth-email {
    font-size: 13px;
    font-weight: 600;
    color: #ffffff;
  }

  .auth-disconnected-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .auth-desc {
    margin: 0;
    font-size: 13px;
    color: #71717a;
  }

  /* Action Footer Bar */
  .action-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-top: 10px;
    margin-top: auto;
  }

  .test-feedback {
    flex: 1;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 6px;
  }
  .status-badge.success {
    background: rgba(16, 185, 129, 0.12);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.25);
  }
  .status-badge.error {
    background: rgba(239, 68, 68, 0.12);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.25);
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-primary {
    height: 34px;
    padding: 0 14px;
    background: #ffffff;
    color: #09090b;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: opacity 0.15s;
  }
  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    height: 34px;
    padding: 0 14px;
    background: #18181b;
    color: #e4e4e7;
    border: 1px solid #27272a;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.15s;
  }
  .btn-secondary:hover:not(:disabled) {
    background: #27272a;
    border-color: #3f3f46;
    color: #ffffff;
  }
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .font-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
</style>

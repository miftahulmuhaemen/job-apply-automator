<script lang="ts">
  import { onMount } from 'svelte'

  let { onclose }: { onclose: () => void } = $props()

  let loading = $state(true)
  let storageData = $state<any>(null)
  let errorMessage = $state<string | null>(null)

  // Google SSO & Ecosystem Integration State
  let googleData = $state<any>(null)
  let googleLoading = $state(false)
  let googleAuthError = $state<string | null>(null)

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

  async function loadGoogleStatus() {
    try {
      const res = await fetch('/api/auth/google/status')
      const json = await res.json()
      if (json.success) {
        googleData = json
      }
    } catch (err) {
      console.error('Failed to load Google auth status:', err)
    }
  }

  async function handleStartGoogleAuth() {
    googleLoading = true
    googleAuthError = null
    try {
      const res = await fetch('/api/auth/google/start')
      const json = await res.json()
      if (json.success && json.auth_url) {
        // Open OAuth flow in new window/tab
        window.open(json.auth_url, '_blank')
        
        // Poll for completion
        const timer = setInterval(async () => {
          const checkRes = await fetch('/api/auth/google/status')
          const checkJson = await checkRes.json()
          if (checkJson.authenticated) {
            clearInterval(timer)
            googleData = checkJson
            googleLoading = false
          }
        }, 2000)

        setTimeout(() => {
          clearInterval(timer)
          googleLoading = false
        }, 120000)
      } else {
        googleAuthError = json.error || 'Failed to initiate Google authentication'
        googleLoading = false
      }
    } catch (err: any) {
      googleAuthError = err.message || 'Error contacting auth endpoint'
      googleLoading = false
    }
  }

  async function handleDisconnectGoogle() {
    if (!confirm('Disconnect Google account? Direct email submission and Gmail drafts will be paused.')) return
    try {
      await fetch('/api/auth/google/disconnect', { method: 'POST' })
      await loadGoogleStatus()
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
  }

  onMount(() => {
    loadStorageStatus()
    loadGoogleStatus()
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

        <!-- 3. Google Services & Ecosystem Integration -->
        <div class="connection-card">
          <div class="card-header">
            <div>
              <div class="card-title">Google Services (SSO &amp; Ecosystem)</div>
              <div class="card-meta">
                {#if googleData?.authenticated}
                  Account: <strong>{googleData?.email || 'miftahulmuhaemen@gmail.com'}</strong>
                {:else if googleData?.configured}
                  Client Secret Configured &bull; Sign-in Required
                {:else}
                  Credentials not detected in <code>~/.job_apply_automator</code>
                {/if}
              </div>
            </div>
            <span class="status-badge {googleData?.authenticated ? 'status-connected' : 'status-disconnected'}">
              {googleData?.authenticated ? 'Connected' : 'Not Connected'}
            </span>
          </div>

          <div class="metrics-grid">
            <div class="metric-item">
              <span class="metric-label">Gmail API</span>
              <span class="metric-val">{googleData?.authenticated ? 'Active' : 'Standby'}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Draft / Send</span>
              <span class="metric-val">{googleData?.authenticated ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Ecosystem</span>
              <span class="metric-val">{googleData?.authenticated ? 'Ready' : 'Pending SSO'}</span>
            </div>
          </div>

          <!-- Google Auth Action Row -->
          <div class="google-action-bar">
            {#if !googleData?.authenticated}
              <button
                type="button"
                class="btn-google-sso"
                onclick={handleStartGoogleAuth}
                disabled={googleLoading}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>{googleLoading ? 'Connecting (Check Browser)...' : 'Sign in with Google'}</span>
              </button>
            {:else}
              <div class="google-connected-row">
                <span class="auth-verified-text">&#10003; Authorized via Google OAuth 2.0</span>
                <div class="auth-btn-group">
                  <button type="button" class="btn-subtle" onclick={handleStartGoogleAuth}>Re-auth</button>
                  <button type="button" class="btn-subtle btn-disconnect" onclick={handleDisconnectGoogle}>Disconnect</button>
                </div>
              </div>
            {/if}
            {#if googleAuthError}
              <div class="google-auth-error">{googleAuthError}</div>
            {/if}
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

  /* Google Auth Action Bar & Buttons */
  .google-action-bar {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid #27272a;
  }

  .btn-google-sso {
    width: 100%;
    height: 34px;
    background: #ffffff;
    color: #09090b;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }

  .btn-google-sso:hover:not(:disabled) {
    background: #e4e4e7;
  }

  .btn-google-sso:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .google-connected-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .auth-verified-text {
    font-size: 11.5px;
    color: #22c55e;
    font-weight: 500;
  }

  .auth-btn-group {
    display: flex;
    gap: 6px;
  }

  .btn-subtle {
    background: #27272a;
    color: #f4f4f5;
    border: 1px solid #3f3f46;
    border-radius: 4px;
    font-size: 11px;
    padding: 3px 8px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-subtle:hover {
    background: #3f3f46;
  }

  .btn-disconnect {
    color: #f87171;
    border-color: #7f1d1d;
  }

  .btn-disconnect:hover {
    background: #450a0a;
  }

  .google-auth-error {
    font-size: 11px;
    color: #ef4444;
    margin-top: 6px;
  }
</style>

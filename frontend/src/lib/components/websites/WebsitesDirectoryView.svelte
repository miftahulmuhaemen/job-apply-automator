<script lang="ts">
  import { onMount } from 'svelte'
  import { Plus, RefreshCw, Key, ShieldCheck, Trash2, ArrowUpDown } from 'lucide-svelte'
  import ActionPopover from '../ui/ActionPopover.svelte'
  import DesktopSessionLauncherDialog from './DesktopSessionLauncherDialog.svelte'
  import ColumnsVisibilityPopover from '../ui/ColumnsVisibilityPopover.svelte'
  import DataTableFooter from '../ui/DataTableFooter.svelte'
  import AddWebsiteDialog from './AddWebsiteDialog.svelte'
  import type { WebsiteRecord } from '../../types'

  let websites = $state<WebsiteRecord[]>([])
  let sessions = $state<Record<string, string>>({})
  let loading = $state(true)
  let checkingSessions = $state(false)
  let isAddModalOpen = $state(false)
  let authModalData = $state<{ portal: string; info: any } | null>(null)

  // Point 3: Column visibility
  let visibleColumns = $state({
    url: true,
    policy: true,
    session: true,
    authType: true,
    cooldown: true,
    notes: true
  })

  // Point 4: Sorting
  let sortColumn = $state<'name' | 'url' | 'cooldown' | null>(null)
  let sortDirection = $state<'asc' | 'desc'>('asc')

  // Point 6: Pagination
  let currentPage = $state(1)
  const pageSize = 10

  async function loadWebsites() {
    loading = true
    try {
      const res = await fetch('/api/websites')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        websites = json.data
      }
    } catch (err) {
      console.error('Failed to load websites:', err)
    } finally {
      loading = false
    }
  }

  async function checkSessions() {
    checkingSessions = true
    try {
      const res = await fetch('/api/websites/session-status')
      const json = await res.json()
      const list = json.sessions || json.data
      if (json.success && Array.isArray(list)) {
        sessions = list
        try {
          localStorage.setItem('portal_session_status', JSON.stringify(list))
        } catch {}
      }
    } catch (err) {
      console.error('Failed to check sessions:', err)
    } finally {
      checkingSessions = false
    }
  }

  onMount(() => {
    try {
      const cached = localStorage.getItem('portal_session_status')
      if (cached) sessions = JSON.parse(cached)
    } catch {}
    loadWebsites()
  })

  function getPortalKey(w: WebsiteRecord): string {
    const n = w.name.toLowerCase()
    return ['kalibrr', 'glints', 'jobstreet', 'linkedin'].find(p => n.includes(p)) || ''
  }

  let sortedWebsites = $derived.by(() => {
    if (!sortColumn) return websites
    return [...websites].sort((a, b) => {
      if (sortColumn === 'name') {
        const cmp = a.name.localeCompare(b.name)
        return sortDirection === 'asc' ? cmp : -cmp
      } else if (sortColumn === 'url') {
        const cmp = a.url.localeCompare(b.url)
        return sortDirection === 'asc' ? cmp : -cmp
      } else if (sortColumn === 'cooldown') {
        const valA = a.cooldown_days ?? 0
        const valB = b.cooldown_days ?? 0
        return sortDirection === 'asc' ? valA - valB : valB - valA
      }
      return 0
    })
  })

  const totalPages = $derived(Math.max(1, Math.ceil(sortedWebsites.length / pageSize)))
  const pagedWebsites = $derived(sortedWebsites.slice((currentPage - 1) * pageSize, currentPage * pageSize))

  function toggleSort(col: 'name' | 'url' | 'cooldown') {
    if (sortColumn === col) {
      if (sortDirection === 'asc') sortDirection = 'desc'
      else { sortColumn = null; sortDirection = 'asc' }
    } else {
      sortColumn = col; sortDirection = 'asc'
    }
  }

  function handleColumnToggle(colId: string) {
    if (colId in visibleColumns) {
      visibleColumns[colId as keyof typeof visibleColumns] = !visibleColumns[colId as keyof typeof visibleColumns]
    }
  }

  async function toggleAllowed(id: string) {
    try {
      const res = await fetch(`/api/websites/${id}/toggle`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        websites = websites.map(w => w.id === id ? { ...w, allowed: w.allowed === 1 ? 0 : 1 } : w)
      }
    } catch (err) {
      console.error('Failed to toggle website policy:', err)
    }
  }

  async function updateCooldown(id: string, days: number) {
    try {
      await fetch(`/api/websites/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cooldown_days: days })
      })
      websites = websites.map(w => w.id === id ? { ...w, cooldown_days: days } : w)
    } catch {}
  }

  async function launchAuth(id: string) {
    try {
      const res = await fetch(`/api/websites/${id}/authenticate`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        authModalData = { portal: json.portalKey || 'portal', info: json.result || {} }
      } else {
        alert(json.error || 'Failed to launch authentication browser')
      }
    } catch (err: any) {
      alert('Launch failed: ' + err.message)
    }
  }

  async function deleteWebsite(id: string) {
    if (!confirm('Are you sure you want to delete this website entry?')) return
    try {
      const res = await fetch(`/api/websites/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        websites = websites.filter(w => w.id !== id)
        selectedIds = selectedIds.filter(i => i !== id)
      }
    } catch (err) {
      console.error('Failed to delete website:', err)
    }
  }

  async function handleSaveNewWebsite(data: { name: string; url: string; auth_type: string; cooldown_days: number; notes: string }) {
    try {
      const res = await fetch('/api/websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const json = await res.json()
      if (json.success) {
        await loadWebsites()
        isAddModalOpen = false
      }
    } catch (err: any) {
      alert('Failed to register website: ' + err.message)
    }
  }
</script>

<div class="view-container">
  <div class="toolbar-left-aligned">
    <button class="btn-primary" onclick={() => isAddModalOpen = true}>
      <Plus size={14} /> Add Website
    </button>
    <button class="btn-secondary" onclick={checkSessions} disabled={checkingSessions}>
      <RefreshCw size={13} class={checkingSessions ? 'spin' : ''} /> Check All Sessions
    </button>

    <!-- Columns visibility toggle inline left-aligned -->
    <ColumnsVisibilityPopover
      columns={[
        { id: 'url', label: 'Target URL', visible: visibleColumns.url },
        { id: 'policy', label: 'Access Policy', visible: visibleColumns.policy },
        { id: 'session', label: 'Session Status', visible: visibleColumns.session },
        { id: 'authType', label: 'Auth Type', visible: visibleColumns.authType },
        { id: 'cooldown', label: 'Cooldown', visible: visibleColumns.cooldown },
        { id: 'notes', label: 'Notes', visible: visibleColumns.notes }
      ]}
      ontoggle={handleColumnToggle}
    />
  </div>

  <div class="table-container">
    {#if loading}
      <div class="loading-state">Loading websites directory...</div>
    {:else if sortedWebsites.length === 0}
      <div class="empty-state">No websites configured. Click "+ Add Website" to register one.</div>
    {:else}
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 190px;">
              <button type="button" class="btn-sort-header" onclick={() => toggleSort('name')}>
                <span>Portal Name</span>
                <ArrowUpDown size={12} class={sortColumn === 'name' ? 'sort-icon-active' : 'sort-icon'} />
              </button>
            </th>
            {#if visibleColumns.url}
              <th>
                <button type="button" class="btn-sort-header" onclick={() => toggleSort('url')}>
                  <span>Target URL</span>
                  <ArrowUpDown size={12} class={sortColumn === 'url' ? 'sort-icon-active' : 'sort-icon'} />
                </button>
              </th>
            {/if}
            {#if visibleColumns.policy}
              <th style="width: 120px;">Access Policy</th>
            {/if}
            {#if visibleColumns.session}
              <th style="width: 150px;">Session Status</th>
            {/if}
            {#if visibleColumns.authType}
              <th style="width: 130px;">Auth Type</th>
            {/if}
            {#if visibleColumns.cooldown}
              <th style="width: 130px;">
                <button type="button" class="btn-sort-header" onclick={() => toggleSort('cooldown')}>
                  <span>Cooldown (Days)</span>
                  <ArrowUpDown size={12} class={sortColumn === 'cooldown' ? 'sort-icon-active' : 'sort-icon'} />
                </button>
              </th>
            {/if}
            {#if visibleColumns.notes}
              <th>Notes</th>
            {/if}
            <th style="width: 60px; text-align: center;">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each pagedWebsites as w (w.id)}
            {@const portalKey = getPortalKey(w)}
            {@const session = portalKey ? (sessions[portalKey] || 'REQUIRES_LOGIN') : 'N/A'}
            <tr>
              <td style="font-weight: 600; color: #ffffff;">{w.name}</td>
              {#if visibleColumns.url}
                <td>
                  <a href={w.url} target="_blank" rel="noreferrer" style="color: #ffffff; text-decoration: underline;">
                    {w.url} &nearr;
                  </a>
                </td>
              {/if}
              {#if visibleColumns.policy}
                <td style="font-size: 12px; color: {w.allowed === 1 ? '#ffffff' : '#71717a'}; font-weight: 500;">
                  {w.allowed === 1 ? 'ALLOWED' : 'BLOCKED'}
                </td>
              {/if}
              {#if visibleColumns.session}
                <td style="font-size: 12px; color: {session === 'AUTHENTICATED' ? '#ffffff' : '#71717a'};">
                  {#if session === 'AUTHENTICATED'}
                    AUTHENTICATED
                  {:else if session === 'BROWSER_OPEN_LOCKED'}
                    WINDOW OPEN
                  {:else if portalKey}
                    REQUIRES_LOGIN
                  {:else}
                    -
                  {/if}
                </td>
              {/if}
              {#if visibleColumns.authType}
                <td>{w.auth_type || 'Google PIN'}</td>
              {/if}
              {#if visibleColumns.cooldown}
                <td>
                  <input
                    type="number"
                    min="0"
                    class="input-base"
                    style="width: 70px; padding: 4px 8px; font-size: 12px;"
                    value={w.cooldown_days ?? 0}
                    onchange={(e) => updateCooldown(w.id, parseInt((e.target as HTMLInputElement).value) || 0)}
                  />
                </td>
              {/if}
              {#if visibleColumns.notes}
                <td style="color: #a1a1aa; font-size: 12px;">{w.notes || '-'}</td>
              {/if}
              <td style="text-align: center; vertical-align: middle;">
                <ActionPopover title="Actions for {w.name}">
                  {#snippet children()}
                    <div class="popover-header">{w.name}</div>
                    {#if portalKey}
                      <button type="button" onclick={() => launchAuth(w.id)}>
                        <Key size={13} /> Launch Auth Browser
                      </button>
                    {/if}
                    <button type="button" onclick={() => toggleAllowed(w.id)}>
                      <ShieldCheck size={13} /> {w.allowed === 1 ? 'Block Portal' : 'Allow Portal'}
                    </button>
                    <button type="button" class="danger" onclick={() => deleteWebsite(w.id)}>
                      <Trash2 size={13} /> Delete Website
                    </button>
                  {/snippet}
                </ActionPopover>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <!-- Point 6: Bottom selection & pagination footer -->
  <DataTableFooter
    totalCount={sortedWebsites.length}
    {currentPage}
    {totalPages}
    showSelection={false}
    onprev={() => currentPage = Math.max(1, currentPage - 1)}
    onnext={() => currentPage = Math.min(totalPages, currentPage + 1)}
  />
</div>

<DesktopSessionLauncherDialog
  {authModalData}
  onclose={() => authModalData = null}
  oncheck={async () => { await checkSessions(); authModalData = null; }}
/>

<AddWebsiteDialog
  open={isAddModalOpen}
  onclose={() => isAddModalOpen = false}
  onsave={handleSaveNewWebsite}
/>

<style>
  .view-container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>

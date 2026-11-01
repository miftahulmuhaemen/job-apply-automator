<script lang="ts">
  import { onMount } from 'svelte'
  import { Search, Upload, Bot, ArrowUpDown } from 'lucide-svelte'
  import ActionPopover from '../ui/ActionPopover.svelte'
  import StageFilterPopover from '../ui/StageFilterPopover.svelte'
  import ColumnsVisibilityPopover from '../ui/ColumnsVisibilityPopover.svelte'
  import DataTableFooter from '../ui/DataTableFooter.svelte'
  import type { CandidateAttribute } from '../../types'

  let attributes = $state<CandidateAttribute[]>([])
  let loading = $state(true)
  let activeTab = $state<'unfilled' | 'filled' | 'all'>('unfilled')
  let searchQuery = $state('')

  // Point 3: Column visibility
  let visibleColumns = $state({
    category: true,
    description: true,
    status: true
  })

  // Point 4: Sorting
  let sortColumn = $state<'category' | 'key' | 'status' | null>(null)
  let sortDirection = $state<'asc' | 'desc'>('asc')

  // Point 6: Pagination
  let currentPage = $state(1)
  const pageSize = 10

  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

  async function loadAttributes(query = '') {
    loading = true
    try {
      const q = query.trim()
      const url = q ? `/api/candidate/attributes?search=${encodeURIComponent(q)}` : '/api/candidate/attributes'
      const res = await fetch(url)
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        attributes = json.data
        currentPage = 1
      }
    } catch (err) {
      console.error('Failed to load attributes:', err)
    } finally {
      loading = false
    }
  }

  function handleSearchInput(e: Event) {
    const val = (e.target as HTMLInputElement).value
    searchQuery = val
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => {
      loadAttributes(val)
    }, 300)
  }

  onMount(() => {
    loadAttributes()
  })

  let filteredAttributes = $derived(
    attributes.filter(a => {
      const isDelegated = a.is_agent_delegated === 1 || a.status === 'DELEGATED_TO_AGY'
      const isUnresolved = (!a.value || a.value.trim() === '' || a.status === 'UNRESOLVED') && !isDelegated

      if (activeTab === 'unfilled' && !isUnresolved) return false
      if (activeTab === 'filled' && isUnresolved) return false

      return true
    })
  )

  let sortedAttributes = $derived.by(() => {
    if (!sortColumn) return filteredAttributes
    return [...filteredAttributes].sort((a, b) => {
      const valA = (sortColumn === 'category' ? a.category : sortColumn === 'key' ? a.key : a.status) || ''
      const valB = (sortColumn === 'category' ? b.category : sortColumn === 'key' ? b.key : b.status) || ''
      const cmp = valA.localeCompare(valB)
      return sortDirection === 'asc' ? cmp : -cmp
    })
  })

  const totalPages = $derived(Math.max(1, Math.ceil(sortedAttributes.length / pageSize)))
  const pagedAttributes = $derived(sortedAttributes.slice((currentPage - 1) * pageSize, currentPage * pageSize))

  function toggleSort(col: 'category' | 'key' | 'status') {
    if (sortColumn === col) {
      if (sortDirection === 'asc') sortDirection = 'desc'
      else { sortColumn = null; sortDirection = 'asc' }
    } else {
      sortColumn = col
      sortDirection = 'asc'
    }
  }

  function handleColumnToggle(colId: string) {
    if (colId in visibleColumns) {
      visibleColumns[colId as keyof typeof visibleColumns] = !visibleColumns[colId as keyof typeof visibleColumns]
    }
  }

  async function saveValue(key: string, value: string) {
    try {
      await fetch('/api/candidate/attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      })
      attributes = attributes.map(a => a.key === key ? { ...a, value, status: 'RESOLVED' } : a)
    } catch (err) {
      console.error('Failed to save attribute:', err)
    }
  }

  async function toggleDelegation(key: string) {
    try {
      const res = await fetch(`/api/candidate/attributes/${key}/delegate`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        attributes = attributes.map(a => {
          if (a.key === key) {
            const nextDelegated = a.is_agent_delegated === 1 ? 0 : 1
            return {
              ...a,
              is_agent_delegated: nextDelegated,
              status: nextDelegated ? 'DELEGATED_TO_AGY' : (a.value ? 'RESOLVED' : 'UNRESOLVED')
            }
          }
          return a
        })
      }
    } catch (err: any) {
      alert('Error toggling delegation: ' + err.message)
    }
  }

  async function uploadPhoto(e: Event) {
    const input = e.target as HTMLInputElement
    if (!input.files || input.files.length === 0) return
    const file = input.files[0]
    const formData = new FormData()
    formData.append('photo', file)

    try {
      const res = await fetch('/api/candidate/photo', {
        method: 'POST',
        body: formData
      })
      const json = await res.json()
      if (json.success) {
        await loadAttributes()
        alert('Photo uploaded to Cloudflare R2 successfully!')
      } else {
        alert(json.error || 'Failed to upload photo')
      }
    } catch (err: any) {
      alert('Upload failed: ' + err.message)
    }
  }
</script>

<div class="view-container">
  <div class="toolbar-left-aligned">
    <StageFilterPopover
      value={activeTab}
      items={[
        {
          id: 'unfilled',
          label: 'Action Required',
          count: attributes.filter(a => (!a.value || a.value.trim() === '') && a.is_agent_delegated !== 1).length
        },
        {
          id: 'filled',
          label: 'Configured & Delegated',
          count: attributes.filter(a => (a.value && a.value.trim() !== '') || a.is_agent_delegated === 1).length
        },
        {
          id: 'all',
          label: 'All Attributes',
          count: attributes.length
        }
      ]}
      onchange={(val) => { activeTab = val as any; currentPage = 1 }}
      ariaLabel="Filter attributes by status"
    />

    <div class="search-input-wrapper">
      <Search size={14} class="search-icon" />
      <input
        type="text"
        placeholder="Search by label or description..."
        value={searchQuery}
        oninput={handleSearchInput}
        class="input-base search-input"
      />
    </div>

    <!-- Columns visibility toggle inline left-aligned -->
    <ColumnsVisibilityPopover
      columns={[
        { id: 'category', label: 'Category', visible: visibleColumns.category },
        { id: 'description', label: 'Description', visible: visibleColumns.description },
        { id: 'status', label: 'Status', visible: visibleColumns.status }
      ]}
      ontoggle={handleColumnToggle}
    />
  </div>

  <div class="table-container">
    {#if loading}
      <div class="loading-state">Loading candidate attributes...</div>
    {:else if sortedAttributes.length === 0}
      <div class="empty-state">No matching profile attributes found.</div>
    {:else}
      <table class="data-table">
        <thead>
          <tr>
            {#if visibleColumns.category}
              <th style="width: 140px;">
                <button type="button" class="btn-sort-header" onclick={() => toggleSort('category')}>
                  <span>Category</span>
                  <ArrowUpDown size={12} class={sortColumn === 'category' ? 'sort-icon-active' : 'sort-icon'} />
                </button>
              </th>
            {/if}
            <th style="width: 160px;">
              <button type="button" class="btn-sort-header" onclick={() => toggleSort('key')}>
                <span>Key</span>
                <ArrowUpDown size={12} class={sortColumn === 'key' ? 'sort-icon-active' : 'sort-icon'} />
              </button>
            </th>
            {#if visibleColumns.description}
              <th style="width: 220px;">Label &amp; Description</th>
            {/if}
            <th>Candidate Value</th>
            {#if visibleColumns.status}
              <th style="width: 140px; text-align: center;">
                <button type="button" class="btn-sort-header" onclick={() => toggleSort('status')}>
                  <span>Status</span>
                  <ArrowUpDown size={12} class={sortColumn === 'status' ? 'sort-icon-active' : 'sort-icon'} />
                </button>
              </th>
            {/if}
            <th style="width: 60px; text-align: center;">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each pagedAttributes as a (a.key)}
            {@const isDelegated = a.is_agent_delegated === 1 || a.status === 'DELEGATED_TO_AGY'}
            {@const isUnresolved = (!a.value || a.value.trim() === '') && !isDelegated}
            <tr>
              {#if visibleColumns.category}
                <td>
                  <span class="category-badge">{a.category}</span>
                </td>
              {/if}
              <td style="font-size: 11.5px; color: #ffffff;">
                {a.key}
              </td>
              {#if visibleColumns.description}
                <td>
                  <div style="font-weight: 600; color: #ffffff;">{a.label}</div>
                  <div style="font-size: 11px; color: #71717a; margin-top: 2px;">{a.description || ''}</div>
                </td>
              {/if}
              <td>
                {#if a.key === 'photo_document'}
                  <div style="display: flex; align-items: center; gap: 8px;">
                    {#if a.value}
                      <span style="font-size: 12px; color: #ffffff;">{a.value}</span>
                      <a href="/api/candidate/photo" target="_blank" rel="noreferrer" style="font-size: 11.5px; color: #ffffff; text-decoration: underline;">
                        View &nearr;
                      </a>
                    {:else}
                      <span style="font-size: 11.5px; color: #71717a; font-style: italic;">No photo uploaded</span>
                    {/if}
                    <label class="btn-secondary" style="padding: 3px 8px; font-size: 11px; cursor: pointer;">
                      <Upload size={12} /> {a.value ? 'Replace' : 'Upload'}
                      <input type="file" accept="image/jpeg,image/png" style="display: none;" onchange={uploadPhoto} />
                    </label>
                  </div>
                {:else}
                  <input
                    type="text"
                    class="input-base"
                    style="width: 100%; font-size: 12px; padding: 5px 8px;"
                    value={a.value || ''}
                    placeholder={isDelegated ? 'Delegated to AGY' : 'Specify value...'}
                    onchange={(e) => saveValue(a.key, (e.target as HTMLInputElement).value)}
                  />
                {/if}
              </td>
              {#if visibleColumns.status}
                <td style="text-align: center;">
                  {#if isDelegated}
                    <span class="badge" style="border-color: #52525b; color: #ffffff;">AGY SYNTHESIZED</span>
                  {:else if isUnresolved}
                    <span class="badge" style="border-color: #71717a; color: #ffffff;">ACTION REQUIRED</span>
                  {:else}
                    <span class="badge badge-muted">RESOLVED</span>
                  {/if}
                </td>
              {/if}
              <td style="text-align: center;">
                <ActionPopover title="Actions for {a.label}">
                  {#snippet children()}
                    <div class="popover-header">{a.key}</div>
                    <button type="button" onclick={() => toggleDelegation(a.key)}>
                      <Bot size={13} /> {isDelegated ? 'Revoke AGY Delegation' : 'Delegate to AGY'}
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
    totalCount={sortedAttributes.length}
    {currentPage}
    {totalPages}
    showSelection={false}
    onprev={() => currentPage = Math.max(1, currentPage - 1)}
    onnext={() => currentPage = Math.min(totalPages, currentPage + 1)}
  />
</div>

<style>
  .view-container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .search-input {
    width: 240px;
  }

  .category-badge {
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    background: #27272a;
    border: 1px solid #3f3f46;
    color: #a1a1aa;
  }

</style>

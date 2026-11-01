<script lang="ts">
  import { onMount } from 'svelte'
  import { Search, CheckCircle, Trash2, ArrowUpDown } from 'lucide-svelte'
  import ActionPopover from '../ui/ActionPopover.svelte'
  import Select from '../ui/Select.svelte'
  import ColumnsVisibilityPopover from '../ui/ColumnsVisibilityPopover.svelte'
  import DataTableFooter from '../ui/DataTableFooter.svelte'
  import type { SystemErrorRecord } from '../../types'

  let errors = $state<SystemErrorRecord[]>([])
  let loading = $state(true)
  let statusFilter = $state<'UNRESOLVED' | 'RESOLVED' | 'ALL'>('UNRESOLVED')
  let searchQuery = $state('')

  // Point 3: Column visibility
  let visibleColumns = $state({
    severity: true,
    component: true,
    status: true
  })

  // Point 4: Sorting
  let sortColumn = $state<'timestamp' | 'severity' | 'component' | null>(null)
  let sortDirection = $state<'asc' | 'desc'>('desc')

  // Point 6: Pagination
  let currentPage = $state(1)
  const pageSize = 10

  async function loadErrors() {
    loading = true
    try {
      const res = await fetch('/api/errors')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        errors = json.data
      }
    } catch (err) {
      console.error('Failed to load system errors:', err)
    } finally {
      loading = false
    }
  }

  onMount(loadErrors)

  let filteredErrors = $derived(
    errors.filter(err => {
      if (statusFilter === 'UNRESOLVED' && err.resolved !== 0) return false
      if (statusFilter === 'RESOLVED' && err.resolved !== 1) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const text = `${err.message} ${err.component} ${err.category} ${err.details || ''}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  )

  let sortedErrors = $derived.by(() => {
    if (!sortColumn) return filteredErrors
    return [...filteredErrors].sort((a, b) => {
      const valA = (sortColumn === 'timestamp' ? a.timestamp : sortColumn === 'severity' ? a.severity : a.component) || ''
      const valB = (sortColumn === 'timestamp' ? b.timestamp : sortColumn === 'severity' ? b.severity : b.component) || ''
      const cmp = valA.localeCompare(valB)
      return sortDirection === 'asc' ? cmp : -cmp
    })
  })

  const totalPages = $derived(Math.max(1, Math.ceil(sortedErrors.length / pageSize)))
  const pagedErrors = $derived(sortedErrors.slice((currentPage - 1) * pageSize, currentPage * pageSize))

  function toggleSort(col: 'timestamp' | 'severity' | 'component') {
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

  async function resolveError(id: number) {
    try {
      const res = await fetch(`/api/errors/${id}/resolve`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        errors = errors.map(e => e.id === id ? { ...e, resolved: 1 } : e)
      }
    } catch (err) {
      console.error('Failed to resolve error:', err)
    }
  }

  async function clearResolved() {
    if (!confirm('Clear all resolved errors from database?')) return
    try {
      const res = await fetch('/api/errors/clear-resolved', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        errors = errors.filter(e => e.resolved === 0)
        selectedIds = selectedIds.filter(id => errors.some(e => e.id === id))
      }
    } catch (err) {
      console.error('Failed to clear resolved errors:', err)
    }
  }
</script>

<div class="view-container">
  <div class="toolbar-left-aligned">
    <div class="search-input-wrapper">
      <Search size={14} class="search-icon" />
      <input
        type="text"
        placeholder="Search errors, components, traces..."
        bind:value={searchQuery}
        class="input-base search-input"
      />
    </div>

    <Select
      value={statusFilter}
      options={[
        { value: 'UNRESOLVED', label: 'Active Unresolved' },
        { value: 'RESOLVED', label: 'Resolved' },
        { value: 'ALL', label: 'All Errors' }
      ]}
      onchange={(val) => { statusFilter = val as any; currentPage = 1 }}
      width="160px"
      ariaLabel="Filter errors by status"
    />

    {#if errors.some(e => e.resolved === 1)}
      <button class="btn-secondary" onclick={clearResolved}>
        <Trash2 size={13} /> Clear Resolved
      </button>
    {/if}

    <!-- Columns visibility toggle inline left-aligned -->
    <ColumnsVisibilityPopover
      columns={[
        { id: 'severity', label: 'Severity', visible: visibleColumns.severity },
        { id: 'component', label: 'Component', visible: visibleColumns.component },
        { id: 'status', label: 'Status', visible: visibleColumns.status }
      ]}
      ontoggle={handleColumnToggle}
    />
  </div>

  <div class="table-container">
    {#if loading}
      <div class="loading-state">Loading system error ledger...</div>
    {:else if sortedErrors.length === 0}
      <div class="empty-state">No matching system errors found. All systems nominal.</div>
    {:else}
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 170px;">
              <button type="button" class="btn-sort-header" onclick={() => toggleSort('timestamp')}>
                <span>Timestamp</span>
                <ArrowUpDown size={12} class={sortColumn === 'timestamp' ? 'sort-icon-active' : 'sort-icon'} />
              </button>
            </th>
            {#if visibleColumns.severity}
              <th style="width: 120px;">
                <button type="button" class="btn-sort-header" onclick={() => toggleSort('severity')}>
                  <span>Severity</span>
                  <ArrowUpDown size={12} class={sortColumn === 'severity' ? 'sort-icon-active' : 'sort-icon'} />
                </button>
              </th>
            {/if}
            {#if visibleColumns.component}
              <th style="width: 140px;">
                <button type="button" class="btn-sort-header" onclick={() => toggleSort('component')}>
                  <span>Component</span>
                  <ArrowUpDown size={12} class={sortColumn === 'component' ? 'sort-icon-active' : 'sort-icon'} />
                </button>
              </th>
            {/if}
            <th>Error Message &amp; Context</th>
            {#if visibleColumns.status}
              <th style="width: 110px; text-align: center;">Status</th>
            {/if}
            <th style="width: 60px; text-align: center;">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each pagedErrors as err (err.id)}
            {@const isResolved = err.resolved === 1}
            <tr style={isResolved ? 'opacity: 0.5;' : ''}>
              <td style="font-size: 11.5px; color: #a1a1aa;">{err.timestamp}</td>
              {#if visibleColumns.severity}
                <td>
                  <span class="badge" style="font-size: 10px;">{err.severity}</span>
                </td>
              {/if}
              {#if visibleColumns.component}
                <td style="font-size: 12px; color: #ffffff;">{err.component}</td>
              {/if}
              <td>
                <div style="font-weight: 600; color: #ffffff;">{err.message}</div>
                {#if err.details}
                  <div style="font-size: 11px; color: #a1a1aa; margin-top: 4px; max-height: 80px; overflow-y: auto;">
                    {err.details}
                  </div>
                {/if}
              </td>
              {#if visibleColumns.status}
                <td style="text-align: center;">
                  <span class="badge {isResolved ? 'badge-muted' : 'badge-active'}">
                    {isResolved ? 'RESOLVED' : 'ACTIVE'}
                  </span>
                </td>
              {/if}
              <td style="text-align: center; vertical-align: middle;">
                <ActionPopover title="Actions for error #{err.id}">
                  {#snippet children()}
                    <div class="popover-header">Error #{err.id}</div>
                    {#if !isResolved}
                      <button type="button" onclick={() => resolveError(err.id)}>
                        <CheckCircle size={13} /> Mark Resolved
                      </button>
                    {/if}
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
    totalCount={sortedErrors.length}
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
    width: 320px;
  }

  .popover-header {
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 600;
    color: #71717a;
    text-transform: uppercase;
    border-bottom: 1px solid #27272a;
  }
</style>

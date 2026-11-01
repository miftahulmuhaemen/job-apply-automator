<script lang="ts">
  import { onMount } from 'svelte'
  import { Search, Plus, Trash2, ArrowUpDown } from 'lucide-svelte'
  import ActionPopover from '../ui/ActionPopover.svelte'
  import Switch from '../ui/Switch.svelte'
  import ColumnsVisibilityPopover from '../ui/ColumnsVisibilityPopover.svelte'
  import DataTableFooter from '../ui/DataTableFooter.svelte'
  import AddRuleDialog from './AddRuleDialog.svelte'
  import type { DecisionCriteriaRecord } from '../../types'

  let rules = $state<DecisionCriteriaRecord[]>([])
  let loading = $state(true)
  let searchQuery = $state('')
  let isAddModalOpen = $state(false)

  // Point 3: Column visibility
  let visibleColumns = $state({
    category: true,
    description: true,
    status: true
  })

  // Point 4: Sorting
  let sortColumn = $state<'category' | 'key' | 'value' | null>(null)
  let sortDirection = $state<'asc' | 'desc'>('asc')

  // Point 6: Pagination
  let currentPage = $state(1)
  const pageSize = 10

  async function loadCriteria() {
    loading = true
    try {
      const res = await fetch('/api/personalization')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        rules = json.data
      }
    } catch (err) {
      console.error('Failed to load criteria:', err)
    } finally {
      loading = false
    }
  }

  onMount(loadCriteria)

  let filteredRules = $derived(
    rules.filter(r => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const text = `${r.category} ${r.key} ${r.value} ${r.description || ''}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  )

  let sortedRules = $derived.by(() => {
    if (!sortColumn) return filteredRules
    return [...filteredRules].sort((a, b) => {
      const valA = (sortColumn === 'category' ? a.category : sortColumn === 'key' ? a.key : a.value) || ''
      const valB = (sortColumn === 'category' ? b.category : sortColumn === 'key' ? b.key : b.value) || ''
      const cmp = valA.localeCompare(valB)
      return sortDirection === 'asc' ? cmp : -cmp
    })
  })

  const totalPages = $derived(Math.max(1, Math.ceil(sortedRules.length / pageSize)))
  const pagedRules = $derived(sortedRules.slice((currentPage - 1) * pageSize, currentPage * pageSize))

  function toggleSort(col: 'category' | 'key' | 'value') {
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

  async function updateField(id: number, field: string, value: string) {
    try {
      const payload: Record<string, string> = {}
      payload[field] = value.trim()
      await fetch(`/api/personalization/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      rules = rules.map(r => r.id === id ? { ...r, [field]: value.trim() } : r)
    } catch (err) {
      console.error('Failed to update field:', err)
    }
  }

  async function toggleRule(id: number) {
    try {
      const res = await fetch(`/api/personalization/${id}/toggle`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        rules = rules.map(r => r.id === id ? { ...r, is_enabled: r.is_enabled === 1 ? 0 : 1 } : r)
      }
    } catch (err) {
      console.error('Failed to toggle rule:', err)
    }
  }

  async function deleteRule(id: number) {
    if (!confirm('Are you sure you want to soft-delete this parameter?')) return
    try {
      const res = await fetch(`/api/personalization/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        rules = rules.filter(r => r.id !== id)
        selectedIds = selectedIds.filter(i => i !== id)
      }
    } catch (err) {
      console.error('Failed to delete rule:', err)
    }
  }

  async function handleSaveNewRule(newRule: { category: string; key: string; value: string; description: string }) {
    try {
      const res = await fetch('/api/personalization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule)
      })
      const json = await res.json()
      if (json.success && json.data) {
        rules = [...rules, json.data]
        isAddModalOpen = false
      }
    } catch (err: any) {
      alert('Error adding parameter: ' + err.message)
    }
  }
</script>

<div class="view-container">
  <div class="toolbar-left-aligned">
    <div class="search-input-wrapper">
      <Search size={14} class="search-icon" />
      <input
        type="text"
        placeholder="Search category, parameter, logic, context..."
        bind:value={searchQuery}
        class="input-base search-input"
      />
    </div>

    <button class="btn-primary" onclick={() => isAddModalOpen = true}>
      <Plus size={14} /> Add Parameter
    </button>

    <!-- Columns visibility toggle inline left-aligned -->
    <ColumnsVisibilityPopover
      columns={[
        { id: 'category', label: 'Category', visible: visibleColumns.category },
        { id: 'description', label: 'Guidance & Context', visible: visibleColumns.description },
        { id: 'status', label: 'Status', visible: visibleColumns.status }
      ]}
      ontoggle={handleColumnToggle}
    />
  </div>

  <div class="table-container">
    {#if loading}
      <div class="loading-state">Loading personalization criteria ledger...</div>
    {:else if sortedRules.length === 0}
      <div class="empty-state">No parameters matching current filter.</div>
    {:else}
      <table class="data-table">
        <thead>
          <tr>
            {#if visibleColumns.category}
              <th style="width: 170px;">
                <button type="button" class="btn-sort-header" onclick={() => toggleSort('category')}>
                  <span>Category</span>
                  <ArrowUpDown size={12} class={sortColumn === 'category' ? 'sort-icon-active' : 'sort-icon'} />
                </button>
              </th>
            {/if}
            <th style="width: 190px;">
              <button type="button" class="btn-sort-header" onclick={() => toggleSort('key')}>
                <span>Parameter / Key</span>
                <ArrowUpDown size={12} class={sortColumn === 'key' ? 'sort-icon-active' : 'sort-icon'} />
              </button>
            </th>
            <th style="min-width: 260px;">
              <button type="button" class="btn-sort-header" onclick={() => toggleSort('value')}>
                <span>Criteria Value / Logic</span>
                <ArrowUpDown size={12} class={sortColumn === 'value' ? 'sort-icon-active' : 'sort-icon'} />
              </button>
            </th>
            {#if visibleColumns.description}
              <th>Operational Guidance &amp; Context</th>
            {/if}
            {#if visibleColumns.status}
              <th style="width: 80px; text-align: center;">Status</th>
            {/if}
            <th style="width: 60px; text-align: center;">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each pagedRules as r (r.id)}
            {@const isEnabled = r.is_enabled === 1 || r.is_enabled === undefined}
            <tr style={!isEnabled ? 'opacity: 0.5;' : ''}>
              {#if visibleColumns.category}
                <td>
                  <input
                    type="text"
                    class="cell-input"
                    value={r.category}
                    placeholder="Category"
                    onchange={(e) => updateField(r.id, 'category', (e.target as HTMLInputElement).value)}
                  />
                </td>
              {/if}
              <td>
                <input
                  type="text"
                  class="cell-input"
                  style="color: #ffffff;"
                  value={r.key}
                  placeholder="parameter_key"
                  onchange={(e) => updateField(r.id, 'key', (e.target as HTMLInputElement).value)}
                />
              </td>
              <td>
                <textarea
                  class="cell-textarea"
                  value={r.value}
                  placeholder="Logic pattern or values"
                  onchange={(e) => updateField(r.id, 'value', (e.target as HTMLTextAreaElement).value)}
                ></textarea>
              </td>
              {#if visibleColumns.description}
                <td>
                  <textarea
                    class="cell-textarea cell-textarea-guidance"
                    value={r.description || ''}
                    placeholder="Operational guidance..."
                    onchange={(e) => updateField(r.id, 'description', (e.target as HTMLTextAreaElement).value)}
                  ></textarea>
                </td>
              {/if}
              {#if visibleColumns.status}
                <td style="text-align: center; vertical-align: middle;">
                  <Switch
                    checked={isEnabled}
                    onchange={() => toggleRule(r.id)}
                    ariaLabel="Toggle active status for {r.key}"
                  />
                </td>
              {/if}
              <td style="text-align: center; vertical-align: middle;">
                <ActionPopover title="Actions for {r.key}">
                  {#snippet children()}
                    <div class="popover-header">{r.key}</div>
                    <button type="button" class="danger" onclick={() => deleteRule(r.id)}>
                      <Trash2 size={13} /> Delete Parameter
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
    totalCount={sortedRules.length}
    {currentPage}
    {totalPages}
    showSelection={false}
    onprev={() => currentPage = Math.max(1, currentPage - 1)}
    onnext={() => currentPage = Math.min(totalPages, currentPage + 1)}
  />
</div>

<AddRuleDialog
  open={isAddModalOpen}
  onclose={() => isAddModalOpen = false}
  onsave={handleSaveNewRule}
/>

<style>
  .view-container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .search-input {
    width: 280px;
  }

  .data-table td {
    vertical-align: top;
  }

  .cell-input {
    width: 100%;
    background: #18181b;
    border: 1px solid #27272a;
    color: #f4f4f5;
    padding: 6px 10px;
    font-size: 12.5px;
    border-radius: 6px;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
  }
  .cell-input:focus {
    background: #18181b;
    border-color: #52525b;
    outline: none;
  }

  .cell-textarea {
    width: 100%;
    background: #18181b;
    border: 1px solid #27272a;
    color: #f4f4f5;
    padding: 8px 10px;
    font-size: 12.5px;
    font-family: inherit;
    line-height: 1.45;
    border-radius: 6px;
    resize: vertical;
    min-height: 80px;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
  }
  .cell-textarea:focus {
    background: #18181b;
    border-color: #52525b;
    outline: none;
  }

  .cell-textarea-guidance {
    font-size: 12px;
    color: #a1a1aa;
  }
  .cell-textarea-guidance:focus {
    color: #f4f4f5;
  }
</style>

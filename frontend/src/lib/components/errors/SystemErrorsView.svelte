<script lang="ts">
  import { onMount } from 'svelte'
  import { ArrowUpDown } from 'lucide-svelte'
  import DataTableFooter from '../ui/DataTableFooter.svelte'
  import type { SystemErrorRecord } from '../../types'

  let errors = $state<SystemErrorRecord[]>([])
  let loading = $state(true)

  // Sorting strictly latest first by default
  let sortColumn = $state<'timestamp' | 'category' | 'component'>('timestamp')
  let sortDirection = $state<'asc' | 'desc'>('desc')

  // Pagination
  let currentPage = $state(1)
  const pageSize = 15

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

  let sortedErrors = $derived.by(() => {
    return [...errors].sort((a, b) => {
      const valA = (sortColumn === 'timestamp' ? a.timestamp : sortColumn === 'category' ? a.category : a.component) || ''
      const valB = (sortColumn === 'timestamp' ? b.timestamp : sortColumn === 'category' ? b.category : b.component) || ''
      const cmp = valA.localeCompare(valB)
      return sortDirection === 'asc' ? cmp : -cmp
    })
  })

  const totalPages = $derived(Math.max(1, Math.ceil(sortedErrors.length / pageSize)))
  const pagedErrors = $derived(sortedErrors.slice((currentPage - 1) * pageSize, currentPage * pageSize))

  function toggleSort(col: 'timestamp' | 'category' | 'component') {
    if (sortColumn === col) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'
    } else {
      sortColumn = col
      sortDirection = 'desc'
    }
  }
</script>

<div class="view-container">
  <div class="table-container">
    {#if loading}
      <div class="loading-state">Loading error logs...</div>
    {:else if sortedErrors.length === 0}
      <div class="empty-state">No error logs recorded. All systems operational.</div>
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
            <th style="width: 140px;">
              <button type="button" class="btn-sort-header" onclick={() => toggleSort('category')}>
                <span>Category</span>
                <ArrowUpDown size={12} class={sortColumn === 'category' ? 'sort-icon-active' : 'sort-icon'} />
              </button>
            </th>
            <th style="width: 160px;">
              <button type="button" class="btn-sort-header" onclick={() => toggleSort('component')}>
                <span>Component</span>
                <ArrowUpDown size={12} class={sortColumn === 'component' ? 'sort-icon-active' : 'sort-icon'} />
              </button>
            </th>
            <th>Error Message &amp; Context</th>
          </tr>
        </thead>
        <tbody>
          {#each pagedErrors as err (err.id)}
            <tr>
              <td style="font-size: 12px; color: #ffffff; font-weight: 500; white-space: nowrap; vertical-align: top; padding-top: 14px;">
                {err.timestamp}
              </td>
              <td style="font-size: 12px; color: #f4f4f5; text-transform: uppercase; font-weight: 500; vertical-align: top; padding-top: 14px;">
                {err.category}
              </td>
              <td style="font-size: 12px; color: #ffffff; font-weight: 600; vertical-align: top; padding-top: 14px;">
                {err.component}
              </td>
              <td style="vertical-align: top;">
                <div style="font-size: 13px; font-weight: 600; color: #ffffff; line-height: 1.4;">
                  {err.message}
                </div>
                {#if err.details}
                  <div class="error-stack-trace">
                    {err.details}
                  </div>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

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

  .error-stack-trace {
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    color: #ffffff;
    margin-top: 6px;
    padding: 8px 12px;
    background-color: #121214;
    border: 1px solid #3f3f46;
    border-radius: 4px;
    max-height: 120px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
    line-height: 1.4;
  }
</style>

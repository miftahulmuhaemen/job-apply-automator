<script lang="ts">
  import { onMount } from 'svelte'
  import { ArrowUpDown } from 'lucide-svelte'
  import Checkbox from '../ui/Checkbox.svelte'
  import JobDossierModal from './JobDossierModal.svelte'
  import JobTableRow from './JobTableRow.svelte'
  import JobsLedgerToolbar from './JobsLedgerToolbar.svelte'
  import DataTableFooter from '../ui/DataTableFooter.svelte'
  import { isJobInStage, sortJobsList } from './jobsTableUtils'
  import type { JobRecord } from '../types'

  let { onswitchview }: { onswitchview?: (view: string) => void } = $props()

  let jobs = $state<JobRecord[]>([])
  let loading = $state(true)
  let currentStage = $state<'review' | 'pending' | 'submitted' | 'dropped' | 'all'>('review')
  let searchQuery = $state('')
  let selectedIds = $state<number[]>([])

  // Modal target
  let selectedJob = $state<JobRecord | null>(null)
  let dossierTab = $state(0)

  // Status error tooltip target
  let activeErrorJobId = $state<number | null>(null)

  // Column visibility
  let visibleColumns = $state({
    portal: true,
    salary: true,
    crawledAt: true,
    status: true
  })

  // Sorting
  let sortColumn = $state<'role' | 'company' | 'created_at' | null>(null)
  let sortDirection = $state<'asc' | 'desc'>('asc')

  // Pagination
  let currentPage = $state(1)
  const pageSize = 10

  async function loadJobs() {
    loading = true
    try {
      const res = await fetch('/api/jobs')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) jobs = json.data
    } catch (err) {
      console.error('Failed to load jobs:', err)
    } finally {
      loading = false
    }
  }

  onMount(() => {
    loadJobs()
    const handleDocClick = () => { activeErrorJobId = null }
    document.addEventListener('click', handleDocClick)
    return () => document.removeEventListener('click', handleDocClick)
  })

  // Stage counts derivation
  const stageCounts = $derived({
    review: jobs.filter(j => isJobInStage(j.status, 'review')).length,
    pending: jobs.filter(j => isJobInStage(j.status, 'pending')).length,
    submitted: jobs.filter(j => isJobInStage(j.status, 'submitted')).length,
    dropped: jobs.filter(j => isJobInStage(j.status, 'dropped')).length,
    all: jobs.length
  })

  // Filtered jobs
  const filteredJobs = $derived(
    jobs.filter(j => {
      if (!isJobInStage(j.status, currentStage)) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const text = `${j.title} ${j.company} ${j.location || ''} ${j.portal} ${j.salary_raw || ''}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  )

  // Sorted jobs
  const sortedJobs = $derived(sortJobsList(filteredJobs, sortColumn, sortDirection))

  // Pagination
  const totalPages = $derived(Math.max(1, Math.ceil(sortedJobs.length / pageSize)))
  const pagedJobs = $derived(
    sortedJobs.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  )

  function toggleSort(col: 'role' | 'company' | 'created_at') {
    if (sortColumn === col) {
      if (sortDirection === 'asc') sortDirection = 'desc'
      else { sortColumn = null; sortDirection = 'asc' }
    } else {
      sortColumn = col
      sortDirection = 'asc'
    }
  }

  function handleColumnToggle(id: string) {
    if (id in visibleColumns) {
      (visibleColumns as any)[id] = !(visibleColumns as any)[id]
    }
  }

  // Selection
  const isAllSelected = $derived(
    pagedJobs.length > 0 && pagedJobs.every(j => selectedIds.includes(j.id))
  )
  const isPartiallySelected = $derived(
    pagedJobs.some(j => selectedIds.includes(j.id)) && !isAllSelected
  )

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      const pageIds = pagedJobs.map(j => j.id)
      selectedIds = Array.from(new Set([...selectedIds, ...pageIds]))
    } else {
      const pageIds = pagedJobs.map(j => j.id)
      selectedIds = selectedIds.filter(id => !pageIds.includes(id))
    }
  }

  function toggleSelect(id: number) {
    selectedIds = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]
  }

  // Status transitions
  async function updateStatus(id: number, targetStatus: string, note = '') {
    try {
      const res = await fetch(`/api/jobs/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus, note })
      })
      const json = await res.json()
      if (json.success) {
        jobs = jobs.map(j => (j.id === id ? { ...j, status: targetStatus } : j))
      } else {
        alert(json.error || 'Failed to update status')
      }
    } catch (err: any) {
      alert('Network error: ' + err.message)
    }
  }

  async function handleDirectSubmit(jobId: number) {
    const jobItem = jobs.find(j => j.id === jobId)
    const label = jobItem ? `${jobItem.title} at ${jobItem.company}` : `Job #${jobId}`
    if (!confirm(`Run automated portal submission driver for ${label}?`)) return

    try {
      const res = await fetch(`/api/jobs/${jobId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const json = await res.json()
      if (json.success) {
        await loadJobs()
        currentStage = 'submitted'
      } else {
        alert(`Submission error: ${json.error || 'Unknown error'}`)
        await loadJobs()
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`)
    }
  }

  async function handleBatchStatus(targetStatus: string) {
    if (selectedIds.length === 0) return
    if (targetStatus === 'DROPPED' && !confirm(`Drop ${selectedIds.length} selected job(s)? They will be moved to Filtered.`)) {
      return
    }

    try {
      const res = await fetch('/api/jobs/batch-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, status: targetStatus })
      })
      const json = await res.json()
      if (json.success) {
        jobs = jobs.map(j => selectedIds.includes(j.id) ? { ...j, status: targetStatus } : j)
        selectedIds = []
        if (targetStatus === 'APPROVED' && currentStage === 'review') currentStage = 'pending'
        else if (targetStatus === 'DROPPED' && (currentStage === 'review' || currentStage === 'pending')) currentStage = 'dropped'
        else if (targetStatus === 'PENDING_HUMAN' && currentStage === 'dropped') currentStage = 'review'
      } else {
        alert(json.error || 'Batch update failed')
      }
    } catch (err: any) {
      alert('Batch update error: ' + err.message)
    }
  }

  async function handleBatchSubmit() {
    if (selectedIds.length === 0) return
    if (!confirm(`Run automated submission drivers for ${selectedIds.length} selected jobs?`)) return

    for (const id of selectedIds) {
      try {
        await fetch(`/api/jobs/${id}/submit`, { method: 'POST' })
      } catch {}
    }
    selectedIds = []
    await loadJobs()
    currentStage = 'submitted'
  }
</script>

<div class="view-panel">
  <!-- Left-Aligned Toolbar with Stage Tabs, Search, Columns Popover, Batch cluster -->
  <JobsLedgerToolbar
    {currentStage}
    counts={stageCounts}
    bind:searchQuery
    selectedCount={selectedIds.length}
    {visibleColumns}
    onstagechange={(val) => { currentStage = val; selectedIds = []; currentPage = 1 }}
    oncolumntoggle={handleColumnToggle}
    ondeselect={() => selectedIds = []}
    onbatchstatus={handleBatchStatus}
    onbatchsubmit={handleBatchSubmit}
  />

  <!-- Table Container -->
  <div class="table-wrapper">
    {#if loading}
      <div class="loading-state">Loading jobs ledger from Cloudflare D1...</div>
    {:else if sortedJobs.length === 0}
      <div class="empty-state">No jobs found matching the selected stage and search filters.</div>
    {:else}
      <table class="triage-table">
        <thead>
          <tr>
            <th style="width: 44px; text-align: center;">
              <Checkbox
                checked={isAllSelected}
                indeterminate={isPartiallySelected}
                onchange={toggleSelectAll}
                ariaLabel="Select all visible jobs on this page"
              />
            </th>
            <th>
              <button type="button" class="btn-sort-header" onclick={() => toggleSort('role')}>
                <span>Role</span>
                <ArrowUpDown size={12} class={sortColumn === 'role' ? 'sort-icon-active' : 'sort-icon'} />
              </button>
            </th>
            <th style="width: 180px;">
              <button type="button" class="btn-sort-header" onclick={() => toggleSort('company')}>
                <span>Company</span>
                <ArrowUpDown size={12} class={sortColumn === 'company' ? 'sort-icon-active' : 'sort-icon'} />
              </button>
            </th>
            <th style="width: 100px; text-align: center;">Details</th>
            <th style="width: 60px; text-align: center;">Actions</th>
            {#if visibleColumns.portal}
              <th style="width: 120px;">Portal</th>
            {/if}
            {#if visibleColumns.salary}
              <th style="width: 200px;">Salary</th>
            {/if}
            {#if visibleColumns.crawledAt}
              <th style="width: 110px;">
                <button type="button" class="btn-sort-header" onclick={() => toggleSort('created_at')}>
                  <span>Crawled At</span>
                  <ArrowUpDown size={12} class={sortColumn === 'created_at' ? 'sort-icon-active' : 'sort-icon'} />
                </button>
              </th>
            {/if}
            {#if visibleColumns.status}
              <th style="width: 140px; text-align: center;">Status</th>
            {/if}
          </tr>
        </thead>
        <tbody>
          {#each pagedJobs as j (j.id)}
            <JobTableRow
              job={j}
              isChecked={selectedIds.includes(j.id)}
              {visibleColumns}
              {activeErrorJobId}
              ontoggleselect={toggleSelect}
              onopenmodal={(job, tab) => { selectedJob = job; dossierTab = tab || 0 }}
              onupdatestatus={updateStatus}
              ondirectsubmit={handleDirectSubmit}
              ontoggleerrorhint={(id) => activeErrorJobId = activeErrorJobId === id ? null : id}
            />
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <!-- Bottom Selection & Pagination Footer (Point 6) -->
  <DataTableFooter
    selectedCount={selectedIds.length}
    totalCount={sortedJobs.length}
    {currentPage}
    {totalPages}
    showSelection={true}
    onprev={() => currentPage = Math.max(1, currentPage - 1)}
    onnext={() => currentPage = Math.min(totalPages, currentPage + 1)}
  />
</div>

<!-- Modal: Comprehensive Job Dossier -->
{#if selectedJob}
  <JobDossierModal
    job={selectedJob}
    initialTab={dossierTab}
    onclose={() => selectedJob = null}
    {onswitchview}
  />
{/if}

<style>
  .view-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: var(--bg-app, #09090b);
    color: var(--text-main, #f4f4f5);
  }

  .table-wrapper {
    flex: 1;
    overflow: auto;
  }

  .triage-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    text-align: left;
  }

  .triage-table thead th {
    background-color: #18181b;
    color: #71717a;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 10px 14px;
    border-bottom: 1px solid #27272a;
    white-space: nowrap;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .btn-sort-header {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: inherit;
    font-size: inherit;
    font-weight: inherit;
    text-transform: inherit;
    letter-spacing: inherit;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }
  .btn-sort-header:hover {
    color: #ffffff;
  }

  :global(.sort-icon) {
    color: #71717a;
  }
  :global(.sort-icon-active) {
    color: #ffffff;
  }

  .empty-state, .loading-state {
    padding: 60px 20px;
    text-align: center;
    color: #71717a;
    font-size: 13px;
  }
</style>

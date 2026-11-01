<script lang="ts">
  import { onMount } from 'svelte'
  import { Search, ExternalLink, FileText, ArrowUpDown } from 'lucide-svelte'
  import ActionPopover from '../ui/ActionPopover.svelte'
  import CompanyDossierDialog from './CompanyDossierDialog.svelte'
  import ColumnsVisibilityPopover from '../ui/ColumnsVisibilityPopover.svelte'
  import DataTableFooter from '../ui/DataTableFooter.svelte'
  import type { CompanyRecord } from '../../types'

  let companies = $state<CompanyRecord[]>([])
  let loading = $state(true)
  let searchQuery = $state('')
  let selectedCompany = $state<CompanyRecord | null>(null)

  // Point 3: Column visibility
  let visibleColumns = $state({
    industry: true,
    scale: true,
    location: true,
    crawled: true,
    applied: true,
    cooldown: true
  })

  // Point 4: Sorting
  let sortColumn = $state<'name' | 'industry' | 'crawled' | 'applied' | null>(null)
  let sortDirection = $state<'asc' | 'desc'>('asc')

  // Point 6: Pagination
  let currentPage = $state(1)
  const pageSize = 10

  async function loadCompanies() {
    loading = true
    try {
      const res = await fetch('/api/companies')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        companies = json.data
      }
    } catch (err) {
      console.error('Failed to load companies:', err)
    } finally {
      loading = false
    }
  }

  onMount(loadCompanies)

  let filteredCompanies = $derived(
    companies.filter(c => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const text = `${c.name} ${c.industry || ''} ${c.location || ''} ${c.overview || ''}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  )

  let sortedCompanies = $derived.by(() => {
    if (!sortColumn) return filteredCompanies
    return [...filteredCompanies].sort((a, b) => {
      if (sortColumn === 'name') {
        const cmp = a.name.localeCompare(b.name)
        return sortDirection === 'asc' ? cmp : -cmp
      } else if (sortColumn === 'industry') {
        const cmp = (a.industry || '').localeCompare(b.industry || '')
        return sortDirection === 'asc' ? cmp : -cmp
      } else if (sortColumn === 'crawled') {
        const valA = a.crawled_count ?? 0
        const valB = b.crawled_count ?? 0
        return sortDirection === 'asc' ? valA - valB : valB - valA
      } else if (sortColumn === 'applied') {
        const valA = a.applications_count ?? 0
        const valB = b.applications_count ?? 0
        return sortDirection === 'asc' ? valA - valB : valB - valA
      }
      return 0
    })
  })

  const totalPages = $derived(Math.max(1, Math.ceil(sortedCompanies.length / pageSize)))
  const pagedCompanies = $derived(
    sortedCompanies.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  )

  function toggleSort(col: 'name' | 'industry' | 'crawled' | 'applied') {
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
</script>

<div class="view-container">
  <div class="toolbar-left-aligned">
    <div class="search-input-wrapper">
      <Search size={14} class="search-icon" />
      <input
        type="text"
        placeholder="Search employer, industry, location..."
        bind:value={searchQuery}
        class="input-base search-input"
      />
    </div>

    <!-- Columns visibility toggle inline left-aligned -->
    <ColumnsVisibilityPopover
      columns={[
        { id: 'industry', label: 'Industry', visible: visibleColumns.industry },
        { id: 'scale', label: 'Company Scale', visible: visibleColumns.scale },
        { id: 'location', label: 'Location', visible: visibleColumns.location },
        { id: 'crawled', label: 'Crawled Count', visible: visibleColumns.crawled },
        { id: 'applied', label: 'Applied Count', visible: visibleColumns.applied },
        { id: 'cooldown', label: 'Cooldown', visible: visibleColumns.cooldown }
      ]}
      ontoggle={handleColumnToggle}
    />
  </div>

  <div class="table-container">
    {#if loading}
      <div class="loading-state">Loading companies master via Cloudflare D1 View...</div>
    {:else if sortedCompanies.length === 0}
      <div class="empty-state">No matching companies found in ledger.</div>
    {:else}
      <table class="data-table">
        <thead>
          <tr>
            <th style="min-width: 220px;">
              <button type="button" class="btn-sort-header" onclick={() => toggleSort('name')}>
                <span>Company / Employer</span>
                <ArrowUpDown size={12} class={sortColumn === 'name' ? 'sort-icon-active' : 'sort-icon'} />
              </button>
            </th>
            {#if visibleColumns.industry}
              <th style="width: 170px;">
                <button type="button" class="btn-sort-header" onclick={() => toggleSort('industry')}>
                  <span>Industry</span>
                  <ArrowUpDown size={12} class={sortColumn === 'industry' ? 'sort-icon-active' : 'sort-icon'} />
                </button>
              </th>
            {/if}
            {#if visibleColumns.scale}
              <th style="width: 140px;">Company Scale</th>
            {/if}
            {#if visibleColumns.location}
              <th style="width: 170px;">Location</th>
            {/if}
            {#if visibleColumns.crawled}
              <th style="width: 110px; text-align: center;">
                <button type="button" class="btn-sort-header" onclick={() => toggleSort('crawled')}>
                  <span>Crawled</span>
                  <ArrowUpDown size={12} class={sortColumn === 'crawled' ? 'sort-icon-active' : 'sort-icon'} />
                </button>
              </th>
            {/if}
            {#if visibleColumns.applied}
              <th style="width: 110px; text-align: center;">
                <button type="button" class="btn-sort-header" onclick={() => toggleSort('applied')}>
                  <span>Applied</span>
                  <ArrowUpDown size={12} class={sortColumn === 'applied' ? 'sort-icon-active' : 'sort-icon'} />
                </button>
              </th>
            {/if}
            {#if visibleColumns.cooldown}
              <th style="width: 140px; text-align: center;">Cooldown</th>
            {/if}
            <th style="width: 60px; text-align: center;">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each pagedCompanies as c (c.id)}
            {@const isEligible = c.cooldown_status === 'ELIGIBLE' || !c.cooldown_status}
            <tr>
              <td>
                <button
                  type="button"
                  class="btn-company-link"
                  onclick={() => selectedCompany = c}
                >
                  {c.name}
                </button>
                {#if c.website}
                  <a href={c.website} target="_blank" rel="noreferrer" class="company-sublink">
                    {c.website} &nearr;
                  </a>
                {/if}
              </td>
              {#if visibleColumns.industry}
                <td>{c.industry || 'Technology'}</td>
              {/if}
              {#if visibleColumns.scale}
                <td>{c.company_size || 'Mid-Market'}</td>
              {/if}
              {#if visibleColumns.location}
                <td>{c.location || 'Indonesia'}</td>
              {/if}
              {#if visibleColumns.crawled}
                <td style="text-align: center; font-weight: 600;">{c.crawled_count}</td>
              {/if}
              {#if visibleColumns.applied}
                <td style="text-align: center; font-weight: 600;">{c.applications_count}</td>
              {/if}
              {#if visibleColumns.cooldown}
                <td style="text-align: center;">
                  {#if isEligible}
                    <span class="badge badge-active">ELIGIBLE</span>
                  {:else}
                    <span class="badge" style="border-color: #71717a;">
                      COOLDOWN ({c.cooldown_days_remaining ?? 0}d left)
                    </span>
                  {/if}
                </td>
              {/if}
              <td style="text-align: center; vertical-align: middle;">
                <ActionPopover title="Actions for {c.name}">
                  {#snippet children()}
                    <div class="popover-header">{c.name}</div>
                    <button type="button" onclick={() => selectedCompany = c}>
                      <FileText size={13} /> View Company Dossier
                    </button>
                    {#if c.website}
                      <a href={c.website} target="_blank" rel="noreferrer">
                        <ExternalLink size={13} /> Official Website
                      </a>
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
    totalCount={sortedCompanies.length}
    {currentPage}
    {totalPages}
    showSelection={false}
    onprev={() => currentPage = Math.max(1, currentPage - 1)}
    onnext={() => currentPage = Math.min(totalPages, currentPage + 1)}
  />
</div>

<!-- Dialog: Company Dossier -->
<CompanyDossierDialog
  company={selectedCompany}
  onclose={() => selectedCompany = null}
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

  .btn-company-link {
    background: transparent;
    border: none;
    color: #ffffff;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
    font-size: inherit;
    text-align: left;
  }
  .btn-company-link:hover {
    text-decoration: underline;
  }

  .company-sublink {
    font-size: 11px;
    color: #71717a;
    display: block;
    margin-top: 2px;
    text-decoration: underline;
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

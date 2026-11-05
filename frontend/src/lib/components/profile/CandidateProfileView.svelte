<script lang="ts">
  import { onMount } from 'svelte'
  import { Search, Upload, Bot, ArrowUpDown, Globe, RefreshCw, ExternalLink, ChevronDown, ChevronRight, Layers, Award, Users, Check, Pencil } from 'lucide-svelte'
  import Tabs from '../ui/Tabs.svelte'
  import Dialog from '../ui/Dialog.svelte'
  import ActionPopover from '../ui/ActionPopover.svelte'
  import StageFilterPopover from '../ui/StageFilterPopover.svelte'
  import ColumnsVisibilityPopover from '../ui/ColumnsVisibilityPopover.svelte'
  import DataTableFooter from '../ui/DataTableFooter.svelte'
  import type { CandidateAttribute } from '../../types'

  let { initialSearchKey = '' } = $props<{ initialSearchKey?: string }>()

  let attributes = $state<CandidateAttribute[]>([])
  let loading = $state(true)
  let activeTab = $state<'unfilled' | 'filled' | 'all'>('unfilled')
  let searchQuery = $state('')

  // Top Level Navigation: Candidate Attributes vs External Sources
  let primaryView = $state<'attributes' | 'external_sources'>('attributes')

  // Portfolio Multi-Source & Crawler State
  let portfolioData = $state<any>(null)
  let loadingPortfolio = $state(false)
  let recrawling = $state(false)
  let recrawlSuccess = $state(false)
  let activeCategoryFilter = $state<'all' | 'product' | 'work' | 'certification' | 'volunteer'>('all')

  // Pagination for External Sources / Portfolio
  let portfolioPage = $state(1)
  const portfolioItemsPerPage = 5

  // Edit Portfolio Item State
  let editingItem = $state<any>(null)
  let isEditing = $state(false)
  let editSaving = $state(false)

  function openEditModal(item: any) {
    editingItem = {
      ...item,
      title: (item.title || '').replace(/&amp;/g, '&').replace(/&#38;/g, '&'),
      date: item.date || '',
      highlights_str: (item.highlights || []).join('\n'),
      tech_stack_str: (item.tech_stack || []).join(', ')
    }
    isEditing = true
  }

  // Multi-Source Directory
  let sources = $state<Array<{ url: string; label: string; active: boolean }>>([
    { url: 'https://muhaemen.my.id', label: 'Primary Personal Portfolio & Blog', active: true }
  ])
  let newSourceUrl = $state('')
  let newSourceLabel = $state('')
  let showAddSourceForm = $state(false)
  let showRecrawlMenu = $state(false)

  function addSource() {
    const u = newSourceUrl.trim()
    if (!u) return
    const l = newSourceLabel.trim() || u.replace(/^https?:\/\//i, '').split('/')[0]
    if (!sources.some(s => s.url === u)) {
      sources = [...sources, { url: u, label: l, active: true }]
    }
    newSourceUrl = ''
    newSourceLabel = ''
    showAddSourceForm = false
  }

  function removeSource(url: string) {
    if (sources.length <= 1) {
      alert('At least one primary source is required.')
      return
    }
    sources = sources.filter(s => s.url !== url)
  }

  $effect(() => {
    if (initialSearchKey) {
      searchQuery = initialSearchKey
      activeTab = 'all'
      loadAttributes(initialSearchKey)
    }
  })

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

  async function loadPartitionedPortfolio() {
    loadingPortfolio = true
    try {
      const res = await fetch('/api/candidate/portfolio/partitioned')
      const json = await res.json()
      if (json.success && json.data) {
        portfolioData = json.data
      }
    } catch (err) {
      console.error('Failed to load partitioned portfolio:', err)
    } finally {
      loadingPortfolio = false
    }
  }

  async function handleRecrawlPortfolio(targetUrl = 'https://muhaemen.my.id', mode: 'incremental' | 'fresh' = 'incremental') {
    recrawling = true
    recrawlSuccess = false
    try {
      const res = await fetch('/api/candidate/portfolio/recrawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl, mode })
      })
      const json = await res.json()
      if (json.success) {
        portfolioData = json.data
        recrawlSuccess = true
        setTimeout(() => { recrawlSuccess = false }, 4000)
        await loadAttributes()
      } else {
        alert('Recrawl failed: ' + (json.error || 'Unknown error'))
      }
    } catch (err: any) {
      alert('Recrawl request failed: ' + err.message)
    } finally {
      recrawling = false
    }
  }

  async function addSourceAndCrawl() {
    const u = newSourceUrl.trim()
    if (!u) return
    const l = newSourceLabel.trim() || u.replace(/^https?:\/\//i, '').split('/')[0]
    if (!sources.some(s => s.url === u)) {
      sources = [...sources, { url: u, label: l, active: true }]
    }
    newSourceUrl = ''
    newSourceLabel = ''
    showAddSourceForm = false
    await handleRecrawlPortfolio(u)
  }

  async function saveEditedItem() {
    if (!editingItem) return
    editSaving = true
    try {
      const techStack = editingItem.tech_stack_str
        ? editingItem.tech_stack_str.split(',').map((s: string) => s.trim()).filter(Boolean)
        : []
      const highlights = editingItem.highlights_str
        ? editingItem.highlights_str.split('\n').map((s: string) => s.trim()).filter(Boolean)
        : []

      const res = await fetch('/api/candidate/portfolio/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: editingItem.slug,
          title: editingItem.title,
          description: editingItem.description,
          date: editingItem.date,
          highlights: highlights,
          project_url: editingItem.project_url,
          article_url: editingItem.article_url,
          tech_stack: techStack
        })
      })
      const json = await res.json()
      if (json.success && json.data) {
        portfolioData = json.data
        isEditing = false
        editingItem = null
      } else {
        alert('Failed to update item: ' + (json.error || 'Unknown error'))
      }
    } catch (err: any) {
      alert('Failed to save edit: ' + err.message)
    } finally {
      editSaving = false
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

  let allPortfolioItems = $derived.by(() => {
    if (!portfolioData?.categories) return []
    const cats = ['product', 'work', 'certification', 'volunteer'] as const
    let list: any[] = []
    if (activeCategoryFilter === 'all') {
      for (const c of cats) {
        list = list.concat(portfolioData.categories[c] || [])
      }
    } else {
      list = portfolioData.categories[activeCategoryFilter] || []
    }
    return list
  })

  let pagedPortfolioItems = $derived.by(() => {
    const start = (portfolioPage - 1) * portfolioItemsPerPage
    return allPortfolioItems.slice(start, start + portfolioItemsPerPage)
  })

  let totalPortfolioPages = $derived(
    Math.max(1, Math.ceil(allPortfolioItems.length / portfolioItemsPerPage))
  )

  onMount(() => {
    loadAttributes()
    loadPartitionedPortfolio()

    const handleWindowClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.closest('.recrawl-menu-container')) {
        showRecrawlMenu = false
      }
    }
    window.addEventListener('click', handleWindowClick)
    return () => {
      window.removeEventListener('click', handleWindowClick)
    }
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
  <!-- Top Level View Switcher Tabs Bar -->
  <div class="primary-view-nav-bar">
    <Tabs
      value={primaryView}
      items={[
        { id: 'attributes', label: 'Candidate Attributes (Table)' },
        { id: 'external_sources', label: 'External Sources & Crawled Portfolio' }
      ]}
      onchange={(id) => primaryView = id as any}
    />
  </div>

  {#if primaryView === 'external_sources'}
    <!-- TAB 2: EXTERNAL SOURCES & MULTI-SOURCE CRAWLER -->
    <div class="external-sources-view">
      <!-- Multi-Source Sources Header & Directory -->
      <div class="sources-management-bar">
        <div class="sources-header-col">
          <div class="sources-title-row">
            <span class="sources-title">REGISTERED PORTFOLIO &amp; DATA SOURCES</span>
          </div>

          <!-- Registered sources chips -->
          <div class="sources-chips-list">
            {#each sources as src}
              <div class="source-chip {src.active ? 'active-chip' : ''}">
                <Globe size={12} class="source-icon" />
                <a href={src.url} target="_blank" rel="noreferrer" class="source-chip-link">
                  {src.label} ({src.url.replace(/^https?:\/\//i, '').replace(/\/$/, '')})
                </a>
                {#if sources.length > 1}
                  <button type="button" class="btn-remove-source" onclick={() => removeSource(src.url)} title="Remove source">&times;</button>
                {/if}
              </div>
            {/each}
          </div>

          <!-- Left-Aligned Actions Toolbar with Dropdown Menu -->
          <div class="sources-controls-row">
            <button
              type="button"
              class="btn-primary"
              onclick={() => showAddSourceForm = !showAddSourceForm}
            >
              <span>+ Add New Source</span>
            </button>

            <!-- Recrawl Mode Dropdown Menu -->
            <div class="recrawl-menu-container">
              <button
                type="button"
                class="btn-secondary btn-recrawl-trigger"
                onclick={(e) => { e.stopPropagation(); showRecrawlMenu = !showRecrawlMenu; }}
                disabled={recrawling}
                title="Choose crawl mode: Incremental sync (preserves edits) or Fresh recrawl (resets data)"
              >
                <RefreshCw size={12} class={recrawling ? 'spinning' : ''} />
                <span>{recrawling ? 'Recrawling...' : recrawlSuccess ? 'Sync Complete!' : 'Recrawl Portfolio'}</span>
                <ChevronDown size={12} />
              </button>

              {#if showRecrawlMenu}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="recrawl-dropdown-menu"
                  onclick={(e) => e.stopPropagation()}
                  role="menu"
                  tabindex="-1"
                >
                  <button
                    type="button"
                    class="recrawl-menu-item"
                    role="menuitem"
                    onclick={() => {
                      showRecrawlMenu = false;
                      handleRecrawlPortfolio('https://muhaemen.my.id', 'incremental');
                    }}
                  >
                    <div class="menu-item-text">
                      <span class="menu-item-title">Recrawl Lanjut (Incremental)</span>
                      <span class="menu-item-desc">Hanya ambil artikel baru, data yang sudah diedit tetap aman</span>
                    </div>
                  </button>

                  <div class="menu-divider"></div>

                  <button
                    type="button"
                    class="recrawl-menu-item item-danger"
                    role="menuitem"
                    onclick={() => {
                      showRecrawlMenu = false;
                      if (confirm('Recrawl dari awal akan menimpa semua data dan editan manual dengan data asli website. Lanjutkan?')) {
                        handleRecrawlPortfolio('https://muhaemen.my.id', 'fresh');
                      }
                    }}
                  >
                    <div class="menu-item-text">
                      <span class="menu-item-title">Recrawl dari Awal (Fresh Reset)</span>
                      <span class="menu-item-desc">Scrape ulang total dari base website, reset semua editan manual</span>
                    </div>
                  </button>
                </div>
              {/if}
            </div>
          </div>

          {#if showAddSourceForm}
            <div class="add-source-inline-form">
              <input
                type="url"
                placeholder="https://example.com/portfolio"
                bind:value={newSourceUrl}
                class="input-base input-add-src"
              />
              <input
                type="text"
                placeholder="Label (e.g. GitHub / Personal Site)"
                bind:value={newSourceLabel}
                class="input-base input-add-src"
              />
              <button type="button" class="btn-primary" onclick={addSourceAndCrawl}>Add &amp; Ingest</button>
              <button type="button" class="btn-secondary" onclick={() => showAddSourceForm = false}>Cancel</button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Horizontal Category Filters Bar with Shadcn Tabs -->
      <div class="category-filter-toolbar">
        <Tabs
          value={activeCategoryFilter}
          items={[
            { id: 'all', label: 'All Categories' },
            { id: 'product', label: 'Products' },
            { id: 'work', label: 'Work Experience' },
            { id: 'certification', label: 'Certifications' },
            { id: 'volunteer', label: 'Volunteer Work' }
          ]}
          onchange={(id) => { activeCategoryFilter = id as any; portfolioPage = 1; }}
        />
      </div>

      <!-- Long Detailed Row Layout (Not Small Cards) -->
      <div class="detailed-items-container">
        {#if loadingPortfolio}
          <div class="loading-state">Loading crawled portfolio datasets...</div>
        {:else if pagedPortfolioItems.length === 0}
          <div class="empty-state">No portfolio items discovered. Click "Recrawl All Sources" to ingest.</div>
        {:else}
          {#each pagedPortfolioItems as item (item.slug + item.category)}
            <div class="detailed-row-card">
              <!-- Top Header Row -->
              <div class="row-header">
                <div class="row-title-block">
                  <div class="row-meta-badges">
                    <span class="badge-category badge-cat-{item.category}">{item.category}</span>
                    {#if item.date}
                      <span class="badge-date">{item.date}</span>
                    {/if}
                    {#if item.cert_type}
                      <span class="badge-cert-type">{item.cert_type}</span>
                    {/if}
                    {#if item.volunteer_role}
                      <span class="badge-volunteer-role">{item.volunteer_role}</span>
                    {/if}
                  </div>
                  <h3 class="row-title">{@html item.title}</h3>
                </div>

                <!-- Top Right Action Popover (Replaces Livesite and Article buttons) -->
                <div class="row-actions-group">
                  <ActionPopover title="Actions for {item.title}">
                    {#snippet children()}
                      <button type="button" onclick={() => openEditModal(item)}>
                        <Pencil size={13} />
                        <span>Edit</span>
                      </button>
                      {#if item.article_url || item.project_url}
                        <a href={item.article_url || item.project_url} target="_blank" rel="noreferrer">
                          <ExternalLink size={13} />
                          <span>Go to Article</span>
                        </a>
                      {/if}
                    {/snippet}
                  </ActionPopover>
                </div>
              </div>

              <!-- Specific Fields: Issuer & Credential (For Certifications) -->
              {#if item.issuer || item.credential_id}
                <div class="row-attribute-grid">
                  {#if item.issuer}
                    <div class="row-attr-item">
                      <span class="attr-label">Issuing Organization:</span>
                      <span class="attr-val font-semibold">{item.issuer}</span>
                    </div>
                  {/if}
                  {#if item.credential_id}
                    <div class="row-attr-item">
                      <span class="attr-label">Credential ID:</span>
                      <code class="attr-val code-val">{item.credential_id}</code>
                    </div>
                  {/if}
                </div>
              {/if}

              <!-- Specific Fields: Volunteer Scope -->
              {#if item.volunteer_scope}
                <div class="row-attribute-grid">
                  <div class="row-attr-item">
                    <span class="attr-label">Volunteer Scope &amp; Activity:</span>
                    <span class="attr-val font-semibold">{item.volunteer_scope}</span>
                  </div>
                </div>
              {/if}

              <!-- Full Description Paragraph -->
              {#if item.description}
                <p class="row-description">{item.description}</p>
              {/if}

              <!-- Architectural Highlights or Volunteer Bullet Points -->
              {#if item.highlights && item.highlights.length > 0}
                <div class="row-highlights-section">
                  <span class="section-micro-label">Highlights &amp; Architectural Implementation:</span>
                  <ul class="highlights-list">
                    {#each item.highlights as hl}
                      <li>{hl}</li>
                    {/each}
                  </ul>
                </div>
              {/if}

              <!-- Certification Tested Coverage Modules -->
              {#if item.coverage && item.coverage.length > 0}
                <div class="row-coverage-section">
                  <span class="section-micro-label">Tested Competency &amp; Domain Coverage:</span>
                  <div class="coverage-pills-row">
                    {#each item.coverage as cov}
                      <span class="coverage-pill">{cov}</span>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Tech Stack Tags -->
              {#if item.tech_stack && item.tech_stack.length > 0}
                <div class="row-tech-section">
                  <span class="section-micro-label">Tech Stack:</span>
                  <div class="tech-pills-row">
                    {#each item.tech_stack as tech}
                      <span class="tech-pill">{tech}</span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

      <!-- Pagination for External Sources / Crawled Portfolio -->
      <DataTableFooter
        totalCount={allPortfolioItems.length}
        currentPage={portfolioPage}
        totalPages={totalPortfolioPages}
        showSelection={false}
        onprev={() => portfolioPage = Math.max(1, portfolioPage - 1)}
        onnext={() => portfolioPage = Math.min(totalPortfolioPages, portfolioPage + 1)}
      />
    </div>
  {:else}
    <!-- TAB 1: CANDIDATE ATTRIBUTES TABLE LEDGER -->
    <div class="attributes-view">

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
                  <span class="col-category">{a.category}</span>
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
                    <span class="status-text status-delegated">AGY SYNTHESIZED</span>
                  {:else if isUnresolved}
                    <span class="status-text status-unresolved">ACTION REQUIRED</span>
                  {:else}
                    <span class="status-text status-resolved">RESOLVED</span>
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
  {/if}
</div>

{#if isEditing && editingItem}
  <Dialog
    open={isEditing}
    title="Edit Portfolio Item"
    subtitle={editingItem.slug}
    maxWidth="620px"
    onclose={() => { isEditing = false; editingItem = null; }}
  >
    {#snippet children()}
      <div class="edit-form-stack">
        <div class="form-field">
          <label class="field-label" for="edit-title">Title</label>
          <input
            id="edit-title"
            type="text"
            class="input-base"
            bind:value={editingItem.title}
          />
        </div>

        <div class="form-field">
          <label class="field-label" for="edit-date">Date / Period</label>
          <input
            id="edit-date"
            type="text"
            class="input-base"
            placeholder="e.g. 15.10.2026"
            bind:value={editingItem.date}
          />
        </div>

        <div class="form-field">
          <label class="field-label" for="edit-desc">Description</label>
          <textarea
            id="edit-desc"
            class="input-base textarea-base"
            rows="3"
            bind:value={editingItem.description}
          ></textarea>
        </div>

        <div class="form-field">
          <label class="field-label" for="edit-highlights">Highlights &amp; Architectural Implementation (one per line)</label>
          <textarea
            id="edit-highlights"
            class="input-base textarea-base"
            rows="5"
            placeholder="Bullet point 1&#10;Bullet point 2..."
            bind:value={editingItem.highlights_str}
          ></textarea>
        </div>

        <div class="form-field">
          <label class="field-label" for="edit-project">Live Site / Project URL</label>
          <input
            id="edit-project"
            type="url"
            class="input-base"
            placeholder="https://..."
            bind:value={editingItem.project_url}
          />
        </div>

        <div class="form-field">
          <label class="field-label" for="edit-article">Article &amp; Case Study URL</label>
          <input
            id="edit-article"
            type="url"
            class="input-base"
            placeholder="https://..."
            bind:value={editingItem.article_url}
          />
        </div>

        <div class="form-field">
          <label class="field-label" for="edit-tech">Tech Stack (comma separated)</label>
          <input
            id="edit-tech"
            type="text"
            class="input-base"
            placeholder="Go, React, TypeScript..."
            bind:value={editingItem.tech_stack_str}
          />
        </div>
      </div>
    {/snippet}

    {#snippet footer()}
      <button
        type="button"
        class="btn-secondary"
        onclick={() => { isEditing = false; editingItem = null; }}
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn-primary"
        disabled={editSaving}
        onclick={saveEditedItem}
      >
        <span>{editSaving ? 'Saving...' : 'Save Changes'}</span>
      </button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .view-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: #09090b;
  }

  /* Top Navigation Bar: Shadcn Tabs Container with 24px padding */
  .primary-view-nav-bar {
    padding: 12px 24px;
    border-bottom: 1px solid #27272a;
    background-color: #09090b;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    flex-shrink: 0;
  }

  /* Tab 1: Attributes View */
  .attributes-view {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .search-input {
    width: 240px;
  }

  .col-category {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: #ffffff;
  }

  .status-text {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    display: inline-block;
  }

  .status-delegated {
    color: #ffffff;
  }

  .status-unresolved {
    color: #f4f4f5;
  }

  .status-resolved {
    color: #ffffff;
  }

  /* Tab 2: External Sources View (Scrollable with 24px padding) */
  .external-sources-view {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 20px 24px 32px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .sources-management-bar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 14px 18px;
  }

  .sources-header-col {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sources-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .sources-title {
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #ffffff;
    text-transform: uppercase;
  }

  .sources-chips-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .source-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 12px;
    color: #ffffff;
  }

  .source-icon {
    color: #ffffff;
  }

  .source-chip-link {
    color: #ffffff;
    text-decoration: none;
    font-size: 12px;
  }

  .source-chip-link:hover {
    text-decoration: underline;
  }

  .btn-remove-source {
    background: transparent;
    border: none;
    color: #ffffff;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    padding: 0 2px;
    transition: opacity 0.15s;
  }

  .btn-remove-source:hover {
    opacity: 0.7;
  }

  .sources-controls-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
  }

  .recrawl-menu-container {
    position: relative;
    display: inline-block;
  }

  .btn-recrawl-trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .recrawl-dropdown-menu {
    position: absolute;
    left: 0;
    top: calc(100% + 4px);
    background: #18181b;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.85);
    z-index: 50;
    min-width: 290px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .recrawl-menu-item {
    display: flex;
    align-items: flex-start;
    padding: 8px 10px;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background-color 0.15s;
  }

  .recrawl-menu-item:hover {
    background-color: #27272a;
  }

  .menu-item-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .menu-item-title {
    font-size: 12.5px;
    font-weight: 600;
    color: #ffffff;
  }

  .menu-item-desc {
    font-size: 11px;
    color: #a1a1aa;
    line-height: 1.35;
  }

  .menu-divider {
    height: 1px;
    background: #27272a;
    margin: 4px 0;
  }

  .add-source-inline-form {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    flex-wrap: wrap;
  }

  .input-add-src {
    font-size: 12px;
    padding: 5px 10px;
    width: 240px;
  }

  :global(.spinning) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Horizontal Category Filter Toolbar */
  .category-filter-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* Long Detailed Row Layout (Expansive vertical items) */
  .detailed-items-container {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .detailed-row-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: border-color 0.15s;
  }

  .detailed-row-card:hover {
    border-color: #3f3f46;
  }

  .row-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    border-bottom: 1px solid #27272a;
    padding-bottom: 12px;
  }

  .row-title-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .row-meta-badges {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .badge-category {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 4px;
    background: #27272a;
    border: 1px solid #3f3f46;
    color: #ffffff;
  }

  .badge-date {
    font-size: 11px;
    color: #ffffff;
    font-weight: 500;
  }

  .badge-cert-type,
  .badge-volunteer-role {
    font-size: 11px;
    font-weight: 600;
    color: #ffffff;
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 4px;
    padding: 2px 8px;
  }

  .row-title {
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    margin: 0;
    line-height: 1.3;
  }

  .row-actions-group {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .edit-form-stack {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #ffffff;
  }

  .textarea-base {
    resize: vertical;
    min-height: 70px;
    font-family: inherit;
    font-size: 12.5px;
    line-height: 1.5;
  }

  .row-attribute-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 16px 24px;
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    padding: 10px 14px;
  }

  .row-attr-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 12px;
  }

  .attr-label {
    color: #ffffff;
    text-transform: uppercase;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .attr-val {
    color: #ffffff;
    font-weight: 500;
  }

  .code-val {
    background: #18181b;
    border: 1px solid #3f3f46;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 11.5px;
    color: #ffffff;
  }

  .row-description {
    font-size: 13px;
    line-height: 1.6;
    color: #ffffff;
    margin: 0;
  }

  .row-highlights-section,
  .row-coverage-section,
  .row-tech-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .section-micro-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #ffffff;
  }

  .highlights-list {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: #ffffff;
    font-size: 13px;
    line-height: 1.6;
  }

  .highlights-list li {
    margin: 0;
  }

  .coverage-pills-row,
  .tech-pills-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .coverage-pill,
  .tech-pill {
    background: #27272a;
    border: 1px solid #3f3f46;
    color: #ffffff;
    font-size: 11.5px;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 4px;
  }
</style>

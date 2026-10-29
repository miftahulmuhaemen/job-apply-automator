let jobsData = [];
let currentJobsTab = 'review';
let selectedJobUuids = new Set();
let activeView = 'jobs';
let activeActionJobUuid = null;
let websitesData = [];
let portalSessionsMap = {};
let companiesData = [];
let criteriaData = [];
let criteriaSearchQuery = '';

// Column visibility preferences (saved in localStorage)
const defaultColumns = {
  role: true,
  platform: true,
  location: true,
  salary: true,
  marketSalary: true,
  exp: true,
  stack: true,
  details: true,
  actions: true,
  status: true,
  histories: true,
  crawled: true,
  applied: true
};

let columnVisibility = { ...defaultColumns };
try {
  const savedCols = localStorage.getItem('ats_column_visibility');
  if (savedCols) {
    columnVisibility = { ...defaultColumns, ...JSON.parse(savedCols) };
  }
} catch {}

/* =========================================================
   INITIALIZATION & NAVIGATION
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  // Restore sidebar state
  if (localStorage.getItem('ats_sidebar_collapsed') === 'true') {
    document.getElementById('appSidebar').classList.add('collapsed');
  }

  // Global click listener to close popovers and dropdown menus
  document.addEventListener('click', (e) => {
    const actionPopover = document.getElementById('actionPopover');
    const columnPopover = document.getElementById('columnPopover');
    const jobsTabMenu = document.getElementById('jobsTabMenu');

    if (actionPopover && !actionPopover.contains(e.target) && !e.target.closest('.btn-action-popover')) {
      actionPopover.style.display = 'none';
    }

    if (columnPopover && !columnPopover.contains(e.target) && !e.target.closest('#btnColumns') && !e.target.closest('.btn-secondary')) {
      columnPopover.style.display = 'none';
    }

    if (jobsTabMenu && !jobsTabMenu.contains(e.target) && !e.target.closest('#jobsTabTrigger')) {
      jobsTabMenu.style.display = 'none';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeScheduleDrawer();
      const actionPopover = document.getElementById('actionPopover');
      if (actionPopover) actionPopover.style.display = 'none';
      const columnPopover = document.getElementById('columnPopover');
      if (columnPopover) columnPopover.style.display = 'none';
      const jobsTabMenu = document.getElementById('jobsTabMenu');
      if (jobsTabMenu) jobsTabMenu.style.display = 'none';
    }
  });

  document.getElementById('searchInput').addEventListener('input', renderJobsTable);

  const knownViews = ['jobs', 'criteria', 'websites', 'companies', 'schedule', 'settings', 'errors'];
  const pathPart = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const savedView = localStorage.getItem('ats_active_view');
  const initialView = knownViews.includes(pathPart) ? pathPart : (knownViews.includes(savedView) ? savedView : 'jobs');

  switchView(initialView, false);
  fetchAgentStatus();
  fetchSystemErrorsSummary();

  window.addEventListener('popstate', () => {
    const curPath = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    const target = knownViews.includes(curPath) ? curPath : 'jobs';
    if (target !== activeView) {
      switchView(target, false);
    }
  });

  const sidebarAgentPill = document.getElementById('sidebarAgentPill');
  if (sidebarAgentPill) {
    sidebarAgentPill.addEventListener('click', () => {
      switchView('schedule');
    });
  }
});

function toggleSidebar() {
  const sidebar = document.getElementById('appSidebar');
  sidebar.classList.toggle('collapsed');
  localStorage.setItem('ats_sidebar_collapsed', sidebar.classList.contains('collapsed'));
}

async function fetchSystemErrorsSummary() {
  try {
    const res = await fetch('/api/errors?resolved=0&limit=1');
    const json = await res.json();
    const count = json.unresolvedCount || 0;
    const badge = document.getElementById('badgeErrorsCount');
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch {}
}

function switchView(viewName, updateUrl = true) {
  const knownViews = ['jobs', 'profile', 'criteria', 'websites', 'companies', 'schedule', 'settings', 'errors'];
  if (!knownViews.includes(viewName)) {
    viewName = 'jobs';
  }
  activeView = viewName;

  // Remove pre-paint zero-flicker style once JS has taken full control
  const zeroFlickerStyle = document.getElementById('zeroFlickerStyle');
  if (zeroFlickerStyle) {
    zeroFlickerStyle.remove();
  }

  const targetPath = viewName === 'jobs' ? '/' : '/' + viewName;
  if (updateUrl && window.location.pathname !== targetPath) {
    history.pushState({ view: viewName }, '', targetPath);
  }
  try {
    localStorage.setItem('ats_active_view', viewName);
  } catch {}

  // Update nav buttons
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === viewName);
  });

  // Update view panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id.toLowerCase() === 'view' + viewName);
  });

  if (viewName === 'jobs') {
    document.getElementById('viewJobs').classList.add('active');
    document.getElementById('topbarTitle').textContent = 'Jobs';
    document.getElementById('topbarSubtitle').textContent = 'Active job listings and workflow lifecycle';
    fetchJobs();
  } else if (viewName === 'profile') {
    document.getElementById('viewProfile').classList.add('active');
    document.getElementById('topbarTitle').textContent = 'Candidate Profile & Attributes Ledger';
    document.getElementById('topbarSubtitle').textContent = 'Master persona, compensation baselines, professional references, and discovered form attributes';
    fetchProfileAttributes();
  } else if (viewName === 'criteria') {
    document.getElementById('viewCriteria').classList.add('active');
    document.getElementById('topbarTitle').textContent = 'Personalization & Decision Criteria';
    document.getElementById('topbarSubtitle').textContent = 'Candidate persona, screening disclosures, triage boundaries, and compensation parameters';
    fetchCriteria();
  } else if (viewName === 'websites') {
    document.getElementById('viewWebsites').classList.add('active');
    document.getElementById('topbarTitle').textContent = 'Websites Directory';
    document.getElementById('topbarSubtitle').textContent = 'Master portals, credentials & bot authentication';
    fetchWebsites();
  } else if (viewName === 'companies') {
    document.getElementById('viewCompanies').classList.add('active');
    document.getElementById('topbarTitle').textContent = 'Companies Master';
    document.getElementById('topbarSubtitle').textContent = 'Application frequencies & employer tracking';
    fetchCompanies();
  } else if (viewName === 'schedule') {
    document.getElementById('viewSchedule').classList.add('active');
    document.getElementById('topbarTitle').textContent = 'Daily Schedule & Batch Runs';
    document.getElementById('topbarSubtitle').textContent = 'Recorded batch processing history & autonomous daily crawler';
    fetchScheduleAndRuns();
  } else if (viewName === 'settings') {
    document.getElementById('viewSettings').classList.add('active');
    document.getElementById('topbarTitle').textContent = 'System Settings & Agent';
    document.getElementById('topbarSubtitle').textContent = 'Sub-agent runtime, model reasoning levels, and diagnostic controls';
    fetchAgentStatus();
    fetchSystemStatus();
  } else if (viewName === 'errors') {
    document.getElementById('viewErrors').classList.add('active');
    document.getElementById('topbarTitle').textContent = 'System Errors & Observability';
    document.getElementById('topbarSubtitle').textContent = 'Live diagnostic error stream, CDP browser crashes, and submission roadblocks';
    fetchSystemErrors();
  }
}

function formatTimestamp(ts) {
  if (!ts) return '-';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toISOString().replace('T', ' ').slice(0, 16);
  } catch {
    return String(ts);
  }
}

/* =========================================================
   VIEW 1: JOBS TABLE & WORKFLOW
   ========================================================= */
function toggleJobsTabDropdown(e) {
  e.stopPropagation();
  const menu = document.getElementById('jobsTabMenu');
  if (!menu) return;
  const isHidden = menu.style.display === 'none';
  document.querySelectorAll('.shadcn-dropdown-menu, .column-popover, .popover-menu').forEach(el => el.style.display = 'none');
  if (isHidden) {
    menu.style.display = 'block';
  }
}

function selectJobsTabFromMenu(tab) {
  switchJobsTab(tab);
  const menu = document.getElementById('jobsTabMenu');
  if (menu) menu.style.display = 'none';
}

function updateJobsTabUI(activeTab) {
  const triggerLabel = document.getElementById('jobsTabTriggerLabel');
  const optEl = document.getElementById('opt' + activeTab.charAt(0).toUpperCase() + activeTab.slice(1));
  if (triggerLabel && optEl) {
    triggerLabel.textContent = optEl.textContent;
  }

  const menu = document.getElementById('jobsTabMenu');
  if (menu) {
    menu.querySelectorAll('.shadcn-dropdown-item').forEach(item => {
      const itemTab = item.getAttribute('data-tab');
      const isActive = itemTab === activeTab;
      item.classList.toggle('active', isActive);
      const checkEl = item.querySelector('.item-check');
      if (checkEl) checkEl.style.display = isActive ? 'inline-flex' : 'none';
    });
  }
}

function switchJobsTab(tab) {
  currentJobsTab = tab;
  const tabSelect = document.getElementById('jobsTabSelect');
  if (tabSelect && tabSelect.value !== tab) {
    tabSelect.value = tab;
  }
  selectedJobUuids.clear();
  const selectAllEl = document.getElementById('selectAllJobsCheckbox');
  if (selectAllEl) selectAllEl.checked = false;
  updateJobsTabUI(tab);
  updateBatchActionBar();
  renderJobsTable();
}

async function fetchJobs() {
  try {
    const res = await fetch('/api/jobs');
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      jobsData = json.data;
      renderJobsTable();
      updateCounts();
      document.getElementById('badgeJobsCount').textContent = jobsData.length;
    } else {
      document.getElementById('jobsTbody').innerHTML = `
        <tr><td colspan="15" class="loading-cell">Failed to load data: ${escapeHtml(json.error || 'Unknown error')}</td></tr>
      `;
    }
  } catch (err) {
    document.getElementById('jobsTbody').innerHTML = `
      <tr><td colspan="15" class="loading-cell">Network error connecting to backend: ${escapeHtml(err.message)}</td></tr>
    `;
  }
}

function updateCounts() {
  const countAll = jobsData.length;
  const countReview = jobsData.filter(j => {
    const st = (j.status || 'CRAWLED').toUpperCase();
    return st === 'PENDING_HUMAN' || st === 'CRAWLED' || st === 'SKIPPED' || st === 'SKIPPED_SALARY';
  }).length;
  const countPending = jobsData.filter(j => {
    const st = (j.status || '').toUpperCase();
    return st === 'APPROVED' || st === 'FAILED';
  }).length;
  const countSubmitted = jobsData.filter(j => {
    const st = (j.status || '').toUpperCase();
    return st === 'APPLIED' || st === 'SUBMITTED (NOT VERIFY-ABLE)' || st === 'APPLYING' || st === 'INTERVIEW' || st === 'OFFER' || st === 'OFFER_ACCEPTED' || st === 'OFFER_DECLINED';
  }).length;
  const countDropped = jobsData.filter(j => {
    const st = (j.status || '').toUpperCase();
    return st === 'DROPPED' || st === 'REJECTED';
  }).length;

  const setOpt = (id, label, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${label} (${val})`;
  };
  setOpt('optReview', 'Review', countReview);
  setOpt('optPending', 'Pending Jobs', countPending);
  setOpt('optSubmitted', 'Submitted', countSubmitted);
  setOpt('optDropped', 'Filtered', countDropped);
  setOpt('optAll', 'All', countAll);

  // Sync Shadcn Dropdown items
  setOpt('menuOptReview', 'Review', countReview);
  setOpt('menuOptPending', 'Pending Jobs', countPending);
  setOpt('menuOptSubmitted', 'Submitted', countSubmitted);
  setOpt('menuOptDropped', 'Filtered', countDropped);
  setOpt('menuOptAll', 'All', countAll);

  updateJobsTabUI(currentJobsTab);

  const setBadge = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setBadge('countAll', countAll);
  setBadge('countReview', countReview);
  setBadge('countPending', countPending);
  setBadge('countSubmitted', countSubmitted);
  setBadge('countDropped', countDropped);
}

function updateSelectionStatus() {
  const selectionStatusEl = document.getElementById('jobsSelectionStatus');
  if (selectionStatusEl) {
    const visibleCount = document.querySelectorAll('#jobsTbody tr:not(.loading-cell)').length;
    selectionStatusEl.innerHTML = `<span class="count-highlight">${selectedJobUuids.size}</span> of ${visibleCount} row(s) selected.`;
  }
}

function updateSelectAllCheckboxState() {
  const selectAllEl = document.getElementById('selectAllJobsCheckbox');
  if (!selectAllEl) return;
  const visibleCheckboxes = document.querySelectorAll('.job-row-checkbox');
  if (visibleCheckboxes.length === 0) {
    selectAllEl.checked = false;
    selectAllEl.indeterminate = false;
    return;
  }
  let checkedCount = 0;
  visibleCheckboxes.forEach(cb => {
    if (cb.checked) checkedCount++;
  });
  if (checkedCount === 0) {
    selectAllEl.checked = false;
    selectAllEl.indeterminate = false;
  } else if (checkedCount === visibleCheckboxes.length) {
    selectAllEl.checked = true;
    selectAllEl.indeterminate = false;
  } else {
    selectAllEl.checked = false;
    selectAllEl.indeterminate = true;
  }
}

function handleJobRowCheckChange(el) {
  const uuid = el.value;
  const tr = el.closest('tr');
  if (el.checked) {
    selectedJobUuids.add(uuid);
    if (tr) tr.classList.add('row-selected');
  } else {
    selectedJobUuids.delete(uuid);
    if (tr) tr.classList.remove('row-selected');
  }
  updateBatchActionBar();
  updateSelectionStatus();
  updateSelectAllCheckboxState();
}

function toggleSelectAllJobs(checked) {
  const visibleCheckboxes = document.querySelectorAll('.job-row-checkbox');
  visibleCheckboxes.forEach(cb => {
    cb.checked = checked;
    const tr = cb.closest('tr');
    if (checked) {
      selectedJobUuids.add(cb.value);
      if (tr) tr.classList.add('row-selected');
    } else {
      selectedJobUuids.delete(cb.value);
      if (tr) tr.classList.remove('row-selected');
    }
  });
  updateBatchActionBar();
  updateSelectionStatus();
}

function clearJobSelection() {
  selectedJobUuids.clear();
  const selectAllEl = document.getElementById('selectAllJobsCheckbox');
  if (selectAllEl) {
    selectAllEl.checked = false;
    selectAllEl.indeterminate = false;
  }
  document.querySelectorAll('.job-row-checkbox').forEach(cb => {
    cb.checked = false;
    const tr = cb.closest('tr');
    if (tr) tr.classList.remove('row-selected');
  });
  updateBatchActionBar();
  updateSelectionStatus();
}

function updateBatchActionBar() {
  const bar = document.getElementById('batchActionBar');
  const countEl = document.getElementById('batchSelectedCount');
  const buttonsEl = document.getElementById('batchActionButtons');
  if (!bar || !countEl || !buttonsEl) return;

  const count = selectedJobUuids.size;
  countEl.textContent = count;

  if (count === 0) {
    bar.style.display = 'none';
    return;
  }

  // Append batch action controls inline next to Columns button (never hide existing controls)
  bar.style.display = 'inline-flex';

  if (currentJobsTab === 'review') {
    buttonsEl.innerHTML = `
      <button class="btn-batch btn-batch-approve" onclick="executeBatchAction('APPROVED')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Approve Selected (${count})
      </button>
      <button class="btn-batch btn-batch-drop" onclick="executeBatchAction('DROPPED')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        Drop Selected (${count})
      </button>
    `;
  } else if (currentJobsTab === 'pending') {
    buttonsEl.innerHTML = `
      <button class="btn-batch btn-batch-submit" onclick="executeBatchSubmit()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        Run &amp; Submit Selected (${count})
      </button>
      <button class="btn-batch btn-batch-drop" onclick="executeBatchAction('DROPPED')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        Drop Selected (${count})
      </button>
    `;
  } else if (currentJobsTab === 'dropped') {
    buttonsEl.innerHTML = `
      <button class="btn-batch btn-batch-restore" onclick="executeBatchAction('PENDING_HUMAN')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
        Restore Selected to Review (${count})
      </button>
    `;
  } else {
    buttonsEl.innerHTML = `
      <button class="btn-batch btn-batch-approve" onclick="executeBatchAction('APPROVED')">
        Approve Selected (${count})
      </button>
      <button class="btn-batch btn-batch-submit" onclick="executeBatchSubmit()">
        Run &amp; Submit Selected (${count})
      </button>
      <button class="btn-batch btn-batch-drop" onclick="executeBatchAction('DROPPED')">
        Drop Selected (${count})
      </button>
    `;
  }
}

async function executeBatchAction(targetStatus) {
  if (selectedJobUuids.size === 0) return;
  const count = selectedJobUuids.size;

  if (targetStatus === 'DROPPED') {
    const confirmed = confirm(`Are you sure you want to drop ${count} selected job(s)?\n\nThey will be moved to the Filtered list and excluded from active applications.`);
    if (!confirmed) return;
  }

  const uuids = Array.from(selectedJobUuids);
  try {
    const res = await fetch('/api/jobs/batch-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobIds: uuids, status: targetStatus })
    });
    const json = await res.json();
    if (json.success) {
      clearJobSelection();
      await fetchJobs();
      if (targetStatus === 'APPROVED' && currentJobsTab === 'review') {
        switchJobsTab('pending');
      } else if (targetStatus === 'DROPPED' && (currentJobsTab === 'review' || currentJobsTab === 'pending')) {
        switchJobsTab('dropped');
      } else if (targetStatus === 'PENDING_HUMAN' && currentJobsTab === 'dropped') {
        switchJobsTab('review');
      }
    } else {
      alert(`Batch action failed: ${json.error || 'Unknown error'}`);
    }
  } catch (err) {
    alert(`Network error: ${err.message}`);
  }
}

async function executeBatchSubmit() {
  if (selectedJobUuids.size === 0) return;
  const uuids = Array.from(selectedJobUuids);
  try {
    const res = await fetch('/api/jobs/batch-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobIds: uuids })
    });
    const json = await res.json();
    if (json.success) {
      clearJobSelection();
      await fetchJobs();
      switchJobsTab('submitted');
    } else {
      alert(`Batch submission error: ${json.error || 'Unknown error'}`);
    }
  } catch (err) {
    alert(`Network error: ${err.message}`);
  }
}

async function handleDirectSubmit(jobUuid) {
  try {
    const res = await fetch(`/api/jobs/${encodeURIComponent(jobUuid)}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const json = await res.json();
    if (json.success) {
      await fetchJobs();
      switchJobsTab('submitted');
    } else {
      alert(`Submission error: ${json.error || 'Unknown error'}`);
    }
  } catch (err) {
    alert(`Network error: ${err.message}`);
  }
}

function renderJobsTable() {
  const tbody = document.getElementById('jobsTbody');
  const search = document.getElementById('searchInput').value.toLowerCase().trim();

  const filtered = jobsData.filter(item => {
    const st = (item.status || 'CRAWLED').toUpperCase();
    if (currentJobsTab === 'review') {
      if (st !== 'PENDING_HUMAN' && st !== 'CRAWLED' && st !== 'SKIPPED' && st !== 'SKIPPED_SALARY') return false;
    } else if (currentJobsTab === 'pending') {
      if (st !== 'APPROVED' && st !== 'FAILED') return false;
    } else if (currentJobsTab === 'submitted') {
      if (st !== 'APPLIED' && st !== 'SUBMITTED (NOT VERIFY-ABLE)' && st !== 'APPLYING' && st !== 'INTERVIEW' && st !== 'OFFER' && st !== 'OFFER_ACCEPTED' && st !== 'OFFER_DECLINED') return false;
    } else if (currentJobsTab === 'dropped') {
      if (st !== 'DROPPED' && st !== 'REJECTED') return false;
    }
    // 'all' includes everything

    if (!search) return true;

    const haystack = [
      item.company,
      item.title,
      item.portal,
      item.status,
      item.location,
      item.tech_stack,
      item.benefits,
      item.company_overview,
      item.requirements_summary,
      item.market_salary_benchmark
    ].join(' ').toLowerCase();

    return haystack.includes(search);
  });

  document.getElementById('jobsFooterSummary').textContent = `Showing ${filtered.length} of ${jobsData.length} records`;
  updateSelectionStatus();

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="15" class="loading-cell">No matching job records found in this stage.</td></tr>`;
    updateSelectAllCheckboxState();
    return;
  }

  tbody.innerHTML = '';

  filtered.forEach(item => {
    const tr = document.createElement('tr');
    const isChecked = selectedJobUuids.has(item.uuid);
    if (isChecked) {
      tr.classList.add('row-selected');
    }

    const tags = (item.tech_stack || '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
      .slice(0, 4)
      .map(t => `<span class="tech-tag">${escapeHtml(t)}</span>`)
      .join('');

    const currentStatus = (item.status || 'CRAWLED').toUpperCase();
    let statusClass = 'crawled';
    if (currentStatus === 'APPROVED') statusClass = 'approved';
    else if (currentStatus === 'PENDING_HUMAN') statusClass = 'pending_human';
    else if (currentStatus === 'APPLYING') statusClass = 'applying';
    else if (currentStatus === 'FAILED') statusClass = 'failed';
    else if (currentStatus === 'APPLIED' || currentStatus === 'SUBMITTED (NOT VERIFY-ABLE)') statusClass = 'applied';
    else if (currentStatus === 'INTERVIEW') statusClass = 'interview';
    else if (currentStatus === 'OFFER' || currentStatus === 'OFFER_ACCEPTED') statusClass = 'offer';
    else if (currentStatus === 'REJECTED' || currentStatus === 'OFFER_DECLINED') statusClass = 'rejected';
    else if (currentStatus === 'DROPPED') statusClass = 'dropped';
    else if (currentStatus === 'SKIPPED' || currentStatus === 'SKIPPED_SALARY') statusClass = 'skipped';

    // Parse histories count
    let historiesList = [];
    try {
      historiesList = JSON.parse(item.histories || '[]');
    } catch {}
    const historyCount = historiesList.length;

    let actionBtnHtml = '';
    if (currentJobsTab === 'pending' || currentStatus === 'APPROVED') {
      actionBtnHtml = `
        <button class="btn-primary" style="padding: 5px 10px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" onclick="handleDirectSubmit('${escapeHtml(item.uuid)}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          Run &amp; Submit
        </button>
      `;
    } else {
      actionBtnHtml = `
        <button class="btn-action-popover" onclick="openActionPopover(event, '${escapeHtml(item.uuid)}')">
          Action &blacktriangledown;
        </button>
      `;
    }

    tr.innerHTML = `
      <td class="col-checkbox">
        <input type="checkbox" class="shadcn-checkbox job-row-checkbox" value="${escapeHtml(item.uuid)}" ${isChecked ? 'checked' : ''} onchange="handleJobRowCheckChange(this)">
      </td>
      <td class="col-sticky-company col-company">
        <button class="company-title-btn" onclick="openCompanyModal('${escapeHtml(item.uuid)}')">
          ${escapeHtml(item.company)} &rsaquo;
        </button>
        <div class="company-meta-row">
          <span class="company-sub-text">${escapeHtml(item.industry || 'Technology')}</span>
        </div>
      </td>
      <td class="col-role">${escapeHtml(item.title)}</td>
      <td class="col-platform">
        <div class="platform-name">${escapeHtml(item.portal || 'Jobstreet')}</div>
        <a href="${item.job_url}" target="_blank" rel="noreferrer" class="platform-job-link">
          View Post &nearr;
        </a>
      </td>
      <td class="col-location">${escapeHtml(item.location || '-')}</td>
      <td class="col-salary">${escapeHtml(item.salary_raw || 'Undisclosed')}</td>
      <td class="col-market-salary">
        <div class="market-salary-val">${escapeHtml(item.market_salary_benchmark || 'Under Survey')}</div>
        <div class="market-salary-src">${escapeHtml(item.benchmark_source || 'Industry Benchmark')}</div>
      </td>
      <td class="col-exp">${escapeHtml(item.experience_req || '-')}</td>
      <td class="col-stack">${tags || '<span style="color:#ffffff">General</span>'}</td>
      <td class="col-details">
        <button class="btn-tabbed-details" onclick="openDetailsModal('${escapeHtml(item.uuid)}')">
          View Details
        </button>
      </td>
      <td class="col-actions">
        ${actionBtnHtml}
      </td>
      <td class="col-status">
        <span class="status-badge ${statusClass}">${escapeHtml(currentStatus)}</span>
        ${item.last_error ? `
          <div class="status-error-snippet" title="${escapeHtml(item.last_error)}" onclick="openDetailsModal('${escapeHtml(item.uuid)}', 4)" style="font-size: 10.5px; color: #a1a1aa; margin-top: 4px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; text-decoration: underline;">
            ${escapeHtml(item.last_error.slice(0, 32))}...
          </div>
        ` : ''}
      </td>
      <td class="col-histories">
        <button class="btn-history-tag" onclick="openHistoriesModal('${escapeHtml(item.uuid)}')">
          ${historyCount} ${historyCount === 1 ? 'event' : 'events'}
        </button>
      </td>
      <td class="col-timestamp col-crawled">${formatTimestamp(item.created_at)}</td>
      <td class="col-timestamp col-applied">${formatTimestamp(item.applied_at)}</td>
    `;

    tbody.appendChild(tr);
  });

  applyColumnVisibility();
  updateSelectAllCheckboxState();
}

/* =========================================================
   COLUMN VISIBILITY TOGGLING (Shadcn Dropdown Menu)
   ========================================================= */
const columnDefinitions = [
  { key: 'role', label: 'Role Title', selector: '.col-role' },
  { key: 'platform', label: 'Platform & Link', selector: '.col-platform' },
  { key: 'location', label: 'Location', selector: '.col-location' },
  { key: 'salary', label: 'Listed Salary', selector: '.col-salary' },
  { key: 'marketSalary', label: 'Market Benchmark', selector: '.col-market-salary' },
  { key: 'exp', label: 'Experience Req', selector: '.col-exp' },
  { key: 'stack', label: 'Tech Stack', selector: '.col-stack' },
  { key: 'details', label: 'Details Dossier', selector: '.col-details' },
  { key: 'actions', label: 'Decision Action', selector: '.col-actions' },
  { key: 'status', label: 'Status Badge', selector: '.col-status' },
  { key: 'histories', label: 'Status Histories', selector: '.col-histories' },
  { key: 'crawled', label: 'Crawled At Timestamp', selector: '.col-crawled' },
  { key: 'applied', label: 'Applied At Timestamp', selector: '.col-applied' }
];

function toggleColumnMenu(e) {
  e.stopPropagation();
  const popover = document.getElementById('columnPopover');
  if (popover.style.display === 'block') {
    popover.style.display = 'none';
    return;
  }

  // Close any other open dropdowns
  const jobsTabMenu = document.getElementById('jobsTabMenu');
  if (jobsTabMenu) jobsTabMenu.style.display = 'none';
  const actionPopover = document.getElementById('actionPopover');
  if (actionPopover) actionPopover.style.display = 'none';

  const rect = e.currentTarget.getBoundingClientRect();
  popover.style.top = `${rect.bottom + 6}px`;
  popover.style.right = `${window.innerWidth - rect.right}px`;
  popover.style.left = 'auto';

  renderColumnOptions();
  popover.style.display = 'block';
}

function renderColumnOptions() {
  const listEl = document.getElementById('columnOptionsList');
  if (!listEl) return;
  listEl.innerHTML = '';

  columnDefinitions.forEach(col => {
    const isVisible = columnVisibility[col.key] !== false;
    const item = document.createElement('div');
    item.className = `shadcn-dropdown-item ${isVisible ? 'active' : ''}`;
    item.onclick = (e) => {
      e.stopPropagation();
      toggleColumn(col.key);
      renderColumnOptions();
    };
    item.innerHTML = `
      <span>${escapeHtml(col.label)}</span>
      <span class="item-check" style="${isVisible ? 'display: inline-flex;' : 'display: none;'}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </span>
    `;
    listEl.appendChild(item);
  });
}

function toggleColumn(key) {
  columnVisibility[key] = !columnVisibility[key];
  localStorage.setItem('ats_column_visibility', JSON.stringify(columnVisibility));
  applyColumnVisibility();
}

function applyColumnVisibility() {
  columnDefinitions.forEach(col => {
    const isVisible = columnVisibility[col.key] !== false;
    document.querySelectorAll(col.selector).forEach(el => {
      el.style.display = isVisible ? '' : 'none';
    });
  });
}

/* =========================================================
   SHADCN ACTION POPOVER (Unidirectional Workflow Lifecycle)
   ========================================================= */
function openActionPopover(e, jobUuid) {
  e.stopPropagation();
  activeActionJobUuid = jobUuid;
  const item = jobsData.find(j => j.uuid === jobUuid || String(j.id) === jobUuid);
  if (!item) return;

  const currentStatus = (item.status || 'CRAWLED').toUpperCase();
  const popover = document.getElementById('actionPopover');

  let actionsHtml = `
    <div class="popover-header">Stage: ${escapeHtml(currentStatus)}</div>
    <div class="popover-group-title">Next Valid Action</div>
  `;

  if (currentStatus === 'CRAWLED' || currentStatus === 'PENDING_HUMAN' || currentStatus === 'SKIPPED' || currentStatus === 'SKIPPED_SALARY') {
    actionsHtml += `
      <button class="popover-item" onclick="handlePopoverTransition('APPROVED')">
        <span class="status-dot dot-applied"></span> Approve Job (Move to Pending Jobs)
      </button>
      <button class="popover-item" onclick="handlePopoverTransition('DROPPED')">
        <span class="status-dot dot-dropped"></span> Drop Job
      </button>
    `;
  } else if (currentStatus === 'APPROVED') {
    actionsHtml += `
      <button class="popover-item highlight" onclick="handlePopoverSubmit('${escapeHtml(item.uuid)}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        Run &amp; Submit Application
      </button>
      <button class="popover-item" onclick="handlePopoverTransition('DROPPED')">
        <span class="status-dot dot-dropped"></span> Drop Job
      </button>
    `;
  } else if (currentStatus === 'APPLYING') {
    actionsHtml += `
      <button class="popover-item" disabled style="opacity: 0.6; cursor: not-allowed;">
        <span class="status-dot dot-interview"></span> Submission in Progress...
      </button>
    `;
  } else if (currentStatus === 'FAILED') {
    actionsHtml += `
      <button class="popover-item highlight" onclick="handlePopoverSubmit('${escapeHtml(item.uuid)}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
        Retry Submission
      </button>
      <button class="popover-item" onclick="handlePopoverTransition('DROPPED')">
        <span class="status-dot dot-dropped"></span> Drop Job
      </button>
    `;
  } else if (currentStatus === 'APPLIED' || currentStatus === 'SUBMITTED (NOT VERIFY-ABLE)') {
    actionsHtml += `
      <button class="popover-item" onclick="handlePopoverTransition('INTERVIEW')">
        <span class="status-dot dot-interview"></span> Advance to INTERVIEW
      </button>
      <button class="popover-item" onclick="handlePopoverTransition('REJECTED')">
        <span class="status-dot dot-rejected"></span> Mark REJECTED
      </button>
      <button class="popover-item" onclick="handlePopoverTransition('DROPPED')">
        <span class="status-dot dot-dropped"></span> Mark DROPPED
      </button>
    `;
  } else if (currentStatus === 'INTERVIEW') {
    actionsHtml += `
      <button class="popover-item" onclick="handlePopoverTransition('OFFER')">
        <span class="status-dot dot-offer"></span> Advance to OFFER
      </button>
      <button class="popover-item" onclick="handlePopoverTransition('REJECTED')">
        <span class="status-dot dot-rejected"></span> Mark REJECTED
      </button>
      <button class="popover-item" onclick="handlePopoverTransition('DROPPED')">
        <span class="status-dot dot-dropped"></span> Mark DROPPED
      </button>
    `;
  } else if (currentStatus === 'OFFER') {
    actionsHtml += `
      <button class="popover-item" onclick="handlePopoverTransition('OFFER_ACCEPTED')">
        <span class="status-dot dot-applied"></span> Mark OFFER ACCEPTED
      </button>
      <button class="popover-item" onclick="handlePopoverTransition('OFFER_DECLINED')">
        <span class="status-dot dot-dropped"></span> Mark OFFER DECLINED
      </button>
      <button class="popover-item" onclick="handlePopoverTransition('DROPPED')">
        <span class="status-dot dot-dropped"></span> Mark DROPPED
      </button>
    `;
  } else if (currentStatus === 'DROPPED') {
    actionsHtml += `
      <button class="popover-item" onclick="handlePopoverTransition('PENDING_HUMAN')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
        Restore to Review
      </button>
    `;
  } else {
    actionsHtml += `
      <div style="font-size: 11px; color: #a1a1aa; padding: 6px 10px;">
        Workflow terminal state reached
      </div>
    `;
  }

  actionsHtml += `
    <div class="popover-divider"></div>
    <button class="popover-item danger" onclick="handlePopoverSoftDelete()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
      Soft Delete Job
    </button>
  `;

  popover.innerHTML = actionsHtml;

  const rect = e.currentTarget.getBoundingClientRect();
  popover.style.top = `${rect.bottom + 4}px`;
  popover.style.left = `${Math.min(rect.left, window.innerWidth - 230)}px`;
  popover.style.display = 'flex';
}

async function handlePopoverTransition(newStatus) {
  if (!activeActionJobUuid) return;
  const item = jobsData.find(j => j.uuid === activeActionJobUuid || String(j.id) === activeActionJobUuid);

  if (newStatus === 'DROPPED') {
    const jobTitle = item ? `${item.company} - ${item.title}` : 'this job';
    const confirmed = confirm(`Are you sure you want to drop this application draft?\n\n${jobTitle}\n\nIt will be moved to the Filtered list.`);
    if (!confirmed) return;
  }

  document.getElementById('actionPopover').style.display = 'none';

  try {
    const res = await fetch(`/api/jobs/${activeActionJobUuid}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const result = await res.json();
    if (result.success) {
      await fetchJobs();
      if (newStatus === 'DROPPED' && (currentJobsTab === 'review' || currentJobsTab === 'pending')) {
        switchJobsTab('dropped');
      } else if (newStatus === 'PENDING_HUMAN' && currentJobsTab === 'dropped') {
        switchJobsTab('review');
      }
    } else {
      alert('Workflow error: ' + (result.error || 'Server error'));
    }
  } catch (err) {
    alert('Failed to connect: ' + err.message);
  }
}

async function handlePopoverSubmit(uuid) {
  if (!uuid) return;
  document.getElementById('actionPopover').style.display = 'none';

  try {
    const res = await fetch(`/api/jobs/${uuid}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await res.json();
    if (result.success) {
      await fetchJobs();
    } else {
      alert('Application submission failed: ' + (result.error || 'Server error'));
      await fetchJobs();
    }
  } catch (err) {
    alert('Failed to connect: ' + err.message);
    await fetchJobs();
  }
}

async function handlePopoverSoftDelete() {
  if (!activeActionJobUuid) return;
  document.getElementById('actionPopover').style.display = 'none';

  if (!confirm('Are you sure you want to soft-delete this job posting? It will be archived with full history preserved.')) {
    return;
  }

  try {
    const res = await fetch(`/api/jobs/${activeActionJobUuid}/soft-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Manual soft-delete via triage action menu' })
    });
    const result = await res.json();
    if (result.success) {
      await fetchJobs();
    } else {
      alert('Error soft-deleting job: ' + (result.error || 'Server error'));
    }
  } catch (err) {
    alert('Failed to connect: ' + err.message);
  }
}

/* =========================================================
   COMPRESSED DETAILS MODAL (TABS: SPECS, Q&A, BENEFITS)
   ========================================================= */
function openDetailsModal(jobUuid, defaultTab = 0) {
  const item = jobsData.find(j => j.uuid === jobUuid || String(j.id) === jobUuid);
  if (!item) return;

  const qList = (item.screening_questions || '').split(';').map(s => s.trim()).filter(Boolean);
  const aList = (item.candidate_answers || '').split(';').map(s => s.trim()).filter(Boolean);

  let qaCards = '';
  const maxQ = Math.max(qList.length, aList.length);
  for (let i = 0; i < maxQ; i++) {
    const q = qList[i] || `Screening Question #${i + 1}`;
    const a = aList[i] || 'Proficient / Qualified';
    qaCards += `
      <div class="modal-qa-card">
        <div class="modal-qa-q">${escapeHtml(q)}</div>
        <div class="modal-qa-a">Proposed Answer: ${escapeHtml(a)}</div>
      </div>
    `;
  }

  const rawBenefits = item.benefits || '';
  const benefitItems = rawBenefits
    ? rawBenefits
        .split(/\r?\n|;/g)
        .map(b => b.replace(/^[\s\-\*•\u2022\d\.\)]+/, '').trim())
        .filter(b => b.length > 0)
    : [];

  const benefitsHtml = benefitItems.length > 0
    ? benefitItems.map(b => `
      <div style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; background: #18181b; border: 1px solid #27272a; border-radius: 6px; margin-bottom: 8px; line-height: 1.5;">
        <span style="color: #71717a; font-size: 14px; line-height: 1.4; user-select: none;">&bull;</span>
        <span style="color: #f4f4f5; font-size: 13px; font-weight: 400;">${escapeHtml(b)}</span>
      </div>
    `).join('')
    : '<div style="color: #a1a1aa; font-size: 13px; padding: 12px 14px; background: #18181b; border: 1px solid #27272a; border-radius: 6px;">No specific perks or benefits itemized by employer.</div>';

  const html = `
    <div class="modal-tabs-nav">
      <button class="modal-tab-btn" onclick="switchModalTab(0)">Specifications</button>
      <button class="modal-tab-btn" onclick="switchModalTab(1)">Form Fill Preview</button>
      <button class="modal-tab-btn" onclick="switchModalTab(2)">Benefits &amp; Perks (${benefitItems.length})</button>
      <button class="modal-tab-btn" onclick="switchModalTab(3)">Tailored Resume (PDF)</button>
      <button class="modal-tab-btn" onclick="switchModalTab(4)">Cover Letter</button>
      <button class="modal-tab-btn" onclick="switchModalTab(5)">Submission Proof</button>
    </div>

    <!-- TAB 0: Specifications -->
    <div id="tabPane0" class="modal-tab-pane">
      <div class="modal-grid">
        <div class="modal-grid-item">
          <div class="modal-grid-label">Experience Required</div>
          <div class="modal-grid-value">${escapeHtml(item.experience_req || 'Not specified')}</div>
        </div>
        <div class="modal-grid-item">
          <div class="modal-grid-label">Listed Salary</div>
          <div class="modal-grid-value">${escapeHtml(item.salary_raw || 'Undisclosed')}</div>
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">Reliable Market Salary Benchmark</div>
        <div style="font-size: 15px; font-weight: 700; color: #ffffff;">${escapeHtml(item.market_salary_benchmark || 'Under Survey')}</div>
        <div style="font-size: 12px; color: #ffffff; margin-top: 3px;">Source: ${escapeHtml(item.benchmark_source || 'Industry Standard')}</div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">Detected Technologies</div>
        <div style="margin-top: 6px;">
          ${(item.tech_stack || '').split(',').map(t => `<span class="tech-tag">${escapeHtml(t.trim())}</span>`).join(' ')}
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">Verbatim Job Specifications &amp; Responsibilities</div>
        <div style="white-space: pre-wrap; word-break: break-word; color: #ffffff; line-height: 1.6;">${escapeHtml(item.full_description || item.requirements_summary || 'No detailed specifications found.')}</div>
      </div>
    </div>

    <!-- TAB 1: Form Fill Preview -->
    <div id="tabPane1" class="modal-tab-pane">
      <div id="formPreviewBox-${item.uuid}">
        <div style="padding: 30px; text-align: center; color: #a1a1aa; font-size: 13px;">
          Resolving form fill preview against live application requirements...
        </div>
      </div>
    </div>

    <!-- TAB 2: Benefits -->
    <div id="tabPane2" class="modal-tab-pane">
      <div class="modal-section">
        <div class="modal-section-title">Itemized Compensation &amp; Perks Package</div>
        <div style="margin-top: 10px;">
          ${benefitsHtml}
        </div>
      </div>
    </div>

    <!-- TAB 3: Tailored Resume (PDF) -->
    <div id="tabPane3" class="modal-tab-pane">
      <div class="modal-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <div class="modal-section-title" style="margin-bottom: 2px;">ATS-Optimized Tailored Resume</div>
            <div style="font-size: 12px; color: #ffffff;">Generated with matched keywords tailored to ${escapeHtml(item.company)}.</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <a href="/api/jobs/${item.uuid}/pdf" download class="btn-primary" style="text-decoration: none; padding: 6px 12px; font-size: 12px;">
              Download PDF
            </a>
            <a href="/api/jobs/${item.uuid}/pdf" target="_blank" class="btn-secondary" style="text-decoration: none; padding: 6px 12px; font-size: 12px;">
              Open PDF &nearr;
            </a>
          </div>
        </div>
        <div style="border: 1px solid var(--border-strong); border-radius: 6px; overflow: hidden; height: 520px; background: #ffffff;">
          <iframe src="/api/jobs/${item.uuid}/pdf" style="width: 100%; height: 100%; border: none;"></iframe>
        </div>
      </div>
    </div>

    <!-- TAB 4: Cover Letter -->
    <div id="tabPane4" class="modal-tab-pane">
      <div class="modal-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <div class="modal-section-title" style="margin-bottom: 2px;">Tailored Cover Letter</div>
            <div style="font-size: 12px; color: #ffffff;">Customized narrative for ${escapeHtml(item.company)} based on candidate profile.</div>
          </div>
          <button class="btn-secondary" onclick="copyCoverLetterText('${item.uuid}')">
            Copy to Clipboard
          </button>
        </div>
        <div id="coverLetterBox-${item.uuid}" style="background-color: var(--bg-app); border: 1px solid var(--border-strong); border-radius: 6px; padding: 18px; font-size: 13.5px; line-height: 1.7; color: #ffffff; white-space: pre-wrap;">
          Loading tailored cover letter...
        </div>
      </div>
    </div>

    <!-- TAB 5: Submission Proof & Roadblock Diagnostics -->
    <div id="tabPane5" class="modal-tab-pane">
      <div class="modal-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <div class="modal-section-title" style="margin-bottom: 2px;">Submission Verification &amp; Roadblock Diagnostics</div>
            <div style="font-size: 12px; color: #ffffff;">Visual evidence, prerequisite gates, and confirmation captured directly from live session.</div>
          </div>
          ${item.applied_at ? `<div style="font-size: 12px; color: #a1a1aa;">Submitted: ${formatTimestamp(item.applied_at)}</div>` : ''}
        </div>

        ${item.status === 'FAILED' || item.last_error ? `
          <!-- Roadblock Diagnostic Alert Banner -->
          <div style="margin-bottom: 14px; background: #18181b; border: 1px solid #52525b; border-radius: 6px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
              <span class="status-badge failed" style="font-size: 11px;">SUBMISSION ROADBLOCK DETECTED</span>
              ${item.roadblock_url ? `
                <a href="${escapeHtml(item.roadblock_url)}" target="_blank" class="btn-primary" style="text-decoration: none; padding: 4px 10px; font-size: 11px;">
                  Open Roadblock Page in Browser &nearr;
                </a>
              ` : ''}
            </div>
            <div style="font-size: 13px; font-weight: 600; color: #ffffff; line-height: 1.5; margin-bottom: 8px;">
              ${escapeHtml(item.last_error || 'Submission halted by platform requirement.')}
            </div>
            ${item.roadblock_url ? `
              <div style="font-size: 11.5px; font-family: monospace; color: #a1a1aa; background: #09090b; padding: 8px 10px; border-radius: 4px; border: 1px solid #27272a; word-break: break-all; margin-bottom: 10px;">
                Prerequisite URL: <a href="${escapeHtml(item.roadblock_url)}" target="_blank" style="color: #ffffff; text-decoration: underline;">${escapeHtml(item.roadblock_url)}</a>
              </div>
            ` : ''}
            <div style="display: flex; gap: 8px;">
              <button class="btn-secondary" onclick="runSubmission('${escapeHtml(item.uuid || item.id)}')" style="padding: 5px 12px; font-size: 11.5px;">
                Retry Pre-Scripted Submission
              </button>
              <a href="${escapeHtml(item.job_url)}" target="_blank" class="btn-secondary" style="text-decoration: none; padding: 5px 12px; font-size: 11.5px;">
                Open Portal Listing &nearr;
              </a>
            </div>
          </div>
        ` : ''}

        ${item.status === 'SUBMITTED (NOT VERIFY-ABLE)' ? `
          <!-- Unverifiable Portal Notice -->
          <div style="margin-bottom: 14px; background: #18181b; border: 1px solid #3f3f46; border-radius: 6px; padding: 14px;">
            <div style="margin-bottom: 6px;">
              <span class="status-badge" style="font-size: 11px; border-color: #52525b; color: #ffffff;">SUBMITTED (NOT VERIFY-ABLE)</span>
            </div>
            <div style="font-size: 12.5px; color: #d4d4d8; line-height: 1.5;">
              Application was submitted on <strong>${escapeHtml(item.portal || 'portal')}</strong>. This portal does not expose a public web application history ledger (verification requires their mobile application). Final form submit receipt modal was captured below.
            </div>
          </div>
        ` : ''}

        <div style="margin-bottom: 14px; background: var(--bg-app); border: 1px solid var(--border-strong); border-radius: 6px; padding: 14px;">
          <div style="font-size: 11px; text-transform: uppercase; color: #a1a1aa; font-weight: 700; margin-bottom: 4px;">Target Portal</div>
          <div style="font-size: 13.5px; font-weight: 600; color: #ffffff;"><a href="${escapeHtml(item.job_url)}" target="_blank" style="color: #ffffff; text-decoration: underline;">${escapeHtml(item.portal || 'Portal')} &nearr;</a></div>
        </div>
        <div style="border: 1px solid var(--border-strong); border-radius: 6px; overflow: hidden; background: #000000; padding: 8px; text-align: center;">
          <img src="/api/jobs/${item.uuid}/roadblock-screenshot" alt="Submission Session Screenshot" style="max-width: 100%; height: auto; border-radius: 4px;" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'padding: 40px; color: #a1a1aa; font-size: 13px;\\'>No external confirmation screenshot captured yet for this role. Submit the application to generate live proof.</div>';" />
        </div>
      </div>
    </div>
  `;

  showModal('JOB DOSSIER', item.title, item.company, html, true);
  switchModalTab(defaultTab);
  loadJobCoverLetter(item.uuid);
  loadJobFormPreview(item.uuid, item.salary_raw);
}

async function loadJobFormPreview(uuid, salaryRaw) {
  const box = document.getElementById(`formPreviewBox-${uuid}`);
  if (!box) return;
  try {
    const res = await fetch(`/api/jobs/${uuid}/form-preview`);
    const json = await res.json();
    if (!json.success || !json.data) {
      box.innerHTML = `<div style="padding: 24px; color: #a1a1aa; font-size: 13px;">Could not generate form preview: ${escapeHtml(json.error || 'Unknown error')}</div>`;
      return;
    }
    const d = json.data;
    const bid = d.expectedSalaryBid;

    const missingFields = [];
    d.groups.forEach(g => {
      g.fields.forEach(f => {
        if (f.required && (f.value.includes('[MISSING') || f.value.includes('[NOT SPECIFIED'))) {
          missingFields.push(f.label);
        }
      });
    });

    let alertBanner = '';
    if (missingFields.length > 0) {
      alertBanner = `
        <div style="background: #18181b; border: 1px solid #71717a; border-radius: 6px; padding: 14px 16px; margin-bottom: 18px;">
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #ffffff; margin-bottom: 4px;">
            Missing Portal Prerequisites (${missingFields.length})
          </div>
          <div style="font-size: 12.5px; color: #d4d4d8; line-height: 1.5;">
            This employer form mandates required files or inputs that are not present in your candidate profile. Application cannot proceed until these are supplied:
          </div>
          <ul style="margin: 6px 0 0 18px; padding: 0; font-size: 12px; color: #ffffff;">
            ${missingFields.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    let html = `
      ${alertBanner}
      <!-- Expected Salary Bid Banner -->
      <div style="background: #18181b; border: 1px solid #3f3f46; border-radius: 6px; padding: 16px 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; font-weight: 700; margin-bottom: 4px;">
              Calculated Monthly Salary Expectation Bid
            </div>
            <div style="font-size: 20px; font-weight: 700; color: #ffffff;">
              ${escapeHtml(bid.monthlyFormatted)}
            </div>
            <div style="font-size: 12px; color: #a1a1aa; margin-top: 4px;">
              ${escapeHtml(bid.basis)} • ${escapeHtml(bid.strategy)}
            </div>
          </div>
          <div style="text-align: right; font-size: 12px;">
            <div style="color: #71717a; text-transform: uppercase; font-size: 10.5px; font-weight: 700;">Employer Listed Range</div>
            <div style="color: #ffffff; font-weight: 600; margin-top: 3px; font-size: 13px;">${escapeHtml(salaryRaw || 'Undisclosed')}</div>
          </div>
        </div>
      </div>
    `;

    if (d.isBlocked) {
      html += `
        <div style="background: #27272a; border: 1px solid #71717a; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; gap: 16px;">
          <div>
            <div style="font-size: 12.5px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.04em;">Action Required: Submission &amp; Approval Blocked</div>
            <div style="font-size: 12px; color: #a1a1aa; margin-top: 3px;">
              ${d.unresolvedRequiredCount} mandatory application field(s) are NOT SPECIFIED in Candidate Profile. You must resolve all required fields before proceeding.
            </div>
          </div>
          <button type="button" class="btn btn-primary" onclick="closeModal(); switchView('profile');" style="padding: 6px 14px; font-size: 11.5px; background: #ffffff; color: #09090b; font-weight: 700; border-radius: 4px; border: 1px solid #ffffff; cursor: pointer; white-space: nowrap;">
            Resolve in Profile Table
          </button>
        </div>
      `;
    }

    // Render groups
    d.groups.forEach(g => {
      html += `
        <div class="modal-section" style="margin-bottom: 22px;">
          <div class="modal-section-title" style="font-size: 12px; font-weight: 700; color: #f4f4f5; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px; border-bottom: 1px solid #27272a; padding-bottom: 6px;">
            ${escapeHtml(g.groupName)}
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${g.fields.map(f => {
              const isMissing = f.required && (f.value.includes('[MISSING') || f.value.includes('[NOT SPECIFIED'));
              return `
              <div style="background: #18181b; border: 1px solid ${isMissing ? '#71717a' : '#27272a'}; border-radius: 6px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
                <div style="flex: 1; min-width: 0;">
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="font-size: 12.5px; color: #ffffff; font-weight: 600;">${escapeHtml(f.label)}</span>
                    ${isMissing
                      ? '<span style="font-size: 10px; padding: 1px 6px; background: #27272a; border: 1px solid #71717a; border-radius: 3px; color: #ffffff; font-weight: 700;">Action Required</span>'
                      : (f.required ? '<span style="font-size: 10px; padding: 1px 5px; background: #27272a; border: 1px solid #3f3f46; border-radius: 3px; color: #f4f4f5; font-weight: 500;">Required</span>' : '<span style="font-size: 10px; padding: 1px 5px; background: transparent; border: 1px solid #27272a; border-radius: 3px; color: #71717a;">Optional</span>')
                    }
                  </div>
                  ${f.description ? `<div style="font-size: 11px; color: #71717a; margin-top: 3px;">${escapeHtml(f.description)}</div>` : ''}
                  <div style="font-size: 13.5px; color: ${isMissing ? '#a1a1aa' : '#ffffff'}; font-weight: 500; margin-top: 5px; word-break: break-word; white-space: pre-wrap;">${escapeHtml(f.value)}</div>
                  ${f.note ? `<div style="font-size: 11px; color: #71717a; margin-top: 3px;">${escapeHtml(f.note)}</div>` : ''}

                  ${isMissing && f.key !== 'photo' && f.key !== 'photo_file' && f.key !== 'portfolio' && f.key !== 'portfolio_pdf' ? `
                    <div style="margin-top: 10px; display: flex; gap: 8px; align-items: center;">
                      <input type="text" id="inlineVal-${uuid}-${escapeHtml(f.key)}" placeholder="Specify ${escapeHtml(f.label)}..." style="background: #09090b; border: 1px solid #3f3f46; color: #ffffff; padding: 5px 8px; font-size: 11.5px; border-radius: 4px; flex: 1; max-width: 320px;">
                      <button type="button" class="btn btn-secondary" onclick="saveInlineProfileAttribute('${uuid}', '${escapeHtml(f.key)}', '${escapeHtml(salaryRaw || '')}')" style="padding: 5px 12px; font-size: 11px; background: #ffffff; color: #09090b; font-weight: 600; border-radius: 4px; border: 1px solid #ffffff; cursor: pointer;">Save</button>
                    </div>
                  ` : ''}

                  ${(f.key === 'photo_file' || f.key === 'photo') ? `
                    <div style="margin-top: 10px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                      <input type="file" id="photoInput-${uuid}" accept="image/jpeg,image/png" style="display:none" onchange="uploadCandidatePhoto(event, '${uuid}', '${escapeHtml(salaryRaw || '')}')">
                      <button type="button" class="btn btn-secondary" onclick="document.getElementById('photoInput-${uuid}').click()" style="padding: 4px 10px; font-size: 11px; background: ${isMissing ? '#ffffff' : '#27272a'}; color: ${isMissing ? '#09090b' : '#f4f4f5'}; border: 1px solid ${isMissing ? '#ffffff' : '#3f3f46'}; border-radius: 4px; cursor: pointer; font-weight: ${isMissing ? '600' : '500'};">
                        ${isMissing ? 'Upload Candidate Photo (JPEG/PNG max 4MB)' : 'Replace Photo'}
                      </button>
                      ${!isMissing ? '<a href="/api/candidate/photo" target="_blank" style="font-size: 11px; color: #f4f4f5; text-decoration: underline;">View Candidate Photo</a>' : ''}
                      <span id="photoStatus-${uuid}" style="font-size: 11px; color: #a1a1aa;"></span>
                    </div>
                  ` : ''}

                  ${(f.key === 'portfolio_pdf' || f.key === 'portfolio') ? `
                    <div style="margin-top: 10px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                      ${!isMissing ? '<a href="/api/candidate/portfolio" target="_blank" style="font-size: 11px; color: #f4f4f5; text-decoration: underline;">View Portfolio PDF</a>' : ''}
                      <button type="button" class="btn btn-secondary" onclick="generateCandidatePortfolioAction('${uuid}', '${escapeHtml(salaryRaw || '')}')" style="padding: 4px 10px; font-size: 11px; background: ${isMissing ? '#ffffff' : '#27272a'}; color: ${isMissing ? '#09090b' : '#f4f4f5'}; border: 1px solid ${isMissing ? '#ffffff' : '#3f3f46'}; border-radius: 4px; cursor: pointer; font-weight: ${isMissing ? '600' : '500'};">
                        ${isMissing ? 'Construct Portfolio PDF' : 'Reconstruct Portfolio'}
                      </button>
                      <span id="portfolioStatus-${uuid}" style="font-size: 11px; color: #a1a1aa;"></span>
                    </div>
                  ` : ''}
                </div>
                <div style="font-size: 10.5px; color: #71717a; text-transform: uppercase; font-family: monospace; flex-shrink: 0; background: #27272a; padding: 2px 6px; border-radius: 4px; border: 1px solid #3f3f46;">
                  ${escapeHtml(f.source.replace('_', ' '))}
                </div>
              </div>
            `;
            }).join('')}
          </div>
        </div>
      `;
    });

    box.innerHTML = html;
  } catch (err) {
    box.innerHTML = `<div style="padding: 24px; color: #a1a1aa; font-size: 13px;">Error loading form fill preview: ${escapeHtml(err.message)}</div>`;
  }
}

async function uploadCandidatePhoto(event, uuid, salaryRaw) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById(`photoStatus-${uuid}`);
  if (statusEl) statusEl.textContent = 'Uploading candidate photo...';

  try {
    const res = await fetch('/api/candidate/photo', {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'image/jpeg',
        'X-File-Name': file.name
      },
      body: file
    });
    const data = await res.json();
    if (data.success) {
      if (statusEl) statusEl.textContent = 'Photo uploaded successfully!';
      setTimeout(() => {
        loadJobFormPreview(uuid, salaryRaw);
      }, 400);
    } else {
      if (statusEl) statusEl.textContent = 'Upload failed: ' + (data.error || 'Unknown error');
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = 'Upload error: ' + err.message;
  }
}

async function generateCandidatePortfolioAction(uuid, salaryRaw) {
  const statusEl = document.getElementById(`portfolioStatus-${uuid}`);
  if (statusEl) statusEl.textContent = 'Compiling authentic portfolio PDF...';

  try {
    const res = await fetch('/api/candidate/portfolio/generate', {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      if (statusEl) statusEl.textContent = 'Portfolio constructed!';
      setTimeout(() => {
        loadJobFormPreview(uuid, salaryRaw);
      }, 400);
    } else {
      if (statusEl) statusEl.textContent = 'Generation failed: ' + (data.error || 'Unknown error');
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = 'Generation error: ' + err.message;
  }
}

async function loadJobCoverLetter(uuid) {
  const box = document.getElementById(`coverLetterBox-${uuid}`);
  if (!box) return;
  try {
    const res = await fetch(`/api/jobs/${uuid}/documents`);
    const data = await res.json();
    if (data.success && data.coverLetter) {
      box.textContent = data.coverLetter;
      box.dataset.raw = data.coverLetter;
    } else {
      box.textContent = 'Could not generate cover letter: ' + (data.error || 'Unknown error');
    }
  } catch (err) {
    box.textContent = 'Error loading cover letter: ' + err.message;
  }
}

function copyCoverLetterText(uuid) {
  const box = document.getElementById(`coverLetterBox-${uuid}`);
  if (box && box.dataset.raw) {
    copyText(box.dataset.raw);
  }
}

function openDocumentsModal() {
  if (!activeActionJobUuid) return;
  document.getElementById('actionPopover').style.display = 'none';
  openDetailsModal(activeActionJobUuid, 3);
}

function switchModalTab(tabIndex) {
  document.querySelectorAll('.modal-tab-btn').forEach((btn, idx) => {
    btn.classList.toggle('active', idx === tabIndex);
  });
  document.querySelectorAll('.modal-tab-pane').forEach((pane, idx) => {
    pane.classList.toggle('active', idx === tabIndex);
  });
}

/* =========================================================
   HISTORIES AUDIT TIMELINE MODAL
   ========================================================= */
function openHistoriesModal(jobUuid) {
  const item = jobsData.find(j => j.uuid === jobUuid || String(j.id) === jobUuid);
  if (!item) return;

  let historyList = [];
  try {
    historyList = JSON.parse(item.histories || '[]');
  } catch {}

  const timelineHtml = historyList.map(h => `
    <div class="history-item">
      <div class="history-dot"></div>
      <div class="history-header">
        <span class="history-status-tag">${escapeHtml(h.to_status || 'STATUS_UPDATE')}</span>
        <span class="history-time">${formatTimestamp(h.timestamp)}</span>
      </div>
      <div class="history-note">${escapeHtml(h.note || 'No notes attached.')}</div>
      ${h.from_status ? `<div style="font-size: 11px; color: #a1a1aa; margin-top: 4px;">Transitioned from: ${escapeHtml(h.from_status)}</div>` : ''}
    </div>
  `).join('');

  const html = `
    <div class="modal-section">
      <div class="modal-section-title">Lifecycle Audit Trail &amp; Status Transitions</div>
      <p style="font-size: 13px; color: #ffffff; margin-bottom: 16px;">
        Every status transition, triage decision, and soft-delete action is cryptographically tracked in SQLite <code>jobs_ledger.histories</code>.
      </p>
      <div class="history-timeline">
        ${timelineHtml || '<div style="color: #ffffff;">No history records found for this entry.</div>'}
      </div>
    </div>
  `;

  showModal('AUDIT TRAIL', 'Application Histories', `${item.company} • ${item.title}`, html, false);
}

/* =========================================================
   COMPANY MODAL & RELATED JOBS
   ========================================================= */
async function openCompanyModal(jobUuid) {
  const item = jobsData.find(j => j.uuid === jobUuid || String(j.id) === jobUuid);
  if (!item) return;

  let c = companiesData.find(x => x.name.toLowerCase() === item.company.toLowerCase());
  if (!c) {
    try {
      const res = await fetch('/api/companies');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        companiesData = json.data;
        c = companiesData.find(x => x.name.toLowerCase() === item.company.toLowerCase());
      }
    } catch {}
  }

  const website = c?.website || item.company_website || 'https://www.google.com/search?q=' + encodeURIComponent(item.company);
  const headquarters = c?.headquarters || item.headquarters || c?.location || item.location || 'Indonesia';
  const overview = c?.overview && !c.overview.startsWith('Verified employer record')
    ? c.overview
    : (item.company_overview && !item.company_overview.startsWith('Verified employer record')
      ? item.company_overview
      : 'Comprehensive technology firm operating in Indonesia.');
  const products = c?.products_summary || 'Core digital platforms, software engineering services, and technology infrastructure.';

  // Parse leaders
  let leaders = [];
  try {
    leaders = JSON.parse(c?.leaders || item.leaders || '[]');
  } catch {}

  // Parse HR contacts
  let hrContacts = [];
  try {
    hrContacts = JSON.parse(c?.hr_contacts || item.hr_contacts || '[]');
  } catch {}

  let leadersHtml = '';
  if (leaders.length > 0) {
    leadersHtml = leaders.map(l => `
      <div class="people-card-row">
        <div class="people-card-left">
          <div class="people-card-name">${escapeHtml(l.name)}</div>
          <div class="people-card-role">${escapeHtml(l.role)}</div>
        </div>
        ${l.linkedin ? `<a href="${l.linkedin}" target="_blank" rel="noreferrer" class="people-linkedin-link">LinkedIn &nearr;</a>` : ''}
      </div>
    `).join('');
  } else {
    leadersHtml = '<div style="color: #a1a1aa; font-size: 13px;">Executive leadership records being cataloged.</div>';
  }

  let hrHtml = '';
  if (hrContacts.length > 0) {
    hrHtml = hrContacts.map(h => `
      <div class="people-card-row">
        <div class="people-card-left">
          <div class="people-card-name">${escapeHtml(h.name)}</div>
          <div class="people-card-role">${escapeHtml(h.role)}${h.email ? ` &bull; <span style="color:#ffffff;">${escapeHtml(h.email)}</span>` : ''}</div>
        </div>
        ${h.linkedin ? `<a href="${h.linkedin}" target="_blank" rel="noreferrer" class="people-linkedin-link">LinkedIn &nearr;</a>` : ''}
      </div>
    `).join('');
  } else {
    hrHtml = '<div style="color: #a1a1aa; font-size: 13px;">Recruitment contacts being cataloged.</div>';
  }

  const html = `
    <div class="intelligence-grid">
      <div class="intelligence-card">
        <div class="intelligence-title">Official Company Website</div>
        <div class="intelligence-content">
          <a href="${website}" target="_blank" rel="noreferrer" class="intelligence-link">
            ${escapeHtml(website)} &nearr;
          </a>
        </div>
      </div>
      <div class="intelligence-card">
        <div class="intelligence-title">Headquarters &amp; Office Location</div>
        <div class="intelligence-content">
          ${escapeHtml(headquarters)}
        </div>
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">What The Company Does &amp; Business Model</div>
      <div style="color: #ffffff; line-height: 1.6; font-size: 13.5px; background-color: var(--bg-app); border: 1px solid var(--border-strong); border-radius: 6px; padding: 14px 16px; margin-bottom: 12px;">
        ${escapeHtml(overview)}
      </div>
      <div class="intelligence-card">
        <div class="intelligence-title">Core Products &amp; Services</div>
        <div class="intelligence-content">${escapeHtml(products)}</div>
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Executive Leadership &amp; Board of Directors</div>
      <div class="people-cards-list">
        ${leadersHtml}
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Human Resources &amp; Talent Acquisition</div>
      <div class="people-cards-list">
        ${hrHtml}
      </div>
    </div>
  `;

  showModal('COMPANY INTELLIGENCE', item.company, `${c?.industry || 'Technology'} • ${headquarters}`, html, true);
}

async function openCompanyDetailModal(companyName) {
  let c = companiesData.find(x => x.name.toLowerCase() === companyName.toLowerCase());
  if (!c) {
    const job = jobsData.find(x => x.company.toLowerCase() === companyName.toLowerCase());
    if (job) {
      c = {
        name: job.company,
        industry: job.industry || 'Technology',
        location: job.location || 'Indonesia',
        company_size: job.company_size || 'Mid-Market',
        overview: job.company_overview || '',
        applications_count: 0,
        crawled_count: 1,
        first_crawled_at: job.created_at,
        last_applied_at: job.applied_at
      };
    } else {
      c = {
        name: companyName,
        industry: 'Technology',
        location: 'Indonesia',
        company_size: 'Mid-Market',
        overview: '',
        applications_count: 0,
        crawled_count: 0,
        first_crawled_at: null,
        last_applied_at: null
      };
    }
  }

  // Calculate 30-day cooldown status
  let cooldownBadge = '';
  let cooldownText = '';
  if (c.applications_count > 0 && c.last_applied_at) {
    const lastDate = new Date(c.last_applied_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 30) {
      cooldownBadge = `<span class="status-badge skipped" style="font-size: 11px;">Cooldown Active (${30 - diffDays}d left)</span>`;
      cooldownText = `Applied on ${formatTimestamp(c.last_applied_at)}. 30-day re-application policy active to prevent duplicate employer spam.`;
    } else {
      cooldownBadge = `<span class="status-badge applied" style="font-size: 11px;">Eligible</span>`;
      cooldownText = `Last application was ${diffDays} days ago. 30-day cooldown restriction satisfied.`;
    }
  } else {
    cooldownBadge = `<span class="status-badge pending_human" style="font-size: 11px;">Eligible</span>`;
    cooldownText = `Zero historical applications sent to this employer. Ready for submission.`;
  }

  // Fetch associated jobs
  let jobsHtml = '<div style="color: #a1a1aa; font-size: 13px;">Loading associated jobs...</div>';
  try {
    const res = await fetch(`/api/companies/${encodeURIComponent(c.name)}/jobs`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      jobsHtml = json.data.map(j => `
        <div style="background-color: var(--bg-app); border: 1px solid var(--border-strong); border-radius: 6px; padding: 12px 14px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; font-size: 14px; color: #ffffff;">${escapeHtml(j.title)}</span>
            <span class="status-badge ${j.status.toLowerCase()}">${escapeHtml(j.status)}</span>
          </div>
          <div style="font-size: 12px; color: #a1a1aa; margin-top: 4px;">
            Portal: ${escapeHtml(j.portal)} &bull; Listed Salary: ${escapeHtml(j.salary_raw || 'Undisclosed')} &bull; Ingested: ${formatTimestamp(j.created_at)}
          </div>
          <div style="margin-top: 8px; display: flex; gap: 10px; align-items: center;">
            <button class="btn-tabbed-details" onclick="openDetailsModal('${escapeHtml(j.uuid || j.id)}')">View Job Dossier</button>
            <a href="${j.job_url}" target="_blank" class="platform-job-link">Open Official Job Post &nearr;</a>
          </div>
        </div>
      `).join('');
    } else {
      jobsHtml = '<div style="color: #a1a1aa; font-size: 13px;">No active postings logged for this employer.</div>';
    }
  } catch (err) {
    jobsHtml = '<div style="color: #a1a1aa; font-size: 13px;">Could not load job postings.</div>';
  }

  const html = `
    <div class="modal-grid">
      <div class="modal-grid-item">
        <div class="modal-grid-label">Official Website</div>
        <div class="modal-grid-value">
          ${c.website ? `<a href="${escapeHtml(c.website)}" target="_blank" style="color: #ffffff; text-decoration: underline;">${escapeHtml(c.website)} &nearr;</a>` : '<span style="color: #71717a;">Uncataloged</span>'}
        </div>
      </div>
      <div class="modal-grid-item">
        <div class="modal-grid-label">Location / Headquarters</div>
        <div class="modal-grid-value">${escapeHtml(c.headquarters || c.location || 'Indonesia')}</div>
      </div>
      <div class="modal-grid-item">
        <div class="modal-grid-label">Company Size &amp; Scale</div>
        <div class="modal-grid-value">${escapeHtml(c.company_size || 'Mid-Market')}</div>
      </div>
      <div class="modal-grid-item">
        <div class="modal-grid-label">Industry Classification</div>
        <div class="modal-grid-value">${escapeHtml(c.industry || 'Technology')}</div>
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">What Product They Produce &amp; Company Overview</div>
      <div style="color: #ffffff; line-height: 1.6; font-size: 13.5px; background-color: var(--bg-app); border: 1px solid var(--border-strong); border-radius: 6px; padding: 14px 16px;">
        ${escapeHtml(c.overview || 'No additional corporate product and operations overview cataloged.')}
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Executive Leadership &amp; Board of Directors</div>
      <div style="color: #ffffff; line-height: 1.6; font-size: 13px; background-color: var(--bg-app); border: 1px solid var(--border-strong); border-radius: 6px; padding: 12px 14px;">
        ${escapeHtml(c.leaders || 'Leadership data has not been enriched yet for this organization.')}
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Human Resources &amp; Talent Acquisition Contacts</div>
      <div style="color: #ffffff; line-height: 1.6; font-size: 13px; background-color: var(--bg-app); border: 1px solid var(--border-strong); border-radius: 6px; padding: 12px 14px;">
        ${escapeHtml(c.hr_contacts || 'Talent acquisition contacts not cataloged yet.')}
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Application Metrics &amp; Cooldown Governance</div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 8px;">
        <div style="background-color: var(--bg-app); border: 1px solid var(--border-strong); border-radius: 6px; padding: 10px 12px;">
          <div style="font-size: 10.5px; text-transform: uppercase; color: #a1a1aa; font-weight: 700;">Total Crawled</div>
          <div style="font-size: 16px; font-weight: 700; color: #ffffff; margin-top: 2px;">${c.crawled_count} roles</div>
        </div>
        <div style="background-color: var(--bg-app); border: 1px solid var(--border-strong); border-radius: 6px; padding: 10px 12px;">
          <div style="font-size: 10.5px; text-transform: uppercase; color: #a1a1aa; font-weight: 700;">Applied Count</div>
          <div style="font-size: 16px; font-weight: 700; color: #ffffff; margin-top: 2px;">${c.applications_count} submitted</div>
        </div>
        <div style="background-color: var(--bg-app); border: 1px solid var(--border-strong); border-radius: 6px; padding: 10px 12px;">
          <div style="font-size: 10.5px; text-transform: uppercase; color: #a1a1aa; font-weight: 700;">First Discovered</div>
          <div style="font-size: 12px; color: #ffffff; margin-top: 4px;">${formatTimestamp(c.first_crawled_at)}</div>
        </div>
        <div style="background-color: var(--bg-app); border: 1px solid var(--border-strong); border-radius: 6px; padding: 10px 12px;">
          <div style="font-size: 10.5px; text-transform: uppercase; color: #a1a1aa; font-weight: 700;">Last Applied</div>
          <div style="font-size: 12px; color: #ffffff; margin-top: 4px;">${formatTimestamp(c.last_applied_at)}</div>
        </div>
      </div>
      <div style="font-size: 12px; color: #a1a1aa; margin-top: 4px;">${escapeHtml(cooldownText)}</div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Associated Job Postings</div>
      <div style="margin-top: 10px;">
        ${jobsHtml}
      </div>
    </div>
  `;

  showModal('COMPANY DOSSIER', c.name, `${c.industry || 'Technology'} • ${c.location || 'Indonesia'}`, html, true);
}

/* =========================================================
   VIEW: CANDIDATE PROFILE & DYNAMIC ATTRIBUTES LEDGER
   ========================================================= */
let profileAttributes = [];
let profileSearchQuery = '';
let profileCategoryFilter = 'all';

async function fetchProfileAttributes() {
  const tbody = document.getElementById('profileTbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Loading candidate attributes...</td></tr>';

  try {
    const res = await fetch('/api/candidate/attributes');
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch attributes');
    profileAttributes = json.data || [];
    renderProfileTable();
    updateProfileBadge();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="error-cell">Error loading profile attributes: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function updateProfileBadge() {
  const badge = document.getElementById('badgeProfileCount');
  if (!badge) return;
  const unresolvedCount = profileAttributes.filter(a => a.status === 'UNRESOLVED').length;
  if (unresolvedCount > 0) {
    badge.textContent = unresolvedCount;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

function filterProfileSearch() {
  const input = document.getElementById('profileSearchInput');
  profileSearchQuery = (input?.value || '').toLowerCase().trim();
  renderProfileTable();
}

function filterProfileCategory(cat) {
  profileCategoryFilter = cat || 'all';
  renderProfileTable();
}

function renderProfileTable() {
  const tbody = document.getElementById('profileTbody');
  const footerSummary = document.getElementById('profileFooterSummary');
  if (!tbody) return;

  let filtered = profileAttributes;

  // Filter by category
  if (profileCategoryFilter === 'unresolved') {
    filtered = filtered.filter(a => a.status === 'UNRESOLVED');
  } else if (profileCategoryFilter !== 'all') {
    filtered = filtered.filter(a => a.category.toLowerCase() === profileCategoryFilter.toLowerCase());
  }

  // Filter by search
  if (profileSearchQuery) {
    filtered = filtered.filter(a => {
      const q = profileSearchQuery;
      return (
        (a.key && a.key.toLowerCase().includes(q)) ||
        (a.label && a.label.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q)) ||
        (a.description && a.description.toLowerCase().includes(q)) ||
        (a.value && a.value.toLowerCase().includes(q))
      );
    });
  }

  if (footerSummary) {
    const unresolvedTotal = profileAttributes.filter(a => a.status === 'UNRESOLVED').length;
    footerSummary.textContent = `Showing ${filtered.length} of ${profileAttributes.length} attributes (${unresolvedTotal} action required)`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 28px; color: #71717a; font-size: 13px;">No attributes matching current filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(a => {
    const isUnresolved = a.status === 'UNRESOLVED';
    return `
      <tr style="border-bottom: 1px solid #27272a;">
        <td style="padding: 10px 12px; vertical-align: top;">
          <span style="display: inline-block; padding: 2px 6px; font-size: 10px; text-transform: uppercase; border-radius: 4px; background: #27272a; border: 1px solid #3f3f46; color: #a1a1aa; font-weight: 600;">
            ${escapeHtml(a.category)}
          </span>
        </td>
        <td style="padding: 10px 12px; font-family: monospace; font-size: 12px; color: #f4f4f5; vertical-align: top;">
          ${escapeHtml(a.key)}
        </td>
        <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #ffffff; vertical-align: top;">
          ${escapeHtml(a.label)}
        </td>
        <td style="padding: 10px 12px; font-size: 12px; color: #a1a1aa; line-height: 1.4; vertical-align: top;">
          ${escapeHtml(a.description || 'Discovered portal application parameter')}
        </td>
        <td style="padding: 10px 12px; vertical-align: top;">
          ${a.key === 'photo_document' ? `
            <div style="display: flex; align-items: center; gap: 8px;">
              ${a.value ? `
                <span style="font-size: 12px; color: #ffffff; font-family: monospace; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${escapeHtml(a.value)}</span>
                <a href="/api/candidate/photo" target="_blank" style="font-size: 11.5px; color: #ffffff; text-decoration: underline;">View &nearr;</a>
              ` : `
                <span style="font-size: 11.5px; color: #71717a; font-style: italic;">No photo uploaded yet</span>
              `}
              <label class="btn btn-secondary" style="margin: 0; padding: 4px 10px; font-size: 11px; background: #27272a; border: 1px solid #3f3f46; color: #f4f4f5; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                <span>${a.value ? 'Replace' : 'Choose Photo'}</span>
                <input type="file" accept="image/jpeg,image/png" style="display: none;" onchange="uploadProfilePhotoFromLedger(event)">
              </label>
            </div>
          ` : `
            <input type="text" id="attrInput-${escapeHtml(a.key)}" value="${escapeHtml(a.value || '')}" placeholder="Specify candidate value..." style="width: 100%; background: #09090b; border: 1px solid ${isUnresolved ? '#71717a' : '#3f3f46'}; color: #ffffff; padding: 5px 8px; font-size: 12px; border-radius: 4px;" onkeydown="if(event.key==='Enter') saveProfileAttribute('${escapeHtml(a.key)}')">
          `}
        </td>
        <td style="padding: 10px 12px; text-align: center; vertical-align: top;">
          ${isUnresolved
            ? '<span style="display: inline-block; padding: 2px 7px; font-size: 10px; border-radius: 4px; background: #27272a; border: 1px solid #71717a; color: #ffffff; font-weight: 700; white-space: nowrap;">ACTION REQUIRED</span>'
            : '<span style="display: inline-block; padding: 2px 7px; font-size: 10px; border-radius: 4px; background: #27272a; border: 1px solid #3f3f46; color: #a1a1aa; font-weight: 600; white-space: nowrap;">RESOLVED</span>'
          }
        </td>
        <td style="padding: 10px 12px; text-align: center; vertical-align: top;">
          ${a.key === 'photo_document' ? `
            <label class="btn btn-secondary" style="margin: 0; padding: 4px 10px; font-size: 11px; background: #ffffff; color: #09090b; font-weight: 600; border-radius: 4px; border: 1px solid #ffffff; cursor: pointer; display: inline-block;">
              Upload
              <input type="file" accept="image/jpeg,image/png" style="display: none;" onchange="uploadProfilePhotoFromLedger(event)">
            </label>
          ` : `
            <button type="button" class="btn btn-secondary" onclick="saveProfileAttribute('${escapeHtml(a.key)}')" style="padding: 4px 10px; font-size: 11px; background: #ffffff; color: #09090b; font-weight: 600; border-radius: 4px; border: 1px solid #ffffff; cursor: pointer;">
              Save
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

async function uploadProfilePhotoFromLedger(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (file.size > 4 * 1024 * 1024) {
    alert('Candidate portrait photo must be less than 4MB');
    return;
  }

  try {
    const res = await fetch('/api/candidate/photo', {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'image/jpeg',
        'X-File-Name': file.name
      },
      body: file
    });
    const data = await res.json();
    if (data.success) {
      await fetchProfileAttributes();
    } else {
      alert('Photo upload failed: ' + (data.error || 'Server error'));
    }
  } catch (err) {
    alert('Photo upload network error: ' + err.message);
  }
}

async function saveProfileAttribute(key) {
  const input = document.getElementById(`attrInput-${key}`);
  if (!input) return;
  const value = input.value.trim();

  try {
    const res = await fetch(`/api/candidate/attributes/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to save attribute');

    input.style.borderColor = '#ffffff';
    setTimeout(() => {
      fetchProfileAttributes();
    }, 400);
  } catch (err) {
    alert(`Error saving attribute: ${err.message}`);
  }
}

async function saveInlineProfileAttribute(uuid, key, salaryRaw) {
  const input = document.getElementById(`inlineVal-${uuid}-${key}`);
  if (!input) return;
  const value = input.value.trim();
  if (!value) {
    alert('Please enter a value before saving.');
    return;
  }

  try {
    const res = await fetch(`/api/candidate/attributes/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to save attribute');

    // Refresh Form Fill Preview in modal immediately
    await loadFormFillPreview(uuid, salaryRaw);
    // Refresh attributes badge
    const badgeRes = await fetch('/api/candidate/attributes');
    const badgeJson = await badgeRes.json();
    if (badgeJson.success) {
      profileAttributes = badgeJson.data || [];
      updateProfileBadge();
    }
  } catch (err) {
    alert(`Error saving attribute: ${err.message}`);
  }
}

function openAddAttributeModal() {
  const modalHtml = `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div>
        <label style="font-size: 11.5px; color: #a1a1aa; font-weight: 600; text-transform: uppercase;">Attribute Key</label>
        <input type="text" id="newAttrKey" placeholder="e.g. visa_status, notice_days" style="width: 100%; margin-top: 4px; background: #18181b; border: 1px solid #3f3f46; color: #ffffff; padding: 7px 10px; font-size: 13px; border-radius: 4px;">
      </div>
      <div>
        <label style="font-size: 11.5px; color: #a1a1aa; font-weight: 600; text-transform: uppercase;">Label &amp; Prompt</label>
        <input type="text" id="newAttrLabel" placeholder="e.g. Visa Sponsorship Status" style="width: 100%; margin-top: 4px; background: #18181b; border: 1px solid #3f3f46; color: #ffffff; padding: 7px 10px; font-size: 13px; border-radius: 4px;">
      </div>
      <div>
        <label style="font-size: 11.5px; color: #a1a1aa; font-weight: 600; text-transform: uppercase;">Category</label>
        <select id="newAttrCategory" style="width: 100%; margin-top: 4px; background: #18181b; border: 1px solid #3f3f46; color: #ffffff; padding: 7px 10px; font-size: 13px; border-radius: 4px;">
          <option value="personal">Personal &amp; Contact</option>
          <option value="compensation">Compensation &amp; Salary</option>
          <option value="references">Professional References</option>
          <option value="education">Education &amp; Academics</option>
          <option value="experience">Experience &amp; Industry</option>
          <option value="custom" selected>Custom / Other</option>
        </select>
      </div>
      <div>
        <label style="font-size: 11.5px; color: #a1a1aa; font-weight: 600; text-transform: uppercase;">Context / Description (What It Is For)</label>
        <textarea id="newAttrDesc" rows="2" placeholder="Explain what this question asks and how it should be answered..." style="width: 100%; margin-top: 4px; background: #18181b; border: 1px solid #3f3f46; color: #ffffff; padding: 7px 10px; font-size: 13px; border-radius: 4px; resize: vertical;"></textarea>
      </div>
      <div>
        <label style="font-size: 11.5px; color: #a1a1aa; font-weight: 600; text-transform: uppercase;">Candidate Value</label>
        <input type="text" id="newAttrVal" placeholder="Current candidate answer/value (leave empty if unresolved)" style="width: 100%; margin-top: 4px; background: #18181b; border: 1px solid #3f3f46; color: #ffffff; padding: 7px 10px; font-size: 13px; border-radius: 4px;">
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn btn-primary" onclick="submitNewAttributeAction()">Save Attribute</button>
      </div>
    </div>
  `;
  showModal('ADD ATTRIBUTE', 'New Candidate Profile Attribute', 'Register custom candidate property or newly discovered ATS question', modalHtml, false);
}

async function submitNewAttributeAction() {
  const key = document.getElementById('newAttrKey')?.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const label = document.getElementById('newAttrLabel')?.value.trim();
  const category = document.getElementById('newAttrCategory')?.value;
  const description = document.getElementById('newAttrDesc')?.value.trim();
  const value = document.getElementById('newAttrVal')?.value.trim();

  if (!key || !label) {
    alert('Key and Label are required.');
    return;
  }

  try {
    const res = await fetch('/api/candidate/attributes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, label, category, description, value })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to add attribute');
    closeModal();
    fetchProfileAttributes();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

/* =========================================================
   VIEW 2: DYNAMIC PERSONALIZATION CRITERIA
   ========================================================= */
async function fetchCriteria() {
  try {
    const res = await fetch('/api/personalization');
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      criteriaData = json.data;
      document.getElementById('badgeCriteriaCount').textContent = criteriaData.length;
      const badgeAll = document.getElementById('criteriaBadgeAll');
      if (badgeAll) badgeAll.textContent = criteriaData.length;
      renderCriteriaTable();
    }
  } catch (err) {
    console.error('Error fetching criteria:', err);
  }
}

function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.max(36, el.scrollHeight) + 'px';
}

async function saveCriteriaCell(ruleId, field, value, inputEl) {
  const item = criteriaData.find(x => x.id === ruleId);
  const trimmed = value.trim();

  // If value didn't change, no-op
  if (item && item[field] === trimmed) {
    return;
  }

  try {
    const payload = {};
    payload[field] = trimmed;

    const res = await fetch(`/api/personalization/${ruleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.success) {
      if (item) {
        item[field] = trimmed;
      }
      if (inputEl) {
        inputEl.classList.remove('inline-cell-error');
        inputEl.classList.add('inline-cell-saved');
        setTimeout(() => {
          inputEl.classList.remove('inline-cell-saved');
        }, 1200);
      }
    } else {
      if (inputEl) {
        inputEl.classList.add('inline-cell-error');
      }
      console.error('Failed to update criteria field:', result.error);
    }
  } catch (err) {
    if (inputEl) {
      inputEl.classList.add('inline-cell-error');
    }
    console.error('Network error updating criteria field:', err);
  }
}

function filterCriteriaSearch() {
  const input = document.getElementById('criteriaSearchInput');
  criteriaSearchQuery = input ? input.value.toLowerCase().trim() : '';
  renderCriteriaTable();
}

function renderCriteriaTable() {
  const tbody = document.getElementById('criteriaTbody');
  if (!tbody) return;

  let filtered = criteriaData;

  // Search query filter
  if (criteriaSearchQuery) {
    filtered = filtered.filter(r => {
      const q = criteriaSearchQuery;
      return (
        (r.category || '').toLowerCase().includes(q) ||
        (r.key || '').toLowerCase().includes(q) ||
        (r.value || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
      );
    });
  }

  const summaryEl = document.getElementById('criteriaFooterSummary');
  if (summaryEl) {
    summaryEl.textContent = `Showing ${filtered.length} of ${criteriaData.length} parameters`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="loading-cell">No matching parameters found. Click "+ Add Parameter" to register one.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const isEnabled = r.is_enabled === 1 || r.is_enabled === undefined;
    const rowClass = isEnabled ? '' : 'row-disabled';

    return `
      <tr class="${rowClass}" id="rule-row-${r.id}">
        <td>
          <input type="text"
                 class="inline-cell-input inline-cell-category"
                 value="${escapeHtml(r.category || '')}"
                 placeholder="Category"
                 onchange="saveCriteriaCell(${r.id}, 'category', this.value, this)"
                 title="Directly edit category (saves automatically)">
        </td>
        <td class="criteria-key-cell">
          <input type="text"
                 class="inline-cell-input inline-cell-key"
                 value="${escapeHtml(r.key || '')}"
                 placeholder="parameter_key"
                 onchange="saveCriteriaCell(${r.id}, 'key', this.value, this)"
                 title="Directly edit parameter key (saves automatically)">
        </td>
        <td>
          <textarea class="inline-cell-textarea inline-cell-value"
                    rows="1"
                    placeholder="Criteria value or logic pattern"
                    oninput="autoResizeTextarea(this)"
                    onchange="saveCriteriaCell(${r.id}, 'value', this.value, this)"
                    title="Directly edit criteria value/logic (saves automatically)">${escapeHtml(r.value || '')}</textarea>
        </td>
        <td class="criteria-desc-cell">
          <textarea class="inline-cell-textarea inline-cell-desc"
                    rows="1"
                    placeholder="Operational guidance and context..."
                    oninput="autoResizeTextarea(this)"
                    onchange="saveCriteriaCell(${r.id}, 'description', this.value, this)"
                    title="Directly edit operational guidance (saves automatically)">${escapeHtml(r.description || '')}</textarea>
        </td>
        <td style="text-align: center;">
          <label class="switch-toggle" title="Toggle active/inactive status">
            <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleCriteriaRule(${r.id})">
            <span class="switch-slider"></span>
          </label>
        </td>
        <td style="text-align: center; white-space: nowrap;">
          <button class="btn-danger-outline" style="padding: 4px 8px; font-size: 11px;" onclick="deleteCriteriaRule(${r.id})" title="Soft-delete parameter">Delete</button>
        </td>
      </tr>
    `;
  }).join('');

  // Auto-resize textareas based on content
  tbody.querySelectorAll('.inline-cell-textarea').forEach(el => autoResizeTextarea(el));
}

async function toggleCriteriaRule(ruleId) {
  try {
    const res = await fetch(`/api/personalization/${ruleId}/toggle`, { method: 'POST' });
    const result = await res.json();
    if (result.success) {
      const item = criteriaData.find(x => x.id === ruleId);
      if (item) {
        item.is_enabled = item.is_enabled === 1 ? 0 : 1;
      }
      renderCriteriaTable();
    } else {
      alert('Error toggling rule: ' + result.error);
      fetchCriteria();
    }
  } catch (err) {
    alert('Failed to connect: ' + err.message);
    fetchCriteria();
  }
}

async function deleteCriteriaRule(ruleId) {
  if (!confirm('Are you sure you want to soft-delete this rule? It will be deactivated and removed from active synchronization.')) return;

  try {
    const res = await fetch(`/api/personalization/${ruleId}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      criteriaData = criteriaData.filter(x => x.id !== ruleId);
      document.getElementById('badgeCriteriaCount').textContent = criteriaData.length;
      const badgeAll = document.getElementById('criteriaBadgeAll');
      if (badgeAll) badgeAll.textContent = criteriaData.length;
      renderCriteriaTable();
    } else {
      alert('Error deleting: ' + result.error);
    }
  } catch (err) {
    alert('Failed to connect: ' + err.message);
  }
}

function openEditRuleModal(ruleId) {
  const rule = criteriaData.find(r => r.id === ruleId);
  if (!rule) return;

  const html = `
    <form onsubmit="event.preventDefault(); submitEditRule(${rule.id});" class="scheduler-form">
      <div class="form-group">
        <label class="form-label">Category</label>
        <input type="text" class="form-input" value="${escapeHtml(rule.category)}" disabled style="opacity: 0.7;">
      </div>
      <div class="form-group">
        <label class="form-label">Parameter Key</label>
        <input type="text" class="form-input" value="${escapeHtml(rule.key)}" disabled style="opacity: 0.7; font-family: monospace;">
      </div>
      <div class="form-group">
        <label class="form-label" for="editRuleVal">Matching Value / Criteria Logic</label>
        <textarea id="editRuleVal" class="rule-textarea" rows="4" required style="width: 100%; background: #000000; color: #ffffff; font-family: monospace; font-size: 12px; padding: 8px; border: 1px solid var(--border-strong); border-radius: 4px;">${escapeHtml(rule.value)}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label" for="editRuleDesc">Operational Guidance &amp; Lengthy Context</label>
        <textarea id="editRuleDesc" class="rule-textarea" rows="4" style="width: 100%; background: #000000; color: #ffffff; font-size: 12px; padding: 8px; border: 1px solid var(--border-strong); border-radius: 4px;">${escapeHtml(rule.description || '')}</textarea>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save Parameter</button>
      </div>
    </form>
  `;

  showModal('EDIT PARAMETER', rule.key, 'Update criteria logic and operational guidance', html, false);
}

async function submitEditRule(ruleId) {
  const val = document.getElementById('editRuleVal').value.trim();
  const desc = document.getElementById('editRuleDesc').value.trim();

  try {
    const res = await fetch(`/api/personalization/${ruleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: val, description: desc })
    });
    const result = await res.json();
    if (result.success) {
      closeModal();
      fetchCriteria();
    } else {
      alert('Error updating parameter: ' + result.error);
    }
  } catch (err) {
    alert('Failed to connect: ' + err.message);
  }
}

function openAddRuleModal() {
  const html = `
    <form onsubmit="event.preventDefault(); submitNewRule();" class="scheduler-form">
      <div class="form-group">
        <label class="form-label" for="newRuleCat">Category</label>
        <input type="text" id="newRuleCat" class="form-input" placeholder="e.g. Technology Blacklist" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="newRuleKey">Rule Key (Identifier)</label>
        <input type="text" id="newRuleKey" class="form-input" placeholder="e.g. tech_framework_blacklist" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="newRuleVal">Filter Value / Matching Logic</label>
        <textarea id="newRuleVal" class="rule-textarea" placeholder="e.g. Spring Boot, Angular, .NET" required></textarea>
      </div>
      <div class="form-group">
        <label class="form-label" for="newRuleDesc">Operational Intent / Description</label>
        <input type="text" id="newRuleDesc" class="form-input" placeholder="Describe the reason for filtering">
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px;">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Create Rule</button>
      </div>
    </form>
  `;

  showModal('DECISION RULES', 'Add Dynamic Criteria Rule', 'Creates dynamic evaluation criteria rule', html, false);
}

async function submitNewRule() {
  const category = document.getElementById('newRuleCat').value.trim();
  const key = document.getElementById('newRuleKey').value.trim();
  const value = document.getElementById('newRuleVal').value.trim();
  const description = document.getElementById('newRuleDesc').value.trim();

  try {
    const res = await fetch('/api/personalization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, key, value, description })
    });
    const result = await res.json();
    if (result.success) {
      closeModal();
      fetchCriteria();
    } else {
      alert('Error creating rule: ' + (result.error || 'Server error'));
    }
  } catch (err) {
    alert('Failed to connect: ' + err.message);
  }
}

/* =========================================================
   SCHEDULE SLIDE-OVER DRAWER CONTROLS
   ========================================================= */
function openScheduleDrawer() {
  const drawer = document.getElementById('scheduleDrawer');
  const overlay = document.getElementById('scheduleDrawerOverlay');
  if (drawer && overlay) {
    drawer.classList.add('active');
    overlay.classList.add('active');
  }
}

function closeScheduleDrawer() {
  const drawer = document.getElementById('scheduleDrawer');
  const overlay = document.getElementById('scheduleDrawerOverlay');
  if (drawer && overlay) {
    drawer.classList.remove('active');
    overlay.classList.remove('active');
  }
}

function toggleScheduleDrawer() {
  const drawer = document.getElementById('scheduleDrawer');
  if (drawer && drawer.classList.contains('active')) {
    closeScheduleDrawer();
  } else {
    openScheduleDrawer();
  }
}

/* =========================================================
   VIEW 3: WEBSITES MASTER DIRECTORY
   ========================================================= */
function getPortalKeyForWebsite(w) {
  const combined = `${w.url || ''} ${w.name || ''}`.toLowerCase();
  if (combined.includes('kalibrr')) return 'kalibrr';
  if (combined.includes('glints')) return 'glints';
  if (combined.includes('jobstreet') || combined.includes('seek')) return 'jobstreet';
  if (combined.includes('linkedin')) return 'linkedin';
  return null;
}

async function fetchWebsites() {
  try {
    const [resSites, resSessions] = await Promise.all([
      fetch('/api/websites'),
      fetch('/api/websites/session-status').catch(() => null)
    ]);
    const json = await resSites.json();
    if (resSessions) {
      try {
        const jsonSessions = await resSessions.json();
        if (jsonSessions.success && jsonSessions.data) {
          portalSessionsMap = jsonSessions.data;
        }
      } catch (e) {
        console.warn('Could not parse session status:', e);
      }
    }
    if (json.success && Array.isArray(json.data)) {
      websitesData = json.data;
      document.getElementById('badgeWebsitesCount').textContent = websitesData.length;
      renderWebsitesTable();
    }
  } catch (err) {
    console.error('Error fetching websites:', err);
  }
}

function renderWebsitesTable() {
  const tbody = document.getElementById('websitesTbody');
  if (websitesData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="loading-cell">No websites configured. Click "+ Add Website" to register.</td></tr>`;
    return;
  }

  tbody.innerHTML = websitesData.map(w => {
    const isAllowed = w.allowed === 1;
    const policyClass = isAllowed ? 'applied' : 'dropped';
    const policyText = isAllowed ? 'ALLOWED' : 'BLOCKED';
    const toggleBtnText = isAllowed ? 'Block' : 'Allow';

    const portalKey = getPortalKeyForWebsite(w);
    let sessionBadgeHtml = `<span class="status-badge" style="border-color: #27272a; background-color: transparent; color: #71717a;">N/A</span>`;
    if (portalKey) {
      const sessionStatus = portalSessionsMap[portalKey] || 'REQUIRES_LOGIN';
      if (sessionStatus === 'AUTHENTICATED') {
        sessionBadgeHtml = `<span class="status-badge session-authenticated">AUTHENTICATED</span>`;
      } else if (sessionStatus === 'BROWSER_OPEN_LOCKED') {
        sessionBadgeHtml = `<span class="status-badge" style="border-color: #52525b; background-color: #27272a; color: #f4f4f5;" title="Login window is open. Close browser window after logging in, then re-check.">WINDOW OPEN</span>`;
      } else {
        sessionBadgeHtml = `<span class="status-badge session-login-required">REQUIRES_LOGIN</span>`;
      }
    }

    return `
      <tr>
        <td style="font-weight: 700;">${escapeHtml(w.name)}</td>
        <td>
          <a href="${w.url}" target="_blank" rel="noreferrer" class="platform-job-link">
            ${escapeHtml(w.url)} &nearr;
          </a>
        </td>
        <td>
          <span class="status-badge ${policyClass}">${policyText}</span>
        </td>
        <td>
          ${sessionBadgeHtml}
        </td>
        <td style="font-weight: 600;">${escapeHtml(w.auth_type || 'Google PIN')}</td>
        <td>${escapeHtml(w.username || '-')}</td>
        <td style="font-size: 12px; color: #ffffff;">${escapeHtml(w.credential_note || 'Standard browser profile')}</td>
        <td style="font-size: 12px; color: #ffffff;">${escapeHtml(w.notes || '-')}</td>
        <td class="col-sticky-actions" style="text-align: center; white-space: nowrap;">
          ${portalKey ? `
            <button class="btn-table-primary" style="margin-right: 6px;" onclick="authenticatePortal('${w.id}')" title="Launch desktop browser to log in">Authenticate</button>
            <button class="btn-secondary" style="margin-right: 6px;" onclick="checkSingleSession('${w.id}')" title="Re-check active session status">Re-check</button>
          ` : ''}
          <button class="btn-secondary" onclick="toggleWebsiteAllowed('${w.id}')">${toggleBtnText}</button>
          <button class="btn-danger-outline" style="margin-left: 6px;" onclick="deleteWebsiteEntry('${w.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function checkAllPortalSessions() {
  try {
    const res = await fetch('/api/websites/session-status');
    const json = await res.json();
    if (json.success && json.data) {
      portalSessionsMap = json.data;
      renderWebsitesTable();
    }
  } catch (err) {
    console.error('Error checking portal sessions:', err);
  }
}

async function authenticatePortal(id) {
  try {
    const res = await fetch(`/api/websites/${id}/authenticate`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      const portalKey = json.portalKey || 'portal';
      const result = json.result || {};
      const html = `
        <div style="padding: 10px 0; color: #f4f4f5; font-size: 13px; line-height: 1.6;">
          <p style="margin-bottom: 12px;">
            Desktop browser window launched for <strong>${escapeHtml(portalKey.toUpperCase())}</strong> using the shared session profile.
          </p>
          <div style="background: #18181b; border: 1px solid #3f3f46; border-radius: 4px; padding: 12px; margin-bottom: 14px; font-family: monospace; font-size: 11px; color: #a1a1aa;">
            <div><strong>Browser:</strong> ${escapeHtml(result.browserPath || 'Desktop Browser')} (${escapeHtml(result.browserType || 'Host')})</div>
            <div><strong>Profile:</strong> ${escapeHtml(result.userDataDir || './data/browser_profile')}</div>
            <div><strong>Target URL:</strong> ${escapeHtml(result.targetUrl || '')}</div>
          </div>
          <ol style="padding-left: 20px; margin-bottom: 16px; color: #d4d4d8;">
            <li style="margin-bottom: 6px;">Log in to your account in the opened desktop browser.</li>
            <li style="margin-bottom: 6px;">Pass any bot challenges (Cloudflare Turnstile, OTP, or CAPTCHA).</li>
            <li style="margin-bottom: 6px;"><strong>Important: Close the login browser window</strong> once you reach the dashboard so cookies are saved and unlocked.</li>
            <li style="margin-bottom: 6px;">Click <strong>Re-check Session Now</strong> below to verify.</li>
          </ol>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="btn-secondary" onclick="closeModal()">Dismiss</button>
            <button type="button" class="btn-primary" onclick="checkSingleSession('${id}', true)">Re-check Session Now</button>
          </div>
        </div>
      `;
      showModal('AUTHENTICATION', `Authenticate ${portalKey.toUpperCase()}`, 'Shared Desktop Browser Session Launcher', html, false);
    } else {
      alert('Failed to launch authentication browser: ' + (json.error || 'Unknown error'));
    }
  } catch (err) {
    alert('Failed to connect: ' + err.message);
  }
}

async function checkSingleSession(id, fromModal = false) {
  try {
    const res = await fetch(`/api/websites/${id}/check-session`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      if (json.portalKey) {
        portalSessionsMap[json.portalKey] = json.status;
      }
      renderWebsitesTable();
      const portalName = json.portalKey ? json.portalKey.toUpperCase() : 'Portal';
      if (fromModal) {
        if (json.status === 'AUTHENTICATED') {
          closeModal();
          alert(`Authentication confirmed! ${portalName} session cookies successfully verified.`);
        } else if (json.status === 'BROWSER_OPEN_LOCKED') {
          alert('The browser window is currently open. Please close the login browser window so cookies can be saved, then click Re-check.');
        } else {
          alert(`Session re-check complete: Status is still ${json.status}. Please make sure you are logged in and have closed the login browser window.`);
        }
      } else {
        if (json.status === 'AUTHENTICATED') {
          alert(`Authentication confirmed! ${portalName} session is active and verified.`);
        } else if (json.status === 'BROWSER_OPEN_LOCKED') {
          alert('The browser window is currently open. Please close the browser window so cookies can be saved, then click Re-check.');
        } else {
          alert(`Session re-check complete: ${portalName} status is ${json.status}. Please make sure you are logged in and have closed the login browser window.`);
        }
      }
    } else {
      alert('Failed to re-check session: ' + (json.error || 'Unknown error'));
    }
  } catch (err) {
    alert('Failed to connect: ' + err.message);
  }
}

async function toggleWebsiteAllowed(id) {
  try {
    const res = await fetch(`/api/websites/${id}/toggle`, { method: 'POST' });
    const result = await res.json();
    if (result.success) {
      fetchWebsites();
    }
  } catch (err) {
    alert('Failed to update: ' + err.message);
  }
}

async function deleteWebsiteEntry(id) {
  if (!confirm('Are you sure you want to remove this website from the governance directory?')) return;
  try {
    const res = await fetch(`/api/websites/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      fetchWebsites();
    }
  } catch (err) {
    alert('Failed to connect: ' + err.message);
  }
}

function openAddWebsiteModal() {
  const html = `
    <form onsubmit="event.preventDefault(); submitNewWebsite();" class="scheduler-form">
      <div class="form-group">
        <label class="form-label" for="siteName">Website / Portal Name</label>
        <input type="text" id="siteName" class="form-input" placeholder="e.g. Kalibrr Indonesia" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="siteUrl">Target URL</label>
        <input type="url" id="siteUrl" class="form-input" placeholder="https://www.kalibrr.com" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="siteAuth">Authentication Type</label>
        <select id="siteAuth" class="form-input">
          <option value="Google PIN / OTP">Google PIN / OTP</option>
          <option value="Cookie Session">Cookie Session</option>
          <option value="Email / Password">Email / Password</option>
          <option value="None">None / Public Scraping</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="siteUser">Account / Username (Optional)</label>
        <input type="text" id="siteUser" class="form-input" placeholder="candidate@email.com">
      </div>
      <div class="form-group">
        <label class="form-label" for="siteCred">Credential &amp; Bot Handling Notes</label>
        <input type="text" id="siteCred" class="form-input" placeholder="Interactive CLI PIN pause; cookies saved in browser profile">
      </div>
      <label class="toggle-group" style="margin-top: 6px;">
        <input type="checkbox" id="siteAllowed" class="toggle-input" checked>
        <span class="toggle-text">Permit Autonomous Access</span>
      </label>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px;">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Register Website</button>
      </div>
    </form>
  `;

  showModal('GOVERNANCE', 'Register New Website Portal', 'Add portal to websites_master table', html, false);
}

async function submitNewWebsite() {
  const name = document.getElementById('siteName').value.trim();
  const url = document.getElementById('siteUrl').value.trim();
  const auth_type = document.getElementById('siteAuth').value;
  const username = document.getElementById('siteUser').value.trim();
  const credential_note = document.getElementById('siteCred').value.trim();
  const allowed = document.getElementById('siteAllowed').checked;

  try {
    const res = await fetch('/api/websites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, auth_type, username, credential_note, allowed })
    });
    const result = await res.json();
    if (result.success) {
      closeModal();
      fetchWebsites();
    } else {
      alert('Error registering website: ' + (result.error || 'Server error'));
    }
  } catch (err) {
    alert('Failed to connect: ' + err.message);
  }
}

/* =========================================================
   VIEW 4: COMPANIES MASTER TABLE & TRACKING
   ========================================================= */
async function fetchCompanies() {
  try {
    const res = await fetch('/api/companies');
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      companiesData = json.data;
      document.getElementById('badgeCompaniesCount').textContent = companiesData.length;
      renderCompaniesTable();
    }
  } catch (err) {
    console.error('Error fetching companies:', err);
  }
}

function renderCompaniesTable() {
  const tbody = document.getElementById('companiesTbody');
  if (companiesData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="loading-cell">No employer records logged yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = companiesData.map(c => {
    const hasApplied = c.applications_count > 0;
    const appTagClass = hasApplied ? 'applied' : '';

    let cooldownBadge = '<span class="status-badge pending_human" style="font-size: 11px;">Eligible</span>';
    if (hasApplied && c.last_applied_at) {
      const lastDate = new Date(c.last_applied_at);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 30) {
        cooldownBadge = `<span class="status-badge skipped" style="font-size: 11px;">Cooldown (${30 - diffDays}d left)</span>`;
      } else {
        cooldownBadge = `<span class="status-badge applied" style="font-size: 11px;">Eligible</span>`;
      }
    }

    const websiteDisplay = c.website
      ? `<a href="${escapeHtml(c.website)}" target="_blank" class="platform-job-link" style="color: #ffffff; text-decoration: underline;">${escapeHtml(c.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))} &nearr;</a>`
      : '<span style="color: #71717a; font-size: 11.5px;">URL uncataloged</span>';

    const industrySize = `${escapeHtml(c.industry || 'Technology')} • ${escapeHtml(c.company_size || 'Mid-Market')}`;

    // Gathered intelligence summary
    const intelligenceItems = [];
    if (c.headquarters) intelligenceItems.push(`HQ: ${escapeHtml(c.headquarters)}`);
    else if (c.location) intelligenceItems.push(`Loc: ${escapeHtml(c.location)}`);
    if (c.leaders) intelligenceItems.push(`Execs: ${escapeHtml(c.leaders)}`);
    if (c.hr_contacts) intelligenceItems.push(`HR: ${escapeHtml(c.hr_contacts)}`);
    const intelligenceText = intelligenceItems.length > 0
      ? intelligenceItems.join(' | ')
      : (c.overview ? escapeHtml(c.overview.slice(0, 50)) + '...' : '<span style="color: #71717a;">Pending intelligence crawl</span>');

    // Enrichment score calculation (out of 7 core fields)
    const trackedFields = [c.overview, c.website, c.headquarters || c.location, c.leaders, c.hr_contacts, c.industry, c.company_size];
    const score = trackedFields.filter(Boolean).length;
    const pct = Math.round((score / 7) * 100);

    return `
      <tr>
        <td style="font-weight: 700;">
          <button class="company-title-btn" onclick="openCompanyDetailModal('${escapeHtml(c.name)}')">
            ${escapeHtml(c.name)} &rsaquo;
          </button>
        </td>
        <td>${websiteDisplay}</td>
        <td style="font-size: 12px; color: #d4d4d8;">${industrySize}</td>
        <td>
          <div style="font-size: 12px; color: #a1a1aa; max-width: 260px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(intelligenceText)}">
            ${intelligenceText}
          </div>
        </td>
        <td style="text-align: center;">
          <span class="status-badge" style="font-size: 10px; border-color: ${score >= 5 ? '#52525b' : '#3f3f46'}; color: #ffffff;">
            ${score}/7 (${pct}%)
          </span>
        </td>
        <td style="text-align: center; font-weight: 600;">${c.crawled_count}</td>
        <td style="text-align: center;">
          <span class="app-count-tag ${appTagClass}" style="font-size: 12px; padding: 3px 8px;">
            ${c.applications_count} applied
          </span>
        </td>
        <td>${cooldownBadge}</td>
        <td style="text-align: center;">
          <button class="btn-secondary" onclick="openCompanyDetailModal('${escapeHtml(c.name)}')">
            View Details
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function viewCompanyJobs(companyName) {
  openCompanyDetailModal(companyName);
}

/* =========================================================
   VIEW 5: DAILY SCHEDULE SETTINGS & RECORDED BATCH RUNS
   ========================================================= */
async function fetchScheduleAndRuns() {
  try {
    // 1. Fetch settings
    const resSettings = await fetch('/api/scheduler');
    const jsonSettings = await resSettings.json();
    if (jsonSettings.success && jsonSettings.data) {
      const s = jsonSettings.data;
      document.getElementById('schedEnabled').checked = Boolean(s.enabled);
      document.getElementById('schedTime').value = s.schedule_time || '09:00';
      document.getElementById('schedMax').value = s.max_daily_applications || 10;
      document.getElementById('schedPortals').value = s.portals || 'Jobstreet, LinkedIn';
    }

    // 2. Fetch recorded batch runs
    const resRuns = await fetch('/api/scheduler/runs');
    const jsonRuns = await resRuns.json();
    if (jsonRuns.success && Array.isArray(jsonRuns.data)) {
      renderBatchRuns(jsonRuns.data);
    }

    // 3. Fetch CLI Agent status
    fetchAgentStatus();
  } catch (err) {
    console.error('Error fetching scheduler data:', err);
  }
}

function renderBatchRuns(runs) {
  const tbody = document.getElementById('batchRunsTbody');
  const badgeEl = document.getElementById('batchRunsBadge');
  const footerSummaryEl = document.getElementById('batchRunsFooterSummary');

  if (badgeEl) badgeEl.textContent = `${runs.length} recorded runs`;
  if (footerSummaryEl) footerSummaryEl.textContent = `Showing ${runs.length} batch runs`;

  if (runs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading-cell">No batch execution runs recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = runs.map(r => `
    <tr>
      <td style="white-space: nowrap; font-family: monospace; font-size: 12px; color: var(--text-secondary);">${escapeHtml(r.run_date)}</td>
      <td>
        <span class="status-badge ${r.status === 'COMPLETED' ? 'completed' : 'failed'}">${escapeHtml(r.status)}</span>
      </td>
      <td style="font-weight: 600; text-align: right; color: var(--text-main);">${r.batch_size}</td>
      <td style="font-weight: 600; text-align: right; color: var(--text-main);">${r.processed_count}</td>
      <td style="font-weight: 600; text-align: right; color: var(--text-main);">${r.success_count}</td>
      <td style="font-weight: 600; text-align: right; color: var(--text-muted);">${r.skipped_count}</td>
      <td style="font-size: 12px; color: var(--text-main);">${escapeHtml(r.details)}</td>
    </tr>
  `).join('');
}

async function saveScheduleSettings() {
  const enabled = document.getElementById('schedEnabled').checked;
  const schedule_time = document.getElementById('schedTime').value;
  const max_daily_applications = parseInt(document.getElementById('schedMax').value, 10) || 10;
  const portals = document.getElementById('schedPortals').value.trim();
  const msgEl = document.getElementById('schedSaveMsg');

  msgEl.textContent = 'Saving...';
  try {
    const res = await fetch('/api/scheduler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, schedule_time, max_daily_applications, portals })
    });
    const result = await res.json();
    if (result.success) {
      msgEl.textContent = 'Saved to SQLite';
      setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 2500);
    } else {
      msgEl.textContent = 'Error saving';
    }
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
  }
}

async function triggerManualBatchRun() {
  const btn = window.event?.target;
  const msgEl = document.getElementById('schedSaveMsg');
  if (btn && btn.tagName === 'BUTTON') btn.disabled = true;
  if (msgEl) msgEl.textContent = 'Triggering batch run...';
  try {
    const res = await fetch('/api/scheduler/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: true })
    });
    const result = await res.json();
    if (result.success) {
      if (msgEl) msgEl.textContent = 'Batch completed';
      await fetchScheduleAndRuns();
    } else {
      if (msgEl) msgEl.textContent = 'Batch status: ' + (result.data?.message || result.error || 'Failed');
    }
  } catch (err) {
    if (msgEl) msgEl.textContent = 'Error: ' + err.message;
  } finally {
    if (btn && btn.tagName === 'BUTTON') btn.disabled = false;
    setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 4000);
  }
}

/* =========================================================
   CLI AGENT (AGY) STATUS & CONTROLS
   ========================================================= */
async function fetchAgentStatus() {
  const sidebarPill = document.getElementById('sidebarAgentPill');
  const badgeView = document.getElementById('agentStatusBadgeView');
  const enabledInput = document.getElementById('agentEnabled');
  const timeoutInput = document.getElementById('agentTimeoutInput');
  const modelSelect = document.getElementById('agentModelSelect');

  try {
    const res = await fetch('/api/agent/status');
    const json = await res.json();
    if (json.success && json.data) {
      const data = json.data;
      
      // Update sidebar pill
      if (sidebarPill) {
        sidebarPill.classList.remove('offline', 'disabled');
        if (!data.available) {
          sidebarPill.textContent = 'AGY: Offline';
          sidebarPill.classList.add('offline');
          sidebarPill.title = data.error || 'Binary not accessible';
        } else if (!data.enabled) {
          sidebarPill.textContent = 'AGY: Disabled';
          sidebarPill.classList.add('disabled');
          sidebarPill.title = 'CLI Agent disabled in settings';
        } else {
          sidebarPill.textContent = `AGY: ${data.version || '1.4.7'}`;
          sidebarPill.title = `Model: ${data.currentModel} | Active: ${data.activeProcessesCount} processes`;
        }
      }

      // Update View 5 card
      if (badgeView) {
        if (!data.available) {
          badgeView.textContent = 'Engine Offline';
          badgeView.style.borderColor = 'var(--border-strong)';
          badgeView.style.color = '#71717a';
        } else if (!data.enabled) {
          badgeView.textContent = 'Disabled';
          badgeView.style.borderColor = 'var(--border-subtle)';
          badgeView.style.color = '#a1a1aa';
        } else {
          badgeView.textContent = `Online: ${data.currentModel}`;
          badgeView.style.borderColor = 'var(--border-strong)';
          badgeView.style.color = '#ffffff';
        }
      }

      if (enabledInput) {
        enabledInput.checked = Boolean(data.enabled);
      }

      if (timeoutInput && data.timeoutSeconds) {
        timeoutInput.value = data.timeoutSeconds;
      }

      if (modelSelect && Array.isArray(data.availableModels) && data.availableModels.length > 0) {
        const prevVal = modelSelect.value || data.currentModel;
        modelSelect.innerHTML = '';
        for (const item of data.availableModels) {
          const modelId = typeof item === 'object' && item.id ? item.id : String(item);
          const modelName = typeof item === 'object' && item.name ? item.name : modelId;
          const opt = document.createElement('option');
          opt.value = modelId;
          opt.textContent = modelId === 'gemini-3.8-flash-high' ? `${modelName} - Default` : modelName;
          modelSelect.appendChild(opt);
        }
        modelSelect.value = data.currentModel || prevVal;
      } else if (modelSelect && data.currentModel) {
        modelSelect.value = data.currentModel;
      }
    }
  } catch (err) {
    if (sidebarPill) {
      sidebarPill.textContent = 'AGY: Offline';
      sidebarPill.classList.add('offline');
    }
    if (badgeView) {
      badgeView.textContent = 'Engine Offline';
    }
    console.error('Error fetching CLI agent status:', err);
  }
}

async function saveAgentSettings() {
  const enabledInput = document.getElementById('agentEnabled');
  const modelSelect = document.getElementById('agentModelSelect');
  const timeoutInput = document.getElementById('agentTimeoutInput');
  const msgEl = document.getElementById('agentSaveMsg');

  const payload = {
    enabled: enabledInput ? enabledInput.checked : true,
    model: modelSelect ? modelSelect.value : 'gemini-3.8-flash-high',
    timeout_seconds: timeoutInput ? parseInt(timeoutInput.value, 10) || 60 : 60
  };

  if (msgEl) msgEl.textContent = 'Saving...';

  try {
    const res = await fetch('/api/agent/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      if (msgEl) {
        msgEl.textContent = 'Saved to SQLite';
        setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 2500);
      }
      await fetchAgentStatus();
    } else {
      if (msgEl) msgEl.textContent = 'Save failed: ' + (result.error || 'Unknown error');
    }
  } catch (err) {
    if (msgEl) msgEl.textContent = 'Network error: ' + err.message;
  }
}

async function runAgentDiagnostic() {
  const outputEl = document.getElementById('agentDiagOutput');
  const testBtn = window.event?.target;

  if (testBtn && testBtn.tagName === 'BUTTON') {
    testBtn.disabled = true;
  }

  if (outputEl) {
    outputEl.style.display = 'block';
    outputEl.textContent = 'Executing non-interactive diagnostic query through agy...\nModel prompt: Ping verification\nTimeout: 30s';
  }

  try {
    const startTime = performance.now();
    const res = await fetch('/api/agent/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await res.json();
    const elapsed = Math.round(performance.now() - startTime);

    if (outputEl) {
      if (result.success) {
        outputEl.textContent = `[SUCCESS] Agent operational\nLatency: ${result.latencyMs || elapsed}ms\nResponse:\n${JSON.stringify(result.data, null, 2)}`;
      } else {
        outputEl.textContent = `[FAILED] Agent execution error\nLatency: ${elapsed}ms\nError: ${result.error || 'Unknown error'}\n${result.rawStderr ? 'Stderr:\n' + result.rawStderr : ''}`;
      }
    }
    await fetchAgentStatus();
  } catch (err) {
    if (outputEl) {
      outputEl.textContent = `[FAILED] Diagnostic request failed: ${err.message}`;
    }
  } finally {
    if (testBtn && testBtn.tagName === 'BUTTON') {
      testBtn.disabled = false;
    }
  }
}

/* =========================================================
   SYSTEM DIAGNOSTICS & DATABASE CONTROL
   ========================================================= */
async function fetchSystemStatus() {
  try {
    const res = await fetch('/api/system/status');
    const json = await res.json();
    if (json.success && json.data) {
      const d = json.data;
      const dbPathInput = document.getElementById('settingDbPath');
      if (dbPathInput && d.db_path) {
        dbPathInput.value = d.db_path;
      }
      const d1El = document.getElementById('cfD1Status');
      if (d1El && d.d1_database_name) {
        d1El.textContent = `${d.d1_database_name} (${d.d1_database_id?.slice(0, 8)}) · ${d.cf_region || 'APAC'}`;
      }
      const r2El = document.getElementById('cfR2Status');
      if (r2El && d.r2_bucket_name) {
        r2El.textContent = `${d.r2_bucket_name} · ${d.cf_region || 'APAC'} (Screenshots & Resumes)`;
      }
    }
  } catch (err) {
    console.error('Error fetching system status:', err);
  }
}

async function switchDatabasePath() {
  const pathInput = document.getElementById('settingDbPath');
  const msgEl = document.getElementById('dbActionMsg');
  const newPath = pathInput ? pathInput.value.trim() : '';
  if (!newPath) return;

  if (msgEl) msgEl.textContent = 'Saving database path...';
  try {
    const res = await fetch('/api/system/database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: newPath })
    });
    const result = await res.json();
    if (result.success) {
      if (msgEl) msgEl.textContent = 'Database path active';
      setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 3000);
      fetchJobs();
      fetchCriteria();
    } else {
      if (msgEl) msgEl.textContent = 'Error: ' + (result.error || 'Failed');
    }
  } catch (err) {
    if (msgEl) msgEl.textContent = 'Connection error: ' + err.message;
  }
}

async function createNewDatabase() {
  const newName = prompt('Enter path or name for new SQLite database:', 'data/amiya.db');
  if (!newName) return;
  const pathInput = document.getElementById('settingDbPath');
  if (pathInput) pathInput.value = newName;
  await switchDatabasePath();
}

/* =========================================================
   MODAL CONTROLLER & UTILITIES
   ========================================================= */
function showModal(category, title, subtitle, htmlContent, isWide = true) {
  document.getElementById('modalCategory').textContent = category;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalSubtitle').textContent = subtitle;
  document.getElementById('modalContent').innerHTML = htmlContent;

  const dialog = document.getElementById('centerModalDialog');
  if (isWide) {
    dialog.classList.remove('modal-compact');
    dialog.classList.add('modal-wide');
  } else {
    dialog.classList.remove('modal-wide');
    dialog.classList.add('modal-compact');
  }

  document.getElementById('centerModalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('centerModalOverlay').classList.remove('active');
}

function handleModalOverlayClick(e) {
  if (e.target.id === 'centerModalOverlay') {
    closeModal();
  }
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('Copied to clipboard: ' + text);
  }).catch(() => {});
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* =========================================================
   VIEW 7: SYSTEM ERRORS & OBSERVABILITY
   ========================================================= */
let errorsData = [];

async function fetchSystemErrors() {
  const tbody = document.getElementById('errorsTbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Loading system errors...</td></tr>';
  }
  try {
    const res = await fetch('/api/errors?limit=200');
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      errorsData = json.data;
      const count = json.unresolvedCount || 0;
      const badge = document.getElementById('badgeErrorsCount');
      if (badge) {
        if (count > 0) {
          badge.textContent = count;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
      renderErrorsTable();
    }
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="loading-cell">Failed to load system errors: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

function filterErrors() {
  renderErrorsTable();
}

function renderErrorsTable() {
  const tbody = document.getElementById('errorsTbody');
  if (!tbody) return;

  const search = (document.getElementById('errorsSearchInput')?.value || '').toLowerCase().trim();
  const categoryFilter = document.getElementById('errorsCategorySelect')?.value || 'ALL';
  const severityFilter = document.getElementById('errorsSeveritySelect')?.value || 'ALL';
  const statusFilter = document.getElementById('errorsStatusSelect')?.value || 'UNRESOLVED';

  const filtered = errorsData.filter(err => {
    if (categoryFilter !== 'ALL' && err.category !== categoryFilter) return false;
    if (severityFilter !== 'ALL' && err.severity !== severityFilter) return false;
    if (statusFilter === 'UNRESOLVED' && err.resolved !== 0) return false;
    if (statusFilter === 'RESOLVED' && err.resolved !== 1) return false;

    if (search) {
      const haystack = `${err.message} ${err.component} ${err.category} ${err.details || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">No matching system errors found. All systems nominal.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(err => {
    const isResolved = err.resolved === 1;
    const severityBadge = `<span class="status-badge" style="font-size: 10px; border-color: #3f3f46; background: #27272a; color: #ffffff;">${escapeHtml(err.severity)}</span>`;
    const statusBadge = isResolved
      ? `<span class="status-badge" style="font-size: 10px; border-color: #3f3f46; color: #71717a;">RESOLVED</span>`
      : `<span class="status-badge" style="font-size: 10px; border-color: #52525b; background: #18181b; color: #ffffff;">ACTIVE</span>`;

    return `
      <tr>
        <td style="font-size: 11.5px; color: #a1a1aa;">${formatTimestamp(err.timestamp)}</td>
        <td style="font-weight: 600; font-size: 12px; color: #ffffff;">${escapeHtml(err.category)}</td>
        <td style="text-align: center;">${severityBadge}</td>
        <td style="font-family: monospace; font-size: 12px; color: #d4d4d8;">${escapeHtml(err.component)}</td>
        <td style="font-size: 12.5px; color: #ffffff; max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(err.message)}">
          ${escapeHtml(err.message)}
        </td>
        <td style="text-align: center;">${statusBadge}</td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 6px; justify-content: center;">
            <button class="btn-secondary" onclick="openErrorDetailsModal(${err.id})" style="padding: 3px 8px; font-size: 11px;">
              Details
            </button>
            ${!isResolved ? `
              <button class="btn-primary" onclick="resolveErrorAction(${err.id})" style="padding: 3px 8px; font-size: 11px;">
                Resolve
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function resolveErrorAction(id) {
  try {
    const res = await fetch(`/api/errors/${id}/resolve`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      await fetchSystemErrors();
    }
  } catch (err) {
    alert('Failed to resolve error: ' + err.message);
  }
}

async function clearResolvedErrorsAction() {
  if (!confirm('Clear all resolved system errors from database?')) return;
  try {
    const res = await fetch('/api/errors/clear-resolved', { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      await fetchSystemErrors();
    }
  } catch (err) {
    alert('Failed to clear resolved errors: ' + err.message);
  }
}

function openErrorDetailsModal(id) {
  const err = errorsData.find(e => e.id === id);
  if (!err) return;

  const html = `
    <div class="modal-grid" style="margin-bottom: 14px;">
      <div class="modal-grid-item">
        <div class="modal-grid-label">Error ID</div>
        <div class="modal-grid-value">#${err.id}</div>
      </div>
      <div class="modal-grid-item">
        <div class="modal-grid-label">Category</div>
        <div class="modal-grid-value">${escapeHtml(err.category)}</div>
      </div>
      <div class="modal-grid-item">
        <div class="modal-grid-label">Severity</div>
        <div class="modal-grid-value">${escapeHtml(err.severity)}</div>
      </div>
      <div class="modal-grid-item">
        <div class="modal-grid-label">Component</div>
        <div class="modal-grid-value" style="font-family: monospace;">${escapeHtml(err.component)}</div>
      </div>
    </div>

    <div class="modal-section" style="margin-bottom: 14px;">
      <div class="modal-section-title">Message</div>
      <div style="background: var(--bg-app); border: 1px solid var(--border-strong); border-radius: 6px; padding: 12px 14px; font-size: 13.5px; font-weight: 600; color: #ffffff;">
        ${escapeHtml(err.message)}
      </div>
    </div>

    <div class="modal-section" style="margin-bottom: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <div class="modal-section-title">Diagnostic Context &amp; Stack Trace</div>
        ${err.details ? `<button class="btn-secondary" onclick="copyText(decodeURIComponent('${encodeURIComponent(err.details)}'))" style="padding: 2px 8px; font-size: 11px;">Copy Context</button>` : ''}
      </div>
      <div style="background: var(--bg-app); border: 1px solid var(--border-strong); border-radius: 6px; padding: 14px; font-family: monospace; font-size: 11.5px; color: #d4d4d8; white-space: pre-wrap; overflow-x: auto; max-height: 280px;">
        ${escapeHtml(err.details || 'No detailed stack trace recorded.')}
      </div>
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-subtle);">
      ${err.resolved === 0 ? `
        <button class="btn-primary" onclick="resolveErrorAction(${err.id}); closeModal();" style="padding: 6px 16px; font-size: 12px;">
          Mark as Resolved
        </button>
      ` : '<span style="font-size: 12px; color: #71717a; align-self: center;">Resolved ' + formatTimestamp(err.resolved_at) + '</span>'}
      <button class="btn-secondary" onclick="closeModal()" style="padding: 6px 16px; font-size: 12px;">Close</button>
    </div>
  `;

  showModal('SYSTEM ERROR DIAGNOSTIC', `Error #${err.id} - ${err.component}`, formatTimestamp(err.timestamp), html, true);
}

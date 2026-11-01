<script lang="ts">
  import { onMount } from 'svelte'
  import Sidebar from './lib/components/layout/Sidebar.svelte'
  import Topbar from './lib/components/layout/Topbar.svelte'
  import JobsLedgerView from './lib/components/jobs/JobsLedgerView.svelte'
  import CandidateProfileView from './lib/components/profile/CandidateProfileView.svelte'
  import DecisionCriteriaView from './lib/components/criteria/DecisionCriteriaView.svelte'
  import WebsitesDirectoryView from './lib/components/websites/WebsitesDirectoryView.svelte'
  import CompaniesView from './lib/components/companies/CompaniesView.svelte'
  import SystemErrorsView from './lib/components/errors/SystemErrorsView.svelte'
  import DailySchedulerModal from './lib/components/settings/DailySchedulerModal.svelte'
  import AgentSettingsModal from './lib/components/settings/AgentSettingsModal.svelte'
  import ConnectionsModal from './lib/components/settings/ConnectionsModal.svelte'

  let activeTab = $state('jobs')
  let isSidebarCollapsed = $state(false)
  let activeSettingsModal = $state<'scheduler' | 'agent' | 'connections' | null>(null)
  let counts = $state<{
    review?: number
    unresolvedProfile?: number
    criteria?: number
    companies?: number
    errors?: number
  }>({})

  const titles: Record<string, { title: string; subtitle?: string }> = {
    jobs: { title: 'Jobs Ledger', subtitle: 'Automated intake & portal application queue' },
    profile: { title: 'Candidate Profile Ledger', subtitle: 'Dynamic form field overrides & master coordinates' },
    criteria: { title: 'Personalization & Decision Criteria', subtitle: 'Filtering thresholds & operational story bank' },
    websites: { title: 'Target Websites Directory', subtitle: 'Portal authentication, scope & cooldown policy' },
    companies: { title: 'Companies Master Directory', subtitle: 'Employer intelligence & application tracking' },
    errors: { title: 'System Error Ledger', subtitle: 'Automated error captures & operational anomalies' }
  }

  async function loadCounts() {
    try {
      const [jobsRes, profileRes, critRes, compRes, errRes] = await Promise.all([
        fetch('/api/jobs').then(r => r.json()),
        fetch('/api/candidate/attributes').then(r => r.json()),
        fetch('/api/personalization').then(r => r.json()),
        fetch('/api/companies').then(r => r.json()),
        fetch('/api/errors').then(r => r.json())
      ])

      counts = {
        review: jobsRes.data?.filter((j: any) => j.status === 'PENDING_HUMAN').length || 0,
        unresolvedProfile: profileRes.data?.filter((a: any) => (!a.value || a.value.trim() === '') && a.is_agent_delegated !== 1).length || 0,
        criteria: critRes.data?.length || 0,
        companies: compRes.data?.length || 0,
        errors: errRes.data?.filter((e: any) => e.resolved === 0).length || 0
      }
    } catch (err) {
      console.error('Failed to load counts:', err)
    }
  }

  onMount(loadCounts)
</script>

<div class="app-shell">
  <Sidebar
    {activeTab}
    {counts}
    collapsed={isSidebarCollapsed}
    onTabChange={(tab) => activeTab = tab}
    onopensettingsmodal={(modal) => activeSettingsModal = modal}
  />

  <main class="main-content">
    <Topbar
      title={titles[activeTab]?.title || 'Console'}
      subtitle={titles[activeTab]?.subtitle}
      ontogglesidebar={() => isSidebarCollapsed = !isSidebarCollapsed}
    />

    <div class="view-viewport">
      {#if activeTab === 'jobs'}
        <JobsLedgerView onswitchview={(view) => activeTab = view} />
      {:else if activeTab === 'profile'}
        <CandidateProfileView />
      {:else if activeTab === 'criteria'}
        <DecisionCriteriaView />
      {:else if activeTab === 'websites'}
        <WebsitesDirectoryView />
      {:else if activeTab === 'companies'}
        <CompaniesView />
      {:else if activeTab === 'errors'}
        <SystemErrorsView />
      {/if}
    </div>
  </main>
</div>

<!-- Compact Settings Modals -->
{#if activeSettingsModal === 'scheduler'}
  <DailySchedulerModal onclose={() => activeSettingsModal = null} />
{:else if activeSettingsModal === 'agent'}
  <AgentSettingsModal onclose={() => activeSettingsModal = null} />
{:else if activeSettingsModal === 'connections'}
  <ConnectionsModal onclose={() => activeSettingsModal = null} />
{/if}

<style>
  .app-shell {
    display: flex;
    width: 100vw;
    height: 100vh;
    background: #09090b;
    overflow: hidden;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100vh;
    background: #09090b;
    overflow: hidden;
  }

  .view-viewport {
    flex: 1;
    overflow: hidden;
    position: relative;
    background: #09090b;
  }
</style>

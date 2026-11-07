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
  import NotificationDrawer from './lib/components/notifications/NotificationDrawer.svelte'

  function getTabFromUrl(): string {
    if (typeof window === 'undefined') return 'jobs'
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '')
    switch (path) {
      case '/candidate':
      case '/profile':
        return 'profile'
      case '/criteria':
        return 'criteria'
      case '/websites':
        return 'websites'
      case '/companies':
        return 'companies'
      case '/system-errors':
      case '/errors':
        return 'errors'
      case '/jobs':
      case '':
        return 'jobs'
      default:
        return 'jobs'
    }
  }

  function getPathForTab(tab: string): string {
    switch (tab) {
      case 'profile':
        return '/candidate'
      case 'criteria':
        return '/criteria'
      case 'websites':
        return '/websites'
      case 'companies':
        return '/companies'
      case 'errors':
        return '/system-errors'
      case 'jobs':
      default:
        return '/jobs'
    }
  }

  let activeTab = $state(getTabFromUrl())
  let isSidebarCollapsed = $state(false)
  let isNotificationDrawerOpen = $state(false)
  let notificationTriggerLeft = $state(180)
  let unreadNotificationsCount = $state(0)
  let candidateProfileSearchKey = $state('')
  let activeSettingsModal = $state<'scheduler' | 'agent' | 'connections' | null>(null)
  let notificationDrawerRef: { fetchNotifications: () => Promise<void> } | null = null

  function switchTab(tab: string, push: boolean = true) {
    activeTab = tab
    if (typeof window !== 'undefined') {
      const targetPath = getPathForTab(tab)
      if (window.location.pathname !== targetPath) {
        if (push) {
          window.history.pushState({ tab }, '', targetPath)
        } else {
          window.history.replaceState({ tab }, '', targetPath)
        }
      }
    }
  }

  onMount(() => {
    // Canonicalize path on first load if on / or legacy aliases
    const currentPath = window.location.pathname.toLowerCase().replace(/\/+$/, '')
    const canonicalPath = getPathForTab(activeTab)
    if (currentPath === '' || currentPath === '/' || currentPath === '/profile' || currentPath === '/errors') {
      window.history.replaceState({ tab: activeTab }, '', canonicalPath)
    }

    const handlePopState = () => {
      activeTab = getTabFromUrl()
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  })

  async function refreshUnreadCount() {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const json = await res.json()
        if (json.success) {
          unreadNotificationsCount = json.unread_count || 0
        }
      }
    } catch (_) {}
  }

  $effect(() => {
    refreshUnreadCount()
    const timer = setInterval(refreshUnreadCount, 15000)
    return () => clearInterval(timer)
  })

  const titles: Record<string, { title: string; subtitle?: string }> = {
    jobs: { title: 'Jobs Ledger', subtitle: 'Automated intake & portal application queue' },
    profile: { title: 'Candidate Profile Ledger', subtitle: 'Dynamic form field overrides & master coordinates' },
    criteria: { title: 'Personalization & Decision Criteria', subtitle: 'Filtering thresholds & operational story bank' },
    websites: { title: 'Target Websites Directory', subtitle: 'Portal authentication, scope & cooldown policy' },
    companies: { title: 'Companies Master Directory', subtitle: 'Employer intelligence & application tracking' },
    errors: { title: 'System Error Ledger', subtitle: 'Automated error captures & operational anomalies' }
  }
</script>

<div class="app-shell">
  <Sidebar
    {activeTab}
    collapsed={isSidebarCollapsed}
    {unreadNotificationsCount}
    onTabChange={(tab) => switchTab(tab)}
    onopensettingsmodal={(modal) => activeSettingsModal = modal}
    ontogglenotifications={(left) => {
      if (left !== undefined) notificationTriggerLeft = left
      isNotificationDrawerOpen = !isNotificationDrawerOpen
    }}
  />

  <main class="main-content">
    <Topbar
      title={titles[activeTab]?.title || 'Console'}
      subtitle={titles[activeTab]?.subtitle}
      ontogglesidebar={() => isSidebarCollapsed = !isSidebarCollapsed}
    />

    <div class="view-viewport">
      {#if activeTab === 'jobs'}
        <JobsLedgerView onswitchview={(view) => switchTab(view)} />
      {:else if activeTab === 'profile'}
        <CandidateProfileView initialSearchKey={candidateProfileSearchKey} />
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

<!-- Notification Popover / Drawer -->
<NotificationDrawer
  isOpen={isNotificationDrawerOpen}
  triggerLeft={notificationTriggerLeft}
  sidebarCollapsed={isSidebarCollapsed}
  onclose={() => isNotificationDrawerOpen = false}
  onnavigatetoprofile={(key) => {
    switchTab('profile')
    if (key) candidateProfileSearchKey = key
    isNotificationDrawerOpen = false
  }}
/>

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

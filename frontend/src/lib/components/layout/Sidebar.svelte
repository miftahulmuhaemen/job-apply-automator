<script lang="ts">
  import {
    Briefcase, User, SlidersHorizontal, Globe, Building2, AlertCircle,
    Settings, Bell
  } from 'lucide-svelte'

  let {
    activeTab = 'jobs',
    collapsed = false,
    unreadNotificationsCount = 0,
    onTabChange,
    onopensettingsmodal,
    ontogglenotifications
  } = $props<{
    activeTab: string
    collapsed?: boolean
    unreadNotificationsCount?: number
    onTabChange: (tab: string) => void
    onopensettingsmodal?: (modal?: string) => void
    ontogglenotifications?: (left?: number, top?: number) => void
  }>()

  const navItems = [
    { id: 'jobs', label: 'Jobs Ledger', icon: Briefcase },
    { id: 'profile', label: 'Candidate Profile', icon: User },
    { id: 'criteria', label: 'Decision Criteria', icon: SlidersHorizontal },
    { id: 'websites', label: 'Websites Directory', icon: Globe },
    { id: 'companies', label: 'Companies', icon: Building2 },
    { id: 'errors', label: 'System Errors', icon: AlertCircle }
  ]
</script>

<aside class="shadcn-sidebar" class:collapsed>
  <!-- Header: Brand Title & Top Actions (Logo removed, Bell & Settings moved here) -->
  <div class="sidebar-header">
    {#if !collapsed}
      <div class="header-brand">
        <div class="brand-text">
          <span class="brand-name">Job Apply Automator</span>
          <span class="brand-plan">Autonomous Engine</span>
        </div>
        <div class="header-actions">
          <button
            type="button"
            class="btn-header-action"
            title="Notifications"
            aria-label="Notifications"
            onclick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              ontogglenotifications?.(rect.left, rect.bottom + 8)
            }}
          >
            <Bell size={15} />
            {#if unreadNotificationsCount > 0}
              <span class="notification-badge">{unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}</span>
            {/if}
          </button>
          <button
            type="button"
            class="btn-header-action"
            title="Settings &amp; Infrastructure"
            aria-label="Settings"
            onclick={() => onopensettingsmodal?.('all')}
          >
            <Settings size={15} />
          </button>
        </div>
      </div>
    {:else}
      <!-- Collapsed / Hidden Form: Two rows for Bell (row 1) and Settings (row 2) -->
      <div class="header-actions collapsed-actions">
        <button
          type="button"
          class="btn-header-action"
          title="Notifications"
          aria-label="Notifications"
          onclick={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            ontogglenotifications?.(rect.right + 8, rect.top)
          }}
        >
          <Bell size={15} />
          {#if unreadNotificationsCount > 0}
            <span class="notification-badge">{unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}</span>
          {/if}
        </button>
        <button
          type="button"
          class="btn-header-action"
          title="Settings &amp; Infrastructure"
          aria-label="Settings"
          onclick={() => onopensettingsmodal?.('all')}
        >
          <Settings size={15} />
        </button>
      </div>
    {/if}
  </div>

  <!-- Content: Platform Navigation -->
  <div class="sidebar-content">
    <div class="sidebar-group">
      {#if !collapsed}
        <div class="group-label">Platform</div>
      {/if}
      <nav class="sidebar-menu">
        {#each navItems as item}
          {@const Icon = item.icon}
          <button
            type="button"
            class="menu-button"
            class:active={activeTab === item.id}
            onclick={() => onTabChange(item.id)}
            title={item.label}
          >
            <span class="menu-icon"><Icon size={16} /></span>
            {#if !collapsed}
              <span class="menu-label">{item.label}</span>
            {/if}
          </button>
        {/each}
      </nav>
    </div>
  </div>
</aside>

<style>
  .shadcn-sidebar {
    width: 250px;
    height: 100vh;
    background: #09090b;
    border-right: 1px solid #27272a;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }

  .shadcn-sidebar.collapsed {
    width: 64px;
  }

  /* Header */
  .sidebar-header {
    padding: 14px 14px 14px 20px;
    border-bottom: 1px solid #27272a;
    min-height: 56px;
    display: flex;
    align-items: center;
  }

  .shadcn-sidebar.collapsed .sidebar-header {
    padding: 12px 0;
    min-height: 84px;
    justify-content: center;
  }

  .header-brand {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .brand-name {
    font-size: 13.5px;
    font-weight: 600;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }

  .brand-plan {
    font-size: 11px;
    font-weight: 400;
    color: #71717a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .collapsed-actions {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .collapsed-actions .btn-header-action {
    width: 36px;
    height: 32px;
  }

  .btn-header-action {
    background: transparent;
    border: 1px solid transparent;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #a1a1aa;
    transition: all 0.15s ease;
    position: relative;
    flex-shrink: 0;
  }
  .btn-header-action:hover {
    background-color: #27272a;
    border-color: #3f3f46;
    color: #ffffff;
  }

  .notification-badge {
    position: absolute;
    top: 1px;
    right: 1px;
    background: #27272a;
    border: 1px solid #3f3f46;
    color: #f4f4f5;
    font-size: 9px;
    font-weight: 600;
    min-width: 14px;
    height: 14px;
    border-radius: 7px;
    padding: 0 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  /* Content */
  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .sidebar-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .group-label {
    font-size: 11px;
    font-weight: 500;
    color: #71717a;
    padding: 4px 8px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .sidebar-menu {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .menu-button {
    width: 100%;
    height: 36px;
    padding: 0 8px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: #a1a1aa;
    font-size: 13px;
    font-weight: 500;
    text-align: left;
    transition: background-color 0.15s ease, color 0.15s ease;
    outline: none;
  }
  .menu-button:hover {
    background: #18181b;
    color: #ffffff;
  }
  .menu-button.active {
    background: #27272a;
    color: #ffffff;
  }

  .menu-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .menu-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>

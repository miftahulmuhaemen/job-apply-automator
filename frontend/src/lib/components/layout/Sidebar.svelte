<script lang="ts">
  import { onMount } from 'svelte'
  import {
    Briefcase, User, SlidersHorizontal, Globe, Building2, AlertCircle,
    Settings, Clock, Database, Bot, Bell
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
    onopensettingsmodal?: (modal: 'scheduler' | 'agent' | 'connections') => void
    ontogglenotifications?: (left?: number) => void
  }>()

  let isSettingsOpen = $state(false)
  let footerRef: HTMLElement | null = null

  function handleClickOutside(e: MouseEvent) {
    if (footerRef && !footerRef.contains(e.target as Node)) {
      isSettingsOpen = false
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      isSettingsOpen = false
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  })

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
  <!-- Header: Team Switcher (Zero top <> icon) -->
  <div class="sidebar-header">
    <button type="button" class="team-switcher" title="Job Apply Automator - Autonomous Engine">
      <div class="team-logo">
        <Bot size={16} />
      </div>
      {#if !collapsed}
        <div class="team-info">
          <span class="team-name">Job Apply Automator</span>
          <span class="team-plan">Autonomous Engine</span>
        </div>
      {/if}
    </button>
  </div>

  <!-- Content: Platform Navigation (Zero settings nav item) -->
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

  <!-- Footer: Settings Icon Popover Trigger -->
  <div class="sidebar-footer" bind:this={footerRef}>
    {#if isSettingsOpen}
      <div class="settings-popover">
        <div class="settings-popover-title">Settings</div>
        <button
          type="button"
          class="settings-popover-item"
          onclick={() => { isSettingsOpen = false; onopensettingsmodal?.('scheduler') }}
        >
          <Clock size={14} class="settings-item-icon" />
          <span>Daily Scheduler</span>
        </button>
        <button
          type="button"
          class="settings-popover-item"
          onclick={() => { isSettingsOpen = false; onopensettingsmodal?.('agent') }}
        >
          <Bot size={14} class="settings-item-icon" />
          <span>Agent</span>
        </button>
        <button
          type="button"
          class="settings-popover-item"
          onclick={() => { isSettingsOpen = false; onopensettingsmodal?.('connections') }}
        >
          <Database size={14} class="settings-item-icon" />
          <span>Connections</span>
        </button>
      </div>
    {/if}

    <div
      class="nav-user"
      title="Candidate Ledger"
    >
      <div class="user-avatar">CP</div>
      {#if !collapsed}
        <div class="user-info">
          <span class="user-name">Candidate Ledger</span>
          <span class="user-meta">D1 Master Ledger</span>
        </div>
      {/if}
      <div class="user-actions">
        <button
          type="button"
          class="btn-notification-trigger"
          title="Notifications"
          aria-label="Notifications"
          onclick={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            ontogglenotifications?.(rect.left)
          }}
        >
          <Bell size={16} class="user-notification-icon" />
          {#if unreadNotificationsCount > 0}
            <span class="notification-badge">{unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}</span>
          {/if}
        </button>
        <button
          type="button"
          class="btn-settings-trigger"
          title="Settings &amp; Infrastructure"
          aria-label="Settings"
          onclick={() => isSettingsOpen = !isSettingsOpen}
        >
          <Settings size={16} class="user-settings-icon" />
        </button>
      </div>
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
    padding: 8px;
    border-bottom: 1px solid #27272a;
  }

  .team-switcher {
    width: 100%;
    height: 48px;
    padding: 0 8px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.15s ease;
    outline: none;
  }
  .team-switcher:hover {
    background: #18181b;
  }

  .nav-user {
    width: 100%;
    height: 48px;
    padding: 0 8px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: transparent;
    border-radius: 8px;
    text-align: left;
  }

  .user-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    flex-shrink: 0;
  }

  .btn-notification-trigger {
    background: transparent;
    border: 1px solid transparent;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #71717a;
    transition: all 0.15s ease;
    position: relative;
    flex-shrink: 0;
  }
  .btn-notification-trigger:hover {
    background-color: #27272a;
    border-color: #3f3f46;
    color: #ffffff;
  }

  .notification-badge {
    position: absolute;
    top: 2px;
    right: 2px;
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

  .btn-settings-trigger {
    background: transparent;
    border: 1px solid transparent;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #71717a;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }
  .btn-settings-trigger:hover {
    background-color: #27272a;
    border-color: #3f3f46;
    color: #ffffff;
  }

  .team-logo, .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: #27272a;
    border: 1px solid #3f3f46;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    flex-shrink: 0;
  }
  .user-avatar {
    font-size: 11.5px;
    font-weight: 700;
  }

  .team-info, .user-info {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex: 1;
  }

  .team-name, .user-name {
    font-size: 13px;
    font-weight: 600;
    color: #ffffff;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .team-plan, .user-meta {
    font-size: 11px;
    color: #71717a;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Content */
  .sidebar-content {
    flex: 1;
    padding: 8px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .sidebar-group, .sidebar-menu {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .group-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #71717a;
    padding: 8px 8px 4px 8px;
  }

  .menu-button {
    width: 100%;
    height: 36px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 500;
    color: #a1a1aa;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
    outline: none;
    white-space: nowrap;
  }

  .collapsed .menu-button { padding: 0; justify-content: center; }
  .menu-button:hover { color: #ffffff; background: #18181b; }
  .menu-button.active { color: #ffffff; background: #27272a; border-color: #3f3f46; font-weight: 600; }
  .menu-icon { display: flex; align-items: center; justify-content: center; color: inherit; flex-shrink: 0; }
  .menu-label { flex: 1; overflow: hidden; text-overflow: ellipsis; }

  /* Footer & Popover */
  .sidebar-footer {
    position: relative;
    padding: 8px;
    border-top: 1px solid #27272a;
  }

  .settings-popover {
    position: absolute;
    bottom: calc(100% + 6px);
    right: 8px;
    left: auto;
    min-width: 190px;
    width: max-content;
    background-color: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .settings-popover-title {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    color: #71717a;
    padding: 6px 10px 4px;
    letter-spacing: 0.04em;
    border-bottom: 1px solid #27272a;
    margin-bottom: 2px;
  }

  .settings-popover-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #f4f4f5;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: background-color 0.12s;
  }
  .settings-popover-item:hover {
    background-color: #27272a;
    color: #ffffff;
  }

  :global(.settings-item-icon) {
    color: #a1a1aa;
    flex-shrink: 0;
  }

  :global(.user-settings-icon) {
    color: inherit;
    flex-shrink: 0;
  }

</style>

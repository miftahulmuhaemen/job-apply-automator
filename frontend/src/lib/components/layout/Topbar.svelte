<script lang="ts">
  import { PanelLeft } from 'lucide-svelte'

  let {
    title = '',
    subtitle = '',
    ontogglesidebar
  } = $props<{
    title: string
    subtitle?: string
    ontogglesidebar?: () => void
  }>()
</script>

<header class="topbar">
  <button
    type="button"
    class="sidebar-trigger"
    onclick={ontogglesidebar}
    title="Toggle Sidebar"
    aria-label="Toggle Sidebar"
  >
    <PanelLeft size={16} />
  </button>

  <div class="topbar-divider"></div>

  <div class="topbar-content">
    <h1 class="topbar-title">{title}</h1>
    {#if subtitle}
      <span class="topbar-subtitle">{subtitle}</span>
    {/if}
  </div>
</header>

<style>
  .topbar {
    height: 52px;
    background: #09090b;
    border-bottom: 1px solid #27272a;
    display: flex;
    align-items: center;
    padding: 0 16px;
    flex-shrink: 0;
  }

  .sidebar-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #a1a1aa;
    cursor: pointer;
    transition: all 0.15s ease;
    padding: 0;
  }

  .sidebar-trigger:hover {
    color: #ffffff;
    background: #27272a;
  }

  .topbar-divider {
    width: 1px;
    height: 16px;
    background: #27272a;
    margin: 0 12px;
  }

  .topbar-content {
    display: flex;
    align-items: baseline;
    gap: 12px;
    overflow: hidden;
  }

  .topbar-title {
    font-size: 14.5px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.2px;
    white-space: nowrap;
  }

  .topbar-subtitle {
    font-size: 12px;
    color: #71717a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>

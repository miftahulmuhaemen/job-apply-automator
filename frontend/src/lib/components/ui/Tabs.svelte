<script lang="ts">
  interface TabItem {
    id: string
    label: string
    count?: number
  }

  let {
    value = '',
    items = [],
    class: customClass = '',
    onchange
  } = $props<{
    value: string
    items: TabItem[]
    class?: string
    onchange: (id: string) => void
  }>()

  function selectTab(id: string) {
    if (id !== value && onchange) {
      onchange(id)
    }
  }
</script>

<div class="shadcn-tabs-list {customClass}" role="tablist">
  {#each items as item}
    <button
      type="button"
      role="tab"
      class="shadcn-tab-trigger"
      class:active={item.id === value}
      aria-selected={item.id === value}
      onclick={() => selectTab(item.id)}
    >
      <span>{item.label}</span>
      {#if item.count !== undefined}
        <span class="tab-count-badge" class:active-count={item.id === value}>{item.count}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .shadcn-tabs-list {
    display: inline-flex;
    align-items: center;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 3px;
    gap: 3px;
    user-select: none;
    max-width: 100%;
    overflow-x: auto;
  }

  .shadcn-tab-trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    color: #a1a1aa;
    background: transparent;
    border: none;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
    outline: none;
  }

  .shadcn-tab-trigger:hover:not(.active) {
    color: #f4f4f5;
  }

  .shadcn-tab-trigger:focus-visible {
    outline: 2px solid #52525b;
    outline-offset: 1px;
  }

  .shadcn-tab-trigger.active {
    background: #27272a;
    color: #ffffff;
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }

  .tab-count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 9999px;
    font-size: 10px;
    font-weight: 600;
    background: #27272a;
    color: #71717a;
    border: 1px solid #3f3f46;
  }

  .tab-count-badge.active-count {
    background: #18181b;
    color: #f4f4f5;
    border-color: #52525b;
  }
</style>

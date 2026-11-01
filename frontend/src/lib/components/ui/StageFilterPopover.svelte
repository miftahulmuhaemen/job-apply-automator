<script lang="ts">
  import { onMount } from 'svelte'
  import { ChevronDown, Check } from 'lucide-svelte'

  let {
    value,
    items,
    onchange,
    prefix = '',
    ariaLabel = 'Filter options'
  }: {
    value: string
    items: { id: string; label: string; count?: number }[]
    onchange: (id: string) => void
    prefix?: string
    ariaLabel?: string
  } = $props()

  let isOpen = $state(false)
  let menuRef: HTMLDivElement | null = null

  const activeItem = $derived(items.find(i => i.id === value) || items[0])

  function handleClickOutside(e: MouseEvent) {
    if (menuRef && !menuRef.contains(e.target as Node)) {
      isOpen = false
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') isOpen = false
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  })
</script>

<div class="stage-filter-container" bind:this={menuRef}>
  <button
    type="button"
    class="stage-filter-trigger"
    onclick={() => isOpen = !isOpen}
    aria-expanded={isOpen}
    aria-label={ariaLabel}
  >
    {#if prefix}
      <span class="prefix-label">{prefix}</span>
    {/if}
    <span class="active-label">{activeItem?.label || 'Select'}</span>
    {#if typeof activeItem?.count === 'number'}
      <span class="count-badge">{activeItem.count}</span>
    {/if}
    <ChevronDown size={13} class="chevron-icon" />
  </button>

  {#if isOpen}
    <div class="stage-filter-menu" role="menu">
      {#each items as item}
        <button
          type="button"
          class="stage-item {item.id === value ? 'active' : ''}"
          role="menuitem"
          onclick={() => {
            onchange(item.id)
            isOpen = false
          }}
        >
          <div class="item-left">
            <span class="check-box">
              {#if item.id === value}
                <Check size={13} />
              {/if}
            </span>
            <span class="item-label">{item.label}</span>
          </div>
          {#if typeof item.count === 'number'}
            <span class="item-count">{item.count}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .stage-filter-container {
    position: relative;
    display: inline-block;
  }

  .stage-filter-trigger {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 32px;
    padding: 0 10px;
    background-color: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    color: #f4f4f5;
    font-size: 12.5px;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s, border-color 0.15s;
  }

  .stage-filter-trigger:hover {
    background-color: #27272a;
    border-color: #3f3f46;
  }

  .prefix-label {
    color: #71717a;
  }

  .active-label {
    font-weight: 500;
  }

  .count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 1px 6px;
    font-size: 11px;
    font-weight: 600;
    background-color: #27272a;
    color: #f4f4f5;
    border-radius: 9999px;
  }

  :global(.chevron-icon) {
    color: #71717a;
    transition: transform 0.15s;
  }

  .stage-filter-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 50;
    min-width: 210px;
    background-color: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .stage-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 6px 8px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #a1a1aa;
    font-size: 12.5px;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.15s, color 0.15s;
  }

  .stage-item:hover {
    background-color: #27272a;
    color: #f4f4f5;
  }

  .stage-item.active {
    color: #ffffff;
    font-weight: 500;
  }

  .item-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .check-box {
    width: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
  }

  .item-label {
    white-space: nowrap;
  }

  .item-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 1px 6px;
    font-size: 11px;
    font-weight: 500;
    background-color: #27272a;
    color: #a1a1aa;
    border-radius: 9999px;
  }
</style>

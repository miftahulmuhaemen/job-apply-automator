<script lang="ts">
  import { onMount } from 'svelte'
  import { ChevronDown, Check } from 'lucide-svelte'

  let {
    columns,
    ontoggle
  }: {
    columns: { id: string; label: string; visible: boolean }[]
    ontoggle: (id: string) => void
  } = $props()

  let isOpen = $state(false)
  let menuRef: HTMLDivElement | null = null

  function handleClickOutside(e: MouseEvent) {
    if (menuRef && !menuRef.contains(e.target as Node)) {
      isOpen = false
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  })
</script>

<div class="columns-popover-container" bind:this={menuRef}>
  <button
    type="button"
    class="btn-columns-trigger"
    onclick={() => isOpen = !isOpen}
    aria-expanded={isOpen}
    aria-label="Toggle column visibility"
  >
    Columns
    <ChevronDown size={13} style="margin-left: 6px; color: #a1a1aa;" />
  </button>

  {#if isOpen}
    <div class="columns-popover-menu">
      <div class="popover-title">Toggle Columns</div>
      {#each columns as col}
        <button
          type="button"
          class="column-item"
          onclick={() => ontoggle(col.id)}
        >
          <span class="column-label">{col.label}</span>
          {#if col.visible}
            <Check size={13} class="check-icon" />
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .columns-popover-container {
    position: relative;
    display: inline-block;
  }

  .btn-columns-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    padding: 0 12px;
    background-color: #18181b;
    color: #f4f4f5;
    border: 1px solid #27272a;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s, border-color 0.15s;
  }
  .btn-columns-trigger:hover {
    background-color: #27272a;
    border-color: #3f3f46;
  }

  .columns-popover-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background-color: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 4px;
    min-width: 150px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
    z-index: 50;
  }

  .popover-title {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    color: #71717a;
    padding: 6px 10px 4px;
    letter-spacing: 0.04em;
    border-bottom: 1px solid #27272a;
    margin-bottom: 4px;
  }

  .column-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 6px 10px;
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
  .column-item:hover {
    background-color: #27272a;
  }

  .column-label {
    flex: 1;
  }

  :global(.check-icon) {
    color: #ffffff;
  }
</style>

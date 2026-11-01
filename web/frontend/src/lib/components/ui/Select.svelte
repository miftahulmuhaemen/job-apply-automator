<script lang="ts">
  import { onMount } from 'svelte'
  import { ChevronDown, Check } from 'lucide-svelte'

  interface Option {
    value: string
    label: string
  }

  let {
    value = '',
    options = [],
    placeholder = 'Select option...',
    disabled = false,
    width = 'auto',
    ariaLabel = 'Select option',
    onchange
  } = $props<{
    value?: string
    options?: Option[]
    placeholder?: string
    disabled?: boolean
    width?: string
    ariaLabel?: string
    onchange?: (value: string) => void
  }>()

  let isOpen = $state(false)
  let containerRef: HTMLDivElement | null = $state(null)

  let selectedLabel = $derived(() => {
    const opt = options.find((o: Option) => o.value === value)
    return opt ? opt.label : placeholder
  })

  function toggle(e: MouseEvent) {
    e.stopPropagation()
    if (disabled) return
    isOpen = !isOpen
  }

  function selectOption(val: string, e: MouseEvent) {
    e.stopPropagation()
    isOpen = false
    if (onchange) onchange(val)
  }

  function handleDocumentClick(e: MouseEvent) {
    if (isOpen && containerRef && !containerRef.contains(e.target as Node)) {
      isOpen = false
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      isOpen = false
    }
  }

  onMount(() => {
    document.addEventListener('click', handleDocumentClick)
    document.addEventListener('keydown', handleKeydown)
    return () => {
      document.removeEventListener('click', handleDocumentClick)
      document.removeEventListener('keydown', handleKeydown)
    }
  })
</script>

<div class="shadcn-select-container" style="width: {width};" bind:this={containerRef}>
  <button
    type="button"
    class="shadcn-select-trigger"
    class:open={isOpen}
    class:disabled
    {disabled}
    onclick={toggle}
    aria-haspopup="listbox"
    aria-expanded={isOpen}
    aria-label={ariaLabel}
  >
    <span class="trigger-label">{selectedLabel()}</span>
    <ChevronDown size={14} class="trigger-icon" />
  </button>

  {#if isOpen}
    <div class="shadcn-select-content" role="listbox" tabindex="-1">
      {#each options as opt}
        <button
          type="button"
          class="shadcn-select-item"
          class:selected={opt.value === value}
          role="option"
          aria-selected={opt.value === value}
          onclick={(e) => selectOption(opt.value, e)}
        >
          <span class="item-label">{opt.label}</span>
          {#if opt.value === value}
            <Check size={13} class="item-check" />
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .shadcn-select-container {
    position: relative;
    display: inline-block;
  }

  .shadcn-select-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    height: 32px;
    width: 100%;
    padding: 0 10px;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    color: #f4f4f5;
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
    user-select: none;
    white-space: nowrap;
  }

  .shadcn-select-trigger:hover:not(.disabled) {
    border-color: #3f3f46;
  }

  .shadcn-select-trigger:focus-visible {
    border-color: #52525b;
    outline: 2px solid #52525b;
    outline-offset: 1px;
  }

  .shadcn-select-trigger.open {
    border-color: #52525b;
  }

  .shadcn-select-trigger.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .trigger-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }

  :global(.trigger-icon) {
    color: #71717a;
    flex-shrink: 0;
    transition: transform 0.2s ease;
  }

  .shadcn-select-trigger.open :global(.trigger-icon) {
    transform: rotate(180deg);
  }

  .shadcn-select-content {
    position: absolute;
    left: 0;
    top: 100%;
    margin-top: 4px;
    background: #18181b;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.85);
    z-index: 60;
    min-width: 100%;
    width: max-content;
    max-width: 320px;
    max-height: 280px;
    overflow-y: auto;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .shadcn-select-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    padding: 6px 10px;
    font-size: 12px;
    color: #a1a1aa;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    transition: background 0.12s, color 0.12s;
    user-select: none;
    outline: none;
  }

  .shadcn-select-item:hover {
    background: #27272a;
    color: #ffffff;
  }

  .shadcn-select-item.selected {
    background: #27272a;
    color: #ffffff;
    font-weight: 600;
  }

  .item-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.item-check) {
    color: #ffffff;
    flex-shrink: 0;
  }
</style>

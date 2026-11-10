<script lang="ts">
  import { ChevronDown } from 'lucide-svelte'

  let {
    title,
    badge = '',
    subtitle = '',
    defaultOpen = false,
    open: controlledOpen,
    ontoggle,
    children
  } = $props<{
    title: string
    badge?: string
    subtitle?: string
    defaultOpen?: boolean
    open?: boolean
    ontoggle?: () => void
    children: any
  }>()

  let localOpen = $state(false)
  $effect(() => {
    localOpen = defaultOpen
  })
  let isOpen = $derived(controlledOpen !== undefined ? controlledOpen : localOpen)

  function toggle() {
    if (ontoggle) {
      ontoggle()
    } else {
      localOpen = !isOpen
    }
  }
</script>

<div class="shadcn-accordion-item" class:is-open={isOpen}>
  <button
    type="button"
    class="accordion-trigger"
    aria-expanded={isOpen}
    onclick={toggle}
  >
    <div class="trigger-left">
      <span class="accordion-title">{title}</span>
      {#if subtitle}
        <span class="accordion-subtitle">{subtitle}</span>
      {/if}
      {#if badge}
        <span class="accordion-badge">{badge}</span>
      {/if}
    </div>
    <ChevronDown size={14} class="accordion-chevron" />
  </button>

  {#if isOpen}
    <div class="accordion-content" role="region">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .shadcn-accordion-item {
    border-bottom: 1px solid #27272a;
    width: 100%;
  }

  .accordion-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 4px;
    background: transparent;
    border: none;
    color: #f4f4f5;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    outline: none;
    transition: color 0.15s ease;
  }

  .accordion-trigger:hover {
    color: #ffffff;
  }

  .trigger-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .accordion-title {
    color: inherit;
  }

  .accordion-subtitle {
    font-size: 11px;
    font-weight: 400;
    color: #71717a;
  }

  .accordion-badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: 9999px;
    font-size: 10px;
    font-weight: 600;
    background: #27272a;
    color: #a1a1aa;
    border: 1px solid #3f3f46;
  }

  :global(.accordion-chevron) {
    color: #71717a;
    flex-shrink: 0;
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .shadcn-accordion-item.is-open :global(.accordion-chevron) {
    transform: rotate(180deg);
  }

  .accordion-content {
    padding: 4px 4px 16px 4px;
  }
</style>

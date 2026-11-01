<script lang="ts" module>
  // Global module-level coordination: strictly ensures at most ONE popover is open app-wide
  let currentCloseFn: (() => void) | null = null

  export function closeActivePopover() {
    if (currentCloseFn) {
      currentCloseFn()
      currentCloseFn = null
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('click', (e) => {
      // If clicking outside any open popover container, dismiss immediately
      const target = e.target as HTMLElement | null
      if (!target?.closest('.popover-container')) {
        closeActivePopover()
      }
    })
    window.addEventListener('scroll', () => closeActivePopover(), true)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeActivePopover()
    })
  }
</script>

<script lang="ts">
  import { Ellipsis } from 'lucide-svelte'

  let { title = 'Actions', children } = $props<{
    title?: string
    children: any
  }>()

  let isOpen = $state(false)
  let containerRef: HTMLDivElement | null = $state(null)

  function close() {
    isOpen = false
    if (currentCloseFn === close) {
      currentCloseFn = null
    }
  }

  function toggle(e: MouseEvent) {
    e.stopPropagation()
    if (isOpen) {
      close()
    } else {
      closeActivePopover()
      isOpen = true
      currentCloseFn = close
    }
  }
</script>

<div class="popover-container" bind:this={containerRef}>
  <button
    type="button"
    class="btn-icon"
    onclick={toggle}
    title={title}
    aria-label={title}
  >
    <Ellipsis size={15} />
  </button>

  {#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="popover-menu"
      onclick={() => close()}
      role="menu"
      tabindex="-1"
    >
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .popover-container {
    position: relative;
    display: inline-block;
  }

  .popover-menu {
    position: absolute;
    right: 0;
    top: 100%;
    margin-top: 4px;
    background: #18181b;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.75);
    z-index: 50;
    min-width: 170px;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  :global(.popover-menu button),
  :global(.popover-menu a) {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    font-size: 12px;
    color: #f4f4f5;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }

  :global(.popover-menu button:hover),
  :global(.popover-menu a:hover) {
    background: #27272a;
    color: #ffffff;
  }

  :global(.popover-menu button.danger:hover) {
    background: #27272a;
    color: #ffffff;
  }
</style>

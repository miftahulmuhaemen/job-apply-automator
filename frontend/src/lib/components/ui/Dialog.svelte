<script lang="ts">
  import { onMount } from 'svelte'
  import { X } from 'lucide-svelte'

  let {
    open = false,
    title = '',
    subtitle = '',
    maxWidth = '600px',
    children,
    footer,
    onclose
  } = $props<{
    open: boolean
    title?: string
    subtitle?: string
    maxWidth?: string
    children: any
    footer?: any
    onclose: () => void
  }>()

  function handleBackdropClick() {
    if (onclose) onclose()
  }

  function handleKeydown(e: KeyboardEvent) {
    if (open && e.key === 'Escape') {
      if (onclose) onclose()
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  })
</script>

{#if open}
  <div
    class="shadcn-dialog-backdrop"
    onclick={handleBackdropClick}
    role="presentation"
  >
    <div
      class="shadcn-dialog-panel"
      style="max-width: {maxWidth};"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabindex="-1"
    >
      {#if title || onclose}
        <div class="shadcn-dialog-header">
          <div class="header-text">
            {#if title}
              <h2 class="shadcn-dialog-title">{title}</h2>
            {/if}
            {#if subtitle}
              <p class="shadcn-dialog-subtitle">{subtitle}</p>
            {/if}
          </div>
          {#if onclose}
            <button
              type="button"
              class="shadcn-dialog-close"
              onclick={onclose}
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          {/if}
        </div>
      {/if}

      <div class="shadcn-dialog-body">
        {@render children()}
      </div>

      {#if footer}
        <div class="shadcn-dialog-footer">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .shadcn-dialog-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.15s ease-out;
  }

  .shadcn-dialog-panel {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.9);
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .shadcn-dialog-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 18px 20px 14px 20px;
    border-bottom: 1px solid #27272a;
    gap: 12px;
  }

  .header-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .shadcn-dialog-title {
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    line-height: 1.3;
  }

  .shadcn-dialog-subtitle {
    font-size: 12px;
    color: #a1a1aa;
    margin: 0;
    line-height: 1.4;
  }

  .shadcn-dialog-close {
    background: transparent;
    border: none;
    color: #71717a;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, background 0.15s;
  }

  .shadcn-dialog-close:hover {
    color: #ffffff;
    background: #27272a;
  }

  .shadcn-dialog-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .shadcn-dialog-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid #27272a;
    background: #18181b;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>

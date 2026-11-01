<script lang="ts">
  let {
    variant = 'default',
    class: customClass = '',
    children
  } = $props<{
    variant?: 'default' | 'outline' | 'secondary' | 'active'
    class?: string
    children: any
  }>()
</script>

<span class="shadcn-badge variant-{variant} {customClass}">
  {@render children()}
</span>

<style>
  .shadcn-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    line-height: 1.4;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    user-select: none;
    white-space: nowrap;
  }

  .variant-default {
    background: #27272a;
    color: #f4f4f5;
    border: 1px solid #3f3f46;
  }

  .variant-outline {
    background: transparent;
    color: #a1a1aa;
    border: 1px solid #3f3f46;
  }

  .variant-secondary {
    background: #18181b;
    color: #a1a1aa;
    border: 1px solid #27272a;
  }

  .variant-active {
    background: #ffffff;
    color: #09090b;
    border: 1px solid #ffffff;
    font-weight: 700;
  }
</style>

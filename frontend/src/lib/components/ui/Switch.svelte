<script lang="ts">
  let {
    checked = false,
    disabled = false,
    ariaLabel = 'Toggle switch',
    onchange
  } = $props<{
    checked: boolean
    disabled?: boolean
    ariaLabel?: string
    onchange?: (checked: boolean) => void
  }>()

  function toggle() {
    if (disabled) return
    onchange?.(!checked)
  }
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={ariaLabel}
  disabled={disabled}
  class="shadcn-switch"
  class:checked={checked}
  onclick={toggle}
>
  <span class="shadcn-switch-thumb" class:thumb-checked={checked}></span>
</button>

<style>
  .shadcn-switch {
    width: 36px;
    height: 20px;
    border-radius: 9999px;
    background-color: #27272a;
    border: 1px solid #3f3f46;
    padding: 0;
    cursor: pointer;
    position: relative;
    display: inline-flex;
    align-items: center;
    transition: background-color 0.15s ease, border-color 0.15s ease;
    outline: none;
    flex-shrink: 0;
  }

  .shadcn-switch:hover:not(:disabled) {
    border-color: #52525b;
  }

  .shadcn-switch:focus-visible {
    outline: 2px solid #52525b;
    outline-offset: 2px;
  }

  .shadcn-switch.checked {
    background-color: #ffffff;
    border-color: #ffffff;
  }

  .shadcn-switch:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .shadcn-switch-thumb {
    width: 14px;
    height: 14px;
    border-radius: 9999px;
    background-color: #71717a;
    position: absolute;
    left: 2px;
    transition: transform 0.15s ease, background-color 0.15s ease;
  }

  .shadcn-switch-thumb.thumb-checked {
    transform: translateX(16px);
    background-color: #09090b;
  }
</style>

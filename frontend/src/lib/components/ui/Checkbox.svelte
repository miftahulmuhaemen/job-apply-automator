<script lang="ts">
  import { Check, Minus } from 'lucide-svelte'

  let {
    checked = false,
    indeterminate = false,
    disabled = false,
    ariaLabel = 'Select item',
    id = '',
    onchange
  } = $props<{
    checked?: boolean
    indeterminate?: boolean
    disabled?: boolean
    ariaLabel?: string
    id?: string
    onchange?: (checked: boolean) => void
  }>()

  function toggle(e: MouseEvent) {
    e.stopPropagation()
    if (disabled) return
    const next = !checked
    if (onchange) onchange(next)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (disabled) return
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      const next = !checked
      if (onchange) onchange(next)
    }
  }
</script>

<button
  type="button"
  role="checkbox"
  aria-checked={indeterminate ? 'mixed' : checked}
  aria-label={ariaLabel}
  {id}
  {disabled}
  class="shadcn-checkbox"
  class:checked
  class:indeterminate
  class:disabled
  onclick={toggle}
  onkeydown={handleKeydown}
>
  {#if indeterminate}
    <Minus size={11} strokeWidth={3.5} />
  {:else if checked}
    <Check size={11} strokeWidth={3.5} />
  {/if}
</button>

<style>
  .shadcn-checkbox {
    width: 16px;
    height: 16px;
    min-width: 16px;
    min-height: 16px;
    border-radius: 4px;
    border: 1px solid #52525b;
    background: transparent;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    outline: none;
    user-select: none;
  }

  .shadcn-checkbox:hover:not(.disabled) {
    border-color: #a1a1aa;
  }

  .shadcn-checkbox:focus-visible {
    outline: 2px solid #a1a1aa;
    outline-offset: 2px;
  }

  .shadcn-checkbox.checked,
  .shadcn-checkbox.indeterminate {
    background: #ffffff;
    border-color: #ffffff;
    color: #09090b;
  }

  .shadcn-checkbox.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

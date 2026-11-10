<script lang="ts">
  import Dialog from '../ui/Dialog.svelte'

  let {
    open,
    onclose,
    onsave
  }: {
    open: boolean
    onclose: () => void
    onsave: (rule: { category: string; key: string; value: string; description: string }) => Promise<void>
  } = $props()

  let newCategory = $state('')
  let newKey = $state('')
  let newValue = $state('')
  let newDescription = $state('')

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!newCategory.trim() || !newKey.trim() || !newValue.trim()) {
      alert('Category, key, and value are required.')
      return
    }
    await onsave({
      category: newCategory.trim(),
      key: newKey.trim(),
      value: newValue.trim(),
      description: newDescription.trim()
    })
    newCategory = ''
    newKey = ''
    newValue = ''
    newDescription = ''
  }
</script>

<Dialog
  {open}
  {onclose}
  title="Register Decision Parameter"
  subtitle="Configure new programmatic or semantic evaluation rule"
>
  <form onsubmit={handleSubmit} id="add-rule-form">
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div>
        <label for="new-rule-category" style="display: block; font-size: 11px; text-transform: uppercase; color: #a1a1aa; font-weight: 600; margin-bottom: 4px;">Category</label>
        <input id="new-rule-category" type="text" class="input-base" style="width: 100%;" bind:value={newCategory} placeholder="e.g. Application Throughput, Technology Blacklist" required />
      </div>

      <div>
        <label for="new-rule-key" style="display: block; font-size: 11px; text-transform: uppercase; color: #a1a1aa; font-weight: 600; margin-bottom: 4px;">Parameter Key</label>
        <input id="new-rule-key" type="text" class="input-base" style="width: 100%;" bind:value={newKey} placeholder="e.g. batch_size, tech_blacklist" required />
      </div>

      <div>
        <label for="new-rule-value" style="display: block; font-size: 11px; text-transform: uppercase; color: #a1a1aa; font-weight: 600; margin-bottom: 4px;">Criteria Value / Logic</label>
        <textarea id="new-rule-value" class="input-base" style="width: 100%;" rows="2" bind:value={newValue} placeholder="e.g. 10 or C#, .NET" required></textarea>
      </div>

      <div>
        <label for="new-rule-desc" style="display: block; font-size: 11px; text-transform: uppercase; color: #a1a1aa; font-weight: 600; margin-bottom: 4px;">Operational Guidance &amp; Lengthy Context</label>
        <textarea id="new-rule-desc" class="input-base" style="width: 100%;" rows="3" bind:value={newDescription} placeholder="Context for LLMs / operators explaining boundary conditions..."></textarea>
      </div>
    </div>
  </form>

  {#snippet footer()}
    <button type="button" class="btn-secondary" onclick={onclose}>
      Cancel
    </button>
    <button type="submit" form="add-rule-form" class="btn-primary">
      Register Rule
    </button>
  {/snippet}
</Dialog>

<style>
  .input-base {
    background-color: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 13px;
    color: #f4f4f5;
    font-family: inherit;
    box-sizing: border-box;
  }
  .input-base:focus {
    outline: none;
    border-color: #52525b;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background-color: #ffffff;
    color: #09090b;
    border: 1px solid #ffffff;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-primary:hover {
    background-color: #f4f4f5;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background-color: #27272a;
    color: #f4f4f5;
    border: 1px solid #3f3f46;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-secondary:hover {
    background-color: #3f3f46;
  }
</style>

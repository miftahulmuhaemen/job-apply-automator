<script lang="ts">
  import Dialog from '../ui/Dialog.svelte'
  import Select from '../ui/Select.svelte'

  let {
    open,
    onclose,
    onsave
  }: {
    open: boolean
    onclose: () => void
    onsave: (data: { name: string; url: string; auth_type: string; cooldown_days: number; notes: string }) => Promise<void>
  } = $props()

  let newName = $state('')
  let newUrl = $state('')
  let newAuthType = $state('Google PIN')
  let newCooldown = $state(0)
  let newNotes = $state('')

  async function handleSubmit(e: Event) {
    e.preventDefault()
    await onsave({
      name: newName.trim(),
      url: newUrl.trim(),
      auth_type: newAuthType,
      cooldown_days: newCooldown,
      notes: newNotes.trim()
    })
    newName = ''
    newUrl = ''
    newCooldown = 0
    newNotes = ''
  }
</script>

<Dialog
  {open}
  {onclose}
  title="Register Target Portal"
  subtitle="Configure portal URL and re-application cooldown"
>
  <form onsubmit={handleSubmit} id="add-website-form">
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div>
        <label for="new-website-name" style="display: block; font-size: 11px; text-transform: uppercase; color: #a1a1aa; font-weight: 600; margin-bottom: 4px;">Portal Name</label>
        <input id="new-website-name" type="text" class="input-base" style="width: 100%;" bind:value={newName} placeholder="e.g. Kalibrr Indonesia" required />
      </div>

      <div>
        <label for="new-website-url" style="display: block; font-size: 11px; text-transform: uppercase; color: #a1a1aa; font-weight: 600; margin-bottom: 4px;">Target URL</label>
        <input id="new-website-url" type="url" class="input-base" style="width: 100%;" bind:value={newUrl} placeholder="https://..." required />
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div>
          <label for="new-website-auth" style="display: block; font-size: 11px; text-transform: uppercase; color: #a1a1aa; font-weight: 600; margin-bottom: 4px;">Auth Type</label>
          <Select
            value={newAuthType}
            options={[
              { value: 'Google PIN', label: 'Google PIN' },
              { value: 'Email / Password', label: 'Email / Password' },
              { value: 'Cookie Session', label: 'Cookie Session' },
              { value: 'Public Application Form', label: 'Public Application Form' }
            ]}
            onchange={(val) => newAuthType = val}
            width="100%"
          />
        </div>

        <div>
          <label for="new-website-cooldown" style="display: block; font-size: 11px; text-transform: uppercase; color: #a1a1aa; font-weight: 600; margin-bottom: 4px;">Cooldown (Days, 0 = Disabled)</label>
          <input id="new-website-cooldown" type="number" min="0" class="input-base" style="width: 100%;" bind:value={newCooldown} />
        </div>
      </div>

      <div>
        <label for="new-website-notes" style="display: block; font-size: 11px; text-transform: uppercase; color: #a1a1aa; font-weight: 600; margin-bottom: 4px;">Notes</label>
        <textarea id="new-website-notes" class="input-base" style="width: 100%;" rows="2" bind:value={newNotes} placeholder="Governance notes..."></textarea>
      </div>
    </div>
  </form>

  {#snippet footer()}
    <button type="button" class="btn-secondary" onclick={onclose}>Cancel</button>
    <button type="submit" form="add-website-form" class="btn-primary">Register Portal</button>
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

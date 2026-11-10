<script lang="ts">
  interface Props {
    benefitsRaw?: string | null
  }

  const { benefitsRaw = null }: Props = $props()

  const benefitItems = $derived.by(() => {
    if (!benefitsRaw) return []
    return benefitsRaw
      .split('\n')
      .map(b => b.trim())
      .filter(b => b.length > 0)
      .map(b => b.replace(/^[\s\-\*•\u2022\d\.\)]+/, '').trim())
      .filter(b => b.length > 0)
  })
</script>

<div class="modal-section">
  <div class="modal-section-title">Itemized Compensation &amp; Perks Package</div>
  {#if benefitItems.length > 0}
    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
      {#each benefitItems as item}
        <div class="perk-card">
          <span style="color: #71717a; font-size: 14px; line-height: 1.4; user-select: none;">&bull;</span>
          <span style="color: #f4f4f5; font-size: 13px;">{item}</span>
        </div>
      {/each}
    </div>
  {:else}
    <div class="card-box" style="color: #a1a1aa; font-size: 13px; margin-top: 8px;">
      No specific perks or benefits itemized by employer.
    </div>
  {/if}
</div>

<style>
  .modal-section {
    margin-bottom: 22px;
  }
  .modal-section-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #ffffff;
    margin-bottom: 8px;
  }
  .card-box {
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 14px 16px;
  }
  .perk-card {
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 10px 14px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
</style>

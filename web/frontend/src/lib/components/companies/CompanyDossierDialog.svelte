<script lang="ts">
  import Dialog from '../ui/Dialog.svelte'
  import type { CompanyRecord } from '../../types'

  let {
    company,
    onclose
  }: {
    company: CompanyRecord | null
    onclose: () => void
  } = $props()
</script>

{#if company}
  <Dialog
    open={company !== null}
    {onclose}
    title={company.name}
    subtitle={`${company.industry || 'Technology'} • ${company.location || 'Indonesia'}`}
    maxWidth="760px"
  >
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
      <div class="metric-card">
        <span class="metric-label">Crawled Roles</span>
        <span class="metric-value">{company.crawled_count}</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">Applications</span>
        <span class="metric-value">{company.applications_count}</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">First Seen</span>
        <span class="metric-value" style="font-size: 11px;">{company.first_crawled_at}</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">Cooldown Policy</span>
        <span class="metric-value" style="font-size: 11px;">{company.cooldown_status || 'ELIGIBLE'}</span>
      </div>
    </div>

    {#if company.overview}
      <div class="dossier-box">
        <div class="dossier-title">Company Overview &amp; Products</div>
        <div style="font-size: 13px; line-height: 1.6; color: #ffffff;">{company.overview}</div>
      </div>
    {/if}

    {#snippet footer()}
      <button type="button" class="btn-primary" onclick={onclose}>
        Done
      </button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .metric-card {
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .metric-label {
    font-size: 10.5px;
    color: #71717a;
    text-transform: uppercase;
    font-weight: 600;
  }

  .metric-value {
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
  }

  .dossier-box {
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 14px;
  }

  .dossier-title {
    font-size: 11.5px;
    font-weight: 700;
    text-transform: uppercase;
    color: #a1a1aa;
    margin-bottom: 6px;
  }
</style>

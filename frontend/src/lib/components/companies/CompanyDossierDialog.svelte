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

  let companyJobs = $state<any[]>([])
  let loadingJobs = $state(false)

  $effect(() => {
    if (company?.name) {
      loadingJobs = true
      fetch(`/api/companies/${encodeURIComponent(company.name)}/jobs`)
        .then(r => r.json())
        .then(d => {
          if (d.success && Array.isArray(d.data)) {
            companyJobs = d.data
          }
        })
        .catch(err => console.error('Failed to load company jobs:', err))
        .finally(() => { loadingJobs = false })
    } else {
      companyJobs = []
    }
  })
</script>

{#if company}
  <Dialog
    open={company !== null}
    {onclose}
    title={company.name}
    subtitle={`${company.industry || 'Technology'} • ${company.location || 'Indonesia'}`}
    maxWidth="760px"
  >
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px;">
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
    </div>

    {#if company.overview}
      <div class="dossier-box" style="margin-bottom: 16px;">
        <div class="dossier-title">Company Overview &amp; Products</div>
        <div style="font-size: 13px; line-height: 1.6; color: #ffffff;">{company.overview}</div>
      </div>
    {/if}

    <div class="dossier-box">
      <div class="dossier-title">Captured Positions ({companyJobs.length})</div>
      {#if loadingJobs}
        <div style="font-size: 12px; color: #71717a; padding: 10px 0;">Loading job records...</div>
      {:else if companyJobs.length === 0}
        <div style="font-size: 12px; color: #71717a; padding: 10px 0;">No active roles recorded for this company.</div>
      {:else}
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px;">
          <thead>
            <tr style="border-bottom: 1px solid #27272a; text-align: left; color: #71717a;">
              <th style="padding: 6px 0;">Role</th>
              <th style="padding: 6px 0;">Portal</th>
              <th style="padding: 6px 0;">Status</th>
            </tr>
          </thead>
          <tbody>
            {#each companyJobs as job}
              <tr style="border-bottom: 1px solid #1f1f23;">
                <td style="padding: 6px 0; color: #ffffff; font-weight: 500;">{job.title}</td>
                <td style="padding: 6px 0; color: #a1a1aa;">{job.portal}</td>
                <td style="padding: 6px 0; color: #f4f4f5;">{job.status}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

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

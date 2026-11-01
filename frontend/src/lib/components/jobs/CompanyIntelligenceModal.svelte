<script lang="ts">
  import { ExternalLink } from 'lucide-svelte'
  import Dialog from '../ui/Dialog.svelte'
  import type { JobRecord } from '$lib/types'

  interface PersonContact {
    name: string
    role: string
    email?: string
    linkedin?: string
  }

  let {
    job,
    onclose
  }: {
    job: JobRecord
    onclose: () => void
  } = $props()

  const website = $derived(job.job_url ? `https://www.google.com/search?q=${encodeURIComponent(job.company)}` : 'Indonesia')
  const headquarters = $derived(job.location || 'Indonesia')
  const overview = $derived(
    job.company_overview && !job.company_overview.startsWith('Verified employer record')
      ? job.company_overview
      : 'Comprehensive technology firm operating in Indonesia.'
  )

  const leaders = $derived.by(() => {
    try {
      const parsed = JSON.parse((job as any).leaders || '[]')
      return Array.isArray(parsed) ? (parsed as PersonContact[]) : []
    } catch {
      return []
    }
  })

  const hrContacts = $derived.by(() => {
    try {
      const parsed = JSON.parse((job as any).hr_contacts || '[]')
      return Array.isArray(parsed) ? (parsed as PersonContact[]) : []
    } catch {
      return []
    }
  })


</script>



<Dialog
  open={true}
  onclose={onclose}
  title={job.company}
  subtitle={`${job.industry || 'Technology'} • ${headquarters}`}
  maxWidth="860px"
>
  <div>
    <div class="intelligence-grid">
      <div class="intelligence-card">
        <div class="intelligence-title">Official Company Search &amp; Website</div>
        <div class="intelligence-content">
          <a href={website} target="_blank" rel="noreferrer" class="intelligence-link">
            Search {job.company} &nearr;
          </a>
        </div>
      </div>
      <div class="intelligence-card">
        <div class="intelligence-title">Headquarters &amp; Office Location</div>
        <div class="intelligence-content">{headquarters}</div>
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">What The Company Does &amp; Business Model</div>
      <div class="overview-box">{overview}</div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Executive Leadership &amp; Board of Directors</div>
      {#if leaders.length > 0}
        <div class="people-grid">
          {#each leaders as l}
            <div class="people-card">
              <div class="people-name">{l.name}</div>
              <div class="people-role">{l.role}</div>
              {#if l.linkedin}
                <a href={l.linkedin} target="_blank" rel="noreferrer" class="people-linkedin-link">
                  LinkedIn &nearr;
                </a>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="card-box" style="color: #a1a1aa; font-size: 13px;">
          Corporate executives are being cataloged by intelligence crawlers.
        </div>
      {/if}
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Human Resources &amp; Talent Acquisition</div>
      {#if hrContacts.length > 0}
        <div class="people-grid">
          {#each hrContacts as h}
            <div class="people-card">
              <div class="people-name">{h.name}</div>
              <div class="people-role">{h.role}</div>
              {#if h.email}
                <div style="font-size: 11px; color: #a1a1aa; margin-top: 4px;">
                  {h.email}
                </div>
              {/if}
              {#if h.linkedin}
                <a href={h.linkedin} target="_blank" rel="noreferrer" class="people-linkedin-link">
                  LinkedIn &nearr;
                </a>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="card-box" style="color: #a1a1aa; font-size: 13px;">
          Recruitment contacts being cataloged.
        </div>
      {/if}
    </div>
  </div>

  {#snippet footer()}
    <button type="button" class="btn-primary" onclick={onclose}>Close</button>
  {/snippet}
</Dialog>

<style>
  .modal-wide {
    max-width: 860px;
    width: 95vw;
    max-height: 85vh;
  }
  .modal-category {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #a1a1aa;
    margin-bottom: 3px;
  }
  .modal-title {
    font-size: 18px;
    font-weight: 700;
    color: #ffffff;
  }
  .modal-subtitle {
    font-size: 12.5px;
    color: #a1a1aa;
    margin-top: 2px;
  }
  .intelligence-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }
  .intelligence-card {
    background: var(--bg-app);
    padding: 12px 14px;
    border-radius: 6px;
    border: 1px solid var(--border-active);
  }
  .intelligence-title {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 700;
    color: #a1a1aa;
    margin-bottom: 4px;
  }
  .intelligence-content {
    font-size: 13px;
    font-weight: 600;
    color: #ffffff;
  }
  .intelligence-link {
    color: #ffffff;
    text-decoration: underline;
  }
  .modal-section {
    margin-bottom: 20px;
  }
  .modal-section-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #f4f4f5;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border-subtle);
  }
  .overview-box {
    color: #ffffff;
    line-height: 1.6;
    font-size: 13.5px;
    background: var(--bg-app);
    border: 1px solid var(--border-active);
    border-radius: 6px;
    padding: 14px 16px;
  }
  .people-cards-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .people-card-row {
    background: var(--bg-app);
    border: 1px solid var(--border-active);
    border-radius: 6px;
    padding: 10px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .people-card-name {
    font-weight: 700;
    color: #ffffff;
    font-size: 13px;
  }
  .people-card-role {
    font-size: 12px;
    color: #a1a1aa;
    margin-top: 2px;
  }
  .people-linkedin-link {
    font-size: 11px;
    font-weight: 600;
    color: #ffffff;
    text-decoration: underline;
  }
  .card-box {
    background: #18181b;
    border: 1px solid var(--border-active);
    border-radius: 6px;
    padding: 12px 14px;
  }
</style>

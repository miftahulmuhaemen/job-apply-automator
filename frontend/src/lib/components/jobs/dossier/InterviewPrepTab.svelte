<script lang="ts">
  import type { JobRecord } from '$lib/types'
  import { Users, Search, Linkedin, MessageSquare, Sparkles, HelpCircle, ShieldAlert, CheckCircle2 } from 'lucide-svelte'

  let { job }: { job: JobRecord } = $props()

  let isAnalyzing = $state(false)
  let analyzedData = $state<any | null>(null)

  function triggerAnalysis() {
    isAnalyzing = true
    // Placeholder simulation for on-demand trigger
    setTimeout(() => {
      analyzedData = {
        analyzed_at: new Date().toISOString(),
        stakeholders: [
          {
            name: 'Talent Acquisition Team',
            category: 'HR / Recruiter',
            title: `Recruiter at ${job.company}`,
            source: 'LinkedIn',
            topics: ['Culture fit', 'Compensation alignment', 'Notice period / availability'],
            advice: 'Emphasize immediate availability (ASAP notice period) and strong ownership.'
          },
          {
            name: 'Engineering Leadership',
            category: 'Tech Lead / CTO',
            title: `Engineering Team at ${job.company}`,
            source: 'LinkedIn & Threads',
            topics: ['Distributed systems', 'High reliability services', 'Fullstack state sync'],
            advice: 'Highlight offline transaction handling and clean microservice architecture.'
          }
        ],
        talkingPoints: [
          `Connect candidate experience at Blue Sky Tech (Bythen AI) with ${job.company}'s core business domain.`,
          'Discuss database query optimization and event-driven architectures with GCP Pub/Sub and Go.',
          'Emphasize disciplined automated testing pipelines with Vitest, Playwright, and GitHub Actions.'
        ],
        reverseQuestions: [
          `What are the most critical architectural milestones planned for the ${job.title} role in the next 6 months?`,
          'How does your engineering team manage the trade-off between deployment velocity and automated regression coverage?'
        ]
      }
      isAnalyzing = false
    }, 1200)
  }
</script>

<div class="interview-prep-container">
  <!-- Top Banner / Scope Callout -->
  <div class="prep-header-card">
    <div class="prep-header-icon">
      <Users size={24} color="#3b82f6" />
    </div>
    <div class="prep-header-body">
      <div class="prep-header-title">
        Interview Intelligence & Stakeholder Analysis
        <span class="badge-manual">On-Demand Trigger</span>
      </div>
      <p class="prep-header-desc">
        Identifies key decision makers (HR, CTO, Tech Lead) for <strong>{job.company}</strong>, analyzes their public professional interests on LinkedIn &amp; Threads, and compiles tailored talking points for your interview.
      </p>
      <div class="prep-policy-note">
        <ShieldAlert size={14} color="#f59e0b" style="flex-shrink: 0; margin-top: 2px;" />
        <span><strong>Non-Automatic Policy</strong>: This analysis never runs in the background. It is triggered only when you explicitly request it for this vacancy.</span>
      </div>
    </div>
  </div>

  {#if !analyzedData && !isAnalyzing}
    <!-- Unanalyzed Empty State -->
    <div class="empty-prep-card">
      <div class="empty-icon-ring">
        <Search size={28} color="#94a3b8" />
      </div>
      <h3 class="empty-title">Ready to Analyze Interview Context</h3>
      <p class="empty-desc">
        Click below to initiate discovery of the hiring team, evaluate public posts and threads from technical leadership, and generate customized talking points for {job.company}.
      </p>
      <button type="button" class="btn-analyze" onclick={triggerAnalysis}>
        <Sparkles size={16} />
        <span>Analyze Interview Stakeholders &amp; Insights</span>
      </button>
    </div>
  {:else if isAnalyzing}
    <!-- Loading State -->
    <div class="loading-prep-card">
      <div class="spinner-ring"></div>
      <h3 class="loading-title">Analyzing Company Leadership &amp; Profiles...</h3>
      <p class="loading-desc">
        Searching LinkedIn &amp; Threads public posts for {job.company} HR and Engineering Leads...
      </p>
    </div>
  {:else}
    <!-- Analyzed Results State -->
    <div class="results-layout">
      <!-- Action Bar -->
      <div class="results-action-bar">
        <div class="analysis-meta">
          <CheckCircle2 size={16} color="#10b981" />
          <span>Analysis ready for <strong>{job.company}</strong> &bull; {job.title}</span>
        </div>
        <button type="button" class="btn-reanalyze" onclick={triggerAnalysis}>
          <Search size={14} />
          <span>Re-analyze</span>
        </button>
      </div>

      <!-- Stakeholder Cards Grid -->
      <div class="section-heading">Key Interview Stakeholders</div>
      <div class="stakeholders-grid">
        {#each analyzedData.stakeholders as s}
          <div class="stakeholder-card">
            <div class="stakeholder-top">
              <div>
                <div class="stakeholder-name">{s.name}</div>
                <div class="stakeholder-title">{s.title}</div>
              </div>
              <span class="badge-role">{s.category}</span>
            </div>
            <div class="social-tags">
              <span class="social-tag">
                <Linkedin size={12} />
                <span>{s.source}</span>
              </span>
            </div>
            <div class="topics-list">
              <div class="topics-label">Public Interests &amp; Topics:</div>
              <div class="chips-row">
                {#each s.topics as topic}
                  <span class="topic-chip">{topic}</span>
                {/each}
              </div>
            </div>
            <div class="advice-box">
              <strong>Interview Angle:</strong> {s.advice}
            </div>
          </div>
        {/each}
      </div>

      <!-- Tailored Talking Points -->
      <div class="section-heading" style="margin-top: 20px;">Tailored Technical Talking Points</div>
      <div class="talking-points-card">
        <ul class="points-list">
          {#each analyzedData.talkingPoints as point}
            <li>
              <div class="bullet-dot"></div>
              <span>{point}</span>
            </li>
          {/each}
        </ul>
      </div>

      <!-- Curated Reverse Interview Questions -->
      <div class="section-heading" style="margin-top: 20px;">Curated Questions to Ask Interviewers</div>
      <div class="reverse-questions-card">
        <ul class="questions-list">
          {#each analyzedData.reverseQuestions as q}
            <li>
              <HelpCircle size={15} color="#3b82f6" style="flex-shrink: 0; margin-top: 2px;" />
              <span>{q}</span>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}
</div>

<style>
  .interview-prep-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 4px 0;
  }

  .prep-header-card {
    display: flex;
    gap: 14px;
    padding: 16px;
    border-radius: 8px;
    background: #18181b;
    border: 1px solid #27272a;
  }

  .prep-header-icon {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    background: rgba(59, 130, 246, 0.12);
    border: 1px solid rgba(59, 130, 246, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .prep-header-body {
    flex: 1;
  }

  .prep-header-title {
    font-size: 14px;
    font-weight: 600;
    color: #f4f4f5;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .badge-manual {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 9999px;
    background: #27272a;
    color: #a1a1aa;
    border: 1px solid #3f3f46;
  }

  .prep-header-desc {
    font-size: 12px;
    color: #a1a1aa;
    line-height: 1.5;
    margin-top: 4px;
  }

  .prep-policy-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 11.5px;
    color: #f59e0b;
    margin-top: 8px;
    padding: 6px 10px;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 6px;
  }

  .empty-prep-card, .loading-prep-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 40px 24px;
    background: #18181b;
    border: 1px dashed #3f3f46;
    border-radius: 8px;
  }

  .empty-icon-ring {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #27272a;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
  }

  .empty-title, .loading-title {
    font-size: 15px;
    font-weight: 600;
    color: #f4f4f5;
    margin-bottom: 6px;
  }

  .empty-desc, .loading-desc {
    font-size: 12.5px;
    color: #71717a;
    max-width: 480px;
    line-height: 1.45;
    margin-bottom: 20px;
  }

  .btn-analyze {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 18px;
    background: #2563eb;
    color: #ffffff;
    font-size: 13px;
    font-weight: 500;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-analyze:hover {
    background: #1d4ed8;
  }

  .spinner-ring {
    width: 36px;
    height: 36px;
    border: 3px solid #27272a;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .results-layout {
    display: flex;
    flex-direction: column;
  }

  .results-action-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .analysis-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    color: #a1a1aa;
  }

  .btn-reanalyze {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: #27272a;
    color: #d4d4d8;
    font-size: 12px;
    border-radius: 6px;
    border: 1px solid #3f3f46;
    cursor: pointer;
  }

  .btn-reanalyze:hover {
    background: #3f3f46;
  }

  .section-heading {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #a1a1aa;
    margin-bottom: 10px;
  }

  .stakeholders-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 12px;
  }

  .stakeholder-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .stakeholder-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .stakeholder-name {
    font-size: 13.5px;
    font-weight: 600;
    color: #f4f4f5;
  }

  .stakeholder-title {
    font-size: 11.5px;
    color: #71717a;
    margin-top: 1px;
  }

  .badge-role {
    font-size: 10.5px;
    font-weight: 600;
    background: rgba(59, 130, 246, 0.12);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.3);
    padding: 2px 7px;
    border-radius: 4px;
  }

  .social-tags {
    display: flex;
    gap: 6px;
  }

  .social-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #0ea5e9;
    background: rgba(14, 165, 233, 0.08);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .topics-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .topics-label {
    font-size: 11px;
    color: #71717a;
  }

  .chips-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .topic-chip {
    font-size: 10.5px;
    padding: 2px 6px;
    border-radius: 4px;
    background: #27272a;
    color: #d4d4d8;
    border: 1px solid #3f3f46;
  }

  .advice-box {
    font-size: 11.5px;
    color: #d4d4d8;
    background: #111113;
    padding: 8px 10px;
    border-radius: 6px;
    border-left: 3px solid #3b82f6;
    line-height: 1.4;
  }

  .talking-points-card, .reverse-questions-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 14px 16px;
  }

  .points-list, .questions-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .points-list li, .questions-list li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 12.5px;
    color: #d4d4d8;
    line-height: 1.45;
  }

  .bullet-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #3b82f6;
    margin-top: 6px;
    flex-shrink: 0;
  }
</style>

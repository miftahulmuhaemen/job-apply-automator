<script lang="ts">
  import { Download, ExternalLink } from 'lucide-svelte'

  interface Props {
    jobUuid: string
    company: string
  }

  const { jobUuid, company }: Props = $props()
</script>

<div class="modal-section">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
    <div>
      <div class="modal-section-title" style="margin-bottom: 2px;">ATS-Optimized Tailored Resume</div>
      <div style="font-size: 12px; color: #a1a1aa;">
        Generated with matched keywords tailored to {company}.
      </div>
    </div>
    <div style="display: flex; gap: 8px;">
      <a
        href="/api/jobs/{jobUuid}/pdf"
        download
        class="btn-primary"
        style="text-decoration: none;"
      >
        <Download size={13} /> Download PDF
      </a>
      <a
        href="/api/jobs/{jobUuid}/pdf"
        target="_blank"
        rel="noreferrer"
        class="btn-secondary"
        style="text-decoration: none;"
      >
        <ExternalLink size={13} /> Open PDF &nearr;
      </a>
    </div>
  </div>

  <div class="pdf-container">
    <iframe
      src="/api/jobs/{jobUuid}/pdf"
      title="Tailored Resume Preview"
      style="width: 100%; height: 540px; border: none; background: #ffffff;"
    ></iframe>
  </div>
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
  .pdf-container {
    border: 1px solid #27272a;
    border-radius: 6px;
    overflow: hidden;
    background: #09090b;
  }
  .btn-primary {
    background-color: #ffffff;
    color: #09090b;
    border: 1px solid #ffffff;
    font-weight: 600;
    padding: 7px 14px;
    border-radius: 6px;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-primary:hover {
    background-color: #f4f4f5;
  }
  .btn-secondary {
    background-color: #27272a;
    color: #f4f4f5;
    border: 1px solid #3f3f46;
    padding: 7px 14px;
    border-radius: 6px;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .btn-secondary:hover {
    background-color: #3f3f46;
  }
</style>

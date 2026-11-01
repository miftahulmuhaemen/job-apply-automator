<script lang="ts">
  import Dialog from '../ui/Dialog.svelte'

  let {
    authModalData,
    onclose,
    oncheck
  }: {
    authModalData: { portal: string; info: any } | null
    onclose: () => void
    oncheck: () => Promise<void>
  } = $props()
</script>

<Dialog
  open={authModalData !== null}
  {onclose}
  title="Desktop Session Launcher"
  subtitle={authModalData ? `Authenticate ${authModalData.portal.toUpperCase()}` : ''}
>
  <div style="font-size: 13px; line-height: 1.6; color: #d4d4d8;">
    <p style="margin-bottom: 12px;">
      Desktop browser window launched using the shared persistent profile.
    </p>
    <ol style="padding-left: 20px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px;">
      <li>Log in to your account in the opened desktop browser.</li>
      <li>Pass any bot challenges (Cloudflare Turnstile, OTP, or CAPTCHA).</li>
      <li><strong>Close the browser window</strong> once you reach your portal dashboard to unlock cookies.</li>
      <li>Click <strong>Check Sessions</strong> to verify.</li>
    </ol>
  </div>

  {#snippet footer()}
    <button type="button" class="btn-secondary" onclick={onclose}>Dismiss</button>
    <button type="button" class="btn-primary" onclick={oncheck}>
      Check Session Now
    </button>
  {/snippet}
</Dialog>

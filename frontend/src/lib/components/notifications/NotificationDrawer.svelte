<script lang="ts">
  import { onMount } from 'svelte'
  import { Bell, X } from 'lucide-svelte'

  let {
    isOpen = false,
    triggerLeft = 180,
    triggerTop = 56,
    sidebarCollapsed = false,
    onclose,
    onnavigatetoprofile
  } = $props<{
    isOpen: boolean
    triggerLeft?: number
    triggerTop?: number
    sidebarCollapsed?: boolean
    onclose: () => void
    onnavigatetoprofile?: (key?: string) => void
  }>()

  interface NotificationItem {
    id: number
    title: string
    message: string
    type: string
    target_job_id: number | null
    candidate_key: string | null
    candidate_label: string | null
    candidate_category: string | null
    is_read: number
    created_at: string | null
    updated_at: string | null
  }

  let notifications = $state<NotificationItem[]>([])
  let unreadCount = $state(0)

  export async function fetchNotifications() {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const json = await res.json()
        if (json.success) {
          notifications = json.data || []
          unreadCount = json.unread_count || 0
        }
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    }
  }

  async function markAsRead(id: number) {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
      if (res.ok) {
        notifications = notifications.map(n => n.id === id ? { ...n, is_read: 1 } : n)
        unreadCount = Math.max(0, unreadCount - 1)
      }
    } catch (err) {
      console.error('Failed to mark notification read:', err)
    }
  }

  async function markAllAsRead() {
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'POST' })
      if (res.ok) {
        notifications = notifications.map(n => ({ ...n, is_read: 1 }))
        unreadCount = 0
      }
    } catch (err) {
      console.error('Failed to mark all notifications read:', err)
    }
  }

  async function clearAll() {
    try {
      const res = await fetch('/api/notifications/clear', { method: 'POST' })
      if (res.ok) {
        notifications = []
        unreadCount = 0
      }
    } catch (err) {
      console.error('Failed to clear notifications:', err)
    }
  }

  function handleCardClick(item: NotificationItem) {
    if (item.is_read === 0) {
      markAsRead(item.id)
    }
    onclose()
    if (onnavigatetoprofile) {
      onnavigatetoprofile(item.candidate_key || undefined)
    }
  }

  function formatTime(createdAt: string | null): string {
    if (!createdAt) return 'Just now'
    return 'Just now'
  }

  onMount(() => {
    fetchNotifications()
    const timer = setInterval(fetchNotifications, 15000)
    return () => clearInterval(timer)
  })
</script>

{#if isOpen}
  <!-- Backdrop dismiss -->
  <div class="popup-backdrop" onclick={onclose} role="presentation"></div>

  <!-- Rounded Floating Card matching Image #1 in Dark Theme -->
  <div
    class="notification-popup"
    style="left: {triggerLeft}px; top: {triggerTop}px;"
    role="dialog"
    aria-labelledby="notification-title"
  >
    <!-- Header -->
    <div class="popup-header">
      <div class="header-left">
        <h2 id="notification-title" class="popup-title">Notifications</h2>
        {#if unreadCount > 0}
          <span class="unread-pill">{unreadCount} new</span>
        {/if}
      </div>
      <div class="header-right">
        {#if notifications.some(n => n.is_read === 0)}
          <button
            type="button"
            class="header-btn"
            onclick={markAllAsRead}
          >
            Mark read
          </button>
        {/if}
        {#if notifications.length > 0}
          <button
            type="button"
            class="header-btn"
            onclick={clearAll}
          >
            Clear
          </button>
        {/if}
        <button
          type="button"
          class="btn-close"
          onclick={onclose}
          aria-label="Close notifications"
        >
          <X size={15} />
        </button>
      </div>
    </div>

    <!-- Body / Content -->
    <div class="popup-body">
      {#if notifications.length === 0}
        <div class="empty-state">
          <div class="empty-icon-wrap">
            <Bell size={38} strokeWidth={1.3} />
          </div>
          <p class="empty-text">No notifications</p>
        </div>
      {:else}
        <div class="items-list">
          {#each notifications as item (item.id)}
            <div
              class="item-card"
              class:unread={item.is_read === 0}
              class:read={item.is_read === 1}
              onclick={() => handleCardClick(item)}
              role="button"
              tabindex="0"
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(item) }}
            >
              <div class="item-head">
                <span class="item-title">{item.title}</span>
                <span class="item-time">{formatTime(item.created_at)}</span>
              </div>
              <p class="item-desc">{item.message}</p>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .popup-backdrop {
    position: fixed;
    inset: 0;
    z-index: 998;
    background: transparent;
  }

  /* Floating Card matching Image #1 in Dark Theme with rounded edges */
  .notification-popup {
    position: fixed;
    top: 56px;
    width: 370px;
    height: 560px;
    max-height: calc(100vh - 80px);
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 20px;
    box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.5), 0 6px 16px -4px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    z-index: 999;
    overflow: hidden;
    animation: popupIn 0.16s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes popupIn {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Header */
  .popup-header {
    height: 52px;
    padding: 0 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #18181b;
    border-bottom: 1px solid #27272a;
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .popup-title {
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .unread-pill {
    font-size: 11px;
    font-weight: 500;
    color: #a1a1aa;
    background: #27272a;
    border: 1px solid #3f3f46;
    padding: 1px 8px;
    border-radius: 9999px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-btn {
    background: transparent;
    border: none;
    color: #a1a1aa;
    font-size: 12px;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 4px;
    transition: color 0.15s ease;
  }
  .header-btn:hover {
    color: #ffffff;
  }

  .btn-close {
    background: transparent;
    border: none;
    color: #71717a;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s ease;
  }
  .btn-close:hover {
    color: #ffffff;
  }

  /* Body */
  .popup-body {
    flex: 1;
    overflow-y: auto;
    background: #141416;
    padding: 14px 16px;
  }

  /* Empty State matching Image #1 in dark theme */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 360px;
    padding: 24px 16px;
    text-align: center;
  }

  .empty-icon-wrap {
    color: #3f3f46;
    margin-bottom: 12px;
  }

  .empty-text {
    font-size: 13.5px;
    color: #71717a;
    margin: 0;
    font-weight: 400;
  }

  /* Items List matching Image #1 */
  .items-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .item-card {
    border-radius: 14px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    outline: none;
  }

  /* Unread card: highlighted */
  .item-card.unread {
    background: #1e1e22;
    border: 1px solid #3f3f46;
  }
  .item-card.unread:hover {
    background: #242429;
    border-color: #52525b;
  }
  .item-card.unread .item-title {
    color: #ffffff;
  }
  .item-card.unread .item-desc {
    color: #a1a1aa;
  }

  /* Read card: greyed out */
  .item-card.read {
    background: #131315;
    border: 1px solid #1f1f23;
    opacity: 0.55;
  }
  .item-card.read:hover {
    opacity: 0.85;
    background: #18181b;
  }
  .item-card.read .item-title {
    color: #71717a;
  }
  .item-card.read .item-desc {
    color: #52525b;
  }

  .item-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .item-title {
    font-size: 13.5px;
    font-weight: 600;
    line-height: 1.35;
    letter-spacing: -0.01em;
  }

  .item-time {
    font-size: 11px;
    color: #71717a;
    flex-shrink: 0;
  }

  .item-desc {
    font-size: 12px;
    line-height: 1.45;
    margin: 0;
  }
</style>

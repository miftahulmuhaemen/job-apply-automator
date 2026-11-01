import type { Page } from 'puppeteer-core'

/**
 * Sets value on an input/select/textarea and dispatches synthetic input, change, and blur events
 * with bubbles: true so React, Vue, and Angular controlled components reliably accept the input.
 */
export async function setControlValueAndDispatch(
  page: Page,
  selector: string,
  value: string
): Promise<boolean> {
  return page.evaluate(
    (sel, val) => {
      const el = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
      if (!el) return false

      // Support React 16+ value tracker override
      let nativeSetter: ((v: any) => void) | undefined
      if (el instanceof HTMLTextAreaElement) {
        nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      } else if (el instanceof HTMLInputElement) {
        nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      } else if (el instanceof HTMLSelectElement) {
        nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set
      }

      if (nativeSetter) {
        nativeSetter.call(el, val)
      } else {
        (el as any).value = val
      }

      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      el.dispatchEvent(new Event('blur', { bubbles: true }))
      return true
    },
    selector,
    value
  )
}

import { describe, it, expect } from 'bun:test'
import { calculateExpectedSalaryBid, generateFormFillPreview } from '../generator/formPreview.js'

describe('formPreview', () => {
  describe('calculateExpectedSalaryBid', () => {
    it('calculates regional Surabaya bid with Rp 8.000.000 target', () => {
      const bid = calculateExpectedSalaryBid('Surabaya, Jawa Timur', 'Rp 7.000.000 - 9.000.000')
      expect(bid.specificBidAmount).toBe(8000000)
      expect(bid.currency).toBe('IDR')
      expect(bid.specificFormatted).toContain('8.000.000')
    })

    it('calculates Jakarta / Remote base bid with IDR 10.000.000 target', () => {
      const bid = calculateExpectedSalaryBid('Jakarta Selatan', 'IDR 12.000.000 - 18.000.000')
      expect(bid.specificBidAmount).toBe(10000000)
      expect(bid.currency).toBe('IDR')
      expect(bid.basis).toContain('Jakarta Base')
    })

    it('bids within employer minimum when specified', () => {
      const bid = calculateExpectedSalaryBid('Bandung', 'IDR 9.000.000 - 14.000.000', 9000000, 14000000)
      expect(bid.specificBidAmount).toBeGreaterThanOrEqual(8000000)
    })
  })

  describe('generateFormFillPreview', () => {
    it('generates multi-group accordion panels for jobs', async () => {
      const mockJob = {
        id: 999,
        company: 'Test Technology PT',
        title: 'Backend Engineer',
        portal: 'Kalibrr',
        location: 'Indonesia',
        salary_raw: 'IDR 10.000.000 - 15.000.000',
        form_schema: null
      }

      const preview = await generateFormFillPreview(mockJob)
      expect(preview.jobId).toBe(999)
      expect(preview.groups.length).toBeGreaterThanOrEqual(4)

      // Ensure Experience [1/3] exists as its own accordion panel
      const hasExp1 = preview.groups.some(g => g.groupName.includes('Experience [1/'))
      expect(hasExp1).toBe(true)

      // Ensure Education exists as an accordion panel
      const hasEdu = preview.groups.some(g => g.groupName.includes('Education'))
      expect(hasEdu).toBe(true)
    })
  })
})

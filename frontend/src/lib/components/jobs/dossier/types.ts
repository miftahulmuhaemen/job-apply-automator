export interface FormFieldItem {
  key: string
  label: string
  value: string
  required: boolean
  source: string
  status: string
}

export interface FormPreviewGroup {
  groupName: string
  fields: FormFieldItem[]
}

export interface ExpectedSalaryBid {
  monthlyFormatted: string
  currency: string
  minimum: number
  maximum: number
  specificBidAmount: number
  specificFormatted: string
  basis: string
  strategy: string
}

export interface FormPreviewData {
  expectedSalaryBid: ExpectedSalaryBid
  groups: FormPreviewGroup[]
  isBlocked: boolean
  unresolvedRequiredCount: number
  unresolvedKeys: string[]
}

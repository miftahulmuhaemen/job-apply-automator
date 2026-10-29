import fs from 'node:fs'
import path from 'node:path'
import candidateProfile from '../../../data/candidateProfile.json' with { type: 'json' }
import { db, getAllCandidateAttributes, CandidateAttributeRecord } from '../storage/db.js'

export interface FormFieldItem {
  key: string
  label: string
  value: string
  required: boolean
  source: 'candidate_profile' | 'calculated_bid' | 'portal_custom' | 'document' | 'user_override'
  status: 'RESOLVED' | 'ACTION_REQUIRED'
  description?: string
  note?: string
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

export interface FormFillPreviewResult {
  jobId: number
  company: string
  title: string
  portal: string
  location: string
  expectedSalaryBid: ExpectedSalaryBid
  groups: FormPreviewGroup[]
  isBlocked: boolean
  unresolvedRequiredCount: number
  unresolvedKeys: string[]
}

/**
 * Calculates a specific concrete monthly salary bid based on location and published employer range.
 */
export function calculateExpectedSalaryBid(
  jobLocation?: string,
  salaryRaw?: string,
  salaryMin?: number | null,
  salaryMax?: number | null
): ExpectedSalaryBid {
  const loc = (jobLocation || '').toLowerCase()
  const raw = (salaryRaw || '').toLowerCase()

  // 1. Specific SEVIMA or Surabaya / Regional target
  if (loc.includes('surabaya') || loc.includes('jawa timur') || raw.includes('7.700.000') || raw.includes('7.000.000')) {
    const specificBid = 8000000
    return {
      monthlyFormatted: 'Rp 8.000.000 / month (Bruto)',
      currency: 'IDR',
      minimum: 8000000,
      maximum: 10000000,
      specificBidAmount: specificBid,
      specificFormatted: 'Rp 8.000.000',
      basis: 'Regional / Surabaya Target (Floor: IDR 7M/mo, Target: IDR 8M-12M/mo)',
      strategy: 'Concrete integer bid matching form requirement (within published compensation range)'
    }
  }

  // 2. Specific Jakarta / Remote target
  if (loc.includes('jakarta') || loc.includes('remote') || loc.includes('hybrid') || loc.includes('indonesia')) {
    const specificBid = 10000000
    return {
      monthlyFormatted: 'IDR 10.000.000 / month',
      currency: 'IDR',
      minimum: 10000000,
      maximum: 15000000,
      specificBidAmount: specificBid,
      specificFormatted: 'IDR 10.000.000',
      basis: 'Jakarta Base (Floor: IDR 8M/mo, Target: IDR 10M-15M/mo)',
      strategy: 'Standard Jakarta target for 5 years engineering experience'
    }
  }

  // 3. Fallback when employer specifies minimum
  if (salaryMin && salaryMin > 0) {
    const bidValue = Math.max(salaryMin, 8000000)
    return {
      monthlyFormatted: `IDR ${bidValue.toLocaleString('id-ID')} / month`,
      currency: 'IDR',
      minimum: salaryMin,
      maximum: salaryMax || salaryMin * 1.5,
      specificBidAmount: bidValue,
      specificFormatted: `IDR ${bidValue.toLocaleString('id-ID')}`,
      basis: 'Employer Range Match',
      strategy: 'Bidding directly within employer published compensation range'
    }
  }

  // 4. Default national fallback
  return {
    monthlyFormatted: 'IDR 10.000.000 / month',
    currency: 'IDR',
    minimum: 8000000,
    maximum: 12000000,
    specificBidAmount: 10000000,
    specificFormatted: 'IDR 10.000.000',
    basis: 'National Baseline (Floor: IDR 8M/mo Jakarta, IDR 7M/mo Regional)',
    strategy: 'Negotiable based on scope, technical stack, and work arrangement'
  }
}

/**
 * GENERIC DYNAMIC FORM SCHEMA RENDERER
 * Driven directly by the candidate_profile_attributes ledger.
 */
function renderDynamicFormSchema(job: any, salaryBid: ExpectedSalaryBid): FormFillPreviewResult {
  let schemaControls: any[] = []
  try {
    schemaControls = typeof job.form_schema === 'string' ? JSON.parse(job.form_schema) : (job.form_schema || [])
  } catch {
    schemaControls = []
  }

  // Load all current candidate attributes from ledger
  const allAttrs = getAllCandidateAttributes()
  const attrMap = new Map<string, CandidateAttributeRecord>()
  for (const a of allAttrs) {
    attrMap.set(a.key.toLowerCase(), a)
  }

  // Documents detection
  const photoCandidates = ['photo.jpg', 'photo.jpeg', 'photo.png']
  let foundPhoto: { name: string; sizeKb: number } | null = null
  for (const f of photoCandidates) {
    const photoPath = path.resolve(process.cwd(), 'data/assets', f)
    if (fs.existsSync(photoPath)) {
      const stats = fs.statSync(photoPath)
      foundPhoto = { name: f, sizeKb: Math.max(1, Math.round(stats.size / 1024)) }
      break
    }
  }

  const portfolioPath = path.resolve(process.cwd(), 'data/assets/portfolio.pdf')
  let foundPortfolio: { name: string; sizeKb: number } | null = null
  if (fs.existsSync(portfolioPath)) {
    const stats = fs.statSync(portfolioPath)
    foundPortfolio = { name: 'Miftahul_Muhaemen_Portfolio.pdf', sizeKb: Math.max(1, Math.round(stats.size / 1024)) }
  }

  const fields: FormFieldItem[] = []
  let unresolvedRequiredCount = 0
  const unresolvedKeys: string[] = []
  const handledRadioGroups = new Set<string>()

  for (const c of schemaControls) {
    const rawKey = c.name || c.id || ''
    if (!rawKey && !c.label) continue
    // Skip hidden autocomplete duplicates
    if (c.id === 'city' && c.type === 'text' && c.label === 'city') {
      // keep
    }

    let key = rawKey
    let rawLabel = c.label || c.placeholder || key
    // Scrub label noise
    rawLabel = rawLabel.replace(/^[\*\s]+/, '').replace(/\s*\(optional\)/i, '').replace(/\s*\(required\)/i, '').trim()
    if (/svgs not supported by this browser/i.test(rawLabel)) {
      rawLabel = 'Country / Work Authorization'
    }
    if (/select an option/i.test(rawLabel)) {
      rawLabel = 'Country Selection'
    }

    let label = rawLabel
    let description = c.description || ''
    let value = ''
    let source: FormFieldItem['source'] = 'candidate_profile'
    let status: 'RESOLVED' | 'ACTION_REQUIRED' = 'RESOLVED'
    let note: string | undefined = undefined

    const lowerKey = key.toLowerCase()
    const lowerLabel = label.toLowerCase()

    // 0. Consolidated Radio Groups (e.g. Ashby compensation tier options)
    if (c.type === 'radio' && c.name) {
      if (handledRadioGroups.has(c.name)) {
        continue
      }
      handledRadioGroups.add(c.name)
      const radioSiblings = schemaControls.filter(x => x.name === c.name && x.type === 'radio')
      const optionsLabels = radioSiblings.map(x => (x.label || x.placeholder || x.id || '').trim()).filter(Boolean)
      const isRateGroup = optionsLabels.some(l => /\$|idr|rp|hour|rate|gaji/i.test(l))
      if (isRateGroup) {
        label = 'Expected Hourly Rate Option'
        description = `Hourly compensation tier selection (${optionsLabels.join(', ')})`
        const matched = optionsLabels.find(l => l.includes('$15') || l.includes('15')) || optionsLabels[0]
        value = `${matched} (Selected option within employer range)`
        status = 'RESOLVED'
        source = 'calculated_bid'
      } else {
        label = rawLabel.includes(':') ? rawLabel.split(':')[0].trim() : (rawLabel || 'Option Selection')
        description = `Choice selection (${optionsLabels.join(', ')})`
        value = `${optionsLabels[0]} (Selected)`
        status = 'RESOLVED'
        source = 'portal_custom'
      }
    }
    // 1. Files & Uploads
    else if (lowerKey === 'photo' || lowerKey.includes('avatar') || (c.type === 'file' && (lowerLabel.includes('foto') || lowerLabel.includes('photo')))) {
      source = 'document'
      label = 'Applicant Photo'
      description = 'Recent professional applicant portrait file (JPEG/PNG max 4MB)'
      if (foundPhoto) {
        value = `${foundPhoto.name} (${foundPhoto.sizeKb} KB, Available)`
        status = 'RESOLVED'
      } else if (c.required) {
        value = '[MISSING - Required by employer: No applicant photo file on record]'
        status = 'ACTION_REQUIRED'
      } else {
        value = '[NOT PROVIDED - Optional]'
        status = 'RESOLVED'
      }
      note = `File upload (type="file")`
    } else if (lowerKey === 'portfolio' || (c.type === 'file' && lowerLabel.includes('portofolio'))) {
      source = 'document'
      label = 'Portfolio PDF'
      description = 'Complete portfolio dossier demonstrating production systems and architecture'
      if (foundPortfolio) {
        value = `${foundPortfolio.name} (${foundPortfolio.sizeKb} KB, Available)`
        status = 'RESOLVED'
      } else if (c.required) {
        value = '[MISSING - Required by employer: No portfolio PDF document on record]'
        status = 'ACTION_REQUIRED'
      } else {
        value = '[NOT PROVIDED - Optional]'
        status = 'RESOLVED'
      }
      note = `Portfolio document upload (type="file")`
    } else if (lowerKey === 'curriculum_vitae' || lowerKey === 'resume' || (c.type === 'file' && (lowerLabel.includes('resume') || lowerLabel.includes('curriculum') || lowerLabel.includes('cv')))) {
      source = 'document'
      label = 'ATS Resume'
      description = 'Tailored ATS single-column resume PDF aligned with employer requirements'
      value = job.resume_path || `Miftahul_Muhaemen_Resume.pdf`
      status = 'RESOLVED'
      note = `Tailored ATS single-column resume PDF`
    } else if (lowerKey === 'cover_letter' || lowerLabel.includes('cover letter')) {
      source = 'document'
      label = 'Cover Letter'
      description = 'Tailored candidate cover letter highlighting domain and technical fit'
      value = 'Included (Tailored to role requirements)'
      status = 'RESOLVED'
      note = `Tailored cover letter`
    }
    // 2. Compensation
    else if (lowerKey === 'salary_expected_type') {
      source = 'portal_custom'
      label = 'Expected Salary Basis'
      description = 'Compensation tax basis parameter'
      value = 'bruto'
      status = 'RESOLVED'
    } else if (lowerKey.includes('salary_expected') || lowerLabel.includes('gaji yang diharapkan') || lowerLabel.includes('expected hourly rate')) {
      source = 'calculated_bid'
      label = 'Expected Salary Bid'
      description = 'Concrete integer compensation bid calculated from employer range and market floor'
      value = salaryBid.specificFormatted
      status = 'RESOLVED'
      note = `Calculated bid: ${salaryBid.basis}`
    } else if (lowerKey === 'salary_before_type') {
      source = 'portal_custom'
      label = 'Previous Salary Basis'
      description = 'Compensation basis for previous salary'
      value = attrMap.get('salary_before_type')?.value || 'nett'
      status = 'RESOLVED'
    } else if (lowerKey.includes('salary_before') || lowerLabel.includes('gaji sebelumnya')) {
      label = 'Previous Monthly Salary'
      description = 'Last drawn monthly salary from previous employer'
      const attr = attrMap.get('salary_before')
      if (attr && attr.value && attr.status === 'RESOLVED') {
        value = attr.value
        status = 'RESOLVED'
      } else {
        value = '[NOT SPECIFIED IN CANDIDATE PROFILE]'
        status = 'ACTION_REQUIRED'
      }
    }
    // 3. Professional References
    else if (lowerKey.includes('reference_name') || (lowerLabel.includes('referensi') && lowerLabel.includes('nama'))) {
      label = 'Professional Reference: Full Name'
      description = 'Full legal name of professional referee'
      const attr = attrMap.get('reference_name')
      if (attr && attr.value && attr.status === 'RESOLVED') {
        value = attr.value
        status = 'RESOLVED'
      } else {
        value = '[NOT SPECIFIED IN CANDIDATE PROFILE]'
        status = 'ACTION_REQUIRED'
      }
    } else if (lowerKey.includes('reference_role') || (lowerLabel.includes('referensi') && lowerLabel.includes('jabatan'))) {
      label = 'Professional Reference: Role / Title'
      description = 'Position / role of professional referee'
      const attr = attrMap.get('reference_role')
      if (attr && attr.value && attr.status === 'RESOLVED') {
        value = attr.value
        status = 'RESOLVED'
      } else {
        value = '[NOT SPECIFIED IN CANDIDATE PROFILE]'
        status = 'ACTION_REQUIRED'
      }
    } else if (lowerKey.includes('reference_company') || (lowerLabel.includes('referensi') && lowerLabel.includes('perusahaan'))) {
      label = 'Professional Reference: Company'
      description = 'Employer where referee worked with candidate'
      const attr = attrMap.get('reference_company')
      if (attr && attr.value && attr.status === 'RESOLVED') {
        value = attr.value
        status = 'RESOLVED'
      } else {
        value = '[NOT SPECIFIED IN CANDIDATE PROFILE]'
        status = 'ACTION_REQUIRED'
      }
    } else if (lowerKey.includes('reference_contact') || (lowerLabel.includes('referensi') && lowerLabel.includes('telepon'))) {
      label = 'Professional Reference: Contact Number'
      description = 'Direct phone number of professional referee'
      const attr = attrMap.get('reference_contact')
      if (attr && attr.value && attr.status === 'RESOLVED') {
        value = attr.value
        status = 'RESOLVED'
      } else {
        value = '[NOT SPECIFIED IN CANDIDATE PROFILE]'
        status = 'ACTION_REQUIRED'
      }
    }
    // 4. Personal & Contact
    else if (lowerKey === 'city' || (lowerLabel.includes('city') && !lowerKey.includes('name')) || lowerLabel.includes('kota')) {
      label = 'City'
      description = 'Municipality / City of residence'
      value = attrMap.get('city')?.value || 'Kota Banjarmasin'
      status = 'RESOLVED'
    } else if (lowerKey === 'postcode' || lowerKey === 'postal_code' || lowerLabel.includes('postcode') || lowerLabel.includes('kode pos')) {
      label = 'Postal Code'
      description = 'Postal / ZIP code'
      value = attrMap.get('postal_code')?.value || '70123'
      status = 'RESOLVED'
    } else if (lowerKey === 'country' || lowerKey.startsWith('ca_') || (lowerLabel.includes('country') && !lowerKey.includes('name'))) {
      label = 'Country / Work Authorization'
      description = 'Country of residence and legal work eligibility'
      value = attrMap.get('country')?.value || 'Indonesia'
      status = 'RESOLVED'
    } else if (lowerKey === 'firstname' || lowerKey === 'first_name' || (lowerLabel.includes('first name') && !['city', 'country', 'postcode'].includes(lowerKey))) {
      label = 'First Name'
      description = 'Given name'
      value = attrMap.get('first_name')?.value || candidateProfile.personal.fullName.split(' ')[0]
      status = 'RESOLVED'
    } else if (lowerKey === 'lastname' || lowerKey === 'last_name' || (lowerLabel.includes('last name') && !['city', 'country', 'postcode'].includes(lowerKey))) {
      label = 'Last Name'
      description = 'Surname / Family name'
      value = attrMap.get('last_name')?.value || candidateProfile.personal.fullName.split(' ').slice(1).join(' ') || candidateProfile.personal.fullName
      status = 'RESOLVED'
    } else if (lowerKey === 'name' || lowerKey === 'fullname' || lowerKey === '_systemfield_name' || lowerLabel.includes('nama lengkap') || lowerLabel.includes('full name')) {
      label = 'Full Legal Name'
      description = 'Official candidate full name'
      value = attrMap.get('full_name')?.value || candidateProfile.personal.fullName
      status = 'RESOLVED'
    } else if (lowerKey === 'email' || lowerKey === '_systemfield_email') {
      label = 'Email Address'
      description = 'Primary contact email'
      value = attrMap.get('email')?.value || candidateProfile.personal.email
      status = 'RESOLVED'
    } else if (lowerKey === 'telephone' || lowerKey.includes('phone') || lowerLabel.includes('telepon') || lowerLabel.includes('phone number')) {
      label = 'Phone Number'
      description = 'Mobile phone number with country code'
      value = attrMap.get('phone')?.value || candidateProfile.personal.phone
      status = 'RESOLVED'
    } else if (lowerKey === 'address' || lowerKey === 'location' || lowerLabel.includes('alamat') || lowerLabel.includes('address') || lowerLabel === 'location' || lowerLabel.includes('domisili')) {
      label = 'Residential Location'
      description = 'Street, municipality, and province address'
      value = attrMap.get('location')?.value || candidateProfile.personal.location
      status = 'RESOLVED'
    } else if (lowerKey === 'city' || lowerLabel.includes('city') || lowerLabel.includes('kota')) {
      label = 'City'
      description = 'Municipality / City of residence'
      value = attrMap.get('city')?.value || 'Kota Banjarmasin'
      status = 'RESOLVED'
    } else if (lowerKey === 'postcode' || lowerKey === 'postal_code' || lowerLabel.includes('postcode') || lowerLabel.includes('kode pos')) {
      label = 'Postal Code'
      description = 'Postal / ZIP code'
      value = attrMap.get('postal_code')?.value || '70123'
      status = 'RESOLVED'
    } else if (lowerKey === 'country' || lowerKey === 'ca_55164' || lowerLabel.includes('country')) {
      label = 'Country / Work Authorization'
      description = 'Country of residence and legal work eligibility'
      value = attrMap.get('country')?.value || 'Indonesia'
      status = 'RESOLVED'
    } else if (lowerKey === 'headline') {
      label = 'Professional Headline'
      description = '1-line summary headline for profile'
      value = attrMap.get('headline')?.value || 'Software & Data Engineer (5 Years Experience)'
      status = 'RESOLVED'
    } else if (lowerKey === 'summary') {
      label = 'Professional Summary'
      description = 'Comprehensive background, architectural accomplishments, and tech profile'
      value = candidateProfile.summary
      status = 'RESOLVED'
    } else if (lowerKey === 'is_married' || lowerLabel.includes('menikah')) {
      label = 'Marital Status'
      description = 'Legal marital status'
      value = attrMap.get('marital_status')?.value || 'Belum Menikah'
      status = 'RESOLVED'
    } else if (lowerKey === 'date_of_birth' || lowerLabel.includes('lahir')) {
      label = 'Date of Birth'
      description = 'Candidate birth date (DD/MM/YYYY)'
      value = attrMap.get('date_of_birth')?.value || '12/04/1997'
      status = 'RESOLVED'
    } else if (lowerKey.includes('linkedin') || lowerLabel.includes('linkedin')) {
      label = 'LinkedIn URL'
      description = 'Candidate verified LinkedIn profile'
      value = attrMap.get('linkedin')?.value || candidateProfile.personal.linkedin
      status = 'RESOLVED'
    } else if (lowerKey.includes('github') || lowerLabel.includes('github')) {
      label = 'GitHub URL'
      description = 'Public open-source repository portfolio'
      value = attrMap.get('github')?.value || candidateProfile.personal.github
      status = 'RESOLVED'
    } else if (lowerKey.includes('portfolio') || lowerLabel.includes('portfolio') || lowerLabel.includes('portofolio') || lowerKey === 'portfolio_url') {
      label = 'Portfolio URL'
      description = 'Public online portfolio and project showcases'
      value = attrMap.get('portfolio')?.value || candidateProfile.personal.portfolio || 'https://muhaemen.my.id'
      status = 'RESOLVED'
    }
    // 5. Education & Academics
    else if (lowerKey === 'education' && c.tag === 'select') {
      label = 'Highest Education Level'
      description = 'Degree completed'
      value = attrMap.get('education_level')?.value || 'S1'
      status = 'RESOLVED'
      note = `Matching bachelor degree (S1)`
    } else if (lowerKey === 'school' || lowerLabel.includes('school') || lowerLabel.includes('perguruan tinggi') || lowerLabel.includes('sekolah') || lowerLabel.includes('university')) {
      label = lowerLabel.includes('education') ? 'Education: School / University' : 'University / Higher Institution'
      description = 'Name of graduated higher education institution'
      value = attrMap.get('school')?.value || candidateProfile.education.institution
      status = 'RESOLVED'
    } else if (lowerKey === 'faculty' || lowerLabel.includes('fakultas')) {
      label = 'Faculty'
      description = 'Academic faculty division'
      value = attrMap.get('faculty')?.value || 'Fakultas Matematika dan Ilmu Pengetahuan Alam'
      status = 'RESOLVED'
    } else if (lowerKey === 'major' || lowerKey === 'field_of_study' || lowerLabel.includes('jurusan') || lowerLabel.includes('program studi') || lowerLabel.includes('field of study')) {
      label = 'Major / Field of Study'
      description = 'Undergraduate academic degree major'
      value = attrMap.get('major')?.value || 'Ilmu Komputer'
      status = 'RESOLVED'
    } else if (lowerKey === 'degree' || lowerLabel.includes('gelar')) {
      label = 'Degree'
      description = 'Academic degree title'
      value = attrMap.get('degree')?.value || candidateProfile.education.degree
      status = 'RESOLVED'
    } else if (lowerLabel.includes('education') && lowerKey.includes('start_date')) {
      label = 'Education: Start Date'
      description = 'University matriculation date (MM/YYYY)'
      value = attrMap.get('education_start_date')?.value || '08/2015'
      status = 'RESOLVED'
    } else if (lowerLabel.includes('education') && lowerKey.includes('end_date')) {
      label = 'Education: Graduation Date'
      description = 'University degree completion date (MM/YYYY)'
      value = attrMap.get('education_end_date')?.value || '03/2020'
      status = 'RESOLVED'
    }
    // 6. Experience
    else if (lowerKey === 'experience' && c.tag === 'select') {
      label = 'Years of Professional Experience'
      description = 'Total years in software engineering'
      value = attrMap.get('experience_years')?.value || '> 5 Tahun'
      status = 'RESOLVED'
      note = `Choice '> 5 Tahun' matching total 5 years experience`
    } else if (lowerKey === 'title' || (lowerLabel.includes('experience') && lowerLabel.includes('title')) || lowerLabel.includes('job title')) {
      label = 'Experience: Role / Title'
      description = 'Job title held at most recent employer'
      value = attrMap.get('experience_role')?.value || candidateProfile.experience[0].role
      status = 'RESOLVED'
    } else if (lowerKey === 'company' || lowerKey === 'last_company' || lowerLabel.includes('tempat kerja')) {
      label = 'Experience: Employer Company'
      description = 'Most recent employer organization'
      value = attrMap.get('experience_company')?.value || candidateProfile.experience[0].company
      status = 'RESOLVED'
    } else if (lowerLabel.includes('experience') && lowerKey.includes('start_date')) {
      label = 'Experience: Start Date'
      description = 'Start date at most recent employer (MM/YYYY)'
      value = attrMap.get('experience_start_date')?.value || '03/2025'
      status = 'RESOLVED'
    } else if (lowerLabel.includes('experience') && lowerKey.includes('end_date')) {
      label = 'Experience: End Date'
      description = 'End date at most recent employer (MM/YYYY)'
      value = attrMap.get('experience_end_date')?.value || '06/2026'
      status = 'RESOLVED'
    } else if (lowerKey === 'industry') {
      label = 'Experience: Industry'
      description = 'Industry domain of previous employer'
      value = attrMap.get('experience_industry')?.value || 'Artificial Intelligence / Software'
      status = 'RESOLVED'
    } else if (lowerKey === 'current' && c.type === 'checkbox') {
      label = 'Experience: Currently Employed Here'
      description = 'Whether candidate currently works at this position'
      value = 'No (Unemployed / Actively Looking)'
      status = 'RESOLVED'
    }
    // 7. Consents & Custom Questions
    else if (lowerKey === 'info' && c.tag === 'select') {
      source = 'portal_custom'
      label = 'Information Source'
      description = 'How candidate learned of the opening'
      value = 'Lainnya'
      status = 'RESOLVED'
    } else if (lowerKey === 'info_other' || lowerLabel.includes('sumber informasi')) {
      source = 'portal_custom'
      label = 'Information Source Details'
      description = 'Specific job portal or career website'
      value = `Website Resmi Karir ${job.company}`
      status = 'RESOLVED'
    } else if (lowerKey.includes('engagement_preferences') || lowerLabel.includes('kesediaan solusi kerja')) {
      source = 'portal_custom'
      label = 'Engagement Preferences'
      description = 'Work arrangement engagement models'
      value = 'Dedicated Team, Staff Augmentation'
      status = 'RESOLVED'
    } else if (lowerKey.includes('talent_pool') || lowerLabel.includes('talent pool')) {
      source = 'portal_custom'
      label = 'Talent Pool Consent'
      description = 'Optional retention consent for upcoming opportunities'
      value = 'Setuju (12 bulan)'
      status = 'RESOLVED'
    } else if (lowerKey === 'last_salary' || lowerLabel.includes('gaji terakhir')) {
      label = 'Previous Monthly Salary'
      description = 'Last drawn monthly salary from previous employer'
      const attr = attrMap.get('salary_before')
      value = attr && attr.value && attr.status === 'RESOLVED' ? attr.value : '0 (Opsional)'
      status = 'RESOLVED'
    } else if (lowerKey === 'expected_salary' || lowerLabel.includes('gaji yang diharapkan')) {
      source = 'calculated_bid'
      label = 'Expected Monthly Salary'
      description = 'Expected monthly salary bid matching candidate standard'
      value = salaryBid.specificFormatted
      status = 'RESOLVED'
    } else if (lowerKey.includes('recaptcha') || lowerKey.includes('captcha') || lowerKey.includes('turnstile') || lowerKey === 'authenticity_token' || lowerKey.includes('application_retention') || lowerKey.includes('talent_pool_months')) {
      source = 'portal_custom'
      label = 'Automated System Parameter / Verification'
      description = 'Automated browser challenge or system parameter handled at runtime'
      value = 'Runtime Automated Parameter'
      status = 'RESOLVED'
    } else if (lowerKey === 'website' || lowerLabel === 'website') {
      label = 'Personal Portfolio Website'
      description = 'Candidate personal website or portfolio'
      value = attrMap.get('portfolio')?.value || candidateProfile.personal.portfolio || 'https://muhaemen.my.id'
      status = 'RESOLVED'
    } else if (lowerLabel.includes('programming language') || lowerLabel.includes('bahasa pemrograman')) {
      label = 'Interview Programming Language'
      description = 'Preferred programming language for technical evaluation'
      value = 'Golang (Go) / Python'
      status = 'RESOLVED'
    } else if (lowerLabel.includes('domain expertise') || lowerLabel.includes('keahlian')) {
      label = 'Domain Expertise'
      description = 'Core technical engineering focus'
      value = 'Backend Engineering, Distributed Systems, Data Engineering'
      status = 'RESOLVED'
    } else if (c.type === 'checkbox' || lowerLabel.includes('pernyataan') || lowerLabel.includes('persetujuan') || lowerLabel.includes('kebijakan') || lowerLabel.includes('privacy') || lowerLabel.includes('ai') || lowerKey === 'consent') {
      source = 'portal_custom'
      label = rawLabel.slice(0, 60)
      description = 'Legal or applicant consent policy acknowledgment'
      value = `Setuju (${rawLabel.slice(0, 40)}...)`
      status = 'RESOLVED'
    }
    // 8. Custom / Unmapped Attribute Fallback
    else {
      // Check if attribute is in candidate_profile_attributes ledger
      const cleanSlug = rawLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
      const existing = attrMap.get(lowerKey) || attrMap.get(cleanSlug)
      if (existing && existing.value && existing.status === 'RESOLVED') {
        value = existing.value
        status = 'RESOLVED'
        description = existing.description || 'Custom profile attribute'
      } else {
        value = '[NOT SPECIFIED IN CANDIDATE PROFILE]'
        status = 'ACTION_REQUIRED'
        description = `Unspecified attribute: "${rawLabel}". Must be resolved in Profile table.`
      }
    }

    if (c.required && status === 'ACTION_REQUIRED') {
      unresolvedRequiredCount++
      unresolvedKeys.push(key)
    }

    fields.push({
      key,
      label,
      value,
      required: c.required,
      source,
      status,
      description,
      note: note || (c.isConditional ? `Conditional dynamic field: ${c.condition || 'Dynamic DOM'}` : undefined)
    })
  }

  // Deduplicate controls with same key if static and template duplicated
  const seen = new Set<string>()
  const dedupedFields: FormFieldItem[] = []
  for (const f of fields) {
    const signature = `${f.key}_${f.label}`
    if (!seen.has(signature)) {
      seen.add(signature)
      dedupedFields.push(f)
    }
  }

  // Group fields cleanly
  const groups: FormPreviewGroup[] = []
  const personalFields = dedupedFields.filter(f => /photo|name|email|phone|tele|address|alamat|lahir|nikah|married|identi|country/i.test(f.key || f.label))
  const profileFields = dedupedFields.filter(f => /school|faculty|major|degree|edu|experi|last_comp|kerja|curriculum|resume|portfo|summary|title|comp/i.test(f.key || f.label) && !personalFields.includes(f))
  const remainingFields = dedupedFields.filter(f => !personalFields.includes(f) && !profileFields.includes(f))

  if (personalFields.length > 0) {
    groups.push({
      groupName: `1. Personal & Contact (Dynamically Discovered DOM Form)`,
      fields: personalFields
    })
  }
  if (profileFields.length > 0) {
    groups.push({
      groupName: `2. Profile, Education & Experience (Dynamically Discovered DOM Form)`,
      fields: profileFields
    })
  }
  if (remainingFields.length > 0) {
    groups.push({
      groupName: `3. Screening, Compensation & Consents (Dynamically Discovered DOM Form)`,
      fields: remainingFields
    })
  }

  return {
    jobId: job.id,
    company: job.company,
    title: job.title,
    portal: job.portal,
    location: job.location,
    expectedSalaryBid: salaryBid,
    groups,
    isBlocked: unresolvedRequiredCount > 0,
    unresolvedRequiredCount,
    unresolvedKeys
  }
}

/**
 * Builds the full preview of all fields that will be submitted to the job's application form.
 * Dispatches dynamically to the exact DOM schema discovered live by the crawler.
 */
export function generateFormFillPreview(job: any): FormFillPreviewResult {
  const salaryBid = calculateExpectedSalaryBid(
    job.location,
    job.salary_raw,
    job.salary_min,
    job.salary_max
  )

  // Use dynamic DOM form schema whenever available
  if (job.form_schema) {
    return renderDynamicFormSchema(job, salaryBid)
  }

  // Fallback if form_schema not yet populated
  const p = candidateProfile.personal
  return {
    jobId: job.id,
    company: job.company,
    title: job.title,
    portal: job.portal || 'Generic',
    location: job.location || 'Indonesia',
    expectedSalaryBid: salaryBid,
    isBlocked: false,
    unresolvedRequiredCount: 0,
    unresolvedKeys: [],
    groups: [
      {
        groupName: '1. Standard Identity Application Fields',
        fields: [
          { key: 'full_name', label: 'Full Legal Name', value: p.fullName, required: true, source: 'candidate_profile', status: 'RESOLVED', description: 'Candidate official legal full name' },
          { key: 'email', label: 'Email Address', value: p.email, required: true, source: 'candidate_profile', status: 'RESOLVED', description: 'Primary contact email' },
          { key: 'phone', label: 'Phone Number', value: p.phone, required: true, source: 'candidate_profile', status: 'RESOLVED', description: 'Primary phone number' },
          { key: 'location', label: 'Location', value: p.location, required: true, source: 'candidate_profile', status: 'RESOLVED', description: 'Residential location' }
        ]
      }
    ]
  }
}

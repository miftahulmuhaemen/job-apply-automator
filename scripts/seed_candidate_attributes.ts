import candidateProfile from '../data/candidateProfile.json' with { type: 'json' }
import { queryD1 } from '../web/src/storage/cfD1.js'
import { db, getAllCandidateAttributes } from '../web/src/storage/db.js'

export interface ProfileAttributeSeed {
  key: string
  category: 'personal' | 'compensation' | 'references' | 'education' | 'experience' | 'skills' | 'documents'
  label: string
  description: string
  value: string | null
  status: 'RESOLVED' | 'UNRESOLVED'
  source_portal: string
  required_by_default: number
}

export const seedAttributes: ProfileAttributeSeed[] = [
  // 1. Personal & Contact
  {
    key: 'full_name',
    category: 'personal',
    label: 'Full Legal Name',
    description: 'Official candidate full name for applications and legal verifications',
    value: candidateProfile.personal.fullName,
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  },
  {
    key: 'first_name',
    category: 'personal',
    label: 'First Name',
    description: 'Candidate given name',
    value: candidateProfile.personal.fullName.split(' ')[0],
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  },
  {
    key: 'last_name',
    category: 'personal',
    label: 'Last Name',
    description: 'Candidate family name / surname',
    value: candidateProfile.personal.fullName.split(' ').slice(1).join(' ') || candidateProfile.personal.fullName,
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  },
  {
    key: 'email',
    category: 'personal',
    label: 'Email Address',
    description: 'Primary contact email address',
    value: candidateProfile.personal.email,
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  },
  {
    key: 'phone',
    category: 'personal',
    label: 'Phone Number',
    description: 'Mobile phone number with country code (+62)',
    value: candidateProfile.personal.phone,
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  },
  {
    key: 'whatsapp',
    category: 'personal',
    label: 'WhatsApp Contact',
    description: 'Direct WhatsApp messaging contact number',
    value: candidateProfile.personal.whatsapp || candidateProfile.personal.phone,
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'location',
    category: 'personal',
    label: 'Residential Address / Location',
    description: 'Municipality, province, and residence address',
    value: candidateProfile.personal.location,
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  },
  {
    key: 'city',
    category: 'personal',
    label: 'City of Residence',
    description: 'Municipality / City of residence',
    value: 'Kota Banjarmasin',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  },
  {
    key: 'province',
    category: 'personal',
    label: 'Province / State',
    description: 'Administrative province of residence',
    value: 'Kalimantan Selatan',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'postal_code',
    category: 'personal',
    label: 'Postal Code',
    description: 'Postal / ZIP code of residence',
    value: '70123',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'country',
    category: 'personal',
    label: 'Country of Residence',
    description: 'Country of citizenship / residence',
    value: 'Indonesia',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  },
  {
    key: 'date_of_birth',
    category: 'personal',
    label: 'Date of Birth',
    description: 'Candidate birth date (DD/MM/YYYY)',
    value: '12/04/1997',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'marital_status',
    category: 'personal',
    label: 'Marital Status',
    description: 'Candidate legal marital status (Belum Menikah / Menikah)',
    value: 'Belum Menikah',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'portfolio',
    category: 'personal',
    label: 'Personal Portfolio Website',
    description: 'Personal portfolio website URL',
    value: candidateProfile.personal.portfolio,
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'linkedin',
    category: 'personal',
    label: 'LinkedIn Profile URL',
    description: 'Verified public LinkedIn profile URL',
    value: candidateProfile.personal.linkedin,
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'github',
    category: 'personal',
    label: 'GitHub Profile URL',
    description: 'Public open-source code repository portfolio URL',
    value: candidateProfile.personal.github,
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'headline',
    category: 'personal',
    label: 'Professional Headline',
    description: '1-line summary headline for profile header',
    value: 'Software & Data Engineer (5 Years Experience)',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'summary',
    category: 'personal',
    label: 'Professional Summary',
    description: 'Comprehensive background, architectural accomplishments, and tech profile',
    value: candidateProfile.summary,
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'work_authorization',
    category: 'personal',
    label: 'Work Authorization',
    description: 'Legal eligibility to work in Indonesia without visa sponsorship',
    value: 'Indonesian Citizen (WNI), no visa sponsorship required',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  },

  // 2. Skills & Technical Preferences
  {
    key: 'interview_programming_language',
    category: 'skills',
    label: 'Interview Programming Language',
    description: 'Preferred programming language for live coding and technical evaluations',
    value: 'Golang (Go) / Python',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'domain_expertise',
    category: 'skills',
    label: 'Domain Technical Expertise',
    description: 'Core software engineering domain and architectural focus',
    value: 'Backend Engineering, Distributed Microservices, Data Pipelines',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'notice_period',
    category: 'skills',
    label: 'Notice Period',
    description: 'Availability to commence work at new employer',
    value: 'Immediately / ASAP',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'employment_status',
    category: 'skills',
    label: 'Employment Status',
    description: 'Current job search status',
    value: 'Unemployed / Actively Looking',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'work_arrangement',
    category: 'skills',
    label: 'Work Arrangement Preference',
    description: 'Acceptable work arrangements (Remote, Hybrid, On-site)',
    value: 'All arrangements acceptable (Remote, Hybrid, On-site / WFO)',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },

  // 3. Compensation
  {
    key: 'salary_before',
    category: 'compensation',
    label: 'Previous Monthly Salary',
    description: 'Last drawn monthly salary from previous employer in IDR',
    value: 'Rp 7.000.000',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'salary_before_type',
    category: 'compensation',
    label: 'Previous Salary Tax Basis',
    description: 'Tax basis for previous compensation (nett / bruto)',
    value: 'nett',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'salary_expected_floor',
    category: 'compensation',
    label: 'Expected Monthly Salary Floor',
    description: 'Minimum acceptable monthly compensation in IDR',
    value: '8000000',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  },
  {
    key: 'salary_expected_type',
    category: 'compensation',
    label: 'Expected Salary Basis',
    description: 'Expected compensation tax basis (bruto)',
    value: 'bruto',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'target_hourly_rate',
    category: 'compensation',
    label: 'Target Hourly Rate (USD)',
    description: 'Preferred hourly rate for global consulting or expert evaluation roles',
    value: '$25 / hour',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },

  // 4. Education
  {
    key: 'education_level',
    category: 'education',
    label: 'Highest Education Level',
    description: 'Highest academic degree obtained (S1 / Bachelor)',
    value: 'S1',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  },
  {
    key: 'school',
    category: 'education',
    label: 'University / Higher Institution',
    description: 'Name of graduated higher education university',
    value: candidateProfile.education.institution,
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  },
  {
    key: 'degree',
    category: 'education',
    label: 'Degree Title',
    description: 'Formal academic degree title awarded',
    value: candidateProfile.education.degree,
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  },
  {
    key: 'faculty',
    category: 'education',
    label: 'Faculty',
    description: 'University faculty or academic department',
    value: 'Fakultas Matematika dan Ilmu Pengetahuan Alam',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'major',
    category: 'education',
    label: 'Major / Field of Study',
    description: 'Undergraduate academic degree major',
    value: 'Ilmu Komputer',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  },
  {
    key: 'gpa',
    category: 'education',
    label: 'GPA / Nilai IPK',
    description: 'Cumulative GPA on 4.0 scale',
    value: candidateProfile.education.gpa,
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'education_start_date',
    category: 'education',
    label: 'Education: Start Date',
    description: 'University matriculation date (MM/YYYY)',
    value: '08/2015',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'education_end_date',
    category: 'education',
    label: 'Education: End Date (Graduation)',
    description: 'University graduation date (MM/YYYY)',
    value: '03/2020',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },

  // 5. Work Experience
  {
    key: 'experience_years',
    category: 'experience',
    label: 'Total Years of Experience',
    description: 'Total professional software engineering experience (> 5 Years)',
    value: '> 5 Tahun',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  },
  {
    key: 'experience_role',
    category: 'experience',
    label: 'Experience: Most Recent Role',
    description: 'Job title at latest employer',
    value: candidateProfile.experience[0].role,
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  },
  {
    key: 'experience_company',
    category: 'experience',
    label: 'Experience: Most Recent Company',
    description: 'Name of latest employer',
    value: candidateProfile.experience[0].company,
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  },
  {
    key: 'experience_start_date',
    category: 'experience',
    label: 'Experience: Start Date',
    description: 'Start date at latest employer (MM/YYYY)',
    value: '03/2025',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'experience_end_date',
    category: 'experience',
    label: 'Experience: End Date',
    description: 'End date at latest employer (MM/YYYY)',
    value: '06/2026',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'experience_industry',
    category: 'experience',
    label: 'Experience: Industry',
    description: 'Industry classification of latest employer',
    value: 'Artificial Intelligence / Software',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },

  // 6. Professional References
  {
    key: 'reference_name',
    category: 'references',
    label: 'Professional Reference: Full Name',
    description: 'Full legal name of professional referee / former engineering manager',
    value: null,
    status: 'UNRESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'reference_role',
    category: 'references',
    label: 'Professional Reference: Role / Title',
    description: 'Title / position of referee (e.g. VP of Engineering, Lead Architect)',
    value: null,
    status: 'UNRESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'reference_company',
    category: 'references',
    label: 'Professional Reference: Company',
    description: 'Company where referee worked with candidate',
    value: null,
    status: 'UNRESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'reference_contact',
    category: 'references',
    label: 'Professional Reference: Phone / WhatsApp',
    description: 'Direct phone number of referee',
    value: null,
    status: 'UNRESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'reference_email',
    category: 'references',
    label: 'Professional Reference: Email',
    description: 'Work email address of referee',
    value: null,
    status: 'UNRESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },

  // 7. Documents
  {
    key: 'photo_document',
    category: 'documents',
    label: 'Applicant Portrait Photo',
    description: 'Recent professional applicant portrait image file (JPEG/PNG max 4MB in data/assets/photo.jpg)',
    value: null,
    status: 'UNRESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'portfolio_document',
    category: 'documents',
    label: 'Portfolio Dossier (PDF)',
    description: 'Complete architecture and production systems portfolio document (PDF)',
    value: 'Miftahul_Muhaemen_Portfolio.pdf',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 0
  },
  {
    key: 'resume_document',
    category: 'documents',
    label: 'Tailored ATS Resume (PDF)',
    description: 'Single-column tailored ATS resume document generated per target job',
    value: 'Miftahul_Muhaemen_Resume.pdf',
    status: 'RESOLVED',
    source_portal: 'profile',
    required_by_default: 1
  }
]

export async function seedCandidateAttributes() {
  console.log(`[SEED] Seeding ${seedAttributes.length} canonical candidate attributes...`)

  // 1. Wipe old table in SQLite and Cloudflare D1
  db.exec('DELETE FROM candidate_profile_attributes;')
  await queryD1('DELETE FROM candidate_profile_attributes;')

  // 2. Insert clean canonical master attributes
  const insertStmt = db.prepare(`
    INSERT INTO candidate_profile_attributes (
      key, category, label, description, value, status, source_portal, required_by_default, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `)

  let d1SqlBatch = ''
  for (const attr of seedAttributes) {
    insertStmt.run(
      attr.key,
      attr.category,
      attr.label,
      attr.description,
      attr.value,
      attr.status,
      attr.source_portal,
      attr.required_by_default
    )

    const valEsc = attr.value === null ? 'NULL' : `'${attr.value.replace(/'/g, "''")}'`
    const descEsc = attr.description ? `'${attr.description.replace(/'/g, "''")}'` : 'NULL'
    const labelEsc = `'${attr.label.replace(/'/g, "''")}'`

    d1SqlBatch += `INSERT OR REPLACE INTO candidate_profile_attributes (key, category, label, description, value, status, source_portal, required_by_default, updated_at) VALUES ('${attr.key}', '${attr.category}', ${labelEsc}, ${descEsc}, ${valEsc}, '${attr.status}', '${attr.source_portal}', ${attr.required_by_default}, datetime('now')); `
  }

  await queryD1(d1SqlBatch)

  const rows = getAllCandidateAttributes()
  const unresolved = rows.filter(r => r.status === 'UNRESOLVED')
  console.log(`[SUCCESS] Candidate Profile Ledger restored cleanly!`)
  console.log(`  Total Canonical Attributes: ${rows.length}`)
  console.log(`  Action Required (Unresolved): ${unresolved.length} (${unresolved.map(u => u.label).join(', ')})`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedCandidateAttributes().catch(console.error)
}

/**
 * BITC Student Admission Number Generator & Utilities
 * Format: BITC/<SHORT_CODE>/<SERIAL_3_DIGITS>/<ACADEMIC_YEAR>
 * Examples:
 * - Cosmetology: BITC/COS/001/2026
 * - Christian Ministry: BITC/CM/001/2026
 * - Caregiver: BITC/CG/001/2026
 * - Health Support Services: BITC/HSS/001/2026
 * - Software Engineering: BITC/SE/001/2026
 * - Computer Packages: BITC/CP/001/2026
 * - Cookery & Baking: BITC/CB/001/2026
 * - Catering & Hospitality: BITC/CH/001/2026
 * - Electrical & Electronics: BITC/EET/001/2026
 * - Nursing Aide: BITC/NA/001/2026
 */

export const COURSE_MAPPINGS: { [key: string]: string } = {
  cosmetology: 'COS',
  beauty: 'COS',
  makeup: 'COS',
  hairdressing: 'COS',
  hair: 'COS',
  'christian ministry': 'CM',
  ministry: 'CM',
  theology: 'CM',
  biblical: 'CM',
  divinity: 'CM',
  pastoral: 'CM',
  caregiver: 'CG',
  caregiving: 'CG',
  'health support services': 'HSS',
  'health support': 'HSS',
  'healthcare support': 'HSS',
  'healthcare': 'HSS',
  'nursing aide': 'NA',
  nursing: 'NA',
  'software engineering': 'SE',
  software: 'SE',
  'web development': 'SE',
  'computer packages': 'CP',
  packages: 'CP',
  cookery: 'CB',
  baking: 'CB',
  cake: 'CB',
  catering: 'CH',
  hospitality: 'CH',
  electrical: 'EET',
  electronics: 'EET',
  solar: 'EET',
  eet: 'EET',
};

// Aliases and legacy code variants for matching existing database records
export const EQUIVALENT_CODES: Record<string, string[]> = {
  COS: ['COS', 'COSMETOLOGY', 'DBT', 'CHD', 'BEAUTY', 'HAIR'],
  CM: ['CM', 'CHRISTIAN-MINISTRY', 'CHRISTIAN_MINISTRY', 'THEOLOGY', 'THS', 'MINISTRY'],
  CG: ['CG', 'CAREGIVER', 'CAREGIVING', 'CNA'],
  HSS: ['HSS', 'HEALTH-SUPPORT', 'HEALTH_SUPPORT', 'HEALTHCARE', 'HEALTH-CARE'],
  NA: ['NA', 'NURSING-AIDE', 'DNA', 'NURSING'],
  SE: ['SE', 'SOFTWARE-ENG', 'SOFTWARE', 'DSE', 'WEB'],
  CP: ['CP', 'COMP-PACKAGES', 'PACKAGES', 'CCP'],
  CB: ['CB', 'COOKERY-BAKING', 'COOKERY', 'BAKING', 'CPC'],
  CH: ['CH', 'CATERING-HOSPITALITY', 'CATERING', 'DCH', 'HOSPITALITY'],
  EET: ['EET', 'ELECTRICAL-ENG', 'ELECTRICAL', 'CEET', 'ELECTRONICS'],
};

/**
 * Derives a standardized short course code for the admission number
 * e.g., Cosmetology -> COS, Christian Ministry -> CM, Caregiver -> CG, Health Support -> HSS
 */
export function getCourseAdmissionCode(courseName: string): string {
  if (!courseName || !courseName.trim()) {
    return 'GEN';
  }

  const lower = courseName.toLowerCase().trim();

  // 1. Exact or keyword matches to standard short codes
  if (lower.includes('cosmetology') || lower.includes('beauty') || lower.includes('hairdressing') || lower.includes('makeup') || lower.includes('hair')) {
    return 'COS';
  }
  if (lower.includes('christian ministry') || lower.includes('theology') || lower.includes('biblical') || lower.includes('ministry') || lower.includes('divinity') || lower.includes('pastoral')) {
    return 'CM';
  }
  if (lower.includes('caregiver') || lower.includes('caregiving')) {
    return 'CG';
  }
  if (lower.includes('health support') || lower.includes('healthcare support') || lower.includes('health support services') || lower.includes('healthcare services') || lower.includes('health services')) {
    return 'HSS';
  }
  if (lower.includes('nursing') || lower.includes('nurse') || lower.includes('aide')) {
    return 'NA';
  }
  if (lower.includes('software') || lower.includes('web dev') || lower.includes('programming') || lower.includes('coding')) {
    return 'SE';
  }
  if (lower.includes('package') || lower.includes('packages') || lower.includes('computer package') || lower.includes('digital commerce') || lower.includes('digital literacy')) {
    return 'CP';
  }
  if (lower.includes('cookery') || lower.includes('baking') || lower.includes('cake')) {
    return 'CB';
  }
  if (lower.includes('catering') || lower.includes('hospitality')) {
    return 'CH';
  }
  if (lower.includes('electrical') || lower.includes('electronics') || lower.includes('solar') || lower.includes('eet')) {
    return 'EET';
  }

  // 2. Custom clean acronym for any other dynamic courses
  const cleanTokens = courseName
    .replace(/^(certificate|diploma|artisan|craft|short course|advanced certificate|degree)\s+(in|of)?\s*/i, '')
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 0 && !['and', 'for', 'the', 'in', 'of', 'with', '&'].includes(t.toLowerCase()));

  if (cleanTokens.length === 0) return 'GEN';
  if (cleanTokens.length === 1) {
    return cleanTokens[0].toUpperCase().slice(0, 4);
  }
  
  // Combine first letters of up to 3 words (e.g. "Community Development" -> "CD")
  return cleanTokens.slice(0, 3).map(t => t[0].toUpperCase()).join('');
}

/**
 * Generates an official BITC admission number
 * Format: BITC/<SHORT_CODE>/<PADDED_SERIAL>/<YEAR>
 * e.g., BITC/COS/001/2026, BITC/CM/001/2026, BITC/CG/001/2026
 */
export function formatAdmissionNumber(
  courseName: string,
  serial: number | string,
  academicYear: string = '2026'
): string {
  const code = getCourseAdmissionCode(courseName);
  const num = typeof serial === 'string' ? parseInt(serial, 10) : serial;
  const validNum = isNaN(num) || num < 1 ? 1 : num;
  const paddedSerial = String(validNum).padStart(3, '0');
  const cleanYear = (academicYear || '2026').trim().replace(/[^0-9]/g, '').slice(0, 4) || '2026';

  return `BITC/${code}/${paddedSerial}/${cleanYear}`;
}

/**
 * Calculates the next available sequential number given existing admission numbers and course
 */
export function calculateNextAdmissionSerial(
  existingRecords: Array<{ admissionNumber?: string; course?: string }>,
  targetCourse?: string
): number {
  let highestSerial = 0;
  const targetCode = targetCourse ? getCourseAdmissionCode(targetCourse) : null;
  const validCodes = targetCode ? (EQUIVALENT_CODES[targetCode] || [targetCode]) : null;

  existingRecords.forEach(rec => {
    if (!rec?.admissionNumber) return;
    const str = String(rec.admissionNumber).trim();

    // Check if matching BITC format: BITC/<COURSE>/<SERIAL>/<YEAR> or BITC/<COURSE>/<SERIAL>
    const bitcMatch = str.match(/^BITC\/([^\/]+)\/(\d+)(?:\/(\d{4}))?$/i);
    if (bitcMatch) {
      const courseInAdm = bitcMatch[1].toUpperCase();
      const serialNum = parseInt(bitcMatch[2], 10);
      const isTargetCourse = !validCodes || validCodes.includes(courseInAdm);

      if (isTargetCourse && !isNaN(serialNum) && serialNum > highestSerial && serialNum < 100000) {
        highestSerial = serialNum;
      }
      return;
    }

    // Check other formats like BITC/<NUM>/<YEAR> or raw numbers
    const parts = str.split('/');
    parts.forEach(part => {
      const parsed = parseInt(part, 10);
      // Skip year numbers (2020-2035)
      if (!isNaN(parsed) && (parsed < 2020 || parsed > 2035) && parsed > highestSerial && parsed < 100000) {
        highestSerial = parsed;
      }
    });
  });

  return highestSerial + 1;
}

export const KNOWN_COURSES = [
  "Cosmetology",
  "Diploma in Beauty Therapy, Skincare & Professional Makeup",
  "Certificate in Hairdressing & Beauty Therapy",
  "Caregiver",
  "Health Support Services",
  "Certificate in Healthcare Support Services & Caregiver",
  "Diploma in Nursing Aide, Anatomy & Patient Nutrition",
  "Christian Ministry",
  "Diploma in Theology & Christian Ministry",
  "Certificate in Theology & Biblical Studies",
  "Diploma in Software Engineering & Web Development",
  "Certificate in Computer Packages & Digital Commerce Systems",
  "Certificate in Professional Cookery, General Baking & Cake Decoration",
  "Diploma in Catering & Hospitality Management",
  "Certificate in Electrical and Electronics Technology"
];

/**
 * Maps any course or program to its official College School / Faculty
 * - Caregiver / Health Support Services / Nursing / Health Care -> "School of Health Sciences"
 * - Cosmetology / Beauty Therapy / Hairdressing / Makeup -> "School of Cosmetology"
 * - Electrical & Electronics / Solar / Wireman -> "School of Electrical & Technology"
 * - Christian Ministry / Theology / Biblical Studies -> "School of Theological Studies & Ministry"
 * - Software Engineering / Computer Packages / ICT -> "School of ICT & Software Engineering"
 * - Cookery / Baking / Catering / Hospitality -> "School of Hospitality & Culinary Arts"
 */
export function getSchoolForCourse(courseName?: string): string {
  if (!courseName || !courseName.trim()) {
    return 'School of Vocational & Technical Studies';
  }

  const c = courseName.toLowerCase().trim();

  // Health Sciences (Caregiver, Healthcare Support Services, Nursing Aide, etc.)
  if (
    c.includes('caregiver') ||
    c.includes('caregiving') ||
    c.includes('health support') ||
    c.includes('healthcare support') ||
    c.includes('health science') ||
    c.includes('healthcare') ||
    c.includes('health') ||
    c.includes('nursing') ||
    c.includes('nurse') ||
    c.includes('aide') ||
    c.includes('anatomy') ||
    c.includes('patient') ||
    c.includes('clinic') ||
    c.includes('cna') ||
    c.includes('dna')
  ) {
    return 'School of Health Sciences';
  }

  // Cosmetology & Beauty Studies
  if (
    c.includes('cosmetology') ||
    c.includes('beauty') ||
    c.includes('hairdressing') ||
    c.includes('hair') ||
    c.includes('makeup') ||
    c.includes('make-up') ||
    c.includes('skincare') ||
    c.includes('styling') ||
    c.includes('nail') ||
    c.includes('dbt') ||
    c.includes('chd')
  ) {
    return 'School of Cosmetology';
  }

  // Electrical & Technology
  if (
    c.includes('electrical') ||
    c.includes('electronic') ||
    c.includes('solar') ||
    c.includes('wireman') ||
    c.includes('wiring') ||
    c.includes('eet') ||
    c.includes('ceet')
  ) {
    return 'School of Electrical & Technology';
  }

  // Theological Studies & Ministry
  if (
    c.includes('theolog') ||
    c.includes('ministry') ||
    c.includes('christian') ||
    c.includes('biblical') ||
    c.includes('divinity') ||
    c.includes('pastoral') ||
    c.includes('ths')
  ) {
    return 'School of Theological Studies & Ministry';
  }

  // ICT & Software Engineering
  if (
    c.includes('software') ||
    c.includes('ict') ||
    c.includes('computer') ||
    c.includes('package') ||
    c.includes('web') ||
    c.includes('programming') ||
    c.includes('coding') ||
    c.includes('digital commerce') ||
    c.includes('dse') ||
    c.includes('ccp')
  ) {
    return 'School of ICT & Software Engineering';
  }

  // Hospitality & Culinary Arts
  if (
    c.includes('hospitality') ||
    c.includes('catering') ||
    c.includes('cookery') ||
    c.includes('baking') ||
    c.includes('cake') ||
    c.includes('food') ||
    c.includes('culinary') ||
    c.includes('cpc') ||
    c.includes('dch')
  ) {
    return 'School of Hospitality & Culinary Arts';
  }

  // Business & Entrepreneurship
  if (
    c.includes('business') ||
    c.includes('entrepreneurship') ||
    c.includes('accounting') ||
    c.includes('commerce') ||
    c.includes('management')
  ) {
    return 'School of Business & Entrepreneurship';
  }

  return 'School of Professional Studies';
}

/**
 * Returns the corresponding academic department for any course
 */
export function getDepartmentForCourse(courseName?: string): string {
  if (!courseName || !courseName.trim()) {
    return 'Department of Academic & Vocational Studies';
  }

  const c = courseName.toLowerCase().trim();

  if (c.includes('caregiver') || c.includes('caregiving') || c.includes('health') || c.includes('nursing') || c.includes('aide')) {
    return 'Department of Health & Social Care Services';
  }
  if (c.includes('cosmetology') || c.includes('beauty') || c.includes('hair') || c.includes('makeup')) {
    return 'Department of Cosmetology & Personal Care Services';
  }
  if (c.includes('electrical') || c.includes('electronic') || c.includes('solar') || c.includes('wiring') || c.includes('eet')) {
    return 'Department of Electrical & Renewable Energy Engineering';
  }
  if (c.includes('theolog') || c.includes('ministry') || c.includes('christian') || c.includes('biblical')) {
    return 'Department of Theological Studies & Christian Ministry';
  }
  if (c.includes('software') || c.includes('ict') || c.includes('computer') || c.includes('package') || c.includes('web')) {
    return 'Department of Information Technology & Computing';
  }
  if (c.includes('hospitality') || c.includes('catering') || c.includes('cookery') || c.includes('baking') || c.includes('food')) {
    return 'Department of Hospitality & Food Technology';
  }
  if (c.includes('business') || c.includes('commerce') || c.includes('accounting')) {
    return 'Department of Business & Entrepreneurship';
  }

  return 'Department of Academic & Technical Studies';
}


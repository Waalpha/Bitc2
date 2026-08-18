export interface ContactInformation {
  phone?: string;
  email?: string;
  address?: string;
}

export interface School {
  id: string; // Document ID: e.g. "bitc", "greenwood"
  name: string;
  code?: string;
  appTitle?: string;
  logoUrl?: string;
  contactInformation?: ContactInformation;
  publicAddress?: string;
  publicPhone?: string;
  publicEmail?: string;
  subscriptionPlan?: 'basic' | 'pro' | 'enterprise';
  expiry?: string;
  activeStatus?: boolean;
  active?: boolean;
  createdAt: string;
}

export interface AppSettings {
  schoolId?: string;
  appTitle: string;
  schoolName?: string;
  logoUrl?: string;
  stampUrl?: string;
  stampPosition?: 'left' | 'center' | 'right';
  fontFamily: string;
  fontSize: string;
  textAlign: 'left' | 'center' | 'right';
  isSchoolClosed?: boolean;
  schoolClosedReason?: string;
  schoolReopenDate?: string;
  allowGateAccessWithFees?: boolean;
  // Official Bank Details & Payment Modes
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  bankPaybill?: string;
  bankPaymentInstructions?: string;
  // Public Portal Settings & Brand Identity
  publicAddress?: string;
  publicPhone?: string;
  publicPhoneSecondary?: string;
  publicWhatsapp?: string;
  publicEmail?: string;
  publicHours?: string;
  publicLocationEmbed?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  headerApplyButtonText?: string;
  headerPortalButtonText?: string;
  // Hero Section
  heroBadgeText?: string;
  heroBadgeEnabled?: boolean;
  publicHeroTitle?: string;
  publicHeroAccentText?: string;
  publicHeroDescription?: string;
  heroLocationText?: string;
  heroPrimaryBtnText?: string;
  heroPrimaryBtnLink?: string;
  heroSecondaryBtnText?: string;
  heroSecondaryBtnLink?: string;
  heroTrustLine?: string;
  publicHeroImageUrl?: string;
  publicHeroImages?: string[];
  publicHeroFont?: string;
  publicHeroAlign?: 'left' | 'center' | 'right';
  publicHeroTitleSize?: string;
  publicHeroDescriptionSize?: string;
  publicHeroTitleBold?: boolean;
  publicHeroTitleItalic?: boolean;
  publicHeroDescriptionBold?: boolean;
  publicHeroDescriptionItalic?: boolean;
  publicHeroPhotoOpacity?: number;
  publicLogoUrl?: string;
  publicPrimaryColor?: string;
  publicSecondaryColor?: string;
  publicAccentColor?: string;
  // Hero 4 Quick Information Cards
  heroCard1Title?: string;
  heroCard1Desc?: string;
  heroCard1Icon?: string;
  heroCard2Title?: string;
  heroCard2Desc?: string;
  heroCard2Icon?: string;
  heroCard3Title?: string;
  heroCard3Desc?: string;
  heroCard3Icon?: string;
  heroCard4Title?: string;
  heroCard4Desc?: string;
  heroCard4Icon?: string;
  // Welcome / About Section
  aboutPreHeading?: string;
  aboutTitle?: string;
  portalAboutUs?: string;
  aboutImageUrl?: string;
  aboutBullet1Title?: string;
  aboutBullet1Desc?: string;
  aboutBullet2Title?: string;
  aboutBullet2Desc?: string;
  aboutBullet3Title?: string;
  aboutBullet3Desc?: string;
  aboutButtonText?: string;
  aboutButtonLink?: string;
  // Why Choose BITC Section
  whyChooseHeading?: string;
  whyChooseSubheading?: string;
  whyFeature1Title?: string;
  whyFeature1Desc?: string;
  whyFeature2Title?: string;
  whyFeature2Desc?: string;
  whyFeature3Title?: string;
  whyFeature3Desc?: string;
  whyFeature4Title?: string;
  whyFeature4Desc?: string;
  whyFeature5Title?: string;
  whyFeature5Desc?: string;
  whyFeature6Title?: string;
  whyFeature6Desc?: string;
  // Examination & Training Notice
  examInfoHeading?: string;
  examInfoCardTitle?: string;
  examInfoCardText?: string;
  // Accreditations
  accreditationHeading?: string;
  accredBadge1Name?: string;
  accredBadge1Sub?: string;
  accredBadge2Name?: string;
  accredBadge2Sub?: string;
  accredBadge3Name?: string;
  accredBadge3Sub?: string;
  accredTvetaReg?: string;
  // Admissions 4-step Section
  admissionsHeading?: string;
  admissionsSubheading?: string;
  admStep1Title?: string;
  admStep1Desc?: string;
  admStep2Title?: string;
  admStep2Desc?: string;
  admStep3Title?: string;
  admStep3Desc?: string;
  admStep4Title?: string;
  admStep4Desc?: string;
  admissionsIntakeOptions?: string;
  // Intake Banner CTA
  intakeBannerTitle?: string;
  intakeBannerSubtitle?: string;
  intakeBannerBtnText?: string;
  intakeBannerSecondaryBtnText?: string;
  intakeBannerLocation?: string;
  // Gallery & Student Experience
  galleryHeading?: string;
  gallerySubheading?: string;
  portalGalleryItems?: {
    url: string;
    title: string;
    tag: string;
  }[];
  portalGallery?: string[];
  // Testimonials
  testimonialsHeading?: string;
  testimonialsEnabled?: boolean;
  portalTestimonials?: {
    name: string;
    role: string;
    workplace: string;
    quote: string;
    rating: number;
    avatar: string;
  }[];
  // Contact & Location
  contactHeading?: string;
  contactSubheading?: string;
  // Footer
  footerDescription?: string;
  footerCopyright?: string;
  sessionTimeoutSeconds?: number;
  activeSession?: string;
  denyAccessOnBalance?: boolean;
  // Landing Page CMS additions
  portalNoticeEnabled?: boolean;
  portalNoticeText?: string;
  portalNoticeLink?: string;
  portalStat1Number?: string;
  portalStat1Label?: string;
  portalStat1Sub?: string;
  portalStat2Number?: string;
  portalStat2Label?: string;
  portalStat2Sub?: string;
  portalStat3Number?: string;
  portalStat3Label?: string;
  portalStat3Sub?: string;
  portalStat4Number?: string;
  portalStat4Label?: string;
  portalStat4Sub?: string;
  isPenaltyEnabled?: boolean;
  penaltyDay?: number;
  penaltyAmount?: number;
  // ERPNext Integration Settings
  erpnextEnabled?: boolean;
  erpnextUrl?: string;
  erpnextApiKey?: string;
  erpnextApiSecret?: string;
  erpnextCompany?: string;
  erpnextAutoSync?: boolean;
  erpnextSyncStudents?: boolean;
  erpnextSyncFees?: boolean;
  erpnextSyncAttendance?: boolean;
  erpnextLastSync?: string;
}

export interface ErpNextSyncLog {
  id: string;
  schoolId?: string;
  timestamp: string;
  type: 'students' | 'fees' | 'attendance' | 'test' | 'webhook';
  status: 'success' | 'failed' | 'warning';
  message: string;
  recordsProcessed?: number;
  details?: any;
}

export interface StyledText {
  text: string;
  fontSize?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
}

export interface LandingSettings {
  logoUrl?: string;
  featuresTitle: StyledText;
  featuresSubtitle: StyledText;
  features: {
    title: StyledText;
    description: StyledText;
    iconName: string;
  }[];
  stats: {
    label: string;
    value: string;
  }[];
  ctaTitle: StyledText;
  ctaSubtitle: StyledText;
  ctaButtonText: string;
}

export interface AuditLog {
  id: string;
  schoolId?: string;
  userId: string;
  action: string;
  module: string;
  description: string;
  timestamp: string;
}

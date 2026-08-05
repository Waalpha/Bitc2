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
  // Public Portal Settings
  publicAddress?: string;
  publicPhone?: string;
  publicEmail?: string;
  publicLocationEmbed?: string;
  publicHeroTitle?: string;
  publicHeroDescription?: string;
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
  // Public Portal Sections
  portalAboutUs?: string;
  aboutTitle?: string;
  aboutImageUrl?: string;
  portalGallery?: string[];
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
  portalTestimonials?: {
    name: string;
    role: string;
    workplace: string;
    quote: string;
    rating: number;
    avatar: string;
  }[];
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

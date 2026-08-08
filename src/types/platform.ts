export interface PlatformSettings {
  platformName: string;
  companyName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  defaultTheme: 'light' | 'dark' | 'system';
  phones: {
    primary: string;
    secondary?: string;
  };
  whatsappNumber: string;
  emails: {
    info: string;
    support: string;
    billing: string;
  };
  physicalAddress: string;
  websiteUrl: string;
  supportContactUrl: string;
  socialLinks: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    youtube?: string;
  };
  loginBranding: {
    bgImageUrl?: string;
    heroTitle?: string;
    heroSubtitle?: string;
  };
  dashboardBranding: {
    topbarTitle?: string;
    customAccentHex?: string;
  };
  footerText: string;
  copyrightText: string;
  termsAndConditions: string;
  privacyPolicy: string;
  customDomain: string;
  subdomainPattern: string;
  emailSmsConfig: {
    smtpHost?: string;
    smtpPort?: number;
    senderEmail?: string;
    smsApiKey?: string;
    smsSenderId?: string;
  };
  mpesaConfig: {
    consumerKey?: string;
    consumerSecret?: string;
    passkey?: string;
    shortcode?: string;
    tillNumber?: string;
    callbackUrl?: string;
  };
  cloudStorageConfig: {
    cloudinaryCloudName?: string;
    cloudinaryApiKey?: string;
    uploadPreset?: string;
  };
  apiKeys: {
    geminiApiKey?: string;
    googleMapsApiKey?: string;
    customWebhookUrl?: string;
  };
  lastUpdated?: string;
  updatedBy?: string;
}

export interface TenantInfo {
  id: string;
  name: string;
  appTitle: string;
  logoUrl?: string;
  adminEmail: string;
  domain?: string;
  subdomain?: string;
  plan: 'trial' | 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'trial' | 'suspended';
  maxStudents: number;
  createdAt: string;
  trialEndsAt?: string;
  mrr?: number;
  dbUsageMb?: number;
}

export interface PlatformAuditLog {
  id: string;
  timestamp: string;
  action: string;
  performedBy: string;
  details: string;
  tenantId?: string;
  ipAddress?: string;
}

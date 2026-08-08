import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, addDoc, updateDoc, query, orderBy, limit } from 'firebase/firestore';
import { PlatformSettings, TenantInfo, PlatformAuditLog } from '../types/platform';

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platformName: 'Davetech ERP',
  companyName: 'Davetech Solutions Ltd',
  tagline: 'Next-Gen Multi-Tenant Enterprise ERP Platform',
  logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
  faviconUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=32&auto=format&fit=crop&q=80',
  primaryColor: '#6366f1',
  secondaryColor: '#0f172a',
  defaultTheme: 'light',
  phones: {
    primary: '+254 700 123 456',
    secondary: '+254 722 987 654'
  },
  whatsappNumber: '+254700123456',
  emails: {
    info: 'info@davetech.co.ke',
    support: 'support@davetech.co.ke',
    billing: 'billing@davetech.co.ke'
  },
  physicalAddress: 'Davetech Plaza, General Kago Road, Thika, Kenya',
  websiteUrl: 'https://davetech.co.ke',
  supportContactUrl: 'https://davetech.co.ke/support',
  socialLinks: {
    facebook: 'https://facebook.com/davetechsolutions',
    twitter: 'https://twitter.com/davetech_erp',
    linkedin: 'https://linkedin.com/company/davetech-solutions',
    instagram: 'https://instagram.com/davetech_erp',
    youtube: 'https://youtube.com/@davetechsolutions'
  },
  loginBranding: {
    bgImageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=80',
    heroTitle: 'Welcome to Davetech Enterprise ERP',
    heroSubtitle: 'Unified Multi-Tenant Platform for Schools, Colleges & Institutions'
  },
  dashboardBranding: {
    topbarTitle: 'Davetech Command Center',
    customAccentHex: '#6366f1'
  },
  footerText: 'Powered by Davetech ERP Platform. High-Performance Multi-Tenant Architecture.',
  copyrightText: '© 2026 Davetech Solutions Ltd. All Rights Reserved.',
  termsAndConditions: 'Standard Davetech ERP Enterprise Terms & Conditions apply. All tenant data is cryptographically and logically isolated.',
  privacyPolicy: 'Davetech Solutions adheres to strict Data Protection Regulations (GDPR and Kenya Data Protection Act 2019). Tenant records remain private and secure.',
  customDomain: 'erp.davetech.co.ke',
  subdomainPattern: '{tenant}.davetech.co.ke',
  emailSmsConfig: {
    smtpHost: 'smtp.davetech.co.ke',
    smtpPort: 587,
    senderEmail: 'noreply@davetech.co.ke',
    smsApiKey: 'dvt_sms_live_98127391238',
    smsSenderId: 'DAVETECH'
  },
  mpesaConfig: {
    consumerKey: 'dvt_mpesa_consumer_key_live',
    consumerSecret: 'dvt_mpesa_consumer_secret_live',
    passkey: 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
    shortcode: '174379',
    tillNumber: '891023',
    callbackUrl: 'https://erp.davetech.co.ke/api/v1/mpesa/callback'
  },
  cloudStorageConfig: {
    cloudinaryCloudName: 'davetech-cloud',
    cloudinaryApiKey: '981273821931293',
    uploadPreset: 'davetech_erp_uploads'
  },
  apiKeys: {
    geminiApiKey: 'GEMINI_LIVE_API_KEY_CONFIGURED',
    googleMapsApiKey: 'AIzaSy_DAVETECH_MAPS_KEY',
    customWebhookUrl: 'https://erp.davetech.co.ke/api/v1/webhooks'
  }
};

const PLATFORM_SETTINGS_DOC = doc(db, 'settings', 'platform_settings');

export const subscribePlatformSettings = (
  callback: (settings: PlatformSettings) => void
) => {
  return onSnapshot(
    PLATFORM_SETTINGS_DOC,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback({ ...DEFAULT_PLATFORM_SETTINGS, ...data } as PlatformSettings);
      } else {
        callback(DEFAULT_PLATFORM_SETTINGS);
      }
    },
    (error) => {
      console.warn("Using default platform settings fallback due to error:", error);
      callback(DEFAULT_PLATFORM_SETTINGS);
    }
  );
};

export const getPlatformSettings = async (): Promise<PlatformSettings> => {
  try {
    const snap = await getDoc(PLATFORM_SETTINGS_DOC);
    if (snap.exists()) {
      return { ...DEFAULT_PLATFORM_SETTINGS, ...snap.data() } as PlatformSettings;
    }
  } catch (err) {
    console.error("Error getting platform settings:", err);
  }
  return DEFAULT_PLATFORM_SETTINGS;
};

export const savePlatformSettings = async (
  updatedSettings: Partial<PlatformSettings>,
  updatedBy: string
): Promise<boolean> => {
  try {
    const current = await getPlatformSettings();
    const merged = {
      ...current,
      ...updatedSettings,
      lastUpdated: new Date().toISOString(),
      updatedBy
    };
    await setDoc(PLATFORM_SETTINGS_DOC, merged, { merge: true });

    // Also write to audit log
    await logPlatformActivity({
      action: 'PLATFORM_SETTINGS_UPDATE',
      performedBy: updatedBy,
      details: 'Updated global Davetech ERP platform branding and settings configuration'
    });

    return true;
  } catch (err) {
    console.error("Failed to save platform settings:", err);
    throw err;
  }
};

export const logPlatformActivity = async (logData: {
  action: string;
  performedBy: string;
  details: string;
  tenantId?: string;
}) => {
  try {
    await addDoc(collection(db, 'platform_audit_logs'), {
      ...logData,
      timestamp: new Date().toISOString(),
      id: Math.random().toString(36).substring(2, 9)
    });
  } catch (err) {
    console.warn("Failed to write platform audit log:", err);
  }
};

export const getPlatformAuditLogs = async (): Promise<PlatformAuditLog[]> => {
  try {
    const q = query(
      collection(db, 'platform_audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PlatformAuditLog));
  } catch (err) {
    console.warn("Could not fetch audit logs:", err);
    return [];
  }
};

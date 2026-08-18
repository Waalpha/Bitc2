import React, { useState } from 'react';
import {
  Globe,
  Save,
  Upload,
  Trash2,
  Plus,
  ExternalLink,
  Sparkles,
  Megaphone,
  Layers,
  BookOpen,
  Award,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  MapPin,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Eye,
  Sliders,
  Shield,
  Phone,
  Mail,
  Clock,
  Briefcase,
  Zap,
  Info,
  Building2
} from 'lucide-react';
import { AppSettings } from '../../types';
import { uploadFile } from '../../services/uploadService';

interface PublicPortalEditorProps {
  appSettings: AppSettings;
  setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onSave: (e: React.FormEvent) => Promise<void>;
  isSaving: boolean;
  addToast: (message: string, type?: 'success' | 'error') => void;
}

type PortalSectionTab =
  | 'brand'
  | 'notice'
  | 'hero'
  | 'quickcards'
  | 'about'
  | 'whychoose'
  | 'examnotice'
  | 'accreditations'
  | 'admissions'
  | 'intakebanner'
  | 'gallery'
  | 'testimonials'
  | 'contact'
  | 'footer';

export const PublicPortalEditor: React.FC<PublicPortalEditorProps> = ({
  appSettings,
  setAppSettings,
  onSave,
  isSaving,
  addToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<PortalSectionTab>('brand');
  const [isUploading, setIsUploading] = useState(false);

  // Single image upload helper
  const handleSingleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldKey: keyof AppSettings
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast('Image is too large (max 5MB).', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const uploadResult = await uploadFile(file);
      setAppSettings(prev => ({
        ...prev,
        [fieldKey]: uploadResult.url
      }));
      addToast('Image uploaded successfully!', 'success');
    } catch (error) {
      console.error('Upload error:', error);
      addToast('Failed to upload image.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Gallery item image upload
  const handleGalleryItemUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast('Image is too large (max 5MB).', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const uploadResult = await uploadFile(file);
      const items = [...(appSettings.portalGalleryItems || [])];
      if (items[index]) {
        items[index].url = uploadResult.url;
        setAppSettings(prev => ({ ...prev, portalGalleryItems: items }));
        addToast('Gallery image uploaded!', 'success');
      }
    } catch (error) {
      console.error('Gallery item upload error:', error);
      addToast('Failed to upload gallery image.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Slideshow multi-upload
  const handleSlideshowUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newImages: string[] = [...(appSettings.publicHeroImages || [])];
    const fileList = Array.from(files);

    try {
      for (const file of fileList) {
        if (file.size > 8 * 1024 * 1024) {
          addToast(`Image ${file.name} is too large (max 8MB).`, 'error');
          continue;
        }
        const uploadResult = await uploadFile(file);
        if (newImages.length >= 12) {
          addToast('Maximum 12 slideshow photos reached.', 'error');
          break;
        }
        newImages.push(uploadResult.url);
      }
      setAppSettings(prev => ({ ...prev, publicHeroImages: newImages }));
      addToast('Slideshow photos uploaded!', 'success');
    } catch (error) {
      console.error('Slideshow upload error:', error);
      addToast('Failed to upload some images.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const navTabs: { id: PortalSectionTab; label: string; icon: any; tag?: string }[] = [
    { id: 'brand', label: '1. Brand & Header', icon: Globe },
    { id: 'notice', label: '2. Top Notice Bar', icon: Megaphone },
    { id: 'hero', label: '3. Hero Banner', icon: Sparkles },
    { id: 'quickcards', label: '4. Quick Feature Cards', icon: Layers },
    { id: 'about', label: '5. About & Intro', icon: BookOpen },
    { id: 'whychoose', label: '6. Why Choose BITC', icon: Shield },
    { id: 'examnotice', label: '7. Exam Guidelines', icon: Info },
    { id: 'accreditations', label: '8. Accreditations', icon: Award },
    { id: 'admissions', label: '9. Admissions Process', icon: FileText },
    { id: 'intakebanner', label: '10. Intake Banner CTA', icon: Sparkles },
    { id: 'gallery', label: '11. Campus Gallery', icon: ImageIcon },
    { id: 'testimonials', label: '12. Student Testimonials', icon: MessageSquare },
    { id: 'contact', label: '13. Contact & Map', icon: MapPin },
    { id: 'footer', label: '14. Footer & Copyright', icon: Sliders }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-[#0B192C] via-[#1E40AF] to-[#0B192C] p-6 sm:p-8 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F59E0B]/20 border border-[#F59E0B]/40 text-[#F59E0B] text-xs font-black uppercase tracking-widest">
            <Sparkles size={14} />
            <span>Public Website CMS & Portal Manager</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Customize the Entire Public Portal
          </h2>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
            Edit all texts, headings, hero banners, photos, admission steps, accreditation badges, and contact details displayed on the public college website.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all hover:scale-105"
          >
            <Eye size={16} className="text-[#F59E0B]" />
            <span>View Live Website</span>
            <ExternalLink size={12} className="opacity-70" />
          </a>

          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || isUploading}
            className="px-6 py-2.5 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#0B192C] text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-2 transition-all hover:scale-105 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin text-[#0B192C]" /> : <Save size={16} />}
            <span>{isSaving ? 'Saving...' : 'Save All Changes'}</span>
          </button>
        </div>
      </div>

      {/* Main CMS Layout with Sub-Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sub-Tab Navigation */}
        <div className="lg:col-span-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm space-y-1 sticky top-6">
          <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
            Portal Sections
          </div>
          {navTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-200 font-extrabold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon size={15} className={isActive ? 'text-white' : 'text-purple-600'} />
                  <span className="truncate">{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Form Content */}
        <div className="lg:col-span-9 bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm">
          <form onSubmit={onSave} className="space-y-6">
            
            {/* 1. BRAND & HEADER TAB */}
            {activeSubTab === 'brand' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Globe size={20} className="text-purple-600" />
                    Header & Brand Identity
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Configure institutional branding, title, header buttons, and custom logo.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Header Brand Title
                    </label>
                    <input
                      type="text"
                      value={appSettings.headerTitle || 'BREAKTHROUGH'}
                      onChange={e => setAppSettings({ ...appSettings, headerTitle: e.target.value })}
                      placeholder="e.g. BREAKTHROUGH"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Header Subtitle / Tagline
                    </label>
                    <input
                      type="text"
                      value={appSettings.headerSubtitle || 'BITC COLLEGE • THIKA'}
                      onChange={e => setAppSettings({ ...appSettings, headerSubtitle: e.target.value })}
                      placeholder="e.g. BITC COLLEGE • THIKA"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Header "Apply Now" Button Label
                    </label>
                    <input
                      type="text"
                      value={appSettings.headerApplyButtonText || 'APPLY NOW'}
                      onChange={e => setAppSettings({ ...appSettings, headerApplyButtonText: e.target.value })}
                      placeholder="e.g. APPLY NOW"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Header "Student Portal" Link Label
                    </label>
                    <input
                      type="text"
                      value={appSettings.headerPortalButtonText || 'Student Portal'}
                      onChange={e => setAppSettings({ ...appSettings, headerPortalButtonText: e.target.value })}
                      placeholder="e.g. Student Portal"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>

                {/* Custom Logo */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Public Portal Logo Override
                  </label>
                  <p className="text-[11px] text-gray-500">
                    Upload an image or paste an image URL for the website navbar header.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                      type="text"
                      value={appSettings.publicLogoUrl || ''}
                      onChange={e => setAppSettings({ ...appSettings, publicLogoUrl: e.target.value })}
                      placeholder="https://..."
                      className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-medium text-gray-900 outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <label className="px-4 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shrink-0">
                      <Upload size={14} />
                      <span>Upload Logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => handleSingleUpload(e, 'publicLogoUrl')}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {appSettings.publicLogoUrl && (
                    <div className="flex items-center gap-3 pt-1">
                      <img
                        src={appSettings.publicLogoUrl}
                        alt="Logo Preview"
                        className="h-12 w-auto object-contain border rounded-lg p-1 bg-white"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => setAppSettings(prev => ({ ...prev, publicLogoUrl: '' }))}
                        className="text-[11px] font-bold text-red-600 hover:underline"
                      >
                        Remove Logo
                      </button>
                    </div>
                  )}
                </div>

                {/* Brand Colors */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Branding Color Theme
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="block text-[11px] font-bold text-gray-600 mb-1">Navy / Dark Blue</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={appSettings.publicSecondaryColor || '#0B192C'}
                          onChange={e => setAppSettings({ ...appSettings, publicSecondaryColor: e.target.value })}
                          className="w-9 h-9 border rounded-lg cursor-pointer p-0"
                        />
                        <input
                          type="text"
                          value={appSettings.publicSecondaryColor || '#0B192C'}
                          onChange={e => setAppSettings({ ...appSettings, publicSecondaryColor: e.target.value })}
                          className="flex-1 px-3 py-1.5 text-xs font-mono border rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-gray-600 mb-1">Primary Blue</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={appSettings.publicPrimaryColor || '#1E40AF'}
                          onChange={e => setAppSettings({ ...appSettings, publicPrimaryColor: e.target.value })}
                          className="w-9 h-9 border rounded-lg cursor-pointer p-0"
                        />
                        <input
                          type="text"
                          value={appSettings.publicPrimaryColor || '#1E40AF'}
                          onChange={e => setAppSettings({ ...appSettings, publicPrimaryColor: e.target.value })}
                          className="flex-1 px-3 py-1.5 text-xs font-mono border rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-gray-600 mb-1">Gold / Yellow Accent</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={appSettings.publicAccentColor || '#F59E0B'}
                          onChange={e => setAppSettings({ ...appSettings, publicAccentColor: e.target.value })}
                          className="w-9 h-9 border rounded-lg cursor-pointer p-0"
                        />
                        <input
                          type="text"
                          value={appSettings.publicAccentColor || '#F59E0B'}
                          onChange={e => setAppSettings({ ...appSettings, publicAccentColor: e.target.value })}
                          className="flex-1 px-3 py-1.5 text-xs font-mono border rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. TOP NOTICE BAR TAB */}
            {activeSubTab === 'notice' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Megaphone size={20} className="text-purple-600" />
                    Top Announcement Alert Bar
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Show an eye-catching alert bar at the very top of the landing page.
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Enable Top Announcement Bar
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      When enabled, this bar displays above the header navigation.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={appSettings.portalNoticeEnabled || false}
                      onChange={e => setAppSettings({ ...appSettings, portalNoticeEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Announcement Text Content
                    </label>
                    <input
                      type="text"
                      value={appSettings.portalNoticeText || ''}
                      onChange={e => setAppSettings({ ...appSettings, portalNoticeText: e.target.value })}
                      placeholder="e.g. September 2026 Intake for all Accredited Diploma & Certificate Courses is currently ongoing!"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Action URL Link (Anchor or Page Link)
                    </label>
                    <input
                      type="text"
                      value={appSettings.portalNoticeLink || ''}
                      onChange={e => setAppSettings({ ...appSettings, portalNoticeLink: e.target.value })}
                      placeholder="e.g. #admissions or https://..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3. HERO BANNER TAB */}
            {activeSubTab === 'hero' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Sparkles size={20} className="text-purple-600" />
                    Hero Banner & Main Headlines
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Customize the primary hero headline, accent text, buttons, and background photography.
                  </p>
                </div>

                {/* Top Badge */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Hero Intake Announcement Badge Text
                    </label>
                    <input
                      type="text"
                      value={appSettings.heroBadgeText || 'SEPTEMBER 2026 INTAKE NOW OPEN'}
                      onChange={e => setAppSettings({ ...appSettings, heroBadgeText: e.target.value })}
                      placeholder="e.g. SEPTEMBER 2026 INTAKE NOW OPEN"
                      className="w-full px-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-4">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={appSettings.heroBadgeEnabled !== false}
                        onChange={e => setAppSettings({ ...appSettings, heroBadgeEnabled: e.target.checked })}
                        className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                      />
                      <span>Show Badge</span>
                    </label>
                  </div>
                </div>

                {/* Headlines */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Main Hero Heading (Line 1)
                    </label>
                    <input
                      type="text"
                      value={appSettings.publicHeroTitle || 'Build Skills.'}
                      onChange={e => setAppSettings({ ...appSettings, publicHeroTitle: e.target.value })}
                      placeholder="e.g. Build Skills."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-sm font-black text-gray-900 outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Accent Highlighted Text (Line 2)
                    </label>
                    <input
                      type="text"
                      value={appSettings.publicHeroAccentText || 'Build Your Future.'}
                      onChange={e => setAppSettings({ ...appSettings, publicHeroAccentText: e.target.value })}
                      placeholder="e.g. Build Your Future."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-sm font-black text-[#F59E0B] outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Description Subtitle */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Supporting Hero Description
                  </label>
                  <textarea
                    value={appSettings.publicHeroDescription || 'Professional training designed to give you practical skills, confidence and career readiness.'}
                    onChange={e => setAppSettings({ ...appSettings, publicHeroDescription: e.target.value })}
                    rows={2}
                    placeholder="Enter hero paragraph..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Location text & Trust line */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Campus Location Subtext
                    </label>
                    <input
                      type="text"
                      value={appSettings.heroLocationText || 'Study in Thika — Kiganjo Corner 2'}
                      onChange={e => setAppSettings({ ...appSettings, heroLocationText: e.target.value })}
                      placeholder="e.g. Study in Thika — Kiganjo Corner 2"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Trust Line Subtext
                    </label>
                    <input
                      type="text"
                      value={appSettings.heroTrustLine || 'Practical Training • Career Focused • Flexible Learning'}
                      onChange={e => setAppSettings({ ...appSettings, heroTrustLine: e.target.value })}
                      placeholder="e.g. Practical Training • Career Focused • Flexible Learning"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Primary & Secondary Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Primary CTA Button
                    </label>
                    <input
                      type="text"
                      value={appSettings.heroPrimaryBtnText || 'APPLY ONLINE NOW'}
                      onChange={e => setAppSettings({ ...appSettings, heroPrimaryBtnText: e.target.value })}
                      placeholder="Label (e.g. APPLY ONLINE NOW)"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-900 outline-none"
                    />
                    <input
                      type="text"
                      value={appSettings.heroPrimaryBtnLink || '#admissions'}
                      onChange={e => setAppSettings({ ...appSettings, heroPrimaryBtnLink: e.target.value })}
                      placeholder="Link Target (e.g. #admissions)"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Secondary CTA Button
                    </label>
                    <input
                      type="text"
                      value={appSettings.heroSecondaryBtnText || 'EXPLORE COURSES'}
                      onChange={e => setAppSettings({ ...appSettings, heroSecondaryBtnText: e.target.value })}
                      placeholder="Label (e.g. EXPLORE COURSES)"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-900 outline-none"
                    />
                    <input
                      type="text"
                      value={appSettings.heroSecondaryBtnLink || '#courses'}
                      onChange={e => setAppSettings({ ...appSettings, heroSecondaryBtnLink: e.target.value })}
                      placeholder="Link Target (e.g. #courses)"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 outline-none"
                    />
                  </div>
                </div>

                {/* Hero Background Image & Opacity */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Hero Photography Background
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                      type="text"
                      value={appSettings.publicHeroImageUrl || ''}
                      onChange={e => setAppSettings({ ...appSettings, publicHeroImageUrl: e.target.value })}
                      placeholder="Paste background image URL..."
                      className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-medium text-gray-900 outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <label className="px-4 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shrink-0">
                      <Upload size={14} />
                      <span>Upload Hero Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => handleSingleUpload(e, 'publicHeroImageUrl')}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {appSettings.publicHeroImageUrl && (
                    <div className="relative h-28 w-full rounded-xl overflow-hidden border border-gray-200">
                      <img
                        src={appSettings.publicHeroImageUrl}
                        alt="Hero Preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => setAppSettings(prev => ({ ...prev, publicHeroImageUrl: '' }))}
                        className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-md"
                      >
                        Reset to Default Photo
                      </button>
                    </div>
                  )}

                  {/* Hero Photo Opacity */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-gray-700">
                        Hero Photo Clarity / Brightness: {appSettings.publicHeroPhotoOpacity ?? 100}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      step="5"
                      value={appSettings.publicHeroPhotoOpacity ?? 100}
                      onChange={e => setAppSettings({ ...appSettings, publicHeroPhotoOpacity: Number(e.target.value) })}
                      className="w-full accent-purple-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. QUICK FEATURE CARDS TAB */}
            {activeSubTab === 'quickcards' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Layers size={20} className="text-purple-600" />
                    Hero 4 Quick Feature Cards
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Customize the 4 cards placed immediately below the hero banner.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-600">CARD 1 (Practical)</span>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Title</label>
                      <input
                        type="text"
                        value={appSettings.heroCard1Title || 'PRACTICAL TRAINING'}
                        onChange={e => setAppSettings({ ...appSettings, heroCard1Title: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Description</label>
                      <textarea
                        value={appSettings.heroCard1Desc || 'Hands-on learning focused on real workplace skills and technical proficiency.'}
                        onChange={e => setAppSettings({ ...appSettings, heroCard1Desc: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-900"
                      />
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-600">CARD 2 (Flexible)</span>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Title</label>
                      <input
                        type="text"
                        value={appSettings.heroCard2Title || 'FLEXIBLE STUDY'}
                        onChange={e => setAppSettings({ ...appSettings, heroCard2Title: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Description</label>
                      <textarea
                        value={appSettings.heroCard2Desc || "Learning options and schedules designed around students' commitments and needs."}
                        onChange={e => setAppSettings({ ...appSettings, heroCard2Desc: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-900"
                      />
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-600">CARD 3 (Career)</span>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Title</label>
                      <input
                        type="text"
                        value={appSettings.heroCard3Title || 'CAREER READY'}
                        onChange={e => setAppSettings({ ...appSettings, heroCard3Title: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Description</label>
                      <textarea
                        value={appSettings.heroCard3Desc || 'Training focused on employable skills, internship readiness, and professional growth.'}
                        onChange={e => setAppSettings({ ...appSettings, heroCard3Desc: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-900"
                      />
                    </div>
                  </div>

                  {/* Card 4 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-600">CARD 4 (Campus)</span>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Title</label>
                      <input
                        type="text"
                        value={appSettings.heroCard4Title || 'THIKA CAMPUS'}
                        onChange={e => setAppSettings({ ...appSettings, heroCard4Title: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Description</label>
                      <textarea
                        value={appSettings.heroCard4Desc || "Conveniently located at Kiganjo Corner 2, near Kang'oki grounds in Thika."}
                        onChange={e => setAppSettings({ ...appSettings, heroCard4Desc: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. ABOUT & INTRO TAB */}
            {activeSubTab === 'about' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <BookOpen size={20} className="text-purple-600" />
                    About BITC & Introductory Section
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Configure the "Where Skills Meet Opportunity" intro section, bullet points, and section image.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Pre-Heading Tag
                    </label>
                    <input
                      type="text"
                      value={appSettings.aboutPreHeading || 'WELCOME TO BITC'}
                      onChange={e => setAppSettings({ ...appSettings, aboutPreHeading: e.target.value })}
                      placeholder="e.g. WELCOME TO BITC"
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Main Section Title
                    </label>
                    <input
                      type="text"
                      value={appSettings.aboutTitle || 'Where Skills Meet Opportunity'}
                      onChange={e => setAppSettings({ ...appSettings, aboutTitle: e.target.value })}
                      placeholder="e.g. Where Skills Meet Opportunity"
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-sm font-black text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Introduction Narrative Paragraph
                  </label>
                  <textarea
                    value={appSettings.portalAboutUs || 'Breakthrough International Training College offers professional training in Thika, focusing on practical skills and career readiness.'}
                    onChange={e => setAppSettings({ ...appSettings, portalAboutUs: e.target.value })}
                    rows={3}
                    placeholder="Enter introductory text..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900"
                  />
                </div>

                {/* 3 Bullet Points */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                  <span className="text-xs font-black uppercase tracking-wider text-purple-600 block">
                    3 Key Advantage Bullets
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">Bullet 1 Title</label>
                      <input
                        type="text"
                        value={appSettings.aboutBullet1Title || 'Industry-Aligned Curricula'}
                        onChange={e => setAppSettings({ ...appSettings, aboutBullet1Title: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">Bullet 1 Details</label>
                      <input
                        type="text"
                        value={appSettings.aboutBullet1Desc || 'Certified by NITA, KNEC, and TVET CDACC frameworks.'}
                        onChange={e => setAppSettings({ ...appSettings, aboutBullet1Desc: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">Bullet 2 Title</label>
                      <input
                        type="text"
                        value={appSettings.aboutBullet2Title || 'Workplace Mentorship & Internships'}
                        onChange={e => setAppSettings({ ...appSettings, aboutBullet2Title: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">Bullet 2 Details</label>
                      <input
                        type="text"
                        value={appSettings.aboutBullet2Desc || 'Dedicated assistance for clinical rotations, salon attachments, and tech roles.'}
                        onChange={e => setAppSettings({ ...appSettings, aboutBullet2Desc: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">Bullet 3 Title</label>
                      <input
                        type="text"
                        value={appSettings.aboutBullet3Title || 'Accessible & Affordable Fees'}
                        onChange={e => setAppSettings({ ...appSettings, aboutBullet3Title: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">Bullet 3 Details</label>
                      <input
                        type="text"
                        value={appSettings.aboutBullet3Desc || 'Flexible fee payment plans designed to support every ambitious student.'}
                        onChange={e => setAppSettings({ ...appSettings, aboutBullet3Desc: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* About Image Upload */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    About Section Feature Image
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                      type="text"
                      value={appSettings.aboutImageUrl || ''}
                      onChange={e => setAppSettings({ ...appSettings, aboutImageUrl: e.target.value })}
                      placeholder="Paste image URL..."
                      className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-medium text-gray-900"
                    />
                    <label className="px-4 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shrink-0">
                      <Upload size={14} />
                      <span>Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => handleSingleUpload(e, 'aboutImageUrl')}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {appSettings.aboutImageUrl && (
                    <img
                      src={appSettings.aboutImageUrl}
                      alt="About Preview"
                      className="h-28 w-auto rounded-xl object-cover border"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
              </div>
            )}

            {/* 6. WHY CHOOSE BITC TAB */}
            {activeSubTab === 'whychoose' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Shield size={20} className="text-purple-600" />
                    Why Students Choose BITC (6 Feature Cards)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Edit the 6 main value-proposition cards that explain why students select BITC.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Section Heading
                    </label>
                    <input
                      type="text"
                      value={appSettings.whyChooseHeading || 'WHY STUDENTS CHOOSE BITC'}
                      onChange={e => setAppSettings({ ...appSettings, whyChooseHeading: e.target.value })}
                      placeholder="e.g. WHY STUDENTS CHOOSE BITC"
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-black text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Section Subtitle
                    </label>
                    <input
                      type="text"
                      value={appSettings.whyChooseSubheading || 'Dedicated to delivering career-transforming technical and vocational education.'}
                      onChange={e => setAppSettings({ ...appSettings, whyChooseSubheading: e.target.value })}
                      placeholder="Enter subtitle..."
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Feature 1 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black uppercase text-purple-600">Feature 1</span>
                    <input
                      type="text"
                      value={appSettings.whyFeature1Title || 'PRACTICAL SKILLS'}
                      onChange={e => setAppSettings({ ...appSettings, whyFeature1Title: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs font-bold"
                    />
                    <textarea
                      value={appSettings.whyFeature1Desc || 'Focus on skills that can be applied in real work environments with mandatory hands-on workshop sessions.'}
                      onChange={e => setAppSettings({ ...appSettings, whyFeature1Desc: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs text-gray-700"
                    />
                  </div>

                  {/* Feature 2 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black uppercase text-purple-600">Feature 2</span>
                    <input
                      type="text"
                      value={appSettings.whyFeature2Title || 'CAREER FOCUSED'}
                      onChange={e => setAppSettings({ ...appSettings, whyFeature2Title: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs font-bold"
                    />
                    <textarea
                      value={appSettings.whyFeature2Desc || 'Training designed around professional development, industry certifications, and employer expectations.'}
                      onChange={e => setAppSettings({ ...appSettings, whyFeature2Desc: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs text-gray-700"
                    />
                  </div>

                  {/* Feature 3 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black uppercase text-purple-600">Feature 3</span>
                    <input
                      type="text"
                      value={appSettings.whyFeature3Title || 'FLEXIBLE LEARNING'}
                      onChange={e => setAppSettings({ ...appSettings, whyFeature3Title: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs font-bold"
                    />
                    <textarea
                      value={appSettings.whyFeature3Desc || 'Options designed to make learning more accessible with morning, evening, and modular study options.'}
                      onChange={e => setAppSettings({ ...appSettings, whyFeature3Desc: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs text-gray-700"
                    />
                  </div>

                  {/* Feature 4 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black uppercase text-purple-600">Feature 4</span>
                    <input
                      type="text"
                      value={appSettings.whyFeature4Title || 'EXPERIENCED TRAINING'}
                      onChange={e => setAppSettings({ ...appSettings, whyFeature4Title: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs font-bold"
                    />
                    <textarea
                      value={appSettings.whyFeature4Desc || 'Professional learning environment focused on student success led by seasoned industry practitioners.'}
                      onChange={e => setAppSettings({ ...appSettings, whyFeature4Desc: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs text-gray-700"
                    />
                  </div>

                  {/* Feature 5 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black uppercase text-purple-600">Feature 5</span>
                    <input
                      type="text"
                      value={appSettings.whyFeature5Title || 'CONVENIENT LOCATION'}
                      onChange={e => setAppSettings({ ...appSettings, whyFeature5Title: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs font-bold"
                    />
                    <textarea
                      value={appSettings.whyFeature5Desc || 'Located in Thika at Kiganjo Corner 2, easily accessible by public transport from Thika Town, Makongeni, and Nairobi.'}
                      onChange={e => setAppSettings({ ...appSettings, whyFeature5Desc: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs text-gray-700"
                    />
                  </div>

                  {/* Feature 6 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black uppercase text-purple-600">Feature 6</span>
                    <input
                      type="text"
                      value={appSettings.whyFeature6Title || 'STUDENT SUPPORT'}
                      onChange={e => setAppSettings({ ...appSettings, whyFeature6Title: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs font-bold"
                    />
                    <textarea
                      value={appSettings.whyFeature6Desc || 'Create a supportive learning environment throughout the student journey with academic counseling and attachment guidance.'}
                      onChange={e => setAppSettings({ ...appSettings, whyFeature6Desc: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs text-gray-700"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 7. EXAM GUIDELINES TAB */}
            {activeSubTab === 'examnotice' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Info size={20} className="text-purple-600" />
                    Training & Examination Notice
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Configure the examination guidelines and physical center attendance requirements.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Section Heading
                    </label>
                    <input
                      type="text"
                      value={appSettings.examInfoHeading || 'Examination Guidelines & Physical Attendance Requirements'}
                      onChange={e => setAppSettings({ ...appSettings, examInfoHeading: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Notice Card Title
                    </label>
                    <input
                      type="text"
                      value={appSettings.examInfoCardTitle || 'IMPORTANT NOTICE'}
                      onChange={e => setAppSettings({ ...appSettings, examInfoCardTitle: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-black text-purple-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Examination Notice Body Text
                    </label>
                    <textarea
                      value={appSettings.examInfoCardText || 'Some course programs may require students to appear physically at an approved examination centre. Students will be informed in advance about examination schedules and the applicable examination centre.'}
                      onChange={e => setAppSettings({ ...appSettings, examInfoCardText: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 8. ACCREDITATIONS TAB */}
            {activeSubTab === 'accreditations' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Award size={20} className="text-purple-600" />
                    Accreditations & Examination Boards
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Customize the officially recognized qualifications, exam boards (NITA, KNEC, TVET CDACC), and TVETA registration number.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Section Heading
                  </label>
                  <input
                    type="text"
                    value={appSettings.accreditationHeading || 'TRAINING & EXAM BOARD ACCREDITATIONS'}
                    onChange={e => setAppSettings({ ...appSettings, accreditationHeading: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-black text-gray-900"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Badge 1 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black uppercase text-amber-600">Accreditation 1</span>
                    <input
                      type="text"
                      value={appSettings.accredBadge1Name || 'NITA Accredited'}
                      onChange={e => setAppSettings({ ...appSettings, accredBadge1Name: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={appSettings.accredBadge1Sub || 'National Industrial Training Authority Kenya'}
                      onChange={e => setAppSettings({ ...appSettings, accredBadge1Sub: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs text-gray-600"
                    />
                  </div>

                  {/* Badge 2 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black uppercase text-emerald-600">Accreditation 2</span>
                    <input
                      type="text"
                      value={appSettings.accredBadge2Name || 'KNEC Registered'}
                      onChange={e => setAppSettings({ ...appSettings, accredBadge2Name: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={appSettings.accredBadge2Sub || 'Kenya National Examinations Council'}
                      onChange={e => setAppSettings({ ...appSettings, accredBadge2Sub: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs text-gray-600"
                    />
                  </div>

                  {/* Badge 3 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black uppercase text-blue-600">Accreditation 3</span>
                    <input
                      type="text"
                      value={appSettings.accredBadge3Name || 'TVET CDACC Certified'}
                      onChange={e => setAppSettings({ ...appSettings, accredBadge3Name: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={appSettings.accredBadge3Sub || 'Curriculum Development, Assessment & Certification'}
                      onChange={e => setAppSettings({ ...appSettings, accredBadge3Sub: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs text-gray-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    TVETA Official Registration Number & Subtext
                  </label>
                  <input
                    type="text"
                    value={appSettings.accredTvetaReg || 'Ministry of Education & TVETA Registered Institution — Reg No. TVETA/TVC/0082/2016'}
                    onChange={e => setAppSettings({ ...appSettings, accredTvetaReg: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-mono text-gray-900"
                  />
                </div>
              </div>
            )}

            {/* 9. ADMISSIONS 4-STEP TAB */}
            {activeSubTab === 'admissions' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <FileText size={20} className="text-purple-600" />
                    Admissions 4-Step Application Procedure
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Configure the step-by-step application guidance presented to prospective students.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Section Heading
                    </label>
                    <input
                      type="text"
                      value={appSettings.admissionsHeading || 'START YOUR JOURNEY TODAY'}
                      onChange={e => setAppSettings({ ...appSettings, admissionsHeading: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-black text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Section Subtitle
                    </label>
                    <input
                      type="text"
                      value={appSettings.admissionsSubheading || 'A straightforward four-step process from application to classroom.'}
                      onChange={e => setAppSettings({ ...appSettings, admissionsSubheading: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Step 1 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black text-purple-600">STEP 01</span>
                    <input
                      type="text"
                      value={appSettings.admStep1Title || 'Choose Your Course'}
                      onChange={e => setAppSettings({ ...appSettings, admStep1Title: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-bold"
                    />
                    <textarea
                      value={appSettings.admStep1Desc || 'Explore our accredited diplomas, certificates, or artisan programs matching your goals.'}
                      onChange={e => setAppSettings({ ...appSettings, admStep1Desc: e.target.value })}
                      rows={3}
                      className="w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs text-gray-600"
                    />
                  </div>

                  {/* Step 2 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black text-purple-600">STEP 02</span>
                    <input
                      type="text"
                      value={appSettings.admStep2Title || 'Submit Application'}
                      onChange={e => setAppSettings({ ...appSettings, admStep2Title: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-bold"
                    />
                    <textarea
                      value={appSettings.admStep2Desc || 'Fill the fast online application form below with your academic details and contacts.'}
                      onChange={e => setAppSettings({ ...appSettings, admStep2Desc: e.target.value })}
                      rows={3}
                      className="w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs text-gray-600"
                    />
                  </div>

                  {/* Step 3 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black text-purple-600">STEP 03</span>
                    <input
                      type="text"
                      value={appSettings.admStep3Title || 'Receive Admission Info'}
                      onChange={e => setAppSettings({ ...appSettings, admStep3Title: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-bold"
                    />
                    <textarea
                      value={appSettings.admStep3Desc || 'Instant provisional admission letter and reporting schedule sent via system and email.'}
                      onChange={e => setAppSettings({ ...appSettings, admStep3Desc: e.target.value })}
                      rows={3}
                      className="w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs text-gray-600"
                    />
                  </div>

                  {/* Step 4 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black text-purple-600">STEP 04</span>
                    <input
                      type="text"
                      value={appSettings.admStep4Title || 'Begin Your Training'}
                      onChange={e => setAppSettings({ ...appSettings, admStep4Title: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-bold"
                    />
                    <textarea
                      value={appSettings.admStep4Desc || 'Report to Thika Campus, receive workshop kits, and commence your hands-on lectures.'}
                      onChange={e => setAppSettings({ ...appSettings, admStep4Desc: e.target.value })}
                      rows={3}
                      className="w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs text-gray-600"
                    />
                  </div>
                </div>

                {/* Official Bank Account Details Config */}
                <div className="pt-6 border-t border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Building2 size={16} className="text-purple-600" />
                        Official Tuition Bank Account & Payment Instructions
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">Displayed on admission letters, application forms, and portal fee guides.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAppSettings(prev => ({
                          ...prev,
                          bankName: 'Co-operative Bank of Kenya',
                          bankAccountName: 'BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE',
                          bankAccountNumber: '032000025240',
                          bankBranch: 'Thika Makongeni',
                          bankPaybill: '247247',
                          bankPaymentInstructions: "Quote your Admission Number as payment reference on all deposits. Cash payments on campus are strictly prohibited."
                        }));
                        addToast('Official bank details restored to defaults!', 'success');
                      }}
                      className="text-xs font-bold text-purple-600 hover:text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={12} />
                      Restore Defaults
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Bank Account Name
                      </label>
                      <input
                        type="text"
                        value={appSettings.bankAccountName || ''}
                        onChange={e => setAppSettings({ ...appSettings, bankAccountName: e.target.value })}
                        placeholder="e.g. BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE"
                        className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={appSettings.bankName || ''}
                        onChange={e => setAppSettings({ ...appSettings, bankName: e.target.value })}
                        placeholder="e.g. Co-operative Bank of Kenya"
                        className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Account Number (A/C No.)
                      </label>
                      <input
                        type="text"
                        value={appSettings.bankAccountNumber || ''}
                        onChange={e => setAppSettings({ ...appSettings, bankAccountNumber: e.target.value })}
                        placeholder="e.g. 032000025240"
                        className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-mono font-bold text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Branch
                      </label>
                      <input
                        type="text"
                        value={appSettings.bankBranch || ''}
                        onChange={e => setAppSettings({ ...appSettings, bankBranch: e.target.value })}
                        placeholder="e.g. Thika Makongeni"
                        className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Paybill / Till (Optional)
                      </label>
                      <input
                        type="text"
                        value={appSettings.bankPaybill || ''}
                        onChange={e => setAppSettings({ ...appSettings, bankPaybill: e.target.value })}
                        placeholder="e.g. 247247"
                        className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-mono text-gray-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Payment Instructions
                    </label>
                    <textarea
                      rows={2}
                      value={appSettings.bankPaymentInstructions || ''}
                      onChange={e => setAppSettings({ ...appSettings, bankPaymentInstructions: e.target.value })}
                      placeholder="e.g. Quote your Admission Number as payment reference on all deposits. Cash payments on campus are strictly prohibited."
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 10. INTAKE BANNER CTA TAB */}
            {activeSubTab === 'intakebanner' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Sparkles size={20} className="text-purple-600" />
                    Intake Call-to-Action Banner
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Customize the full-width high-contrast gradient intake promotion banner.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Banner Top Badge
                    </label>
                    <input
                      type="text"
                      value={appSettings.intakeBannerTitle || 'SEPTEMBER 2026 INTAKE'}
                      onChange={e => setAppSettings({ ...appSettings, intakeBannerTitle: e.target.value })}
                      placeholder="e.g. SEPTEMBER 2026 INTAKE"
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-black text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Banner Main Headline
                    </label>
                    <input
                      type="text"
                      value={appSettings.intakeBannerSubtitle || 'Applications are now open. Take the next step toward your professional future.'}
                      onChange={e => setAppSettings({ ...appSettings, intakeBannerSubtitle: e.target.value })}
                      placeholder="Enter main headline..."
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-900"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Primary Button Text
                      </label>
                      <input
                        type="text"
                        value={appSettings.intakeBannerBtnText || 'APPLY NOW'}
                        onChange={e => setAppSettings({ ...appSettings, intakeBannerBtnText: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 border rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Secondary Button Text
                      </label>
                      <input
                        type="text"
                        value={appSettings.intakeBannerSecondaryBtnText || 'VIEW COURSES'}
                        onChange={e => setAppSettings({ ...appSettings, intakeBannerSecondaryBtnText: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 border rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Location Subtext
                      </label>
                      <input
                        type="text"
                        value={appSettings.intakeBannerLocation || 'Thika — Kiganjo Corner 2'}
                        onChange={e => setAppSettings({ ...appSettings, intakeBannerLocation: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 border rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 11. CAMPUS GALLERY TAB */}
            {activeSubTab === 'gallery' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <ImageIcon size={20} className="text-purple-600" />
                    Campus Life Gallery & Photo Snapshots
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Manage the gallery items displayed in the "The Student Experience" section.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Gallery Section Heading
                    </label>
                    <input
                      type="text"
                      value={appSettings.galleryHeading || 'THE STUDENT EXPERIENCE'}
                      onChange={e => setAppSettings({ ...appSettings, galleryHeading: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-black text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Gallery Subtitle
                    </label>
                    <input
                      type="text"
                      value={appSettings.gallerySubheading || 'Vibrant practical workshops, computer laboratories, and academic milestones.'}
                      onChange={e => setAppSettings({ ...appSettings, gallerySubheading: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900"
                    />
                  </div>
                </div>

                {/* Dynamic Gallery Items List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-gray-700">
                      Gallery Image Cards
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const items = appSettings.portalGalleryItems || [
                          {
                            url: 'https://images.unsplash.com/photo-1523050853064-85216775870f?q=80&w=800&auto=format&fit=crop',
                            title: 'Graduation & Awarding Ceremony',
                            tag: 'Academic Milestone'
                          },
                          {
                            url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop',
                            title: 'ICT & Software Engineering Lab',
                            tag: 'Practical Tech'
                          },
                          {
                            url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=800&auto=format&fit=crop',
                            title: 'Cosmetology & Beauty Therapy Studio',
                            tag: 'Hands-on Beauty'
                          },
                          {
                            url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=800&auto=format&fit=crop',
                            title: 'Healthcare & Patient Care Practice',
                            tag: 'Caregiver Training'
                          }
                        ];
                        setAppSettings({
                          ...appSettings,
                          portalGalleryItems: [
                            ...items,
                            {
                              url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=800&auto=format&fit=crop',
                              title: 'New Student Experience Photo',
                              tag: 'Campus Activity'
                            }
                          ]
                        });
                      }}
                      className="px-3 py-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Add Gallery Photo</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(
                      appSettings.portalGalleryItems || [
                        {
                          url: 'https://images.unsplash.com/photo-1523050853064-85216775870f?q=80&w=800&auto=format&fit=crop',
                          title: 'Graduation & Awarding Ceremony',
                          tag: 'Academic Milestone'
                        },
                        {
                          url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop',
                          title: 'ICT & Software Engineering Lab',
                          tag: 'Practical Tech'
                        },
                        {
                          url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=800&auto=format&fit=crop',
                          title: 'Cosmetology & Beauty Therapy Studio',
                          tag: 'Hands-on Beauty'
                        },
                        {
                          url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=800&auto=format&fit=crop',
                          title: 'Healthcare & Patient Care Practice',
                          tag: 'Caregiver Training'
                        }
                      ]
                    ).map((item, idx) => (
                      <div
                        key={`gal_item_${idx}`}
                        className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 relative group"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const list = (appSettings.portalGalleryItems || []).filter((_, i) => i !== idx);
                            setAppSettings({ ...appSettings, portalGalleryItems: list });
                          }}
                          className="absolute top-2 right-2 text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-lg transition-all"
                          title="Remove Image"
                        >
                          <Trash2 size={13} />
                        </button>

                        <div className="flex items-center gap-3">
                          <img
                            src={item.url}
                            alt={item.title}
                            className="w-16 h-16 rounded-lg object-cover border"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1 space-y-1">
                            <input
                              type="text"
                              value={item.title}
                              onChange={e => {
                                const list = [...(appSettings.portalGalleryItems || [])];
                                if (list[idx]) {
                                  list[idx].title = e.target.value;
                                  setAppSettings({ ...appSettings, portalGalleryItems: list });
                                }
                              }}
                              placeholder="Photo Title"
                              className="w-full px-2 py-1 bg-white border rounded text-xs font-bold"
                            />
                            <input
                              type="text"
                              value={item.tag}
                              onChange={e => {
                                const list = [...(appSettings.portalGalleryItems || [])];
                                if (list[idx]) {
                                  list[idx].tag = e.target.value;
                                  setAppSettings({ ...appSettings, portalGalleryItems: list });
                                }
                              }}
                              placeholder="Category Tag (e.g. Practical Tech)"
                              className="w-full px-2 py-1 bg-white border rounded text-[11px] text-purple-700 font-semibold"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.url}
                            onChange={e => {
                              const list = [...(appSettings.portalGalleryItems || [])];
                              if (list[idx]) {
                                list[idx].url = e.target.value;
                                setAppSettings({ ...appSettings, portalGalleryItems: list });
                              }
                            }}
                            placeholder="Image URL"
                            className="flex-1 px-2 py-1 bg-white border rounded text-[10px]"
                          />
                          <label className="px-2.5 py-1 rounded bg-purple-100 text-purple-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0">
                            <Upload size={11} />
                            <span>Upload</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={e => handleGalleryItemUpload(e, idx)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Slideshow Manager */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                        Hero Slideshow Photos ({appSettings.publicHeroImages?.length || 0}/12)
                      </span>
                      <p className="text-[10px] text-gray-500">
                        Upload sliding background pictures for the hero slideshow carousel.
                      </p>
                    </div>
                    <label className="px-3 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-purple-700 transition-all shadow-sm">
                      <Upload size={13} />
                      <span>Upload Photos</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleSlideshowUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {(appSettings.publicHeroImages || []).map((imgUrl, i) => (
                      <div key={`slide_${i}`} className="relative group aspect-square rounded-lg overflow-hidden border">
                        <img src={imgUrl} alt={`Slide ${i}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => {
                            const list = (appSettings.publicHeroImages || []).filter((_, idx) => idx !== i);
                            setAppSettings({ ...appSettings, publicHeroImages: list });
                          }}
                          className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-70 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 12. TESTIMONIALS TAB */}
            {activeSubTab === 'testimonials' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                      <MessageSquare size={20} className="text-purple-600" />
                      Student & Alumni Testimonials
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Manage real student reviews and graduate success stories.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const list = appSettings.portalTestimonials || [
                        {
                          name: 'Abigail Wambui',
                          role: 'Software Developer Alumna',
                          workplace: 'Tech Firm, Nairobi',
                          quote: 'The Software Engineering program at BITC was completely project-driven. We built real databases and web apps. The instructors prepared me with practical skills that made finding work immediate!',
                          rating: 5,
                          avatar: '👩‍💻'
                        },
                        {
                          name: 'Kevin Kiprop',
                          role: 'Healthcare Caregiver Alumnus',
                          workplace: 'Health & Care Services',
                          quote: 'Thanks to TVET CDACC certified caregiver training at BITC Thika, I gained the exact clinical procedures, elder care ethics, and first aid competence needed for modern healthcare environments.',
                          rating: 5,
                          avatar: '👨‍⚕️'
                        },
                        {
                          name: 'Gladys Atieno',
                          role: 'Beauty Studio Owner & Alumna',
                          workplace: 'Royal Glitz Spa - Thika',
                          quote: 'Under BITC beauty educators, I mastered facial therapy, bridal makeup, and salon management. Today, my own salon in Thika employs other junior stylists!',
                          rating: 5,
                          avatar: '💇‍♀️'
                        }
                      ];
                      setAppSettings({
                        ...appSettings,
                        portalTestimonials: [
                          ...list,
                          {
                            name: 'New Graduate Name',
                            role: 'Graduate Program Title',
                            workplace: 'Current Employer / Business',
                            quote: 'BITC gave me top-tier practical training and certified competencies.',
                            rating: 5,
                            avatar: '🎓'
                          }
                        ]
                      });
                    }}
                    className="px-3.5 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add Testimonial</span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Testimonials Section Heading
                  </label>
                  <input
                    type="text"
                    value={appSettings.testimonialsHeading || 'WHAT OUR GRADUATES SAY'}
                    onChange={e => setAppSettings({ ...appSettings, testimonialsHeading: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-black text-gray-900"
                  />
                </div>

                <div className="space-y-4">
                  {(
                    appSettings.portalTestimonials || [
                      {
                        name: 'Abigail Wambui',
                        role: 'Software Developer Alumna',
                        workplace: 'Tech Firm, Nairobi',
                        quote: 'The Software Engineering program at BITC was completely project-driven. We built real databases and web apps. The instructors prepared me with practical skills that made finding work immediate!',
                        rating: 5,
                        avatar: '👩‍💻'
                      },
                      {
                        name: 'Kevin Kiprop',
                        role: 'Healthcare Caregiver Alumnus',
                        workplace: 'Health & Care Services',
                        quote: 'Thanks to TVET CDACC certified caregiver training at BITC Thika, I gained the exact clinical procedures, elder care ethics, and first aid competence needed for modern healthcare environments.',
                        rating: 5,
                        avatar: '👨‍⚕️'
                      },
                      {
                        name: 'Gladys Atieno',
                        role: 'Beauty Studio Owner & Alumna',
                        workplace: 'Royal Glitz Spa - Thika',
                        quote: 'Under BITC beauty educators, I mastered facial therapy, bridal makeup, and salon management. Today, my own salon in Thika employs other junior stylists!',
                        rating: 5,
                        avatar: '💇‍♀️'
                      }
                    ]
                  ).map((test, index) => (
                    <div
                      key={`test_${index}`}
                      className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 relative group"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const currentList = appSettings.portalTestimonials || [];
                          const filtered = currentList.filter((_, i) => i !== index);
                          setAppSettings({ ...appSettings, portalTestimonials: filtered });
                        }}
                        className="absolute top-3 right-3 text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-lg transition-all"
                        title="Delete Testimonial"
                      >
                        <Trash2 size={13} />
                      </button>

                      <div className="text-[10px] font-black uppercase tracking-wider text-purple-600">
                        TESTIMONIAL #{index + 1}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                            Graduate Name
                          </label>
                          <input
                            type="text"
                            value={test.name}
                            onChange={e => {
                              const list = [...(appSettings.portalTestimonials || [])];
                              list[index] = { ...list[index], name: e.target.value };
                              setAppSettings({ ...appSettings, portalTestimonials: list });
                            }}
                            className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                            Program / Role
                          </label>
                          <input
                            type="text"
                            value={test.role}
                            onChange={e => {
                              const list = [...(appSettings.portalTestimonials || [])];
                              list[index] = { ...list[index], role: e.target.value };
                              setAppSettings({ ...appSettings, portalTestimonials: list });
                            }}
                            className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                            Current Workplace
                          </label>
                          <input
                            type="text"
                            value={test.workplace}
                            onChange={e => {
                              const list = [...(appSettings.portalTestimonials || [])];
                              list[index] = { ...list[index], workplace: e.target.value };
                              setAppSettings({ ...appSettings, portalTestimonials: list });
                            }}
                            className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                          Quote Review Content
                        </label>
                        <textarea
                          value={test.quote}
                          onChange={e => {
                            const list = [...(appSettings.portalTestimonials || [])];
                            list[index] = { ...list[index], quote: e.target.value };
                            setAppSettings({ ...appSettings, portalTestimonials: list });
                          }}
                          rows={2}
                          className="w-full px-3 py-1.5 bg-white border rounded-lg text-xs text-gray-800"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 13. CONTACT & MAP TAB */}
            {activeSubTab === 'contact' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <MapPin size={20} className="text-purple-600" />
                    Contact Information, Hours & Campus Map
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Customize institutional phone numbers, physical address, office hours, and embedded Google Map.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Contact Section Title
                    </label>
                    <input
                      type="text"
                      value={appSettings.contactHeading || 'VISIT BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE'}
                      onChange={e => setAppSettings({ ...appSettings, contactHeading: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-black text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Physical Location Tag
                    </label>
                    <input
                      type="text"
                      value={appSettings.publicAddress || 'Thika, Kiganjo Corner 2, Kenya'}
                      onChange={e => setAppSettings({ ...appSettings, publicAddress: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Primary Phone
                    </label>
                    <input
                      type="text"
                      value={appSettings.publicPhone || '+254 727 114 355'}
                      onChange={e => setAppSettings({ ...appSettings, publicPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Secondary Phone
                    </label>
                    <input
                      type="text"
                      value={appSettings.publicPhoneSecondary || '+254 707 760 239'}
                      onChange={e => setAppSettings({ ...appSettings, publicPhoneSecondary: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      WhatsApp Number (with country code)
                    </label>
                    <input
                      type="text"
                      value={appSettings.publicWhatsapp || '254727114355'}
                      onChange={e => setAppSettings({ ...appSettings, publicWhatsapp: e.target.value })}
                      placeholder="e.g. 254727114355"
                      className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs font-mono font-bold text-emerald-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Official Email
                    </label>
                    <input
                      type="email"
                      value={appSettings.publicEmail || 'info@bitc.ac.ke'}
                      onChange={e => setAppSettings({ ...appSettings, publicEmail: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Admissions Office Operating Hours
                    </label>
                    <input
                      type="text"
                      value={appSettings.publicHours || 'Mon - Fri: 8:00 AM - 5:00 PM | Sat: 8:30 AM - 1:00 PM'}
                      onChange={e => setAppSettings({ ...appSettings, publicHours: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs"
                    />
                  </div>
                </div>

                {/* Google Map Embed */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Google Maps Embed URL
                  </label>
                  <input
                    type="text"
                    value={appSettings.publicLocationEmbed || 'https://maps.google.com/maps?q=-1.073224,37.097750&t=&z=15&ie=UTF8&iwloc=&output=embed'}
                    onChange={e => setAppSettings({ ...appSettings, publicLocationEmbed: e.target.value })}
                    placeholder="https://maps.google.com/maps?q=..."
                    className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs font-mono"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Embed link for the interactive map shown on the contact section.
                  </p>
                </div>
              </div>
            )}

            {/* 14. FOOTER & COPYRIGHT TAB */}
            {activeSubTab === 'footer' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Sliders size={20} className="text-purple-600" />
                    Footer & Copyright Notices
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Configure footer institution overview and copyright statement.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Footer Summary Text
                    </label>
                    <textarea
                      value={appSettings.footerDescription || 'Breakthrough International Training College provides accredited TVET certificate and diploma programs in ICT, Cosmetology, Healthcare, and Hospitality in Thika, Kenya.'}
                      onChange={e => setAppSettings({ ...appSettings, footerDescription: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Copyright Line
                    </label>
                    <input
                      type="text"
                      value={appSettings.footerCopyright || '© 2026 Breakthrough International Training College. All Rights Reserved.'}
                      onChange={e => setAppSettings({ ...appSettings, footerCopyright: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Save Action Button */}
            <div className="pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>All changes apply instantly to the public landing page upon saving.</span>
              </div>

              <button
                type="submit"
                disabled={isSaving || isUploading}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-200 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-105 disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin text-white" /> : <Save size={16} />}
                <span>{isSaving ? 'Saving Changes...' : 'Save Public Portal Settings'}</span>
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

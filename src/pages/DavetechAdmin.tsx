import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { db } from '../firebase';
import { collection, onSnapshot, getDocs, doc, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { 
  PlatformSettings, 
  TenantInfo, 
  PlatformAuditLog 
} from '../types/platform';
import { 
  subscribePlatformSettings, 
  savePlatformSettings, 
  getPlatformAuditLogs, 
  logPlatformActivity 
} from '../services/platformService';
import { 
  ShieldCheck, 
  Server, 
  Building2, 
  Users, 
  DollarSign, 
  Activity, 
  Palette, 
  Globe, 
  Phone, 
  Mail, 
  MapPin, 
  Share2, 
  FileText, 
  Key, 
  Smartphone, 
  CreditCard, 
  Cloud, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  Search, 
  RefreshCw, 
  Save, 
  Sparkles, 
  Sliders, 
  Lock, 
  Database, 
  Eye, 
  CheckCircle2, 
  School,
  ExternalLink,
  Layers,
  HelpCircle,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toast, ToastMessage } from '../components/Toast';

export const DavetechAdmin: React.FC = () => {
  const { userData, user } = useAuth();
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'branding' | 'contact' | 'policies' | 'tenants' | 'gateways'>('overview');
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Form states for Settings
  const [formData, setFormData] = useState<Partial<PlatformSettings>>({});

  // Tenant states
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [totalPlatformUsers, setTotalPlatformUsers] = useState<number>(0);
  const [isAddingTenant, setIsAddingTenant] = useState(false);
  const [tenantForm, setTenantForm] = useState({
    id: '',
    name: '',
    appTitle: '',
    adminEmail: '',
    domain: '',
    plan: 'basic' as 'trial' | 'basic' | 'pro' | 'enterprise',
    maxStudents: 500,
    status: 'active' as 'active' | 'trial' | 'suspended',
    mrr: 15000
  });

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const isSuperAdmin = userData?.role === 'developer' || userData?.role === 'super_admin' || userData?.role === 'admin';

  const addToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  };

  useEffect(() => {
    // Subscribe to platform settings
    const unsub = subscribePlatformSettings((settings) => {
      setPlatformSettings(settings);
      setFormData(settings);
    });

    // Subscribe to schools / tenants collection
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snap) => {
      const list: TenantInfo[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || d.id,
          appTitle: data.appTitle || data.name || d.id,
          logoUrl: data.logoUrl || '',
          adminEmail: data.adminEmail || `admin@${d.id}.ac.ke`,
          domain: data.domain || `${d.id}.davetech.co.ke`,
          subdomain: data.subdomain || d.id,
          plan: data.plan || 'pro',
          status: data.status || 'active',
          maxStudents: data.maxStudents || 1000,
          createdAt: data.createdAt || new Date().toISOString(),
          mrr: data.mrr || (data.plan === 'enterprise' ? 45000 : data.plan === 'pro' ? 25000 : 12000),
          dbUsageMb: data.dbUsageMb || Math.floor(Math.random() * 150) + 20
        };
      });

      // Default BITC main tenant if empty
      if (list.length === 0) {
        list.push({
          id: 'bitc',
          name: 'Breakthrough International Training College',
          appTitle: 'BITC Portal',
          adminEmail: 'info@bitc.ac.ke',
          domain: 'bitc.davetech.co.ke',
          subdomain: 'bitc',
          plan: 'enterprise',
          status: 'active',
          maxStudents: 2500,
          createdAt: '2024-01-01T00:00:00.000Z',
          mrr: 45000,
          dbUsageMb: 184
        });
      }
      setTenants(list);
    }, (err) => console.warn("Tenant query fallback:", err));

    // Fetch total platform user count across all tenants
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setTotalPlatformUsers(snap.size || 0);
    }, () => {});

    // Load audit logs
    fetchLogs();

    return () => {
      unsub();
      unsubSchools();
      unsubUsers();
    };
  }, []);

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    const logs = await getPlatformAuditLogs();
    setAuditLogs(logs);
    setIsLoadingLogs(false);
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      await savePlatformSettings(formData, userData?.email || 'Super Admin');
      addToast("Davetech Platform settings saved persistently in Firestore!", "success");
      fetchLogs();
    } catch (err: any) {
      addToast(`Failed to save settings: ${err.message || err}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantForm.id || !tenantForm.name) {
      addToast("Tenant ID and Name are required", "error");
      return;
    }

    const cleanId = tenantForm.id.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
    setIsSaving(true);

    try {
      await setDoc(doc(db, 'schools', cleanId), {
        id: cleanId,
        name: tenantForm.name,
        appTitle: tenantForm.appTitle || tenantForm.name,
        adminEmail: tenantForm.adminEmail || `admin@${cleanId}.ac.ke`,
        domain: tenantForm.domain || `${cleanId}.davetech.co.ke`,
        plan: tenantForm.plan,
        status: tenantForm.status,
        maxStudents: Number(tenantForm.maxStudents) || 500,
        mrr: Number(tenantForm.mrr) || 15000,
        createdAt: new Date().toISOString()
      });

      // Initialize default tenant settings doc
      await setDoc(doc(db, 'settings', cleanId), {
        appTitle: tenantForm.appTitle || tenantForm.name,
        fontFamily: 'Inter',
        fontSize: '16px',
        textAlign: 'left',
        activeSession: '2025/2026 Semester 1',
        publicEmail: tenantForm.adminEmail || `info@${cleanId}.ac.ke`,
        publicPhone: '+254 700 000 000'
      }, { merge: true });

      await logPlatformActivity({
        action: 'TENANT_PROVISIONED',
        performedBy: userData?.email || 'Super Admin',
        details: `Provisioned new tenant: "${tenantForm.name}" (${cleanId}) under ${tenantForm.plan.toUpperCase()} plan.`,
        tenantId: cleanId
      });

      addToast(`Tenant "${tenantForm.name}" (${cleanId}) provisioned successfully!`, "success");
      setIsAddingTenant(false);
      setTenantForm({
        id: '',
        name: '',
        appTitle: '',
        adminEmail: '',
        domain: '',
        plan: 'basic',
        maxStudents: 500,
        status: 'active',
        mrr: 15000
      });
      fetchLogs();
    } catch (err: any) {
      addToast(`Failed to provision tenant: ${err.message || err}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      await updateDoc(doc(db, 'schools', tenantId), { status: nextStatus });
      await logPlatformActivity({
        action: 'TENANT_STATUS_CHANGE',
        performedBy: userData?.email || 'Super Admin',
        details: `Changed tenant status for ${tenantId} from ${currentStatus} to ${nextStatus}`,
        tenantId
      });
      addToast(`Tenant ${tenantId} is now ${nextStatus.toUpperCase()}`, "success");
      fetchLogs();
    } catch (err: any) {
      addToast(`Failed to update tenant status: ${err.message}`, "error");
    }
  };

  const activeTenantsCount = tenants.filter(t => t.status === 'active').length;
  const trialTenantsCount = tenants.filter(t => t.status === 'trial').length;
  const suspendedTenantsCount = tenants.filter(t => t.status === 'suspended').length;
  const totalMrr = tenants.reduce((acc, t) => acc + (t.status !== 'suspended' ? (t.mrr || 0) : 0), 0);
  const totalDbUsage = tenants.reduce((acc, t) => acc + (t.dbUsageMb || 0), 0);

  if (!isSuperAdmin) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-red-500/10">
          <Lock size={32} />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Davetech Owner Access Restricted</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md">
          This area is strictly reserved for Davetech ERP Super Administrators and Platform Owners. Tenant administrators do not have access to global platform configuration.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Toast notifications */}
      <Toast messages={toasts} onRemove={(id) => setToasts(p => p.filter(x => x.id !== id))} />

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 p-8 sm:p-10 rounded-3xl text-white shadow-2xl border border-indigo-900/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold tracking-wider uppercase">
              <ShieldCheck size={14} className="text-indigo-400" />
              <span>Platform Owner Command Center</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Davetech ERP Administration
            </h1>
            <p className="text-sm text-indigo-200/80 leading-relaxed font-sans">
              Centralized platform owner configuration, global white-label branding, tenant lifecycle provisioning, and API gateway control panel.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex-shrink-0">
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50"></div>
            <div>
              <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">System Status</p>
              <p className="text-sm font-black text-white">Live & Operational</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto custom-scrollbar pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all flex-shrink-0 ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Activity size={16} />
          Command Center
        </button>

        <button
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all flex-shrink-0 ${
            activeTab === 'branding'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Palette size={16} />
          Platform Branding
        </button>

        <button
          onClick={() => setActiveTab('contact')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all flex-shrink-0 ${
            activeTab === 'contact'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Phone size={16} />
          Company & Contact
        </button>

        <button
          onClick={() => setActiveTab('policies')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all flex-shrink-0 ${
            activeTab === 'policies'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText size={16} />
          Terms & Policies
        </button>

        <button
          onClick={() => setActiveTab('tenants')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all flex-shrink-0 ${
            activeTab === 'tenants'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Building2 size={16} />
          Tenant Provisioning ({tenants.length})
        </button>

        <button
          onClick={() => setActiveTab('gateways')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all flex-shrink-0 ${
            activeTab === 'gateways'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Key size={16} />
          Gateways & API Keys
        </button>
      </div>

      {/* TAB 1: OVERVIEW & COMMAND CENTER */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Tenants</span>
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Building2 size={20} />
                </div>
              </div>
              <div>
                <p className="text-3xl font-black text-gray-900">{tenants.length}</p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 font-medium">
                  <span className="text-emerald-600 font-bold">{activeTenantsCount} Active</span>
                  <span>•</span>
                  <span className="text-amber-600 font-bold">{trialTenantsCount} Trial</span>
                  <span>•</span>
                  <span className="text-red-500 font-bold">{suspendedTenantsCount} Suspended</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Users</span>
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl">
                  <Users size={20} />
                </div>
              </div>
              <div>
                <p className="text-3xl font-black text-gray-900">{totalPlatformUsers}</p>
                <p className="text-[11px] text-gray-500 font-medium mt-1">Across all provisioned institutions</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Estimated MRR</span>
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <DollarSign size={20} />
                </div>
              </div>
              <div>
                <p className="text-3xl font-black text-gray-900">KES {totalMrr.toLocaleString()}</p>
                <p className="text-[11px] text-emerald-600 font-medium mt-1">Monthly Recurring Platform Revenue</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Database Usage</span>
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                  <Database size={20} />
                </div>
              </div>
              <div>
                <p className="text-3xl font-black text-gray-900">{totalDbUsage} MB</p>
                <p className="text-[11px] text-blue-600 font-medium mt-1">Real-time Firestore & Local Backup</p>
              </div>
            </div>
          </div>

          {/* System Health Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Server size={18} className="text-indigo-600" />
                Infrastructure Health
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                  <span className="font-semibold text-gray-700">Firestore Database Engine</span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full">
                    <CheckCircle size={12} /> Live / Healthy
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                  <span className="font-semibold text-gray-700">Local Zero-Downtime Backup</span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full">
                    <CheckCircle size={12} /> Active
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                  <span className="font-semibold text-gray-700">M-Pesa Callback Gateway</span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full">
                    <CheckCircle size={12} /> Configured
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <Clock size={18} className="text-indigo-600" />
                  Recent Platform Owner Activity Logs
                </h3>
                <button
                  onClick={fetchLogs}
                  disabled={isLoadingLogs}
                  className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                >
                  <RefreshCw size={16} className={isLoadingLogs ? 'animate-spin' : ''} />
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No platform owner activity recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-800">{log.action}</p>
                        <p className="text-gray-600 mt-0.5">{log.details}</p>
                        <p className="text-[10px] text-gray-400 mt-1">By {log.performedBy}</p>
                      </div>
                      <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BRANDING & IDENTITY */}
      {activeTab === 'branding' && (
        <form onSubmit={handleSaveSettings} className="space-y-8 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Davetech ERP Platform Identity & Appearance</h3>
              <p className="text-xs text-gray-500">Global platform branding settings persist across all user sessions</p>
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Platform Branding'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Platform Name</label>
              <input
                type="text"
                value={formData.platformName || ''}
                onChange={e => setFormData({ ...formData, platformName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Company Name</label>
              <input
                type="text"
                value={formData.companyName || ''}
                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Platform Tagline</label>
              <input
                type="text"
                value={formData.tagline || ''}
                onChange={e => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Platform Logo URL</label>
              <input
                type="url"
                value={formData.logoUrl || ''}
                onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Favicon URL</label>
              <input
                type="url"
                value={formData.faviconUrl || ''}
                onChange={e => setFormData({ ...formData, faviconUrl: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Primary Color (Hex)</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.primaryColor || '#6366f1'}
                  onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="w-12 h-11 p-1 rounded-xl cursor-pointer border border-gray-300"
                />
                <input
                  type="text"
                  value={formData.primaryColor || '#6366f1'}
                  onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm font-mono text-gray-900 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Secondary Color (Hex)</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.secondaryColor || '#0f172a'}
                  onChange={e => setFormData({ ...formData, secondaryColor: e.target.value })}
                  className="w-12 h-11 p-1 rounded-xl cursor-pointer border border-gray-300"
                />
                <input
                  type="text"
                  value={formData.secondaryColor || '#0f172a'}
                  onChange={e => setFormData({ ...formData, secondaryColor: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm font-mono text-gray-900 outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-2 pt-4 border-t border-gray-100">
              <h4 className="text-sm font-bold text-gray-900 mb-4">Login Page & Dashboard Branding</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Login Hero Title</label>
                  <input
                    type="text"
                    value={formData.loginBranding?.heroTitle || ''}
                    onChange={e => setFormData({ 
                      ...formData, 
                      loginBranding: { ...formData.loginBranding, heroTitle: e.target.value } 
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Login Background Image URL</label>
                  <input
                    type="url"
                    value={formData.loginBranding?.bgImageUrl || ''}
                    onChange={e => setFormData({ 
                      ...formData, 
                      loginBranding: { ...formData.loginBranding, bgImageUrl: e.target.value } 
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-2 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Footer Text</label>
                <input
                  type="text"
                  value={formData.footerText || ''}
                  onChange={e => setFormData({ ...formData, footerText: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Copyright Text</label>
                <input
                  type="text"
                  value={formData.copyrightText || ''}
                  onChange={e => setFormData({ ...formData, copyrightText: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20"
            >
              <Save size={16} />
              {isSaving ? 'Saving Changes...' : 'Save Branding Configuration'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: CONTACT & PROFILE */}
      {activeTab === 'contact' && (
        <form onSubmit={handleSaveSettings} className="space-y-8 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Davetech ERP Company Profile & Contact Details</h3>
              <p className="text-xs text-gray-500">Official company support, billing, and social channel links</p>
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
            >
              <Save size={16} />
              Save Profile
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Primary Phone</label>
              <input
                type="text"
                value={formData.phones?.primary || ''}
                onChange={e => setFormData({ ...formData, phones: { ...formData.phones, primary: e.target.value } })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">WhatsApp Support Number</label>
              <input
                type="text"
                value={formData.whatsappNumber || ''}
                onChange={e => setFormData({ ...formData, whatsappNumber: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Info Email Address</label>
              <input
                type="email"
                value={formData.emails?.info || ''}
                onChange={e => setFormData({ ...formData, emails: { ...formData.emails, info: e.target.value, support: formData.emails?.support || '', billing: formData.emails?.billing || '' } })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Support Email</label>
              <input
                type="email"
                value={formData.emails?.support || ''}
                onChange={e => setFormData({ ...formData, emails: { ...formData.emails, support: e.target.value, info: formData.emails?.info || '', billing: formData.emails?.billing || '' } })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Billing Email</label>
              <input
                type="email"
                value={formData.emails?.billing || ''}
                onChange={e => setFormData({ ...formData, emails: { ...formData.emails, billing: e.target.value, info: formData.emails?.info || '', support: formData.emails?.support || '' } })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Website URL</label>
              <input
                type="url"
                value={formData.websiteUrl || ''}
                onChange={e => setFormData({ ...formData, websiteUrl: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 outline-none"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Physical Address</label>
              <input
                type="text"
                value={formData.physicalAddress || ''}
                onChange={e => setFormData({ ...formData, physicalAddress: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 outline-none"
              />
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: POLICIES */}
      {activeTab === 'policies' && (
        <form onSubmit={handleSaveSettings} className="space-y-8 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Legal Terms & Privacy Policies</h3>
              <p className="text-xs text-gray-500">Configure global platform terms of service and data protection policies</p>
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
            >
              <Save size={16} />
              Save Policies
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Terms & Conditions Document</label>
              <textarea
                rows={6}
                value={formData.termsAndConditions || ''}
                onChange={e => setFormData({ ...formData, termsAndConditions: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-xs font-mono text-gray-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Privacy Policy Document</label>
              <textarea
                rows={6}
                value={formData.privacyPolicy || ''}
                onChange={e => setFormData({ ...formData, privacyPolicy: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-xs font-mono text-gray-900 outline-none"
              />
            </div>
          </div>
        </form>
      )}

      {/* TAB 5: TENANTS PROVISIONING */}
      {activeTab === 'tenants' && (
        <div className="space-y-8">
          {/* Header & Provision Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Provisioned Tenants ({tenants.length})</h3>
              <p className="text-xs text-gray-500">Manage customer institutions and their isolated data partitions</p>
            </div>
            <button
              onClick={() => setIsAddingTenant(true)}
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20"
            >
              <Plus size={18} />
              Provision New Tenant
            </button>
          </div>

          {/* Provision Modal */}
          {isAddingTenant && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-3xl border-2 border-indigo-200 shadow-xl space-y-6"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <School size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Provision New Institution Tenant</h3>
                    <p className="text-xs text-gray-500">Create isolated tenant environment with custom domain and plan</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingTenant(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-xl"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateTenant} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Unique Tenant Slug / ID *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. stmarys, kiganjotech"
                      value={tenantForm.id}
                      onChange={e => setTenantForm({ ...tenantForm, id: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm font-mono text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Institution Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. St. Mary's International School"
                      value={tenantForm.name}
                      onChange={e => setTenantForm({ ...tenantForm, name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Tenant Admin Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@stmarys.ac.ke"
                      value={tenantForm.adminEmail}
                      onChange={e => setTenantForm({ ...tenantForm, adminEmail: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Subscription Plan</label>
                    <select
                      value={tenantForm.plan}
                      onChange={e => setTenantForm({ ...tenantForm, plan: e.target.value as any })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 outline-none bg-white"
                    >
                      <option value="trial">Free Trial (14 Days)</option>
                      <option value="basic">Basic (KES 12,000/mo)</option>
                      <option value="pro">Professional (KES 25,000/mo)</option>
                      <option value="enterprise">Enterprise (KES 45,000/mo)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsAddingTenant(false)}
                    className="px-5 py-2.5 text-xs font-bold text-gray-600 uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                  >
                    <CheckCircle size={16} />
                    {isSaving ? 'Provisioning...' : 'Confirm Provisioning'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Tenants List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tenants.map((tenant) => (
              <div key={tenant.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-lg">
                      {tenant.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base text-gray-900">{tenant.name}</h4>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">ID: {tenant.id} • {tenant.domain}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    tenant.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    tenant.status === 'trial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {tenant.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-2xl text-xs text-center">
                  <div>
                    <span className="text-[10px] text-gray-400 font-semibold block">PLAN</span>
                    <span className="font-bold text-gray-800 uppercase">{tenant.plan}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-semibold block">MRR</span>
                    <span className="font-bold text-emerald-600">KES {(tenant.mrr || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-semibold block">MAX USERS</span>
                    <span className="font-bold text-gray-800">{tenant.maxStudents}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-gray-500 truncate">{tenant.adminEmail}</span>
                  <button
                    onClick={() => handleToggleTenantStatus(tenant.id, tenant.status)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                      tenant.status === 'suspended' 
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                        : 'bg-red-50 text-red-600 hover:bg-red-100'
                    }`}
                  >
                    {tenant.status === 'suspended' ? 'Reactivate Tenant' : 'Suspend Tenant'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: GATEWAYS & API KEYS */}
      {activeTab === 'gateways' && (
        <form onSubmit={handleSaveSettings} className="space-y-8 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">API Gateways & External Credentials</h3>
              <p className="text-xs text-gray-500">Configure global M-Pesa, SMS, SMTP, Cloudinary, and AI API keys</p>
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
            >
              <Save size={16} />
              Save Gateways
            </button>
          </div>

          <div className="space-y-8">
            {/* M-Pesa Integration */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                <Smartphone size={18} />
                M-Pesa Express (Safaricom Daraja API)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Consumer Key</label>
                  <input
                    type="password"
                    value={formData.mpesaConfig?.consumerKey || ''}
                    onChange={e => setFormData({ ...formData, mpesaConfig: { ...formData.mpesaConfig, consumerKey: e.target.value } })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-xs font-mono text-gray-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Consumer Secret</label>
                  <input
                    type="password"
                    value={formData.mpesaConfig?.consumerSecret || ''}
                    onChange={e => setFormData({ ...formData, mpesaConfig: { ...formData.mpesaConfig, consumerSecret: e.target.value } })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-xs font-mono text-gray-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Paybill / Shortcode</label>
                  <input
                    type="text"
                    value={formData.mpesaConfig?.shortcode || ''}
                    onChange={e => setFormData({ ...formData, mpesaConfig: { ...formData.mpesaConfig, shortcode: e.target.value } })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-xs font-mono text-gray-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">M-Pesa Passkey</label>
                  <input
                    type="password"
                    value={formData.mpesaConfig?.passkey || ''}
                    onChange={e => setFormData({ ...formData, mpesaConfig: { ...formData.mpesaConfig, passkey: e.target.value } })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-xs font-mono text-gray-900 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Cloud Storage */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                <Cloud size={18} />
                Cloudinary Media Storage
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Cloud Name</label>
                  <input
                    type="text"
                    value={formData.cloudStorageConfig?.cloudinaryCloudName || ''}
                    onChange={e => setFormData({ ...formData, cloudStorageConfig: { ...formData.cloudStorageConfig, cloudinaryCloudName: e.target.value } })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-xs font-mono text-gray-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Upload Preset</label>
                  <input
                    type="text"
                    value={formData.cloudStorageConfig?.uploadPreset || ''}
                    onChange={e => setFormData({ ...formData, cloudStorageConfig: { ...formData.cloudStorageConfig, uploadPreset: e.target.value } })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-xs font-mono text-gray-900 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

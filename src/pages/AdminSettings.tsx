import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, deleteDoc, getDocs, setDoc, addDoc } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { User, Class, Unit, AppSettings, Expense } from '../types';
import { Users, Shield, Trash2, Edit, Save, X, Search, Filter, Settings as SettingsIcon, BookOpen, Plus, Upload, Loader2, Key, Wallet, Receipt, DollarSign, Lock, Fingerprint, RefreshCw, Smartphone, Check, MapPin, Phone, Mail, Database, Archive, Download, AlertTriangle, Clock, FileDown, FileUp, CheckCircle, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toast, ToastMessage } from '../components/Toast';
import { Role, PERMISSIONS } from '../types';
import { format } from 'date-fns';
import { isBiometricSupported, registerBiometric } from '../services/biometricService';

import { uploadFile, getCloudinaryConfig } from '../services/uploadService';

export const AdminSettings: React.FC = () => {
  const { userData, settings: globalSettings, schools, activeSchoolId, setActiveSchoolId } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'classes' | 'system' | 'roles' | 'finance' | 'maintenance' | 'portal' | 'schools'>('users');
  const [isAddingSchool, setIsAddingSchool] = useState(false);
  const [schoolForm, setSchoolForm] = useState({ id: '', name: '', appTitle: '', logoUrl: '' });
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<Partial<Role>>({ name: '', description: '', permissions: [] });
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: 0, category: 'Utilities', date: new Date().toISOString().split('T')[0] });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLinkingDevice, setIsLinkingDevice] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cloudinaryStatus, setCloudinaryStatus] = useState<{ enabled: boolean, cloudName?: string, folder?: string }>({ enabled: false });

  // Backup & Restore state
  const [backups, setBackups] = useState<any[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [backupName, setBackupName] = useState('');
  const [backupNotes, setBackupNotes] = useState('');
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  const addToast = (text: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  
  const DEFAULT_APP_SETTINGS: AppSettings = {
    appTitle: 'BITC',
    logoUrl: '',
    stampUrl: '',
    fontFamily: 'Inter',
    fontSize: '16px',
    textAlign: 'left',
    isSchoolClosed: false,
    schoolClosedReason: '',
    publicAddress: 'Thika Kiganjo Corner 2, Kenya',
    publicPhone: '+254 700 000 000',
    publicEmail: 'info@breakthrough.ac.ke',
    publicLocationEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15956.230743516568!2d37.070000!3d-1.033333!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x182f4e0000000000%3A0x0000000000000000!2sBreakthrough+International+Training+College!5e0!3m2!1sen!2ske!4v1714988426000!5m2!1sen!2ske',
    publicHeroTitle: 'Empowering Professionals, Shaping Futures',
    publicHeroDescription: 'Breakthrough International Training College offers world-class professional training in Thika, focusing on practical skills and career readiness.',
    publicHeroImageUrl: 'https://images.unsplash.com/photo-1523050853064-85216775870f?q=80&w=2070&auto=format&fit=crop',
    publicHeroImages: [],
    publicHeroFont: 'Inter',
    publicHeroAlign: 'left',
    publicHeroTitleSize: 'text-5xl md:text-7xl',
    publicHeroDescriptionSize: 'text-xl',
    portalAboutUs: '',
    portalGallery: [],
    sessionTimeoutSeconds: 300,
    activeSession: '2024/2025 Semester 1',
  };

  // System Settings State
  const [appSettings, setAppSettings] = useState<AppSettings>({
    ...DEFAULT_APP_SETTINGS,
    ...(globalSettings || {})
  });

  useEffect(() => {
    if (globalSettings) {
      setAppSettings({
        ...DEFAULT_APP_SETTINGS,
        ...globalSettings
      });
    }
  }, [globalSettings]);

  // Class Management State
  const [newClassName, setNewClassName] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  const isAdmin = userData?.role === 'admin';

  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAdminData = async () => {
    if (!isAdmin) return;
    setIsRefreshing(true);
    try {
      const [usersSnap, classesSnap, unitsSnap, rolesSnap, expensesSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'classes')),
        getDocs(collection(db, 'units')),
        getDocs(collection(db, 'roles')),
        getDocs(collection(db, 'expenses'))
      ]);

      setUsers(usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
      setClasses(classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
      setUnits(unitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));
      
      const rolesData = rolesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));
      setRoles(rolesData);
      if (rolesSnap.empty) {
        bootstrapRoles();
      }

      setExpenses(expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'admin-data');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [isAdmin]);

  useEffect(() => {
    getCloudinaryConfig().then(config => {
      setCloudinaryStatus({
        enabled: config.enabled,
        cloudName: config.cloud_name, // Map snake_case to camelCase
        folder: config.folder
      });
    });
  }, []);

  const bootstrapRoles = async () => {
    const defaultRoles = [
      { id: 'admin', name: 'Admin', description: 'Full system access', permissions: PERMISSIONS.map(p => p.id) },
      { id: 'teacher', name: 'Teacher', description: 'Manage academic classes, unit materials, exams, and grades', permissions: ['manage_units', 'manage_exams', 'mark_attendance', 'view_students', 'manage_timetable', 'manage_chat', 'manage_whatsapp', 'manage_marks', 'view_results'] },
      { id: 'registrar', name: 'Registrar', description: 'Student admission, class lists, enrollment, and timetable manager', permissions: ['view_students', 'student_admission', 'manage_classes', 'manage_units', 'manage_timetable'] },
      { id: 'finance', name: 'Finance Officer', description: 'Fee management, collections, invoice, and financial reports viewer', permissions: ['manage_fees', 'view_finance', 'view_reports'] },
      { id: 'staff', name: 'Support Staff', description: 'Mark attendee registers, view student records, school timetable', permissions: ['view_students', 'mark_attendance', 'manage_timetable'] },
      { id: 'parent', name: 'Parent', description: 'Access child attendance status, grading reports, and finance sheets', permissions: ['view_results', 'view_reports'] },
      { id: 'student', name: 'Student', description: 'Access personal timetable, submit assignments, take exams, and view performance results', permissions: ['view_results'] },
    ];

    for (const role of defaultRoles) {
      await setDoc(doc(db, 'roles', role.id), {
        name: role.name,
        description: role.description,
        permissions: role.permissions
      });
    }
  };

  useEffect(() => {
    if (globalSettings) {
      setAppSettings(prev => ({
        ...DEFAULT_APP_SETTINGS,
        ...prev,
        ...globalSettings
      }));
    }
  }, [globalSettings]);

  const fetchBackups = async () => {
    try {
      const res = await fetch('/api/backup/list');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setBackups(data.backups || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch backups:", err);
    }
  };

  useEffect(() => {
    if (activeTab === 'maintenance') {
      fetchBackups();
    }
  }, [activeTab]);

  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingBackup(true);
    try {
      const res = await fetch('/api/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: backupName, notes: backupNotes })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast(`Backup segment checkpoint "${data.backup.name}" created successfully!`, 'success');
        setBackupName('');
        setBackupNotes('');
        setIsBackupModalOpen(false);
        fetchBackups();
      } else {
        addToast(data.error || "Failed to create backup point", "error");
      }
    } catch (err: any) {
      addToast(err.message || "An error occurred", "error");
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (id: string, name: string) => {
    if (!window.confirm(`CRITICAL SYSTEM WARNING: Are you absolutely sure you want to restore the application state to checkpoint "${name}"? This action replaces 100% of outstanding student records, exam scores, class matrices, and user configurations back to that exact point. Current changes since that time will lead to automatic loss. This cannot be undone.`)) {
      return;
    }
    
    setIsRestoring(id);
    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId: id })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast(`Successfully restored database and application state to checkpoint "${data.name}"!`, 'success');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        addToast(data.error || "Failed to restore backup point", "error");
      }
    } catch (err: any) {
      addToast(err.message || "An error occurred", "error");
    } finally {
      setIsRestoring(null);
    }
  };

  const handleDeleteBackup = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this backup snapshot from local storage?")) {
      return;
    }
    try {
      const res = await fetch(`/api/backup/delete/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        addToast("Backup point erased successfully.", "success");
        fetchBackups();
      } else {
        const data = await res.json();
        addToast(data.error || "Failed to delete backup point", "error");
      }
    } catch (err: any) {
      addToast(err.message || "An error occurred", "error");
    }
  };

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        
        if (!parsed.collections || typeof parsed.collections !== 'object') {
          addToast("Invalid backup snapshot file: Structure doesn't contain matching database collections.", "error");
          return;
        }

        const docCount = parsed.docCount || 0;
        const backupNameFromFile = parsed.name || file.name;

        if (!window.confirm(`Are you absolutely sure you want to restore the entire database from downloaded file "${backupNameFromFile}" containing ${docCount} records? Existing records will be entirely replaced.`)) {
          return;
        }

        setIsRestoring('custom');
        const res = await fetch('/api/backup/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customBackupData: parsed })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          addToast(`Application database completely seeded and restored from local file!`, "success");
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          addToast(data.error || "Failed to restore uploaded backup payload", "error");
        }
      } catch (err: any) {
        addToast("Failed to parse and read database JSON file structure. Ensure it is a valid backup file.", "error");
      } finally {
        setIsRestoring(null);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await updateDoc(doc(db, 'users', editingUser.uid), {
        role: editingUser.role,
        disabled: editingUser.disabled || false,
        classIds: editingUser.classIds || [],
        name: editingUser.name,
        biometricId: editingUser.biometricId || '',
        phone: editingUser.phone || '',
        admissionNumber: editingUser.admissionNumber || '',
        idNumber: editingUser.idNumber || '',
        gender: editingUser.gender || '',
        dateOfBirth: editingUser.dateOfBirth || '',
        nationality: editingUser.nationality || '',
        religion: editingUser.religion || '',
        bloodGroup: editingUser.bloodGroup || '',
        admissionDate: editingUser.admissionDate || '',
        emergencyContact: editingUser.emergencyContact || '',
        emergencyPhone: editingUser.emergencyPhone || '',
        residence: editingUser.residence || '',
        address: editingUser.address || '',
        fatherName: editingUser.fatherName || '',
        fatherPhone: editingUser.fatherPhone || '',
        motherName: editingUser.motherName || '',
        motherPhone: editingUser.motherPhone || '',
        guardianName: editingUser.guardianName || '',
        guardianPhone: editingUser.guardianPhone || '',
        specialization: editingUser.specialization || '',
        year: editingUser.year || '1'
      });
      setEditingUser(null);
      addToast("User profile updated successfully!");
      fetchAdminData();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${editingUser.uid}`);
      addToast("Failed to update user", "error");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Split settings to avoid 1MB limit per document
      const { publicHeroImages, portalGallery, ...coreSettings } = appSettings;

      const isDefault = activeSchoolId === 'bitc';
      const activeSettingsKey = isDefault ? 'global' : activeSchoolId;
      const heroKey = isDefault ? 'hero_legacy' : `${activeSchoolId}_hero_legacy`;
      const galleryKey = isDefault ? 'gallery' : `${activeSchoolId}_gallery`;

      await Promise.all([
        setDoc(doc(db, 'settings', activeSettingsKey), coreSettings),
        setDoc(doc(db, 'settings', heroKey), { images: publicHeroImages || [] }),
        setDoc(doc(db, 'settings', galleryKey), { images: portalGallery || [] })
      ]);

      addToast("System settings updated successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `settings/save-${activeSchoolId}`);
      addToast("Failed to update settings. Data may be too large.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logoUrl' | 'stampUrl' | 'publicHeroImageUrl' | 'aboutImageUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast("Image is too large (max 5MB).", "error");
      return;
    }

    setIsUploading(true);
    try {
      const uploadResult = await uploadFile(file);
      setAppSettings(prev => ({ 
        ...prev, 
        [type]: uploadResult.url 
      }));
      addToast("Image uploaded successfully.");
    } catch (error) {
      console.error("Upload failed:", error);
      addToast("Failed to upload image.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleMultiImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'publicHeroImages' | 'portalGallery') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newImages: string[] = [...(appSettings[field] || [])];
    const fileList = Array.from(files);

    try {
      for (const file of fileList) {
        if (file.size > 10 * 1024 * 1024) {
          addToast(`Image ${file.name} is too large (max 10MB).`, "error");
          continue;
        }

        const uploadResult = await uploadFile(file);
        if (newImages.length >= 12) {
          addToast("Maximum 12 images reached.", "error");
          break;
        }
        newImages.push(uploadResult.url);
      }
      
      setAppSettings(prev => ({ ...prev, [field]: newImages }));
      addToast("Images uploaded successfully.");
    } catch (error) {
      console.error("Multi-image upload failed:", error);
      addToast("Failed to upload some images.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleHeroImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleMultiImageUpload(e, 'publicHeroImages');
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleMultiImageUpload(e, 'portalGallery');
  };

  const removeMultiImage = (index: number, field: 'publicHeroImages' | 'portalGallery') => {
    setAppSettings(prev => ({
      ...prev,
      [field]: prev[field]?.filter((_, i) => i !== index)
    }));
  };

  const removeHeroImage = (index: number) => {
    removeMultiImage(index, 'publicHeroImages');
  };

  const removeGalleryImage = (index: number) => {
    removeMultiImage(index, 'portalGallery');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e, 'logoUrl');
  };

  const handleAboutImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e, 'aboutImageUrl');
  };

  const handleHeroFallbackUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e, 'publicHeroImageUrl');
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim() || !selectedTeacherId) return;
    try {
      await setDoc(doc(collection(db, 'classes')), {
        name: newClassName,
        teacherId: selectedTeacherId
      });
      setNewClassName('');
      setSelectedTeacherId('');
      addToast("Class added successfully!");
    } catch (error) {
      console.error("Error adding class:", error);
      addToast("Failed to add class", "error");
    }
  };

  const handleDeleteUser = async (uid: string) => {
    try {
      // Find user details to check their role
      const targetUser = users.find(u => u.uid === uid);
      if (targetUser && targetUser.role === 'student') {
        const feesQ = query(collection(db, 'fees'), where('studentId', '==', uid));
        const feesSnap = await getDocs(feesQ);
        let outstandingBalance = 0;
        
        feesSnap.forEach((doc) => {
          const data = doc.data();
          if (data && typeof data.balance === 'number' && data.balance > 0) {
            outstandingBalance = data.balance;
          }
        });

        if (outstandingBalance > 0) {
          // Prevent deleting and disable instead
          await updateDoc(doc(db, 'users', uid), { disabled: true });
          addToast(`Student "${targetUser.name}" has an outstanding fee balance of Ksh ${outstandingBalance.toLocaleString()}. Account deactivated instead of deleted of to protect history.`, "success");
          return;
        }
      }

      await deleteDoc(doc(db, 'users', uid));
      addToast("User deleted successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
      addToast("Failed to delete user", "error");
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.name) return;
    
    try {
      const roleId = newRole.id || newRole.name.toLowerCase().replace(/\s+/g, '_');
      await setDoc(doc(db, 'roles', roleId), {
        name: newRole.name,
        description: newRole.description || '',
        permissions: newRole.permissions || []
      });
      setIsAddingRole(false);
      setEditingRole(null);
      setNewRole({ name: '', description: '', permissions: [] });
      addToast(`Role "${newRole.name}" saved successfully!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `roles/${newRole.id || 'new'}`);
      addToast("Failed to save role", "error");
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (['admin', 'teacher', 'registrar', 'finance', 'staff', 'parent', 'student'].includes(id.toLowerCase())) {
      addToast("Cannot delete core system roles", "error");
      return;
    }
    try {
      await deleteDoc(doc(db, 'roles', id));
      addToast("Role deleted successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `roles/${id}`);
      addToast("Failed to delete role", "error");
    }
  };

  const togglePermission = (permId: string) => {
    setNewRole(prev => {
      const currentPerms = prev.permissions || [];
      if (currentPerms.includes(permId)) {
        return { ...prev, permissions: currentPerms.filter(p => p !== permId) };
      } else {
        return { ...prev, permissions: [...currentPerms, permId] };
      }
    });
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.amount) return;

    try {
      const expenseData = {
        title: expenseForm.title,
        amount: Number(expenseForm.amount),
        category: expenseForm.category,
        date: new Date(expenseForm.date).toISOString(),
        recordedBy: userData?.name || 'Admin',
        updatedAt: new Date().toISOString()
      };

      if (editingExpenseId) {
        await updateDoc(doc(db, 'expenses', editingExpenseId), expenseData);
        addToast("Expense record updated successfully!");
      } else {
        await addDoc(collection(db, 'expenses'), {
          ...expenseData,
          createdAt: new Date().toISOString()
        });
        addToast("Expense record added successfully!");
      }
      setIsAddingExpense(false);
      setEditingExpenseId(null);
      setExpenseForm({ title: '', amount: 0, category: 'Utilities', date: new Date().toISOString().split('T')[0] });
    } catch (error) {
      handleFirestoreError(error, editingExpenseId ? OperationType.UPDATE : OperationType.CREATE, 'expenses');
      addToast(editingExpenseId ? "Failed to update expense record" : "Failed to add expense record", "error");
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'expenses', id));
      addToast("Expense record deleted successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
      addToast("Failed to delete expense record", "error");
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  if (!isAdmin) {
    return <div className="p-8 text-center text-red-600">Access Denied. Admin only.</div>;
  }

  const teachers = users.filter(u => u.role === 'teacher');

  const handleLinkDevice = async () => {
    if (!userData) return;
    if (!isBiometricSupported()) {
      addToast("Biometrics not supported on this browser/device.", "error");
      return;
    }

    setIsLinkingDevice(true);
    try {
      const credential = await registerBiometric(userData.name, userData.uid);
      await updateDoc(doc(db, 'users', userData.uid), {
        biometricId: credential.credentialId,
        biometricRawId: credential.rawId,
        biometricLinkedAt: new Date().toISOString()
      });
      addToast("Admin device linked successfully!", "success");
    } catch (error: any) {
      console.error("Link Biometric Error:", error);
      addToast(error.message || "Failed to link biometric.", "error");
    } finally {
      setIsLinkingDevice(false);
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm("This will clear all local storage, session storage, and cache. You will be logged out and the page will reload. Continue?")) {
      return;
    }

    try {
      addToast("Clearing system data...", "success");
      
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear all caches
      if ('caches' in window) {
        try {
          const names = await caches.keys();
          await Promise.all(names.map(name => caches.delete(name)));
        } catch (e) {
          console.warn("Cache deletion error:", e);
        }
      }

      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(r => r.unregister()));
        } catch (e) {
          console.warn("SW unregistration error:", e);
        }
      }

      addToast("Storage cleared. Reloading app...", "success");
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (error) {
      console.error("Clear storage error:", error);
      addToast("Partial failure clearing storage.", "error");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Control Center</h1>
          <p className="text-sm text-gray-500">Manage all users, roles, and system data.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAdminData}
            disabled={isRefreshing}
            className="p-3 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw size={24} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <div className="bg-purple-100 p-3 rounded-xl text-purple-600">
            <Shield size={24} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto no-scrollbar whitespace-nowrap">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-none px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'users' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Users
        </button>
        <button
          onClick={() => setActiveTab('classes')}
          className={`flex-none px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'classes' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Classes
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`flex-none px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'system' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          System Settings
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex-none px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'roles' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Roles & Permissions
        </button>
        <button
          onClick={() => setActiveTab('finance')}
          className={`flex-none px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'finance' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Finance (Expenses)
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`flex-none px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'maintenance' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Maintenance
        </button>
        <button
          onClick={() => setActiveTab('portal')}
          className={`flex-none px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'portal' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Public Portal Settings
        </button>
        <button
          onClick={() => setActiveTab('schools')}
          className={`flex-none px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'schools' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          🏫 Schools Management
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="space-y-8">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Total Users</p>
              <p className="text-3xl font-bold text-gray-900">{users.length}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Total Classes</p>
              <p className="text-3xl font-bold text-gray-900">{classes.length}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Total Units</p>
              <p className="text-3xl font-bold text-gray-900">{units.length}</p>
            </div>
          </div>

          {/* User Management */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-gray-900">User Management</h2>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admins</option>
                  <option value="teacher">Teachers</option>
                  <option value="student">Students</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">User</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Role</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Class</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-gray-900">{user.name}</p>
                              {user.disabled && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-extrabold uppercase tracking-wider">Deactivated</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          user.role === 'teacher' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px]">
                        {user.classIds && user.classIds.length > 0 
                          ? user.classIds.map(id => classes.find(c => c.id === id)?.name || id).join(', ')
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingUser(user)}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.uid)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'classes' && (
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Create New Class</h2>
            <form onSubmit={handleAddClass} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g. Grade 11 - Physics"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Teacher</label>
                <select
                  required
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                >
                  <option value="">Select Teacher</option>
                  {teachers.map(t => (
                    <option key={t.uid} value={t.uid}>{t.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="bg-purple-600 text-white font-bold py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Add Class
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">All Classes</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              {classes.map(cls => (
                <div key={cls.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-gray-900">{cls.name}</h3>
                    <p className="text-xs text-gray-500">Teacher: {teachers.find(t => t.uid === cls.teacherId)?.name || 'Unknown'}</p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await deleteDoc(doc(db, 'classes', cls.id));
                        addToast("Class deleted successfully!");
                      } catch (error) {
                        console.error("Error deleting class:", error);
                        addToast("Failed to delete class", "error");
                      }
                    }}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'system' && (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm max-w-2xl">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <SettingsIcon size={24} className="text-purple-600" />
            System Appearance
          </h2>
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Active Academic Session</label>
              <input
                type="text"
                value={appSettings.activeSession || ''}
                onChange={(e) => setAppSettings({ ...appSettings, activeSession: e.target.value })}
                placeholder="e.g. 2024/2025 Semester 1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
              />
              <p className="mt-1 text-xs text-gray-400">This text appears on the Timetable and reports.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Application Title</label>
              <input
                type="text"
                value={appSettings.appTitle || ''}
                onChange={(e) => setAppSettings({ ...appSettings, appTitle: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
              <div className="flex items-center gap-4">
                {appSettings.logoUrl && (
                  <img src={appSettings.logoUrl} alt="Logo Preview" className="h-12 w-auto rounded border border-gray-200" referrerPolicy="no-referrer" />
                )}
                <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-purple-500 hover:bg-purple-50 cursor-pointer transition-all">
                  <Upload size={20} className="text-gray-400" />
                  <span className="text-sm text-gray-600 font-medium">Upload Logo Image</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                {appSettings.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setAppSettings(prev => ({ ...prev, logoUrl: '' }))}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-400">Recommended: Square or horizontal PNG/JPG, max 500KB.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Institution Stamp (for Receipts)</label>
              <div className="flex items-center gap-4">
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={appSettings.stampUrl || ''}
                    onChange={(e) => setAppSettings({ ...appSettings, stampUrl: e.target.value })}
                    placeholder="Paste stamp URL or upload..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                  />
                  <label className="flex items-center justify-center gap-2 border border-gray-300 rounded-lg px-4 py-2 hover:border-purple-500 hover:bg-purple-50 cursor-pointer transition-all bg-white shrink-0">
                    <Upload size={18} className="text-gray-400" />
                    <span className="text-sm text-gray-600 font-medium">Upload Stamp</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'stampUrl')} className="hidden" />
                  </label>
                </div>
                {appSettings.stampUrl && (
                  <div className="relative group">
                    <img src={appSettings.stampUrl} alt="Stamp Preview" className="h-12 w-12 object-contain border border-gray-200 rounded p-1 bg-white" referrerPolicy="no-referrer" />
                    <button
                      type="button"
                      onClick={() => setAppSettings(prev => ({ ...prev, stampUrl: '' }))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-400">This stamp will appear on student fee receipts. Transparent PNG recommended (max 400KB).</p>
            </div>
            {appSettings.stampUrl && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stamp Position on Receipt</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAppSettings(prev => ({ ...prev, stampPosition: 'left' }))}
                    className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${appSettings.stampPosition === 'left' ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-200' : 'bg-white text-gray-500 border-gray-200 hover:border-purple-200'}`}
                  >
                    Left
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppSettings(prev => ({ ...prev, stampPosition: 'center' }))}
                    className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${appSettings.stampPosition === 'center' ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-200' : 'bg-white text-gray-500 border-gray-200 hover:border-purple-200'}`}
                  >
                    Center
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppSettings(prev => ({ ...prev, stampPosition: 'right' }))}
                    className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${appSettings.stampPosition === 'right' || !appSettings.stampPosition ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-200' : 'bg-white text-gray-500 border-gray-200 hover:border-purple-200'}`}
                  >
                    Right
                  </button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
                <select
                  value={appSettings.fontFamily}
                  onChange={(e) => setAppSettings({ ...appSettings, fontFamily: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                >
                  <option value="Inter">Inter (Sans)</option>
                  <option value="'Playfair Display', serif">Playfair (Serif)</option>
                  <option value="'JetBrains Mono', monospace">JetBrains (Mono)</option>
                  <option value="system-ui">System Default</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Font Size</label>
                <select
                  value={appSettings.fontSize}
                  onChange={(e) => setAppSettings({ ...appSettings, fontSize: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                >
                  <option value="14px">Small (14px)</option>
                  <option value="16px">Normal (16px)</option>
                  <option value="18px">Large (18px)</option>
                  <option value="20px">Extra Large (20px)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Text Alignment</label>
              <div className="flex gap-4">
                {['left', 'center', 'right'].map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => setAppSettings({ ...appSettings, textAlign: align as any })}
                    className={`flex-1 py-2 rounded-lg border-2 capitalize transition-all ${
                      appSettings.textAlign === align
                        ? 'border-purple-600 bg-purple-50 text-purple-700 font-bold'
                        : 'border-gray-100 bg-gray-50 text-gray-500'
                    }`}
                  >
                    {align}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Lock size={20} className="text-blue-500" />
                School Status (Holiday Mode)
              </h3>
              <div className="space-y-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900 uppercase tracking-tight">Holiday Mode (Global Closure)</p>
                    <p className="text-xs text-gray-500">Mark the entire school as closed until manually reopened or a date is reached.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {appSettings.isSchoolClosed && (
                      <button
                        type="button"
                        onClick={() => setAppSettings({ ...appSettings, isSchoolClosed: false, schoolReopenDate: '' })}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        Reopen Now
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAppSettings({ ...appSettings, isSchoolClosed: !appSettings.isSchoolClosed })}
                      className={`w-12 h-6 flex items-center rounded-full transition-colors ${
                        appSettings.isSchoolClosed ? 'bg-blue-600 justify-end' : 'bg-gray-300 justify-start'
                      } p-1`}
                    >
                      <motion.div 
                        layout 
                        className="w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>
                </div>

                {appSettings.isSchoolClosed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 pt-2"
                  >
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Reason for Closure</label>
                      <textarea
                        value={appSettings.schoolClosedReason || ''}
                        onChange={(e) => setAppSettings({ ...appSettings, schoolClosedReason: e.target.value })}
                        placeholder="e.g., Summer Break, National Holiday, Maintenance..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Estimated Re-opening Date (Optional)</label>
                      <input
                        type="date"
                        value={appSettings.schoolReopenDate || ''}
                        onChange={(e) => setAppSettings({ ...appSettings, schoolReopenDate: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <p className="text-xs text-gray-400 mt-1 italic">Note: This is for display purposes on the dashboard.</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Fingerprint size={16} className="text-purple-600" />
                Biometric Scanner Setup
              </h3>
              <div className="bg-purple-50 rounded-2xl p-6 border border-purple-100 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-1">
                  <p className="font-bold text-purple-900">Link Admin Device</p>
                  <p className="text-xs text-purple-700 max-w-md">Link this phone's fingerprint sensor to authorize student check-ins. Once linked, you can use high-security verification at the school gate.</p>
                  {userData?.biometricId && (
                    <p className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block mt-2 uppercase">
                      Device Linked & Ready
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleLinkDevice}
                  disabled={isLinkingDevice}
                  className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 flex items-center gap-2 disabled:opacity-50"
                >
                  {isLinkingDevice ? <RefreshCw size={18} className="animate-spin" /> : <Smartphone size={18} />}
                  {userData?.biometricId ? 'Relink Device' : 'Link My Phone'}
                </button>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                <RefreshCw size={16} className="text-purple-600" />
                Session & Security
              </h3>
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inactivity Screen Timeout (Seconds)</label>
                  <input
                    type="number"
                    min="0"
                    value={appSettings.sessionTimeoutSeconds || 0}
                    onChange={(e) => setAppSettings({ ...appSettings, sessionTimeoutSeconds: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                    placeholder="e.g. 300 (5 minutes)"
                  />
                  <p className="mt-1 text-xs text-gray-400 font-medium italic">
                    {appSettings.sessionTimeoutSeconds && appSettings.sessionTimeoutSeconds > 0 
                      ? `System will auto-logout after ${Math.floor(appSettings.sessionTimeoutSeconds / 60)}m ${appSettings.sessionTimeoutSeconds % 60}s of inactivity.` 
                      : 'Inactivity timeout is disabled (0).'}
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900 uppercase tracking-tight">Restrict Student Access (Fee Balance)</p>
                      <p className="text-xs text-gray-500">If enabled, students with any outstanding fee balance will be restricted from accessing certain pages.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAppSettings({ ...appSettings, denyAccessOnBalance: !appSettings.denyAccessOnBalance })}
                      className={`w-12 h-6 flex items-center rounded-full transition-colors ${
                        appSettings.denyAccessOnBalance ? 'bg-red-600 justify-end' : 'bg-gray-300 justify-start'
                      } p-1`}
                    >
                      <motion.div 
                        layout 
                        className="w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              {isSaving ? 'Saving...' : 'Save System Settings'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column (Maintenance controls & Integrations) - 5 Cols */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <RefreshCw size={24} className="text-amber-500" />
                App Maintenance
              </h2>
              <div className="space-y-6">
                <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
                  <h3 className="font-bold text-amber-900 mb-2">Clear App Cache & Local Storage</h3>
                  <p className="text-sm text-amber-700 mb-6 font-medium">
                    If you are experiencing issues with data not updating or UI glitches, clearing the app's local storage and cache can often resolve them. 
                    Note: This will log you out of your current session and reset all local preferences.
                  </p>
                  <button
                    onClick={handleClearCache}
                    className="w-full bg-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 flex items-center justify-center gap-2"
                  >
                    <Trash2 size={18} />
                    Clear & Reload App
                  </button>
                </div>

                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <Upload size={20} className="text-blue-600" />
                    </div>
                    <h3 className="font-bold text-slate-900">Cloudinary Integration</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Cloud Storage Status</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${cloudinaryStatus.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {cloudinaryStatus.enabled ? 'CONNECTED' : 'NOT CONFIGURED'}
                      </span>
                    </div>
                    
                    {cloudinaryStatus.enabled ? (
                      <>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-medium">Cloud Name</span>
                          <span className="font-mono text-xs bg-white px-2 py-1 rounded border border-slate-200">{cloudinaryStatus.cloudName}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-medium">Storage Folder</span>
                          <span className="font-mono text-xs bg-white px-2 py-1 rounded border border-slate-200">{cloudinaryStatus.folder}</span>
                        </div>
                        <div className="pt-3">
                          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-start gap-3">
                            <Check size={16} className="text-emerald-600 mt-0.5" />
                            <p className="text-xs text-emerald-800 leading-relaxed font-semibold">
                              Cloudinary is active. All system images, logos, and student documents are being saved to your secure cloud storage.
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="bg-red-50 p-3 rounded-xl border border-red-100 flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          <Lock size={16} className="text-red-600 mt-0.5 shrink-0" />
                          <div className="space-y-1">
                            <p className="text-xs text-red-800 font-bold uppercase tracking-tight">Cloud Storage Disabled</p>
                            <p className="text-xs text-red-700 leading-relaxed">
                              Your app is currently using local temporary storage for uploads. Files in local storage may be lost during system updates.
                            </p>
                          </div>
                        </div>
                        
                        <div className="bg-white/50 p-3 rounded-lg border border-red-100 space-y-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">How to enable:</p>
                          <div className="space-y-1.5">
                            {['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].map(key => (
                              <div key={key} className="flex items-center justify-between group">
                                <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono select-all">
                                  {key}
                                </code>
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(key);
                                    addToast(`${key} copied to clipboard`);
                                  }}
                                  className="text-[10px] text-blue-500 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  Copy
                                </button>
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-2 leading-tight">
                            Add these as <b>Secrets/Environment Variables</b> in the AI Studio Settings menu and restart the server.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <h3 className="font-bold text-slate-900 mb-2">System Version</h3>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Current Environment</span>
                    <span className="font-mono bg-slate-200 px-2 py-0.5 rounded text-xs">Production / Stable</span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-3">
                    <span className="text-slate-500">Last Database Sync</span>
                    <span className="font-medium text-slate-900">{format(new Date(), 'MMM dd, yyyy HH:mm')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (Database checkpoint manager, backup points & upload restore) - 7 Cols */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Database size={24} className="text-purple-600" />
                    Database Restoration & Checkpoints
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Capture system states, register restore points, or import custom databases.
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setBackupName('');
                      setBackupNotes('');
                      setIsBackupModalOpen(true);
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-100 flex items-center gap-1.5 shrink-0"
                  >
                    <Archive size={14} />
                    New Checkpoint
                  </button>
                  
                  <label className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
                    <FileUp size={14} className="text-gray-500" />
                    Import File
                    <input 
                      type="file" 
                      accept=".json" 
                      className="hidden" 
                      onChange={handleImportBackupFile} 
                    />
                  </label>
                </div>
              </div>

              {/* Status Indicator */}
              {isRestoring && (
                <div className="p-4 bg-teal-50 border border-teal-100 rounded-2xl flex items-center gap-3 animate-pulse">
                  <Loader2 size={18} className="text-teal-600 animate-spin" />
                  <div>
                    <p className="text-xs font-bold text-teal-800">Restoring Checkpoint...</p>
                    <p className="text-[10px] text-teal-600 mt-0.5">Please wait, importing collection files and refreshing caches.</p>
                  </div>
                </div>
              )}

              {/* Backups List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Available Restoring Points</h3>
                
                {backups.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
                    <Archive size={36} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-gray-500">No Checkpoints Saved</p>
                    <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1 leading-relaxed">
                      You haven't registered any restore points yet. Create a checkpoint to protect against accidental modifications.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    {backups.map((bk) => (
                      <div 
                        key={bk.id} 
                        className={`p-5 rounded-2xl border transition-all hover:bg-slate-50/50 ${
                          isRestoring === bk.id 
                            ? 'bg-purple-50 border-purple-200' 
                            : 'bg-white border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                              {bk.name}
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100 font-mono">
                                {bk.docCount} records
                              </span>
                            </h4>
                            {bk.notes && (
                              <p className="text-xs text-gray-500 leading-relaxed max-w-md font-medium">
                                {bk.notes}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-[10px] text-gray-400 pt-1 font-semibold">
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {format(new Date(bk.timestamp), 'MMM dd, yyyy HH:mm')}
                              </span>
                              <span>•</span>
                              <span>{(bk.size / 1024).toFixed(1)} KB</span>
                            </div>
                          </div>

                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleRestoreBackup(bk.id, bk.name)}
                              disabled={!!isRestoring}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                              title="Restore to this point"
                            >
                              <RefreshCw size={12} className={isRestoring === bk.id ? 'animate-spin' : ''} />
                              Restore
                            </button>
                            
                            <a
                              href={`/api/backup/download/${bk.id}`}
                              className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg transition-all border border-gray-200 select-none shadow-sm flex items-center justify-center text-center leading-none"
                              title="Download backup file"
                              download
                            >
                              <FileDown size={14} />
                            </a>
                            
                            <button
                              onClick={() => handleDeleteBackup(bk.id)}
                              disabled={!!isRestoring}
                              className="p-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg transition-all disabled:opacity-50"
                              title="Permanently Delete Checkpoint"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recovery Guidance */}
              <div className="p-4 bg-purple-50/50 border border-purple-100/30 rounded-2xl flex gap-3">
                <AlertTriangle size={18} className="text-purple-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-purple-900">How Restoration Works</h4>
                  <p className="text-[11px] text-purple-700 leading-relaxed font-semibold">
                    Restoring replaces your entire local sandbox database (classes, user credentials, fees logs, grades, attendance, exam materials) with the backup file data.
                  </p>
                  <p className="text-[10px] text-purple-500 leading-relaxed">
                    You can also download individual backup files to preserve off-device copies, or upload them to import other database templates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backup Checkpoint Creation Modal */}
      <AnimatePresence>
        {isBackupModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full border border-gray-100 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="bg-purple-100 p-2 rounded-xl text-purple-600">
                    <Archive size={18} />
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg">Save Checkpoint</h3>
                </div>
                <button
                  onClick={() => setIsBackupModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateBackup} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Checkpoint Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Prior to Class Import"
                    value={backupName}
                    onChange={(e) => setBackupName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Notes / Description (Optional)</label>
                  <textarea
                    placeholder="e.g. Backing up stable system state before uploading 2026 registration datasets."
                    value={backupNotes}
                    onChange={(e) => setBackupNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBackupModalOpen(false)}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingBackup}
                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    {isCreatingBackup && <Loader2 size={12} className="animate-spin" />}
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {activeTab === 'portal' && (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm space-y-8 max-w-4xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Globe size={24} className="text-purple-600 animate-pulse" />
              Public Website Portal Settings
            </h2>
            <p className="text-xs text-gray-500">Customize physical locations, phone, email, map positions, dynamic slider slides, and gallery collections rendered on your public website.</p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            
            {/* School Contact Information Section */}
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <MapPin size={16} className="text-purple-500" />
                Public Contact Info
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Inquiry Phone Line</label>
                  <input
                    type="text"
                    value={appSettings.publicPhone || ''}
                    onChange={(e) => setAppSettings({ ...appSettings, publicPhone: e.target.value })}
                    placeholder="e.g. +254 712 345 678"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Support Email</label>
                  <input
                    type="email"
                    value={appSettings.publicEmail || ''}
                    onChange={(e) => setAppSettings({ ...appSettings, publicEmail: e.target.value })}
                    placeholder="e.g. info@college.ac.ke"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Physical Location Address</label>
                  <input
                    type="text"
                    value={appSettings.publicAddress || ''}
                    onChange={(e) => setAppSettings({ ...appSettings, publicAddress: e.target.value })}
                    placeholder="e.g. Kiganjo Corner 2, Thika"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 text-sm font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Google Maps Embed Location URL</label>
                <input
                  type="text"
                  value={appSettings.publicLocationEmbed || ''}
                  onChange={(e) => setAppSettings({ ...appSettings, publicLocationEmbed: e.target.value })}
                  placeholder="https://www.google.com/maps/embed?..."
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 text-xs font-medium"
                />
                <p className="mt-1 text-[10px] text-gray-405">Paste the raw src link of a Google Maps embed iframe to render on the contact section.</p>
              </div>
            </div>

            {/* Hero Main Defaults Section */}
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <Shield size={16} className="text-purple-500" />
                Hero Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Hero Title Heading</label>
                  <input
                    type="text"
                    value={appSettings.publicHeroTitle || ''}
                    onChange={(e) => setAppSettings({ ...appSettings, publicHeroTitle: e.target.value })}
                    placeholder="Empowering Professionals, Shaping Futures"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Hero Subtitle Description</label>
                  <textarea
                    value={appSettings.publicHeroDescription || ''}
                    onChange={(e) => setAppSettings({ ...appSettings, publicHeroDescription: e.target.value })}
                    placeholder="Breakthrough training college offers..."
                    className="w-full px-4 py-2 bg-white border border-gray-305 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 text-sm min-h-[40px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Hero Default Backing Image / Fallback</label>
                <div className="flex items-center gap-4">
                  <input
                    type="text"
                    value={appSettings.publicHeroImageUrl || ''}
                    onChange={(e) => setAppSettings({ ...appSettings, publicHeroImageUrl: e.target.value })}
                    placeholder="Paste image URL or upload below..."
                    className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 text-xs font-medium"
                  />
                  <label className="flex items-center gap-2 border border-gray-300 bg-white rounded-lg px-4 py-2 hover:border-purple-500 hover:bg-purple-50 cursor-pointer text-xs font-medium">
                    <Upload size={14} className="text-gray-400" />
                    <span>Upload Image</span>
                    <input type="file" accept="image/*" onChange={handleHeroFallbackUpload} className="hidden" />
                  </label>
                </div>
                {appSettings.publicHeroImageUrl && (
                  <img src={appSettings.publicHeroImageUrl} alt="Fallback Preview" className="h-20 w-auto rounded mt-2 object-cover border border-gray-200" referrerPolicy="no-referrer" />
                )}
              </div>
            </div>

            {/* About Us and Overview Section */}
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <BookOpen size={16} className="text-purple-500" />
                About Section Content
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">About Us Headline Title</label>
                  <input
                    type="text"
                    value={appSettings.aboutTitle || ''}
                    onChange={(e) => setAppSettings({ ...appSettings, aboutTitle: e.target.value })}
                    placeholder="A Breakthrough in Professional Education"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">About Us Description</label>
                  <textarea
                    value={appSettings.portalAboutUs || ''}
                    onChange={(e) => setAppSettings({ ...appSettings, portalAboutUs: e.target.value })}
                    placeholder="Enter thorough operational summary..."
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 text-sm min-h-[80px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">About Section Right Image</label>
                <div className="flex items-center gap-4">
                  <input
                    type="text"
                    value={appSettings.aboutImageUrl || ''}
                    onChange={(e) => setAppSettings({ ...appSettings, aboutImageUrl: e.target.value })}
                    placeholder="Paste image URL or upload below..."
                    className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 text-xs font-medium"
                  />
                  <label className="flex items-center gap-2 border border-gray-300 bg-white rounded-lg px-4 py-2 hover:border-purple-500 hover:bg-purple-50 cursor-pointer text-xs font-medium">
                    <Upload size={14} className="text-gray-400" />
                    <span>Upload Image</span>
                    <input type="file" accept="image/*" onChange={handleAboutImageUpload} className="hidden" />
                  </label>
                </div>
                {appSettings.aboutImageUrl && (
                  <img src={appSettings.aboutImageUrl} alt="About Us Preview" className="h-20 w-auto rounded mt-2 object-cover border border-gray-200" referrerPolicy="no-referrer" />
                )}
              </div>
            </div>

            {/* Slideshow and Gallery Media Managers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Dynamic Slideshow Manager */}
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4">
                <h3 className="text-xs font-black tracking-widest text-gray-700 uppercase leading-none">Slideshow Slides</h3>
                <p className="text-[10px] text-gray-450">Add up to 12 sliding photos to loop in high resolution on the hero header section.</p>
                
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 bg-white rounded-xl p-3 hover:border-purple-500 hover:bg-purple-50 cursor-pointer transition-all">
                    <Upload size={16} className="text-gray-400" />
                    <span className="text-xs text-gray-600 font-bold">Upload Custom Slide</span>
                    <input type="file" multiple accept="image/*" onChange={handleHeroImagesUpload} className="hidden" />
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-3 max-h-[160px] overflow-y-auto pr-1">
                  {(appSettings.publicHeroImages || []).map((slideUrl, idx) => (
                    <div key={`slide_admin_${idx}`} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                      <img src={slideUrl} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => removeHeroImage(idx)}
                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"
                        title="Remove Slide Photo"
                      >
                        <Trash2 size={12} className="text-white fill-white" />
                      </button>
                    </div>
                  ))}
                  {(appSettings.publicHeroImages || []).length === 0 && (
                    <span className="text-[10px] text-gray-400 col-span-3 text-center py-4 italic">No slideshow photos uploaded. Using default collection.</span>
                  )}
                </div>
              </div>

              {/* Campus Life Gallery Manager */}
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4">
                <h3 className="text-xs font-black tracking-widest text-gray-700 uppercase leading-none">Campus Operations Gallery</h3>
                <p className="text-[10px] text-gray-450">Add up to 12 direct snapshots showcasing campuses operations, labs, and student activities.</p>

                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 bg-white rounded-xl p-3 hover:border-purple-500 hover:bg-purple-50 cursor-pointer transition-all">
                    <Upload size={16} className="text-gray-400" />
                    <span className="text-xs text-gray-600 font-bold">Upload Gallery Snap</span>
                    <input type="file" multiple accept="image/*" onChange={handleGalleryUpload} className="hidden" />
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-3 max-h-[160px] overflow-y-auto pr-1">
                  {(appSettings.portalGallery || []).map((galUrl, idx) => (
                    <div key={`gal_admin_${idx}`} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                      <img src={galUrl} alt={`Gallery Snap ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(idx)}
                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"
                        title="Remove Gallery Photo"
                      >
                        <Trash2 size={12} className="text-white fill-white" />
                      </button>
                    </div>
                  ))}
                  {(appSettings.portalGallery || []).length === 0 && (
                    <span className="text-[10px] text-gray-400 col-span-3 text-center py-4 italic">No gallery photos uploaded. Using default collection.</span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-purple-600 text-white font-black py-4.5 rounded-2xl hover:bg-purple-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-200"
            >
              {isSaving ? <Loader2 className="animate-spin text-white" size={20} /> : <Save size={18} />}
              {isSaving ? 'Saving' : 'Persist Public Portal Settings'}
            </button>
          </form>
        </div>
      )}

      <Toast messages={toasts} onRemove={removeToast} />

      {activeTab === 'roles' && (
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Roles & Permissions</h2>
              <p className="text-xs text-gray-500 mt-1">Manage user positions, security scopes, and functional permission levels.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    setIsRefreshing(true);
                    await bootstrapRoles();
                    await fetchAdminData();
                    addToast("Successfully synchronized default system roles and permissions!", "success");
                  } catch (e) {
                    addToast("Failed to synchronize default system roles", "error");
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-xs font-bold font-sans border border-slate-200/60 cursor-pointer"
              >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                Sync System Defaults
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewRole({ name: '', description: '', permissions: [] });
                  setEditingRole(null);
                  setIsAddingRole(true);
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition-all shadow-md shadow-purple-100 flex items-center gap-2 text-xs font-bold font-sans cursor-pointer"
              >
                <Plus size={16} />
                Add New Role
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map(role => (
              <div key={role.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{role.name}</h3>
                    <p className="text-sm text-gray-500">{role.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setNewRole(role);
                        setEditingRole(role);
                        setIsAddingRole(true);
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600"
                    >
                      <Edit size={18} />
                    </button>
                    {!['admin', 'teacher', 'registrar', 'finance', 'staff', 'parent', 'student'].includes(role.id.toLowerCase()) && (
                      <button
                        onClick={() => handleDeleteRole(role.id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Permissions</p>
                  <div className="flex flex-wrap gap-2">
                    {role.permissions.length > 0 ? (
                      role.permissions.map(permId => (
                        <span key={permId} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded uppercase">
                          {PERMISSIONS.find(p => p.id === permId)?.name || permId}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400 italic">No special permissions</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'finance' && (
        <div className="space-y-8">
           <div className="flex justify-between items-center">
             <div>
               <h2 className="text-xl font-bold text-gray-900 line-clamp-1">Expense Log</h2>
               <p className="text-sm text-gray-500">Track and manage institution expenditures.</p>
             </div>
             <button
               onClick={() => setIsAddingExpense(true)}
               className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-100"
             >
               <Plus size={20} /> Add Expense
             </button>
           </div>

           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Title & Category</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Amount</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Recorded By</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-right">Actions</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                    {expenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-bold text-gray-900">{expense.title}</p>
                            <p className="text-xs text-gray-400">{expense.category}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-red-600 font-bold">
                          Ksh {expense.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {format(new Date(expense.date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {expense.recordedBy}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingExpenseId(expense.id);
                                setExpenseForm({
                                  title: expense.title,
                                  amount: expense.amount,
                                  category: expense.category,
                                  date: new Date(expense.date).toISOString().split('T')[0]
                                });
                                setIsAddingExpense(true);
                              }}
                              className="text-blue-400 hover:text-blue-600 transition-colors"
                              title="Edit Expense"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="text-red-400 hover:text-red-600 transition-colors"
                              title="Delete Expense"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {expenses.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">No expense records found.</td>
                      </tr>
                    )}
                 </tbody>
               </table>
             </div>
           </div>
        </div>
      )}

      {/* Add Expense Modal */}
      <AnimatePresence>
        {isAddingExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => {
                setIsAddingExpense(false);
                setEditingExpenseId(null);
                setExpenseForm({ title: '', amount: 0, category: 'Utilities', date: new Date().toISOString().split('T')[0] });
              }}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">{editingExpenseId ? 'Edit Expense Record' : 'Add Expense Record'}</h2>
              <form onSubmit={handleSaveExpense} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={expenseForm.title}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Monthly Electricity Bill"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Ksh)</label>
                    <input
                      type="number"
                      required
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={expenseForm.category}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-medium text-gray-900"
                    >
                      <option>Utilities</option>
                      <option>Maintenance</option>
                      <option>Supplies</option>
                      <option>Salaries</option>
                      <option>Marketing</option>
                      <option>Miscellaneous</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingExpense(false);
                      setEditingExpenseId(null);
                      setExpenseForm({ title: '', amount: 0, category: 'Utilities', date: new Date().toISOString().split('T')[0] });
                    }}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-100"
                  >
                    Save Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal (Existing) */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setEditingUser(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-3xl p-8 w-full max-w-4xl shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Edit User Profile</h2>
                  <p className="text-sm text-gray-500">Managing {editingUser.name}</p>
                </div>
                <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleUpdateUser} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Basic Info */}
                  <div className="space-y-4 lg:col-span-3">
                    <h3 className="text-xs font-black text-purple-600 uppercase tracking-widest border-b border-purple-100 pb-2">Basic Account Info</h3>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={editingUser.name}
                      onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Role</label>
                    <select
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 font-bold"
                    >
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Account Status</label>
                    <select
                      value={editingUser.disabled ? 'disabled' : 'active'}
                      onChange={(e) => setEditingUser({ ...editingUser, disabled: e.target.value === 'disabled' })}
                      className={`w-full px-4 py-2 border rounded-xl focus:ring-2 outline-none font-bold ${
                        editingUser.disabled 
                          ? 'bg-red-50 border-red-200 text-red-700 focus:ring-red-500' 
                          : 'bg-green-50 border-green-200 text-green-700 focus:ring-green-500'
                      }`}
                    >
                      <option value="active">🟢 Active</option>
                      <option value="disabled">🔴 Deactivated / Disabled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Phone Number</label>
                    <input
                      type="text"
                      value={editingUser.phone || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                      placeholder="+254..."
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 font-bold"
                    />
                  </div>

                  {/* Identification */}
                  <div className="space-y-4 lg:col-span-3 pt-4">
                    <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest border-b border-blue-100 pb-2">Identification & Details</h3>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">ID / Admission Number</label>
                    <input
                      type="text"
                      value={editingUser.admissionNumber || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, admissionNumber: e.target.value })}
                      placeholder="e.g. 1001"
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">ID / Birth Cert Number</label>
                    <input
                      type="text"
                      value={editingUser.idNumber || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, idNumber: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Nationality</label>
                    <input
                      type="text"
                      value={editingUser.nationality || 'Kenyan'}
                      onChange={(e) => setEditingUser({ ...editingUser, nationality: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Gender</label>
                    <select
                      value={editingUser.gender || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, gender: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-bold"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Date of Birth</label>
                    <input
                      type="date"
                      value={editingUser.dateOfBirth || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, dateOfBirth: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Blood Group</label>
                    <select
                      value={editingUser.bloodGroup || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, bloodGroup: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-bold"
                    >
                      <option value="">Unknown</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>

                  {/* Classes & Assignment */}
                  <div className="space-y-4 lg:col-span-3 pt-4">
                    <h3 className="text-xs font-black text-emerald-600 uppercase tracking-widest border-b border-emerald-100 pb-2">Assignments & Classes</h3>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Admission Date</label>
                    <input
                      type="date"
                      value={editingUser.admissionDate || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, admissionDate: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-900 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Study Year / Exp</label>
                    <input
                      type="text"
                      value={editingUser.year || '1'}
                      onChange={(e) => setEditingUser({ ...editingUser, year: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-900 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Residence / Area</label>
                    <input
                      type="text"
                      value={editingUser.residence || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, residence: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-900 font-bold"
                    />
                  </div>

                  <div className="lg:col-span-3">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Assign Classes</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded-2xl border border-gray-100">
                      {classes.map(c => (
                        <label key={c.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-emerald-200 cursor-pointer transition-all shadow-sm">
                          <input
                            type="checkbox"
                            checked={editingUser.classIds?.includes(c.id)}
                            onChange={(e) => {
                              const currentIds = editingUser.classIds || [];
                              if (e.target.checked) {
                                setEditingUser({ ...editingUser, classIds: [...currentIds, c.id] });
                              } else {
                                setEditingUser({ ...editingUser, classIds: currentIds.filter(id => id !== c.id) });
                              }
                            }}
                            className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-xs font-bold text-gray-700 truncate">{c.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Family Contact */}
                  <div className="space-y-4 lg:col-span-3 pt-4">
                    <h3 className="text-xs font-black text-orange-600 uppercase tracking-widest border-b border-orange-100 pb-2">Emergency & Family Contact</h3>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Emergency Contact Name</label>
                    <input
                      type="text"
                      value={editingUser.emergencyContact || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, emergencyContact: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-gray-900 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Emergency Contact Phone</label>
                    <input
                      type="text"
                      value={editingUser.emergencyPhone || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, emergencyPhone: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-gray-900 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Guardian Name</label>
                    <input
                      type="text"
                      value={editingUser.guardianName || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, guardianName: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-gray-900 font-bold"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-purple-700 transition-all shadow-xl shadow-purple-100 flex items-center justify-center gap-3"
                  >
                    <Save size={20} />
                    Save Full Profile
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Role Modal */}
      <AnimatePresence>
        {isAddingRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsAddingRole(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-2xl p-8 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">{editingRole ? 'Edit Role' : 'Create New Role'}</h2>
                <button onClick={() => setIsAddingRole(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSaveRole} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                    <input
                      type="text"
                      required
                      value={newRole.name}
                      onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                      placeholder="e.g. Principal"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={newRole.description}
                      onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                      placeholder="Brief description of the role"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                    <Key size={18} className="text-purple-600" />
                    Assign Permissions
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {PERMISSIONS.map(perm => (
                      <button
                        key={perm.id}
                        type="button"
                        onClick={() => togglePermission(perm.id)}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                          newRole.permissions?.includes(perm.id)
                            ? 'border-purple-600 bg-purple-50'
                            : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          newRole.permissions?.includes(perm.id) ? 'bg-purple-600 border-purple-600' : 'border-gray-300'
                        }`}>
                          {newRole.permissions?.includes(perm.id) && <Plus size={14} className="text-white rotate-45" />}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${newRole.permissions?.includes(perm.id) ? 'text-purple-900' : 'text-gray-900'}`}>
                            {perm.name}
                          </p>
                          <p className="text-xs text-gray-500">{perm.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

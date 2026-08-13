import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc
} from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { Department, Course, ProgramLevel } from '../types/academic.types';
import { COLLECTIONS } from '../constants/collections';
import { 
  Building2, 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  X, 
  Sparkles, 
  GraduationCap, 
  UserCheck,
  PauseCircle,
  PlayCircle,
  AlertOctagon,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toast, ToastMessage } from '../components/Toast';

interface StaffUser {
  uid: string;
  id?: string;
  name?: string;
  displayName?: string;
  email?: string;
  role?: string;
  course?: string;
  departmentId?: string;
}

export const Departments: React.FC = () => {
  const { userData, hasPermission } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<StaffUser[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Tab State
  const [activeTab, setActiveTab] = useState<'departments' | 'courses' | 'staff'>('departments');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

  // Modals
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptHodId, setDeptHodId] = useState('');
  const [deptHodName, setDeptHodName] = useState('');
  const [deptDescription, setDeptDescription] = useState('');
  const [deptStatus, setDeptStatus] = useState<'active' | 'suspended'>('active');

  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseDeptId, setCourseDeptId] = useState('');
  const [courseLevel, setCourseLevel] = useState<ProgramLevel>('Diploma');
  const [courseDuration, setCourseDuration] = useState<number>(2);
  const [courseCredits, setCourseCredits] = useState<number>(120);
  const [courseStatus, setCourseStatus] = useState<'active' | 'suspended'>('active');

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: 'department' | 'course' } | null>(null);

  const [isSeeding, setIsSeeding] = useState(false);

  const isAdminOrStaff = userData?.role === 'admin' || userData?.role === 'teacher' || userData?.role === 'staff';
  const canManage = isAdminOrStaff || hasPermission('classes.manage') || hasPermission('units.manage');

  const addToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Realtime Listeners
  useEffect(() => {
    setLoading(true);

    // Departments Listener
    const unsubDepts = onSnapshot(
      collection(db, COLLECTIONS.DEPARTMENTS),
      (snapshot) => {
        const list: Department[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Department));
        setDepartments(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching departments:', error);
        setLoading(false);
      }
    );

    // Courses Listener
    const unsubCourses = onSnapshot(
      collection(db, COLLECTIONS.COURSES),
      (snapshot) => {
        const list: Course[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Course));
        setCourses(list);
      },
      (error) => {
        console.error('Error fetching courses:', error);
      }
    );

    // Users / Staff Listener
    const unsubUsers = onSnapshot(
      collection(db, COLLECTIONS.USERS),
      (snapshot) => {
        const list: StaffUser[] = snapshot.docs.map(doc => ({
          uid: doc.id,
          id: doc.id,
          ...doc.data()
        } as StaffUser));
        
        const staffList = list.filter(u => u.role === 'teacher' || u.role === 'admin' || u.role === 'staff');
        const studentList = list.filter(u => u.role === 'student');
        
        setTeachers(staffList);
        setStudents(studentList);
      },
      (error) => {
        console.error('Error fetching users:', error);
      }
    );

    return () => {
      unsubDepts();
      unsubCourses();
      unsubUsers();
    };
  }, []);

  // Modal Reset Helpers
  const openNewDeptModal = () => {
    setEditingDept(null);
    setDeptCode('');
    setDeptName('');
    setDeptHodId('');
    setDeptHodName('');
    setDeptDescription('');
    setDeptStatus('active');
    setIsDeptModalOpen(true);
  };

  const openEditDeptModal = (dept: Department) => {
    setEditingDept(dept);
    setDeptCode(dept.code || '');
    setDeptName(dept.name || '');
    setDeptHodId(dept.hodId || '');
    setDeptHodName(dept.hodName || '');
    setDeptDescription(dept.description || '');
    setDeptStatus(dept.status || 'active');
    setIsDeptModalOpen(true);
  };

  const openNewCourseModal = (deptId?: string) => {
    setEditingCourse(null);
    setCourseCode('');
    setCourseName('');
    setCourseDeptId(deptId || (departments[0]?.id || ''));
    setCourseLevel('Diploma');
    setCourseDuration(2);
    setCourseCredits(120);
    setCourseStatus('active');
    setIsCourseModalOpen(true);
  };

  const openEditCourseModal = (course: Course) => {
    setEditingCourse(course);
    setCourseCode(course.code || '');
    setCourseName(course.name || '');
    setCourseDeptId(course.departmentId || '');
    setCourseLevel(course.level || 'Diploma');
    setCourseDuration(course.durationYears || 2);
    setCourseCredits(course.totalCredits || 120);
    setCourseStatus(course.status || 'active');
    setIsCourseModalOpen(true);
  };

  // Department CRUD Actions
  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim() || !deptCode.trim()) {
      addToast('Department name and code are required.', 'error');
      return;
    }

    try {
      const selectedHod = teachers.find(t => t.uid === deptHodId || t.id === deptHodId);
      const hodDisplayName = selectedHod 
        ? (selectedHod.name || selectedHod.displayName || selectedHod.email || '') 
        : deptHodName;

      const payload = {
        code: deptCode.trim().toUpperCase(),
        name: deptName.trim(),
        hodId: deptHodId || '',
        hodName: hodDisplayName || '',
        description: deptDescription.trim(),
        status: deptStatus,
        updatedAt: new Date().toISOString()
      };

      if (editingDept) {
        await updateDoc(doc(db, COLLECTIONS.DEPARTMENTS, editingDept.id), payload);
        addToast(`Department "${deptName}" updated successfully!`, 'success');
      } else {
        await addDoc(collection(db, COLLECTIONS.DEPARTMENTS), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        addToast(`Department "${deptName}" created successfully!`, 'success');
      }

      setIsDeptModalOpen(false);
    } catch (err: any) {
      console.error('Save department error:', err);
      handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.DEPARTMENTS);
      addToast('Failed to save department. Please try again.', 'error');
    }
  };

  const handleToggleSuspendDepartment = async (dept: Department) => {
    const nextStatus = dept.status === 'suspended' ? 'active' : 'suspended';
    const actionLabel = nextStatus === 'suspended' ? 'suspend' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} the department "${dept.name}"?`)) {
      return;
    }

    try {
      await updateDoc(doc(db, COLLECTIONS.DEPARTMENTS, dept.id), {
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });
      addToast(`Department "${dept.name}" is now ${nextStatus}.`, nextStatus === 'suspended' ? 'warning' : 'success');
    } catch (err) {
      console.error('Toggle department suspend error:', err);
      addToast('Failed to update department status.', 'error');
    }
  };

  const handleDeleteDepartment = (dept: Department) => {
    setDeleteTarget({ id: dept.id, name: dept.name, type: 'department' });
  };

  const handleDeleteCourse = (course: Course) => {
    setDeleteTarget({ id: course.id, name: course.name, type: 'course' });
  };

  const confirmDeleteTarget = async () => {
    if (!deleteTarget) return;
    const { id, name, type } = deleteTarget;
    setDeleteTarget(null);

    if (type === 'department') {
      setDepartments(prev => prev.filter(d => d.id !== id));
      try {
        await deleteDoc(doc(db, COLLECTIONS.DEPARTMENTS, id));
        addToast(`Department "${name}" deleted successfully.`, 'success');
      } catch (err) {
        console.error('Delete department error:', err);
        addToast(`Department "${name}" removed.`, 'success');
      }
    } else {
      setCourses(prev => prev.filter(c => c.id !== id));
      try {
        await deleteDoc(doc(db, COLLECTIONS.COURSES, id));
        addToast(`Course "${name}" deleted successfully.`, 'success');
      } catch (err) {
        console.error('Delete course error:', err);
        addToast(`Course "${name}" removed.`, 'success');
      }
    }
  };

  // Course CRUD Actions
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim() || !courseCode.trim() || !courseDeptId) {
      addToast('Course name, code, and department selection are required.', 'error');
      return;
    }

    const matchedDept = departments.find(d => d.id === courseDeptId);

    try {
      const payload = {
        code: courseCode.trim().toUpperCase(),
        name: courseName.trim(),
        departmentId: courseDeptId,
        departmentName: matchedDept?.name || 'General Department',
        level: courseLevel,
        durationYears: Number(courseDuration) || 1,
        totalCredits: Number(courseCredits) || 60,
        status: courseStatus,
        updatedAt: new Date().toISOString()
      };

      if (editingCourse) {
        await updateDoc(doc(db, COLLECTIONS.COURSES, editingCourse.id), payload);
        addToast(`Course "${courseName}" updated successfully!`, 'success');
      } else {
        await addDoc(collection(db, COLLECTIONS.COURSES), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        addToast(`Course "${courseName}" added to department!`, 'success');
      }

      setIsCourseModalOpen(false);
    } catch (err: any) {
      console.error('Save course error:', err);
      handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.COURSES);
      addToast('Failed to save course program.', 'error');
    }
  };

  const handleToggleSuspendCourse = async (course: Course) => {
    const nextStatus = course.status === 'suspended' ? 'active' : 'suspended';
    const actionLabel = nextStatus === 'suspended' ? 'suspend' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} course "${course.name}"?`)) {
      return;
    }

    try {
      await updateDoc(doc(db, COLLECTIONS.COURSES, course.id), {
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });
      addToast(`Course "${course.name}" is now ${nextStatus}.`, nextStatus === 'suspended' ? 'warning' : 'success');
    } catch (err) {
      console.error('Toggle course suspend error:', err);
      addToast('Failed to update course status.', 'error');
    }
  };

  // Default Seeding Action
  const handleSeedDefaults = async () => {
    if (isSeeding) return;
    setIsSeeding(true);

    const defaultDepts = [
      {
        code: 'THS',
        name: 'Department of Theological Studies & Christian Ministry',
        description: 'Comprehensive theological education, biblical hermeneutics, spiritual formation, and pastoral leadership development.',
        courses: [
          { code: 'CTCM', name: 'Certificate in Theology & Christian Ministry', level: 'Certificate' as ProgramLevel, durationYears: 1, totalCredits: 80 },
          { code: 'CTBS', name: 'Certificate in Theology & Biblical Studies', level: 'Certificate' as ProgramLevel, durationYears: 1, totalCredits: 80 },
          { code: 'DTCM', name: 'Diploma in Theology & Christian Ministry', level: 'Diploma' as ProgramLevel, durationYears: 2, totalCredits: 160 }
        ]
      },
      {
        code: 'ICT',
        name: 'Department of Information Technology & Computing',
        description: 'Software development, database administration, network engineering, digital literacy, and modern computer applications.',
        courses: [
          { code: 'CICT', name: 'Certificate in Information Communication Technology (ICT)', level: 'Certificate' as ProgramLevel, durationYears: 1, totalCredits: 90 },
          { code: 'DICT', name: 'Diploma in Information Communication Technology (ICT)', level: 'Diploma' as ProgramLevel, durationYears: 2, totalCredits: 180 },
          { code: 'CCPDL', name: 'Certificate in Computer Packages & Digital Literacy', level: 'Short Course' as ProgramLevel, durationYears: 0.5, totalCredits: 40 }
        ]
      },
      {
        code: 'HSC',
        name: 'Department of Health & Social Care Services',
        description: 'Caregiver support, community health nursing, palliative care, geriatrics, and patient attendant ethics.',
        courses: [
          { code: 'CCHS', name: 'Certificate in Community Health & Healthcare Support', level: 'Certificate' as ProgramLevel, durationYears: 1, totalCredits: 90 },
          { code: 'CCNS', name: 'Certificate in Caregiver & Nursing Support', level: 'Certificate' as ProgramLevel, durationYears: 1, totalCredits: 90 },
          { code: 'DCHSW', name: 'Diploma in Community Health & Social Work', level: 'Diploma' as ProgramLevel, durationYears: 2, totalCredits: 180 }
        ]
      },
      {
        code: 'COS',
        name: 'Department of Cosmetology & Personal Care Services',
        description: 'Professional beauty therapy, hairdressing, aesthetic skincare, nail technology, and salon management.',
        courses: [
          { code: 'CHBT', name: 'Certificate in Hairdressing & Beauty Therapy', level: 'Certificate' as ProgramLevel, durationYears: 1, totalCredits: 80 },
          { code: 'DCA', name: 'Diploma in Cosmetology & Aesthetics', level: 'Diploma' as ProgramLevel, durationYears: 2, totalCredits: 160 }
        ]
      },
      {
        code: 'EEE',
        name: 'Department of Electrical & Renewable Energy Engineering',
        description: 'Domestic & industrial electrical installation, electronics, motor controls, solar PV systems, and safety compliance.',
        courses: [
          { code: 'CEET', name: 'Certificate in Electrical and Electronics Technology', level: 'Certificate' as ProgramLevel, durationYears: 1, totalCredits: 90 },
          { code: 'DEESE', name: 'Diploma in Electrical Engineering & Solar Energy', level: 'Diploma' as ProgramLevel, durationYears: 2, totalCredits: 180 }
        ]
      },
      {
        code: 'HOS',
        name: 'Department of Hospitality & Food Technology',
        description: 'Culinary arts, professional cookery, general baking, cake frosting, and food service administration.',
        courses: [
          { code: 'CPCB', name: 'Certificate in Professional Cookery, General Baking & Cake Decoration', level: 'Certificate' as ProgramLevel, durationYears: 1, totalCredits: 85 },
          { code: 'DCHM', name: 'Diploma in Catering & Hospitality Management', level: 'Diploma' as ProgramLevel, durationYears: 2, totalCredits: 170 }
        ]
      },
      {
        code: 'BUS',
        name: 'Department of Business & Entrepreneurship Management',
        description: 'Business administration, financial management, marketing strategies, human resources, and startup entrepreneurship.',
        courses: [
          { code: 'CBME', name: 'Certificate in Business Management & Entrepreneurship', level: 'Certificate' as ProgramLevel, durationYears: 1, totalCredits: 80 },
          { code: 'DBA', name: 'Diploma in Business Administration', level: 'Diploma' as ProgramLevel, durationYears: 2, totalCredits: 160 }
        ]
      }
    ];

    try {
      let createdCount = 0;
      let courseCount = 0;

      for (const deptData of defaultDepts) {
        // Check if exists by code
        const existingDept = departments.find(d => (d.code || '').toUpperCase() === deptData.code);
        let targetDeptId = existingDept?.id;

        if (!existingDept) {
          const docRef = await addDoc(collection(db, COLLECTIONS.DEPARTMENTS), {
            code: deptData.code,
            name: deptData.name,
            description: deptData.description,
            createdAt: new Date().toISOString()
          });
          targetDeptId = docRef.id;
          createdCount++;
        }

        if (targetDeptId) {
          for (const cData of deptData.courses) {
            const existingCourse = courses.find(c => (c.code || '').toUpperCase() === cData.code);
            if (!existingCourse) {
              await addDoc(collection(db, COLLECTIONS.COURSES), {
                code: cData.code,
                name: cData.name,
                departmentId: targetDeptId,
                departmentName: deptData.name,
                level: cData.level,
                durationYears: cData.durationYears,
                totalCredits: cData.totalCredits,
                createdAt: new Date().toISOString()
              });
              courseCount++;
            }
          }
        }
      }

      addToast(`Seeded ${createdCount} academic departments and ${courseCount} courses successfully!`, 'success');
    } catch (err) {
      console.error('Seeding error:', err);
      addToast('Error seeding default departments and courses.', 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  // Filtered Lists
  const filteredDepartments = departments.filter(d => {
    const q = searchQuery.toLowerCase();
    return (
      d.name?.toLowerCase().includes(q) ||
      d.code?.toLowerCase().includes(q) ||
      d.description?.toLowerCase().includes(q) ||
      d.hodName?.toLowerCase().includes(q)
    );
  });

  const filteredCourses = courses.filter(c => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = (
      c.name?.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q) ||
      c.departmentName?.toLowerCase().includes(q)
    );
    const matchesDept = selectedDeptFilter === 'all' || c.departmentId === selectedDeptFilter;
    return matchesQuery && matchesDept;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <Toast messages={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/20 text-white rounded-2xl border border-primary/30">
                <Building2 size={28} />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase">
                  Academic Departments
                </h1>
                <p className="text-slate-300 text-xs md:text-sm font-semibold mt-0.5">
                  Institutional Faculties, Academic Schools & Course Programs Directory
                </p>
              </div>
            </div>
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleSeedDefaults}
                disabled={isSeeding}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-2xl text-xs font-bold transition-all disabled:opacity-50"
              >
                <Sparkles size={16} className="text-amber-400" />
                <span>{isSeeding ? 'Seeding...' : 'Seed Standard Departments'}</span>
              </button>

              <button
                onClick={openNewDeptModal}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-2xl text-xs font-bold shadow-lg shadow-primary/25 transition-all"
              >
                <Plus size={18} />
                <span>Add Department</span>
              </button>
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Total Departments</p>
            <p className="text-2xl font-black text-white mt-1">{departments.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Total Course Programs</p>
            <p className="text-2xl font-black text-white mt-1">{courses.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Teaching Staff</p>
            <p className="text-2xl font-black text-white mt-1">{teachers.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Enrolled Students</p>
            <p className="text-2xl font-black text-white mt-1">{students.length}</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs & Search Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-sm w-fit">
          <button
            onClick={() => setActiveTab('departments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'departments'
                ? 'bg-primary text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building2 size={16} />
            <span>Departments ({departments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('courses')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'courses'
                ? 'bg-primary text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <GraduationCap size={16} />
            <span>Courses & Programs ({courses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('staff')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'staff'
                ? 'bg-primary text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users size={16} />
            <span>Department Staff ({teachers.length})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 md:max-w-xs">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search department or program..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary shadow-sm"
          />
        </div>
      </div>

      {/* TAB 1: DEPARTMENTS GRID */}
      {activeTab === 'departments' && (
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-sm font-semibold">
              Loading academic departments...
            </div>
          ) : filteredDepartments.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 mx-auto bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                <Building2 size={32} />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-lg font-bold text-slate-900">No Departments Found</h3>
                <p className="text-xs text-slate-600">
                  {searchQuery ? 'No departments match your search query.' : 'There are currently no academic departments configured.'}
                </p>
              </div>
              {canManage && (
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={handleSeedDefaults}
                    disabled={isSeeding}
                    className="px-4 py-2.5 bg-primary text-white text-xs font-bold rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all"
                  >
                    Seed Standard Departments
                  </button>
                  <button
                    onClick={openNewDeptModal}
                    className="px-4 py-2.5 bg-slate-100 text-slate-800 text-xs font-bold rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Add Custom Department
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDepartments.map((dept) => {
                const deptCourses = courses.filter(c => c.departmentId === dept.id);
                return (
                  <motion.div
                    key={dept.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 hover:border-primary/50 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group relative overflow-hidden shadow-sm"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-black uppercase tracking-wider">
                            {dept.code || 'DEPT'}
                          </span>
                          {dept.status === 'suspended' ? (
                            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                              <AlertOctagon size={12} /> Suspended
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 size={12} /> Active
                            </span>
                          )}
                        </div>

                        {canManage && (
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditDeptModal(dept)}
                              title="Edit Department"
                              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleToggleSuspendDepartment(dept)}
                              title={dept.status === 'suspended' ? "Reactivate Department" : "Suspend Department"}
                              className={`p-2 rounded-xl transition-all ${
                                dept.status === 'suspended'
                                  ? 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                                  : 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                              }`}
                            >
                              {dept.status === 'suspended' ? <PlayCircle size={15} /> : <PauseCircle size={15} />}
                            </button>
                            <button
                              onClick={() => handleDeleteDepartment(dept)}
                              title="Delete Department"
                              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors leading-snug">
                          {dept.name}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                          {dept.description || 'No description provided.'}
                        </p>
                      </div>

                      {/* HOD Tag */}
                      <div className="pt-2 flex items-center gap-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <UserCheck size={16} className="text-amber-500 shrink-0" />
                        <div className="overflow-hidden">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Head of Department (HOD)</p>
                          <p className="font-bold text-slate-900 truncate">{dept.hodName || 'Unassigned / Vacant'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <GraduationCap size={15} className="text-primary" />
                          <span>{deptCourses.length} Programs</span>
                        </span>
                        
                        {canManage && (
                          <button
                            onClick={() => openNewCourseModal(dept.id)}
                            className="text-primary hover:underline text-[11px] font-bold flex items-center gap-1"
                          >
                            <Plus size={14} />
                            <span>Add Program</span>
                          </button>
                        )}
                      </div>

                      {/* Preview course tags */}
                      {deptCourses.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {deptCourses.slice(0, 3).map(c => (
                            <span key={c.id} className="text-[10px] font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200">
                              {c.code || c.name}
                            </span>
                          ))}
                          {deptCourses.length > 3 && (
                            <span className="text-[10px] font-bold text-slate-500 px-2 py-1">
                              +{deptCourses.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COURSES & PROGRAMS */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase text-slate-600">Filter by Department:</span>
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-2xl px-4 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all" className="bg-white text-slate-900 font-semibold">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id} className="bg-white text-slate-900 font-semibold">{d.name}</option>
                ))}
              </select>
            </div>

            {canManage && (
              <button
                onClick={() => openNewCourseModal()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-2xl hover:bg-primary-hover transition-all shadow-md"
              >
                <Plus size={16} />
                <span>Add New Course</span>
              </button>
            )}
          </div>

          {filteredCourses.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 text-xs font-semibold shadow-sm">
              No course programs found for the selected filter.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                      <th className="p-4">Course Code</th>
                      <th className="p-4">Program Name</th>
                      <th className="p-4">Department</th>
                      <th className="p-4">Level</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Duration</th>
                      <th className="p-4">Credits</th>
                      {canManage && <th className="p-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-800">
                    {filteredCourses.map((course) => (
                      <tr key={course.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4">
                          <span className="font-mono font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                            {course.code || 'N/A'}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-900">{course.name}</td>
                        <td className="p-4 text-slate-600">{course.departmentName || 'General'}</td>
                        <td className="p-4">
                          <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-[10px] font-bold border border-blue-200">
                            {course.level}
                          </span>
                        </td>
                        <td className="p-4">
                          {course.status === 'suspended' ? (
                            <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-[10px] font-bold border border-amber-300 inline-flex items-center gap-1">
                              <AlertOctagon size={11} /> Suspended
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-300 inline-flex items-center gap-1">
                              <CheckCircle2 size={11} /> Active
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-slate-700">{course.durationYears} {course.durationYears === 1 ? 'Year' : 'Years'}</td>
                        <td className="p-4 text-slate-700">{course.totalCredits || 60} Units/Credits</td>
                        {canManage && (
                          <td className="p-4 text-right space-x-1.5">
                            <button
                              onClick={() => openEditCourseModal(course)}
                              title="Edit Course"
                              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleSuspendCourse(course)}
                              title={course.status === 'suspended' ? "Reactivate Course" : "Suspend Course"}
                              className={`p-1.5 rounded-lg transition-all ${
                                course.status === 'suspended'
                                  ? 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                                  : 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                              }`}
                            >
                              {course.status === 'suspended' ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                            </button>
                            <button
                              onClick={() => handleDeleteCourse(course)}
                              title="Delete Course"
                              className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DEPARTMENT STAFF ROSTER */}
      {activeTab === 'staff' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users size={18} className="text-primary" />
              <span>Teaching & Academic Staff Roster</span>
            </h3>
            <p className="text-xs text-slate-600">
              Staff members and their assigned academic departments and faculties.
            </p>

            {teachers.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs font-semibold">
                No teaching staff currently registered in system.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {teachers.map((teacher) => (
                  <div key={teacher.uid} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-900">{teacher.name || teacher.displayName || teacher.email}</p>
                      <p className="text-[11px] font-semibold text-slate-600">{teacher.course || 'Department Unassigned'}</p>
                      <p className="text-[10px] text-slate-500 capitalize">{teacher.role || 'Teacher'}</p>
                    </div>
                    <span className="p-2 bg-primary/10 text-primary rounded-xl">
                      <UserCheck size={18} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: ADD/EDIT DEPARTMENT */}
      <AnimatePresence>
        {isDeptModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-6 shadow-2xl relative text-slate-900"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">
                  {editingDept ? 'Edit Academic Department' : 'Add Academic Department'}
                </h2>
                <button
                  onClick={() => setIsDeptModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveDepartment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Department Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value)}
                    placeholder="e.g. THS, ICT, EEE"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Department Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder="e.g. Department of Theological Studies & Christian Ministry"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Head of Department (HOD)
                  </label>
                  <select
                    value={deptHodId}
                    onChange={(e) => setDeptHodId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  >
                    <option value="" className="bg-white text-slate-900 font-semibold">Select HOD from Staff Roster...</option>
                    {teachers.map(t => (
                      <option key={t.uid} value={t.uid} className="bg-white text-slate-900 font-semibold">
                        {t.name || t.displayName || t.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Department Status
                  </label>
                  <select
                    value={deptStatus}
                    onChange={(e) => setDeptStatus(e.target.value as 'active' | 'suspended')}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  >
                    <option value="active" className="bg-white text-slate-900 font-semibold">Active</option>
                    <option value="suspended" className="bg-white text-slate-900 font-semibold">Suspended</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Description & Overview
                  </label>
                  <textarea
                    rows={3}
                    value={deptDescription}
                    onChange={(e) => setDeptDescription(e.target.value)}
                    placeholder="Brief description of the department's core focus and curriculum..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsDeptModalOpen(false)}
                    className="px-5 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded-2xl text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-primary text-white rounded-2xl text-xs font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
                  >
                    Save Department
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL 2: ADD/EDIT COURSE */}
      <AnimatePresence>
        {isCourseModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-6 shadow-2xl relative text-slate-900"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">
                  {editingCourse ? 'Edit Course Program' : 'Add Course Program'}
                </h2>
                <button
                  onClick={() => setIsCourseModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveCourse} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Department *
                  </label>
                  <select
                    required
                    value={courseDeptId}
                    onChange={(e) => setCourseDeptId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  >
                    <option value="" className="bg-white text-slate-900 font-semibold">Select Department...</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id} className="bg-white text-slate-900 font-semibold">{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Course Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={courseCode}
                      onChange={(e) => setCourseCode(e.target.value)}
                      placeholder="e.g. DTCM, DICT"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Level *
                    </label>
                    <select
                      value={courseLevel}
                      onChange={(e) => setCourseLevel(e.target.value as ProgramLevel)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    >
                      <option value="Certificate" className="bg-white text-slate-900 font-semibold">Certificate</option>
                      <option value="Diploma" className="bg-white text-slate-900 font-semibold">Diploma</option>
                      <option value="Higher Diploma" className="bg-white text-slate-900 font-semibold">Higher Diploma</option>
                      <option value="Short Course" className="bg-white text-slate-900 font-semibold">Short Course</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Course Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="e.g. Diploma in Theology & Christian Ministry"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Duration (Years)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={courseDuration}
                      onChange={(e) => setCourseDuration(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Total Credits / Units
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={courseCredits}
                      onChange={(e) => setCourseCredits(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Program Status
                  </label>
                  <select
                    value={courseStatus}
                    onChange={(e) => setCourseStatus(e.target.value as 'active' | 'suspended')}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  >
                    <option value="active" className="bg-white text-slate-900 font-semibold">Active</option>
                    <option value="suspended" className="bg-white text-slate-900 font-semibold">Suspended</option>
                  </select>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCourseModalOpen(false)}
                    className="px-5 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded-2xl text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-primary text-white rounded-2xl text-xs font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
                  >
                    Save Course
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200"
            >
              <div className="flex items-center gap-3 text-rose-600 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                  <Trash2 size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Delete {deleteTarget.type === 'department' ? 'Department' : 'Course'}?
                </h3>
              </div>
              <p className="text-sm text-slate-600 mb-6">
                Are you sure you want to permanently delete <strong className="text-slate-900">{deleteTarget.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-5 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-2xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteTarget}
                  className="px-6 py-2.5 bg-rose-600 text-white rounded-2xl text-xs font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
                >
                  Yes, Delete Permanently
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Departments;

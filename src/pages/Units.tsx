import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, query, where, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { Class, Unit } from '../types';
import { Plus, Trash2, BookOpen, X, CheckCircle, XCircle, Edit2, ClipboardCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { Toast, ToastMessage } from '../components/Toast';

export const Units: React.FC = () => {
  const { user, userData, hasPermission } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [newUnitName, setNewUnitName] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [newUnitStatus, setNewUnitStatus] = useState<'active' | 'completed' | 'archived'>('active');
  const [isAdding, setIsAdding] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSeedingModalOpen, setIsSeedingModalOpen] = useState(false);
  const [seedingClassId, setSeedingClassId] = useState('');
  const [seedingCourseType, setSeedingCourseType] = useState<'ict' | 'cosmetology' | 'electrical'>('ict');

  const curriculumOptions = {
    ict: {
      name: "ICT & Business Management",
      units: [
        "Introduction to ICT", 
        "Principles of Management", 
        "Financial Accounting", 
        "Business Law", 
        "Quantitative Methods", 
        "Macroeconomics", 
        "Microeconomics", 
        "Business Communication", 
        "Human Resource Management",
        "Marketing Management", 
        "Organizational Behavior", 
        "Management Information Systems",
        "Entrepreneurship"
      ]
    },
    cosmetology: {
      name: "Cosmetology, Hairdressing & Beauty Therapy",
      units: [
        "Beauty therapy theory",
        "Beauty therapy practicle",
        "Hairdressing theory",
        "Hairdressing practicle",
        "Enterprenurship",
        "Communication skills"
      ]
    },
    electrical: {
      name: "Certificate in Electrical and Electronics Technology",
      units: [
        "EET 101: Introduction to Electrical and Electronics Engineering",
        "EET 102: Engineering Mathematics",
        "EET 103: Engineering Science",
        "EET 104: Electrical Safety and First Aid",
        "EET 105: Electrical Workshop Practice I",
        "EET 106: Basic Electrical Installation",
        "EET 107: Electrical Measurements and Instruments",
        "EET 108: Computer Applications",
        "EET 201: Basic Electronics",
        "EET 202: Electronic Components and Circuits",
        "EET 203: Electrical Machines",
        "EET 204: Motor Control and Protection",
        "EET 205: Solar Photovoltaic Systems",
        "EET 206: Electrical Testing and Fault Diagnosis",
        "EET 207: Entrepreneurship Education",
        "EET 208: Industrial Attachment / Final Practical Project"
      ]
    }
  };

  const addToast = (text: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const canManageUnits = hasPermission('manage_units');
  const isTeacher = userData?.role === 'teacher';

  useEffect(() => {
    if (!user) return;

    const fetchUnitsAndClasses = async () => {
      try {
        const unitsQ = query(collection(db, 'units'));
        const unitsSnap = await getDocs(unitsQ);
        setUnits(unitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));

        const classesQ = (isTeacher || userData?.role === 'admin')
          ? query(collection(db, 'classes'))
          : query(collection(db, 'classes'));

        const classesSnap = await getDocs(classesQ);
        const loadedClasses = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
        setClasses(loadedClasses);
        if (loadedClasses.length > 0) {
          setSeedingClassId(loadedClasses[0].id);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'data');
      }
    };

    fetchUnitsAndClasses();
  }, [user, isTeacher, userData?.role]);

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim() || !selectedClassId) return;

    try {
      if (editingUnit) {
        await updateDoc(doc(db, 'units', editingUnit.id), {
          name: newUnitName,
          classId: selectedClassId,
          status: newUnitStatus,
          updatedAt: new Date().toISOString()
        });
        setUnits(prev => prev.map(u => u.id === editingUnit.id ? { ...u, name: newUnitName, classId: selectedClassId, status: newUnitStatus } : u));
        addToast("Unit updated successfully!");
      } else {
        const docRef = await addDoc(collection(db, 'units'), {
          name: newUnitName,
          classId: selectedClassId,
          status: 'active',
          createdAt: new Date().toISOString()
        });
        setUnits(prev => [...prev, { id: docRef.id, name: newUnitName, classId: selectedClassId, status: 'active' }]);
        addToast("Unit added successfully!");
      }
      setNewUnitName('');
      setSelectedClassId('');
      setEditingUnit(null);
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, editingUnit ? OperationType.UPDATE : OperationType.CREATE, 'units');
      addToast(editingUnit ? "Failed to update unit" : "Failed to add unit", "error");
    }
  };

  const openEditModal = (unit: Unit) => {
    setEditingUnit(unit);
    setNewUnitName(unit.name);
    setSelectedClassId(unit.classId);
    setNewUnitStatus(unit.status || 'active');
    setIsAdding(true);
  };

  const handleBulkGenerate = async () => {
    const targetClassId = seedingClassId || (classes.length > 0 ? classes[0].id : null);
    
    if (!targetClassId) {
      addToast("Please select a target class", "error");
      return;
    }

    const selectedCurriculum = curriculumOptions[seedingCourseType];
    if (!confirm(`This will add ${selectedCurriculum.units.length} standard curriculum units for "${selectedCurriculum.name}" to the selected class. Continue?`)) return;

    setIsGenerating(true);
    try {
      const addedUnits: Unit[] = [];
      for (const unitName of selectedCurriculum.units) {
        const docRef = await addDoc(collection(db, 'units'), {
          name: unitName,
          classId: targetClassId,
          status: 'active',
          createdAt: new Date().toISOString()
        });
        addedUnits.push({
          id: docRef.id,
          name: unitName,
          classId: targetClassId,
          status: 'active'
        });
      }
      setUnits(prev => [...prev, ...addedUnits]);
      addToast(`Successfully added ${selectedCurriculum.units.length} ${selectedCurriculum.name} units!`);
      setIsSeedingModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'units');
      addToast("Failed to bulk add units", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteUnit = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'units', id));
      setUnits(prev => prev.filter(u => u.id !== id));
      addToast("Unit deleted successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `units/${id}`);
      addToast("Failed to delete unit", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Units</h1>
          <p className="text-text-muted text-xs font-bold uppercase tracking-widest mt-1">Manage academic units and assignments</p>
        </div>
        {canManageUnits && (
          <div className="flex gap-3">
            <button
              onClick={() => setIsSeedingModalOpen(true)}
              className="flex items-center gap-2 bg-amber-500/10 text-amber-500 px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-amber-500 hover:text-white transition-all border border-amber-500/20"
            >
              <BookOpen size={18} />
              Seed Curriculum
            </button>
            <button
              onClick={() => {
                setEditingUnit(null);
                setNewUnitName('');
                setSelectedClassId('');
                setIsAdding(true);
              }}
              className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary-hover transition-all shadow-xl shadow-primary/20"
            >
              <Plus size={18} />
              Add Unit
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {units.map((unit, idx) => (
          <motion.div 
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            key={`${unit.id || 'unit'}_${idx}`} 
            className="bg-bg-card p-8 rounded-[32px] border border-white/5 shadow-xl transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 -tranzlate-y-1/2 translate-x-1/2 w-24 h-24 bg-primary/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div className="bg-primary/10 p-4 rounded-2xl text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-500">
                <BookOpen size={24} />
              </div>
              {canManageUnits && (
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(unit)}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => deleteUnit(unit.id)}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
            
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-text-primary mb-2 tracking-tight">{unit.name}</h3>
              <div className="flex items-center gap-2 text-text-muted mb-6">
                <div className="w-1 h-1 rounded-full bg-primary" />
                <p className="text-xs font-bold uppercase tracking-widest">
                  {classes.find(c => c.id === unit.classId)?.name || 'General Class'}
                </p>
              </div>
              
              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full ${unit.status === 'completed' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                  {unit.status || 'Active'}
                </span>
                <div className="flex gap-4">
                  {(userData?.role === 'teacher' || userData?.role === 'admin') && (
                    <Link
                      to="/marks"
                      state={{ prefillUnitId: unit.id, prefillClassId: unit.classId }}
                      className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest hover:underline"
                    >
                      <ClipboardCheck size={14} />
                      Record Marks
                    </Link>
                  )}
                  <button className="text-secondary font-bold text-xs uppercase tracking-widest hover:underline">Details</button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        {units.length === 0 && (
          <div className="col-span-full py-20 text-center bg-bg-card rounded-[40px] border-2 border-dashed border-white/5">
            <div className="w-16 h-16 bg-white/5 rounded-2xl shadow-sm inline-flex items-center justify-center text-text-muted mb-4">
              <BookOpen size={32} />
            </div>
            <h3 className="text-lg font-bold text-text-primary uppercase">No units found</h3>
            <p className="text-text-muted text-sm">Units will appear here once they are added to classes.</p>
          </div>
        )}
      </div>

      {/* Add Unit Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsAdding(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-bg-card border border-white/5 rounded-[40px] p-10 w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 -tranzlate-y-1/2 translate-x-1/2 w-48 h-48 bg-primary/10 rounded-full blur-3xl opacity-50" />
              
              <div className="flex justify-between items-center mb-8 relative z-10">
                <h2 className="text-2xl font-bold text-text-primary tracking-tight uppercase">
                  {editingUnit ? 'Edit Unit' : 'Add New Unit'}
                </h2>
                <button 
                  onClick={() => setIsAdding(false)} 
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleAddUnit} className="space-y-6 relative z-10">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Unit Name</label>
                  <input
                    type="text"
                    required
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    placeholder="e.g. Introduction into ICT"
                    className="w-full bg-white/5 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 placeholder:text-text-muted ring-1 ring-white/10 focus:ring-4 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Assign to Class</label>
                  <select
                    required
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full bg-white/5 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 ring-1 ring-white/10 focus:ring-4 focus:ring-primary/20 transition-all outline-none appearance-none"
                  >
                    <option value="" className="bg-bg-card">Select Class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id} className="bg-bg-card">{c.name}</option>
                    ))}
                  </select>
                </div>

                {editingUnit && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Status</label>
                    <select
                      required
                      value={newUnitStatus}
                      onChange={(e) => setNewUnitStatus(e.target.value as 'active' | 'completed')}
                      className="w-full bg-white/5 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 ring-1 ring-white/10 focus:ring-4 focus:ring-primary/20 transition-all outline-none appearance-none"
                    >
                      <option value="active" className="bg-bg-card">Active</option>
                      <option value="completed" className="bg-bg-card">Completed</option>
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-primary text-white font-bold py-5 rounded-2xl hover:bg-primary-hover transition-all shadow-xl shadow-primary/20 uppercase text-xs tracking-widest active:scale-95 mt-4"
                >
                  {editingUnit ? 'Update Unit' : 'Create Unit'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Seed Curriculum Modal */}
      <AnimatePresence>
        {isSeedingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsSeedingModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-bg-card border border-white/5 rounded-[40px] p-10 w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl opacity-50" />
              
              <div className="flex justify-between items-center mb-8 relative z-10">
                <h2 className="text-2xl font-bold text-text-primary tracking-tight uppercase flex items-center gap-2">
                  <BookOpen size={24} className="text-amber-500" />
                  Seed Curriculum
                </h2>
                <button 
                  onClick={() => setIsSeedingModalOpen(false)} 
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-6 relative z-10">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Target Class</label>
                  <select
                    required
                    value={seedingClassId}
                    onChange={(e) => setSeedingClassId(e.target.value)}
                    className="w-full bg-white/5 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 ring-1 ring-white/10 focus:ring-4 focus:ring-primary/20 transition-all outline-none appearance-none"
                  >
                    <option value="" className="bg-bg-card">Select Class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id} className="bg-bg-card">{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Course Curriculum</label>
                  <select
                    required
                    value={seedingCourseType}
                    onChange={(e) => setSeedingCourseType(e.target.value as any)}
                    className="w-full bg-white/5 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 ring-1 ring-white/10 focus:ring-4 focus:ring-primary/20 transition-all outline-none appearance-none"
                  >
                    <option value="ict" className="bg-bg-card">ICT & Business Management (13 Units)</option>
                    <option value="cosmetology" className="bg-bg-card">Cosmetology, Hairdressing & Beauty Therapy (10 Units)</option>
                    <option value="electrical" className="bg-bg-card">Certificate in Electrical and Electronics Technology (16 Units)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Units Preview</label>
                  <div className="max-h-48 overflow-y-auto bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-1.5">
                    {curriculumOptions[seedingCourseType].units.map((unitName, index) => (
                      <div key={index} className="flex items-center gap-2.5 text-xs text-gray-700 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {unitName}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleBulkGenerate}
                  disabled={isGenerating || !seedingClassId}
                  className="w-full bg-amber-500 text-white font-bold py-5 rounded-2xl hover:bg-amber-600 transition-all shadow-xl shadow-amber-500/20 uppercase text-xs tracking-widest active:scale-95 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? 'Generating Units...' : `Seed ${curriculumOptions[seedingCourseType].units.length} Units`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <Toast messages={toasts} onRemove={removeToast} />
    </div>
  );
};

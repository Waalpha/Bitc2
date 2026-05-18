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
  const [newUnitStatus, setNewUnitStatus] = useState<'active' | 'completed'>('active');
  const [isAdding, setIsAdding] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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
        setClasses(classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'data');
      }
    };

    fetchUnitsAndClasses();
  }, [user, isTeacher]);

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
        addToast("Unit updated successfully!");
      } else {
        await addDoc(collection(db, 'units'), {
          name: newUnitName,
          classId: selectedClassId,
          status: 'active',
          createdAt: new Date().toISOString()
        });
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
    if (!selectedClassId && classes.length > 0) {
      // Just pick the first class if none selected
      setSelectedClassId(classes[0].id);
    }
    
    const targetClassId = selectedClassId || (classes.length > 0 ? classes[0].id : null);
    
    if (!targetClassId) {
      addToast("Please create a class first", "error");
      return;
    }

    if (!confirm("This will add 13 typical academic units to the selected class. Continue?")) return;

    setIsGenerating(true);
    const typicalUnits = [
      "Introduction to ICT", "Principles of Management", "Financial Accounting", 
      "Business Law", "Quantitative Methods", "Macroeconomics", 
      "Microeconomics", "Business Communication", "Human Resource Management",
      "Marketing Management", "Organizational Behavior", "Management Information Systems",
      "Entrepreneurship"
    ];

    try {
      for (const unitName of typicalUnits) {
        await addDoc(collection(db, 'units'), {
          name: unitName,
          classId: targetClassId,
          status: 'active',
          createdAt: new Date().toISOString()
        });
      }
      addToast("Successfully added 13 academic units!");
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
              onClick={handleBulkGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 bg-amber-500/10 text-amber-500 px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-amber-500 hover:text-white transition-all border border-amber-500/20 disabled:opacity-50"
            >
              <Plus size={18} />
              {isGenerating ? 'Adding...' : 'Seed 13 Units'}
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
        {units.map((unit) => (
          <motion.div 
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            key={unit.id} 
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
      <Toast messages={toasts} onRemove={removeToast} />
    </div>
  );
};

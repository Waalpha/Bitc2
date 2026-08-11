import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where, addDoc, doc, updateDoc, deleteDoc, getDocs, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { Class, Unit, User, FeeBalance } from '../types';
import { Plus, Trash2, Users, BookOpen, UserPlus, X, CheckCircle, XCircle, Wallet, Edit2, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { Toast, ToastMessage } from '../components/Toast';

export const Classes: React.FC = () => {
  const { user, userData, hasPermission } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [newLatitude, setNewLatitude] = useState('');
  const [newLongitude, setNewLongitude] = useState('');
  const [newRadius, setNewRadius] = useState('100');
  const [editClassName, setEditClassName] = useState('');
  const [editTeacherId, setEditTeacherId] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editLatitude, setEditLatitude] = useState('');
  const [editLongitude, setEditLongitude] = useState('');
  const [editRadius, setEditRadius] = useState('100');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [initialSubjectName, setInitialSubjectName] = useState('');
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [isEditingClass, setIsEditingClass] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [feeBalances, setFeeBalances] = useState<FeeBalance[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (text: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const role = userData?.role?.toLowerCase();
  const isTeacher = role === 'teacher' || role === 'staff' || hasPermission('classes.view') || hasPermission('classes.manage') || hasPermission('manage_classes');
  const isAdmin = ['admin', 'school_admin', 'super_admin'].includes(role || '') || hasPermission('classes.manage') || hasPermission('manage_classes');
  const canManageClasses = isAdmin || isTeacher || hasPermission('classes.manage') || hasPermission('manage_classes');
  const canManageUnits = hasPermission('manage_units') || hasPermission('units.manage');

  useEffect(() => {
    if (!user) return;

    const fetchClassesAndTeachers = async () => {
      try {
        const q = (isTeacher || isAdmin)
          ? query(collection(db, 'classes'))
          : query(collection(db, 'classes'));

        const classesSnap = await getDocs(q);
        setClasses(classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));

        // Fetch teachers for admin selection
        const teachersQ = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const teachersSnap = await getDocs(teachersQ);
        setTeachers(teachersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));

        const balancesSnap = await getDocs(collection(db, 'fees'));
        setFeeBalances(balancesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeeBalance)));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'data');
      }
    };

    fetchClassesAndTeachers();
  }, [user, isTeacher]);

  const fetchStudentsAndUnits = async () => {
    if (!selectedClass) return;
    try {
      // Fetch students
      const studentsQ = query(collection(db, 'users'), where('classIds', 'array-contains', selectedClass.id));
      const studentsSnap = await getDocs(studentsQ);
      setStudents(studentsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));

      // Fetch units
      const unitsQ = query(collection(db, 'units'), where('classId', '==', selectedClass.id));
      const unitsSnap = await getDocs(unitsQ);
      setUnits(unitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'class-details');
    }
  };

  useEffect(() => {
    fetchStudentsAndUnits();
  }, [selectedClass]);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      addToast("Permission denied: Only admin can add classes", "error");
      return;
    }
    if (!newClassName.trim() || !user) return;
    
    const teacherId = selectedTeacherId || user.uid;

    try {
      const batch = writeBatch(db);
      const classRef = doc(collection(db, 'classes'));
      
      batch.set(classRef, {
        name: newClassName,
        teacherId: teacherId,
        startTime: newStartTime || null,
        endTime: newEndTime || null,
        latitude: newLatitude ? parseFloat(newLatitude) : null,
        longitude: newLongitude ? parseFloat(newLongitude) : null,
        radius: newRadius ? parseFloat(newRadius) : 100,
        createdAt: new Date().toISOString()
      });

      if (initialSubjectName.trim()) {
        const courseRef = doc(collection(db, 'units'));
        batch.set(courseRef, {
          name: initialSubjectName.trim(),
          classId: classRef.id,
        });
      }

      await batch.commit();
      
      setNewClassName('');
      setSelectedTeacherId('');
      setInitialSubjectName('');
      setNewLatitude('');
      setNewLongitude('');
      setNewRadius('100');
      setIsAddingClass(false);
      addToast("Class added successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'classes');
      addToast("Failed to add class", "error");
    }
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      addToast("Permission denied: Only admin can update classes", "error");
      return;
    }
    if (!editingClass || !editClassName.trim()) return;

    try {
      await updateDoc(doc(db, 'classes', editingClass.id), {
        name: editClassName.trim(),
        teacherId: editTeacherId || editingClass.teacherId,
        startTime: editStartTime || null,
        endTime: editEndTime || null,
        latitude: editLatitude ? parseFloat(editLatitude) : null,
        longitude: editLongitude ? parseFloat(editLongitude) : null,
        radius: editRadius ? parseFloat(editRadius) : 100
      });
      
      if (selectedClass?.id === editingClass.id) {
        setSelectedClass({ 
          ...selectedClass, 
          name: editClassName.trim(), 
          teacherId: editTeacherId || editingClass.teacherId,
          startTime: editStartTime || null,
          endTime: editEndTime || null,
          latitude: editLatitude ? parseFloat(editLatitude) : null,
          longitude: editLongitude ? parseFloat(editLongitude) : null,
          radius: editRadius ? parseFloat(editRadius) : 100
        });
      }

      setIsEditingClass(false);
      setEditingClass(null);
      addToast("Class updated successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `classes/${editingClass.id}`);
      addToast("Failed to update class", "error");
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!isAdmin) {
      addToast("Permission denied: Only admin can delete classes", "error");
      return;
    }
    try {
      await deleteDoc(doc(db, 'classes', id));
      if (selectedClass?.id === id) setSelectedClass(null);
      addToast("Class deleted successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `classes/${id}`);
      addToast("Failed to delete class", "error");
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      addToast("Permission denied: Only admin can assign students", "error");
      return;
    }
    if (!studentEmail.trim() || !selectedClass) return;

    try {
      const q = query(collection(db, 'users'), where('email', '==', studentEmail.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        addToast(`No user found with email ${studentEmail}`, "error");
        return;
      }

      const studentDoc = querySnapshot.docs[0];
      const studentData = studentDoc.data() as User;

      if (studentData.role !== 'student') {
        addToast("Only users with the 'student' role can be added to a class", "error");
        return;
      }

      if (studentData.classIds && studentData.classIds.includes(selectedClass.id)) {
        addToast("Student is already in this class", "error");
        return;
      }

      await updateDoc(doc(db, 'users', studentDoc.id), {
        classIds: arrayUnion(selectedClass.id)
      });

      addToast(`Added ${studentData.name || studentEmail} to ${selectedClass.name}`);
      setIsAddingStudent(false);
      setStudentEmail('');
      fetchStudentsAndUnits();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
      addToast("Failed to add student", "error");
    }
  };

  const handleRemoveStudent = async (studentUid: string) => {
    if (!selectedClass) return;
    if (!isAdmin) {
      addToast("Permission denied: Only admin can unassign students", "error");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', studentUid), {
        classIds: arrayRemove(selectedClass.id)
      });
      addToast("Student removed from class");
      fetchStudentsAndUnits();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${studentUid}`);
      addToast("Failed to remove student", "error");
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    try {
      await deleteDoc(doc(db, 'units', unitId));
      addToast("Unit deleted successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `units/${unitId}`);
      addToast("Failed to delete unit", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Manage Classes</h1>
        {canManageClasses && (
          <button
            onClick={() => setIsAddingClass(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Add Class
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Classes List */}
        <div className="md:col-span-1 space-y-4">
          {classes.map((cls) => (
            <div
              key={cls.id}
              onClick={() => setSelectedClass(cls)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedClass?.id === cls.id
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-blue-300'
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Users className={selectedClass?.id === cls.id ? 'text-blue-600' : 'text-gray-400'} />
                  <span className="font-semibold text-gray-900">{cls.name}</span>
                </div>
                {canManageClasses && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingClass(cls);
                        setEditClassName(cls.name);
                        setEditTeacherId(cls.teacherId);
                        setEditStartTime(cls.startTime || '');
                        setEditEndTime(cls.endTime || '');
                        setEditLatitude(cls.latitude?.toString() || '');
                        setEditLongitude(cls.longitude?.toString() || '');
                        setEditRadius(cls.radius?.toString() || '100');
                        setIsEditingClass(true);
                      }}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit class"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete class "${cls.name}"? This action cannot be undone.`)) {
                          handleDeleteClass(cls.id);
                        }
                      }}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete class"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {classes.length === 0 && (
            <p className="text-gray-500 text-center py-8">No classes found.</p>
          )}
        </div>

        {/* Selected Class Details */}
        <div className="md:col-span-2">
          {selectedClass ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedClass.name}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded">
                      Class Room
                    </span>
                    {selectedClass.startTime && (
                      <span className="text-xs font-bold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {selectedClass.startTime} - {selectedClass.endTime}
                      </span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setIsAddingStudent(true)}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <UserPlus size={18} />
                      Add Student
                    </button>
                  </div>
                )}
              </div>
              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Students Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Students</h3>
                  <div className="space-y-6">
                    {(() => {
                      const now = new Date();
                      const currentYear = now.getFullYear();
                      const currentMonth = now.getMonth();

                      const overpaid: { student: User; balance?: FeeBalance }[] = [];
                      const paidThisMonth: { student: User; balance?: FeeBalance }[] = [];
                      const outstanding: { student: User; balance?: FeeBalance }[] = [];

                      students.forEach(student => {
                        const balance = feeBalances.find(b => b.studentId === student.uid);
                        const hasPaidThisMonth = balance?.history?.some(h => {
                          if (h.type !== 'payment') return false;
                          const d = new Date(h.date);
                          return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
                        }) || false;

                        if (balance && balance.balance < 0) {
                          overpaid.push({ student, balance });
                        } else if (hasPaidThisMonth) {
                          paidThisMonth.push({ student, balance });
                        } else {
                          outstanding.push({ student, balance });
                        }
                      });

                      if (students.length === 0) {
                        return <p className="text-gray-500 text-center py-4">No students enrolled in this class.</p>;
                      }

                      return (
                        <>
                          {/* Overpaid Section */}
                          <div className="border border-sky-100 bg-sky-50/10 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2 border-b border-sky-100 pb-1">
                              <span className="text-xs font-bold uppercase tracking-wider text-sky-600 flex items-center gap-1.5">
                                <CheckCircle size={14} className="text-sky-500" />
                                Overpaid / Credit ({overpaid.length})
                              </span>
                            </div>
                            <div className="space-y-2">
                              {overpaid.map(({ student, balance }) => (
                                <div key={student.uid} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-sky-100/60 shadow-2xs group hover:border-sky-300 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 text-xs font-bold">
                                      {(student?.name || 'S').charAt(0)}
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">{student?.name || 'Unknown Student'}</p>
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs text-gray-500">{student.email}</p>
                                        {balance && (
                                          <span className="text-xs font-extrabold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">
                                            Credit: Ksh {Math.abs(balance.balance)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {balance && (
                                      <div className="hidden group-hover:flex items-center gap-1 text-xs font-bold text-gray-400">
                                        Paid: Ksh {balance.paidAmount}
                                      </div>
                                    )}
                                    {isAdmin && (
                                      <button
                                        onClick={() => handleRemoveStudent(student.uid)}
                                        className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                        title="Remove from class"
                                      >
                                        <X size={16} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {overpaid.length === 0 && (
                                <p className="text-xs text-gray-400 italic py-1">No overpaid students in this class.</p>
                              )}
                            </div>
                          </div>

                          {/* Paid This Month Section */}
                          <div className="border border-emerald-100 bg-emerald-50/10 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2 border-b border-emerald-100 pb-1">
                              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                                <CheckCircle size={14} className="text-emerald-500" />
                                Paid This Month ({paidThisMonth.length})
                              </span>
                            </div>
                            <div className="space-y-2">
                              {paidThisMonth.map(({ student, balance }) => (
                                <div key={student.uid} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-emerald-100/60 shadow-2xs group hover:border-emerald-300 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold">
                                      {(student?.name || 'S').charAt(0)}
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">{student?.name || 'Unknown Student'}</p>
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs text-gray-500">{student.email}</p>
                                        {balance && (
                                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                            Bal: Ksh {balance.balance}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {balance && (
                                      <div className="hidden group-hover:flex items-center gap-1 text-xs font-bold text-gray-400">
                                        Paid: Ksh {balance.paidAmount}
                                      </div>
                                    )}
                                    {isAdmin && (
                                      <button
                                        onClick={() => handleRemoveStudent(student.uid)}
                                        className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                        title="Remove from class"
                                      >
                                        <X size={16} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {paidThisMonth.length === 0 && (
                                <p className="text-xs text-gray-400 italic py-1">No payments made this month.</p>
                              )}
                            </div>
                          </div>

                          {/* Pending / Outstanding Section */}
                          <div className="border border-rose-100 bg-rose-50/5 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2 border-b border-rose-100 pb-1">
                              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                                <XCircle size={14} className="text-rose-400" />
                                Outstanding / Unpaid This Month ({outstanding.length})
                              </span>
                            </div>
                            <div className="space-y-2">
                              {outstanding.map(({ student, balance }) => (
                                <div key={student.uid} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-rose-100/40 shadow-2xs group hover:border-rose-300 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-700 text-xs font-bold">
                                      {(student?.name || 'S').charAt(0)}
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">{student?.name || 'Unknown Student'}</p>
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs text-gray-500">{student.email}</p>
                                        {balance && (
                                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${balance.balance > 0 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-gray-50 text-gray-600'}`}>
                                            Bal: Ksh {balance.balance}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {balance && (
                                      <div className="hidden group-hover:flex items-center gap-1 text-xs font-bold text-gray-400">
                                        Paid: Ksh {balance.paidAmount}
                                      </div>
                                    )}
                                    {isAdmin && (
                                      <button
                                        onClick={() => handleRemoveStudent(student.uid)}
                                        className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                        title="Remove from class"
                                      >
                                        <X size={16} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {outstanding.length === 0 && (
                                <p className="text-xs text-gray-400 italic py-1">No outstanding balances.</p>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Units Section */}
                <div className="space-y-8">
                  {/* Additional Unit Info Section */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Additional Unit Info</h3>
                      {(isTeacher || isAdmin) && (
                        <button
                          onClick={() => {
                            const unitName = prompt("Enter unit name (e.g. Science, Arts):");
                            if (unitName && selectedClass) {
                              const updatedUnits = [...(selectedClass.unitIds || []), unitName];
                              updateDoc(doc(db, 'classes', selectedClass.id), {
                                unitIds: updatedUnits
                              }).then(() => {
                                addToast(`Unit ${unitName} added!`);
                              }).catch(err => {
                                handleFirestoreError(err, OperationType.UPDATE, `classes/${selectedClass.id}`);
                                addToast("Failed to add unit", "error");
                              });
                            }
                          }}
                          className="text-xs font-bold text-blue-600 hover:underline uppercase tracking-tighter"
                        >
                          + Add Unit
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedClass.unitIds?.map((unitName, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl group/sec">
                          <span className="text-sm font-bold text-gray-700">{unitName}</span>
                          {(isTeacher || isAdmin) && (
                            <button
                              onClick={() => {
                                if (confirm(`Remove unit ${unitName}?`)) {
                                  const updatedUnits = selectedClass.unitIds?.filter((_, i) => i !== idx);
                                  updateDoc(doc(db, 'classes', selectedClass.id), {
                                    unitIds: updatedUnits
                                  }).then(() => {
                                    addToast("Unit removed");
                                  });
                                }
                              }}
                              className="text-gray-400 hover:text-red-500 opacity-0 group-hover/sec:opacity-100 transition-opacity"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      {(!selectedClass.unitIds || selectedClass.unitIds.length === 0) && (
                        <p className="text-xs text-gray-400 font-medium italic">No units defined yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Units List Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Units List</h3>
                  <div className="space-y-3">
                    {units.map((unit) => (
                      <div key={unit.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                            <BookOpen size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{unit.name}</p>
                          </div>
                        </div>
                        {canManageUnits && (
                          <button
                            onClick={() => handleDeleteUnit(unit.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete unit"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                    {units.length === 0 && (
                      <p className="text-gray-500 text-center py-4">No units assigned to this class.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12">
              <Users size={48} className="mb-4 opacity-20" />
              <p>Select a class to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Class Modal */}
      <AnimatePresence>
        {isAddingClass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsAddingClass(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Add New Class</h2>
                <button onClick={() => setIsAddingClass(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleAddClass} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                  <input
                    type="text"
                    required
                    value={newClassName || ''}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="e.g. Grade 10 - Science"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                  />
                </div>
                
                {!isTeacher && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign Teacher</label>
                    <select
                      value={selectedTeacherId || ''}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                    >
                      <option value="">Select a teacher (Default: You)</option>
                      {teachers.map(teacher => (
                        <option key={teacher.uid} value={teacher.uid}>
                          {teacher.name} ({teacher.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={newStartTime || ''}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input
                      type="time"
                      value={newEndTime || ''}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                    />
                  </div>
                </div>



                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Initial Unit (Optional)</label>
                  <input
                    type="text"
                    value={initialSubjectName || ''}
                    onChange={(e) => setInitialSubjectName(e.target.value)}
                    placeholder="e.g. Mathematics"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">Create the first unit for this class immediately.</p>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Class
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Class Modal */}
      <AnimatePresence>
        {isEditingClass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsEditingClass(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Edit Class</h2>
                <button onClick={() => setIsEditingClass(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleUpdateClass} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                  <input
                    type="text"
                    required
                    value={editClassName || ''}
                    onChange={(e) => setEditClassName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                  />
                </div>
                
                {!isTeacher && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign Teacher</label>
                    <select
                      value={editTeacherId || ''}
                      onChange={(e) => setEditTeacherId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                    >
                      <option value="">Select a teacher</option>
                      {teachers.map(teacher => (
                        <option key={teacher.uid} value={teacher.uid}>
                          {teacher.name} ({teacher.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={editStartTime || ''}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input
                      type="time"
                      value={editEndTime || ''}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                    />
                  </div>
                </div>



                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditingClass(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Student Modal */}
      <AnimatePresence>
        {isAddingStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsAddingStudent(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Add Student to {selectedClass?.name}</h2>
                <button onClick={() => setIsAddingStudent(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleAddStudent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student Email</label>
                  <input
                    type="email"
                    required
                    value={studentEmail || ''}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    placeholder="student@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter the email of the student you want to add to this class.</p>
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add to Class
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

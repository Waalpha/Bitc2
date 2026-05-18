import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthProvider';
import { Unit, Class } from '../types';
import { motion } from 'motion/react';
import { BookOpen, CheckCircle2, Clock, Award, BookMarked, ChevronRight } from 'lucide-react';

export const MyUnits: React.FC = () => {
  const { userData } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData || !userData.classIds || userData.classIds.length === 0) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const snapClasses = await getDocs(collection(db, 'classes'));
        const clsList = snapClasses.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Class))
          .filter(c => userData.classIds?.includes(c.id));
        setClasses(clsList);

        const snapUnits = await getDocs(collection(db, 'units'));
        const unitList = snapUnits.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Unit))
          .filter(u => userData.classIds?.includes(u.classId));
        setUnits(unitList);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching units:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [userData]);

  const activeUnits = units.filter(u => u.status !== 'completed');
  const completedUnits = units.filter(u => u.status === 'completed');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="relative overflow-hidden bg-gradient-to-br from-bg-main to-primary/20 p-8 sm:p-12 rounded-[40px] text-text-primary shadow-2xl border border-white/5">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">My Academic Units</h1>
          <p className="text-text-secondary text-sm sm:text-base font-medium max-w-lg leading-relaxed">
            View and track your unit progress. Manage your registrations and check completion status for {userData?.academicYear || 'this session'}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Units */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-primary font-bold uppercase tracking-[0.2em] text-xs flex items-center gap-2">
              <Clock size={14} /> Active Units
            </h2>
            <span className="bg-primary/10 text-primary text-xs font-black px-3 py-1 rounded-full">{activeUnits.length} IN PROGRESS</span>
          </div>

          <div className="space-y-4">
            {activeUnits.length > 0 ? (
              activeUnits.map((unit) => (
                <motion.div
                  key={unit.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-bg-card p-6 rounded-[32px] border border-white/5 shadow-xl transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 p-4 rounded-2xl text-primary">
                        <BookOpen size={24} />
                      </div>
                      <div>
                        <h3 className="font-black text-text-primary text-lg tracking-tight">{unit.name}</h3>
                        <p className="text-text-muted text-xs font-bold uppercase tracking-widest mt-1">
                          {classes.find(c => c.id === unit.classId)?.name || 'General Class'}
                        </p>
                      </div>
                    </div>
                    <div className="bg-success/10 text-success text-xs font-black px-4 py-1.5 rounded-xl uppercase tracking-widest">
                      Registered
                    </div>
                  </div>
                  
                  <div className="mt-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="bg-white/5 px-4 py-2 rounded-xl">
                          <span className="text-xs font-black text-text-muted uppercase tracking-widest">Course Code</span>
                          <p className="text-xs font-bold text-text-secondary">UNIT-{unit.id.substring(0, 4).toUpperCase()}</p>
                       </div>
                    </div>
                    <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-muted group-hover:bg-primary group-hover:text-white transition-all">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="bg-bg-card/50 border border-white/5 rounded-[32px] p-12 text-center text-text-muted font-black text-xs uppercase tracking-[0.2em]">
                No active units found
              </div>
            )}
          </div>
        </div>

        {/* Completed Units */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-success font-bold uppercase tracking-[0.2em] text-xs flex items-center gap-2">
              <CheckCircle2 size={14} /> Completed Units
            </h2>
            <span className="bg-success/10 text-success text-xs font-black px-3 py-1 rounded-full">{completedUnits.length} FINISHED</span>
          </div>

          <div className="space-y-4">
            {completedUnits.length > 0 ? (
              completedUnits.map((unit) => (
                <motion.div
                  key={unit.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-bg-card/60 backdrop-blur-md p-6 rounded-[32px] border border-white/5 shadow-xl transition-all grayscale hover:grayscale-0 opacity-80 hover:opacity-100"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="bg-success/10 p-4 rounded-2xl text-success">
                        <Award size={24} />
                      </div>
                      <div>
                        <h3 className="font-black text-text-primary text-lg tracking-tight">{unit.name}</h3>
                        <p className="text-text-muted text-xs font-bold uppercase tracking-widest mt-1">
                          Completed in {userData?.academicYear || 'Previous Session'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <CheckCircle2 size={18} className="text-success" />
                      <span className="text-xs font-black text-success uppercase tracking-[0.2em]">Validated</span>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="bg-bg-card/50 border border-white/5 rounded-[32px] p-12 text-center text-text-muted font-black text-xs uppercase tracking-[0.2em]">
                No completed units yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

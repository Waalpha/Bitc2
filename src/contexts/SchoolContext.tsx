import React, { createContext, useContext, useState } from 'react';
import { SchoolRecord } from '../repositories/SchoolRepository';

export interface SchoolContextType {
  activeSchoolId: string;
  setActiveSchoolId: (id: string) => void;
  activeSchool: SchoolRecord | null;
  setActiveSchool: (school: SchoolRecord | null) => void;
}

export const SchoolContext = createContext<SchoolContextType>({
  activeSchoolId: 'bitc',
  setActiveSchoolId: () => {},
  activeSchool: null,
  setActiveSchool: () => {},
});

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSchoolId, setActiveSchoolId] = useState<string>('bitc');
  const [activeSchool, setActiveSchool] = useState<SchoolRecord | null>(null);

  return (
    <SchoolContext.Provider value={{ activeSchoolId, setActiveSchoolId, activeSchool, setActiveSchool }}>
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchoolContext = () => useContext(SchoolContext);

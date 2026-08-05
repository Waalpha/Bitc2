export type ExamType =
  | 'CAT'
  | 'Quiz'
  | 'Assignment'
  | 'Midterm'
  | 'Final'
  | 'Practical'
  | 'Project'
  | 'Oral'
  | 'Attachment Assessment'
  | 'Physical';

export interface Question {
  id: string;
  text: string;
  type: 'multiple-choice' | 'text';
  options?: string[];
  correctAnswer?: string;
}

export interface Exam {
  id: string;
  schoolId?: string;
  title: string;
  type: ExamType;
  unitId: string;
  classId: string;
  teacherId: string;
  questions: Question[];
  published: boolean;
  isOffline?: boolean;
  dueDate?: string;
  examDate?: string;
  location?: string;
  maxMarks: number;
  passingMarks: number;
  duration?: number; // In minutes
  createdAt: string;
}

export interface Submission {
  id: string;
  schoolId?: string;
  examId: string;
  studentId: string;
  answers: { questionId: string; answer: string }[];
  grade?: number;
  feedback?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'pdf' | 'word' | 'video';
  submittedAt: string;
}

export interface Grade {
  id: string;
  schoolId?: string;
  label: string; // e.g., 'A', 'B', 'C'
  minPercentage: number;
  maxPercentage: number;
  comment?: string;
}

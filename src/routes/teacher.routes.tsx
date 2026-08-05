import React from 'react';
import { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from './guards';
import { Attendance } from '../pages/Attendance';
import { Exams } from '../pages/Exams';
import { ExamAttendance } from '../pages/ExamAttendance';
import { MarksRegister } from '../pages/MarksRegister';
import { Timetable } from '../pages/Timetable';
import { Units } from '../pages/Units';
import { Classes } from '../pages/Classes';

export const teacherRoutes: RouteObject[] = [
  {
    path: '/attendance',
    element: (
      <ProtectedRoute>
        <Attendance />
      </ProtectedRoute>
    ),
  },
  {
    path: '/exams',
    element: (
      <ProtectedRoute permission="manage_exams">
        <Exams />
      </ProtectedRoute>
    ),
  },
  {
    path: '/exams/attendance',
    element: (
      <ProtectedRoute permission="manage_exams">
        <ExamAttendance />
      </ProtectedRoute>
    ),
  },
  {
    path: '/marks',
    element: (
      <ProtectedRoute permission="manage_exams">
        <MarksRegister />
      </ProtectedRoute>
    ),
  },
  {
    path: '/timetable',
    element: (
      <ProtectedRoute>
        <Timetable />
      </ProtectedRoute>
    ),
  },
  {
    path: '/units',
    element: (
      <ProtectedRoute permission="manage_units">
        <Units />
      </ProtectedRoute>
    ),
  },
  {
    path: '/classes',
    element: (
      <ProtectedRoute permission="manage_classes">
        <Classes />
      </ProtectedRoute>
    ),
  },
];

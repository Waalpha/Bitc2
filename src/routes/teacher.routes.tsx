import React from 'react';
import { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from './guards';
import { Attendance } from '../pages/Attendance';
import { Exams } from '../pages/Exams';
import { ExamAttendance } from '../pages/ExamAttendance';
import { MarksRegister } from '../pages/MarksRegister';
import { Timetable } from '../pages/Timetable';
import { Units } from '../pages/Units';
import { MyUnits } from '../pages/MyUnits';
import { Classes } from '../pages/Classes';
import { Departments } from '../pages/Departments';

export const teacherRoutes: RouteObject[] = [
  {
    path: '/departments',
    element: (
      <ProtectedRoute>
        <Departments />
      </ProtectedRoute>
    ),
  },
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
      <ProtectedRoute>
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
      <ProtectedRoute>
        <Units />
      </ProtectedRoute>
    ),
  },
  {
    path: '/my-units',
    element: (
      <ProtectedRoute>
        <MyUnits />
      </ProtectedRoute>
    ),
  },
  {
    path: '/classes',
    element: (
      <ProtectedRoute>
        <Classes />
      </ProtectedRoute>
    ),
  },
];

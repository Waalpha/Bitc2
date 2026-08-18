import React from 'react';
import { RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './guards';
import { AdminSettings } from '../pages/AdminSettings';
import { Students } from '../pages/Students';
import { StudentAdmission } from '../pages/StudentAdmission';
import { Transcripts } from '../pages/Transcripts';
import { HR } from '../pages/HR';
import { Fees } from '../pages/Fees';
import { WhatsApp } from '../pages/WhatsApp';

export const adminRoutes: RouteObject[] = [
  {
    path: '/admin',
    element: (
      <ProtectedRoute permission="settings.manage">
        <AdminSettings />
      </ProtectedRoute>
    ),
  },
  {
    path: '/students',
    element: (
      <ProtectedRoute permission="view_students">
        <Students />
      </ProtectedRoute>
    ),
  },
  {
    path: '/students/admission',
    element: (
      <ProtectedRoute permission="student_admission">
        <StudentAdmission />
      </ProtectedRoute>
    ),
  },
  {
    path: '/transcripts',
    element: (
      <ProtectedRoute requireAdminPortal={true}>
        <Transcripts />
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr',
    element: (
      <ProtectedRoute requireAdminPortal={true}>
        <HR />
      </ProtectedRoute>
    ),
  },
  {
    path: '/fees',
    element: (
      <ProtectedRoute>
        <Fees />
      </ProtectedRoute>
    ),
  },
  {
    path: '/chat',
    element: <Navigate to="/whatsapp" replace />,
  },
  {
    path: '/whatsapp',
    element: (
      <ProtectedRoute>
        <WhatsApp />
      </ProtectedRoute>
    ),
  },
];

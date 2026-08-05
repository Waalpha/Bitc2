import React from 'react';
import { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from './guards';
import { MyUnits } from '../pages/MyUnits';
import { ExamTaking } from '../pages/ExamTaking';
import { ExamResults } from '../pages/ExamResults';
import { Profile } from '../pages/Profile';

export const studentRoutes: RouteObject[] = [
  {
    path: '/my-units',
    element: (
      <ProtectedRoute permission="view_results">
        <MyUnits />
      </ProtectedRoute>
    ),
  },
  {
    path: '/results',
    element: (
      <ProtectedRoute permission="view_results">
        <ExamResults />
      </ProtectedRoute>
    ),
  },
  {
    path: '/exams/take/:examId',
    element: (
      <ProtectedRoute permission="view_results">
        <ExamTaking />
      </ProtectedRoute>
    ),
  },
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    ),
  },
];

import React from 'react';
import { RouteObject } from 'react-router-dom';
import { PublicPortal } from '../pages/PublicPortal';
import { Auth } from '../components/Auth';
import { StudentVerification } from '../pages/StudentVerification';
import { CertificateVerification } from '../pages/CertificateVerification';

export const publicRoutes: RouteObject[] = [
  {
    path: '/',
    element: <PublicPortal />,
  },
  {
    path: '/auth',
    element: <Auth />,
  },
  {
    path: '/student/verify/*',
    element: <StudentVerification />,
  },
  {
    path: '/verify/certificate/*',
    element: <CertificateVerification />,
  },
  {
    path: '/certificate/*',
    element: <CertificateVerification />,
  },
];

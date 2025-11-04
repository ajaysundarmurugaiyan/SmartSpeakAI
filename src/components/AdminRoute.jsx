import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const getAdminEmails = () => {
  const raw = import.meta.env.VITE_ADMIN_EMAILS || '';
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
};

const AdminRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();
  // Allow access if hardcoded admin session flag is set
  const hardcodedAdmin = typeof window !== 'undefined' && sessionStorage.getItem('hardcoded-admin') === '1';
  if (hardcodedAdmin) return children;
  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  const admins = getAdminEmails();
  const isAdmin = admins.length === 0 ? false : admins.includes((currentUser.email || '').toLowerCase());
  if (!isAdmin) return <Navigate to="/home" replace />;
  return children;
};

export default AdminRoute;



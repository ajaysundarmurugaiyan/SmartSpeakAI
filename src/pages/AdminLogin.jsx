import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Dedicated admin login route: /admin-login
// Password unlocks the /admin dashboard (sets the session flags AdminRoute + Admin read).
const AdminLogin = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  // Admin password from env; on localhost falls back to a dev default for testing.
  const expected = import.meta.env.VITE_ADMIN_PASS || (import.meta.env.DEV ? 'admin123' : '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!expected) {
      setError('Admin password is not configured. Set VITE_ADMIN_PASS in your environment.');
      return;
    }
    if (pass === expected) {
      sessionStorage.setItem('hardcoded-admin', '1'); // satisfies AdminRoute
      sessionStorage.setItem('admin-pass-ok', '1');    // satisfies Admin's inner gate
      navigate('/admin');
    } else {
      setError('Incorrect admin password.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl mb-4 shadow-lg">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Access</h1>
          <p className="text-gray-500 text-sm mt-1">Restricted — authorized staff only</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {!currentUser && (
            <div className="mb-4 text-xs bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg">
              Tip: sign into the app first — the dashboard reads Firestore, which needs a signed-in account.
            </div>
          )}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Enter admin password"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-sm bg-white"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-all shadow-md"
            >
              Unlock Dashboard
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;

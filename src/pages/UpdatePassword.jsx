import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db, auth } from '../firebase/config';
import { collection, query, where, getDocs, updateDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, updatePassword, sendPasswordResetEmail, signOut } from 'firebase/auth';

const UpdatePassword = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [checkingApproval, setCheckingApproval] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const checkPasswordResetApproval = async (userEmail) => {
    setCheckingApproval(true);
    setError('');
    
    try {
      // Check if user has an approved password reset request
      const resetRequestsRef = collection(db, 'passwordResetRequests');
      const q = query(
        resetRequestsRef,
        where('email', '==', userEmail.toLowerCase()),
        where('approved', '==', true),
        where('status', '==', 'approved')
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // No approved reset request found
        setIsApproved(false);
        setShowForm(false);
        setError('No approved password reset request found. Please send a request using "Forgot Password" and wait for admin approval.');
      } else {
        setIsApproved(true);
        setShowForm(true);
        setError('');
      }
    } catch (err) {
      console.error('Error checking approval:', err);
      setError('Failed to verify password reset approval');
      setIsApproved(false);
      setShowForm(false);
    } finally {
      setCheckingApproval(false);
    }
  };

  const handleCheckApproval = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    await checkPasswordResetApproval(email);
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!email || !newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);

      // Check for approved reset request
      const resetRequestsRef = collection(db, 'passwordResetRequests');
      const q = query(
        resetRequestsRef,
        where('email', '==', email.toLowerCase()),
        where('approved', '==', true),
        where('status', '==', 'approved')
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('No approved reset request found');
        setLoading(false);
        return;
      }

      // Get the request document
      let requestDocId = null;
      querySnapshot.forEach((docSnapshot) => {
        requestDocId = docSnapshot.id;
      });

      // Send password reset email from Firebase
      await sendPasswordResetEmail(auth, email);

      // Store the new password temporarily for the user to use after clicking reset link
      await updateDoc(doc(db, 'passwordResetRequests', requestDocId), {
        status: 'password_reset_sent',
        passwordResetSentAt: new Date(),
        newPasswordToSet: newPassword,
        message: 'Password reset email sent. Check your email to complete the process.'
      });

      setSuccess(true);
      setError('');
      
      // Show success message with instructions
      setTimeout(() => {
        alert(`✉️ Password Reset Email Sent!\n\nPlease check your email inbox (or spam folder) for a password reset link from Firebase.\n\nClick the link in the email and set your new password there.\n\nYour new password: ${newPassword}\n\nAfter setting the password via email link, you can login with your new password.`);
        navigate('/login');
      }, 1500);
    } catch (err) {
      console.error('Error updating password:', err);
      if (err.code === 'auth/user-not-found') {
        setError('User not found');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many requests. Please try again later.');
      } else {
        setError('Failed to send password reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-900 rounded-2xl mb-4 shadow-lg">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Update Password
          </h1>
          <p className="text-gray-600 text-sm">
            Your password reset request has been approved
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {success ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-8"
            >
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Reset Email Sent!</h3>
              <p className="text-gray-600">Check your email for the password reset link...</p>
            </motion.div>
          ) : !showForm ? (
            <>
              {/* Email Check Form */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">
                  {error}
                </div>
              )}

              <p className="text-gray-600 text-sm mb-6 text-center">
                Enter your email to verify admin approval for password reset
              </p>

              <form onSubmit={handleCheckApproval} className="space-y-5">
                {/* Email Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-sm"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                {/* Check Approval Button */}
                <button
                  type="submit"
                  disabled={checkingApproval}
                  className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  {checkingApproval ? 'Checking...' : 'Check Approval Status'}
                </button>
              </form>

              <button
                onClick={() => navigate('/login')}
                className="w-full mt-4 text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                Back to Login
              </button>
            </>
          ) : (
            <>
              {/* Password Update Form */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">
                  {error}
                </div>
              )}

              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm">
                ✓ Admin approval verified for {email}
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-5">
                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-sm"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-sm"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Update Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>

              <button
                onClick={() => navigate('/home')}
                className="w-full mt-4 text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default UpdatePassword;

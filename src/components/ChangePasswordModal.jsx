import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function ChangePasswordModal({ isOpen, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      // 1. Get current user session email
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) throw new Error('No active user session found.');

      // 2. Verify current password by attempting a quick re-sign-in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      });

      if (verifyError) {
        throw new Error('Incorrect current password entered.');
      }

      // 3. Update to the new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setSuccessMessage('Password successfully updated!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        onClose();
        setSuccessMessage('');
      }, 1500);
    } catch (err) {
      console.error('Password change error:', err);
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-mono">
      <div className="bg-[oklch(0.23_0.045_265)] border border-white/20 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl text-[oklch(0.96_0.012_265)]">
        
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <div>
            <span className="text-[10px] text-[oklch(0.94_0.21_118)] uppercase tracking-widest font-bold">Security Hub</span>
            <h3 className="text-lg font-bold font-sans">Change Password</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer">✕</button>
        </div>

        {error && (
          <div className="p-3 rounded-xl text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 text-center">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="p-3 rounded-xl text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-center">
            {successMessage}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4 text-xs">
          <div>
            <label className="block uppercase tracking-wider text-[oklch(0.68_0.04_265)] mb-1.5">Current (Last Used) Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[oklch(0.94_0.21_118)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block uppercase tracking-wider text-[oklch(0.68_0.04_265)] mb-1.5">New Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[oklch(0.94_0.21_118)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block uppercase tracking-wider text-[oklch(0.68_0.04_265)] mb-1.5">Confirm New Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[oklch(0.94_0.21_118)] focus:outline-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)] uppercase font-bold tracking-widest rounded-xl border border-white/10 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] uppercase font-extrabold tracking-widest rounded-xl shadow cursor-pointer hover:brightness-110 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
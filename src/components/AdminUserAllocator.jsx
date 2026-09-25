import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const cleanText = (text) => {
  if (!text) return '';
  return String(text).replace(/â€“/g, '–').replace(/â€”/g, '—').replace(/â€™/g, "'");
};

export default function AdminUserAllocator() {
  const [users, setUsers] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [defaultPassword, setDefaultPassword] = useState('Tryvo@2026');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchWhitelistedUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('allowed_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching allowed users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWhitelistedUsers();
  }, []);

  // 1. Authorize User & Ensure Auth Record Exists with Password
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newEmail) return;

    setLoading(true);
    setMessage('');

    try {
      const cleanEmail = newEmail.trim().toLowerCase();
      const pwd = defaultPassword || 'Tryvo@2026';

      // A. Add to allowed_users whitelist table
      const { error: whitelistErr } = await supabase
        .from('allowed_users')
        .upsert([{ email: cleanEmail }], { onConflict: 'email' });

      if (whitelistErr) throw whitelistErr;

      // B. Create or Reset password via Supabase RPC helper
      const { error: rpcErr } = await supabase.rpc('admin_upsert_user_auth', {
        target_email: cleanEmail,
        new_password: pwd
      });

      if (rpcErr) throw rpcErr;

      setMessage(`Successfully authorized ${cleanEmail} with password: "${pwd}"`);
      setNewEmail('');
      setDefaultPassword('Tryvo@2026');
      fetchWhitelistedUsers();
    } catch (err) {
      console.error('Error authorizing user:', err);
      setMessage('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Reset Password back to Default
  const handleResetPassword = async (emailToReset) => {
    const resetPwd = prompt(`Enter new default password to reset for ${emailToReset}:`, 'Tryvo@2026');
    if (!resetPwd) return;

    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.rpc('admin_upsert_user_auth', {
        target_email: emailToReset,
        new_password: resetPwd
      });

      if (error) throw error;

      setMessage(`Password for ${emailToReset} successfully reset to: "${resetPwd}"`);
    } catch (err) {
      console.error('Reset error:', err);
      alert('Password reset failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Remove User from Whitelist
  const handleDeleteUser = async (emailToDelete) => {
    if (!window.confirm(`Are you sure you want to revoke access for ${emailToDelete}?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('allowed_users')
        .delete()
        .eq('email', emailToDelete);

      if (error) throw error;

      setMessage(`Revoked access for ${emailToDelete}`);
      fetchWhitelistedUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      setMessage('Error deleting user: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)] p-6 sm:p-10 font-sans space-y-8 overflow-y-auto">
      <div className="bg-[oklch(0.23_0.045_265)] border border-white/10 p-6 rounded-3xl shadow-xl flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="font-mono text-xs text-[oklch(0.94_0.21_118)] uppercase tracking-widest font-bold">Security & Access Management</span>
          <h1 className="text-2xl font-black font-['Archivo_Black'] tracking-tight">Whitelisted Users & Credentials</h1>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-2xl font-mono text-xs bg-white/5 border border-white/10 text-[oklch(0.94_0.21_118)] text-center">
          {message}
        </div>
      )}

      <div className="bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl max-w-2xl font-mono text-xs space-y-6">
        <h3 className="font-bold text-[oklch(0.94_0.21_118)] uppercase tracking-widest border-b border-white/10 pb-3">
          ➕ Authorize New Student / User
        </h3>

        <form onSubmit={handleAddUser} className="space-y-4">
          <div>
            <label className="block uppercase tracking-wider text-[oklch(0.68_0.04_265)] mb-2">Student Email Address</label>
            <input
              type="email"
              required
              placeholder="student@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-[oklch(0.94_0.21_118)]"
            />
          </div>

          <div>
            <label className="block uppercase tracking-wider text-[oklch(0.68_0.04_265)] mb-2">Default Password Assignment</label>
            <input
              type="text"
              required
              placeholder="Tryvo@2026"
              value={defaultPassword}
              onChange={(e) => setDefaultPassword(e.target.value)}
              className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-[oklch(0.94_0.21_118)]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[oklch(0.94_0.21_118)] hover:brightness-110 text-[oklch(0.16_0.03_265)] font-extrabold uppercase tracking-widest rounded-xl shadow transition cursor-pointer"
          >
            {loading ? 'Processing...' : 'Authorize User & Set Password →'}
          </button>
        </form>
      </div>

      <div className="bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl font-mono text-xs space-y-4">
        <h3 className="font-bold text-[oklch(0.94_0.21_118)] uppercase tracking-widest border-b border-white/10 pb-3">
          📋 Authorized Whitelist Directory ({users.length})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[oklch(0.68_0.04_265)] uppercase tracking-wider">
                <th className="py-3 px-4">Email Address</th>
                <th className="py-3 px-4">Authorized On</th>
                <th className="py-3 px-4 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u, idx) => (
                <tr key={idx} className="hover:bg-white/5 transition">
                  <td className="py-3.5 px-4 font-bold text-[oklch(0.96_0.012_265)]">{cleanText(u.email)}</td>
                  <td className="py-3.5 px-4 text-[oklch(0.68_0.04_265)]">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleResetPassword(u.email)}
                      className="px-3 py-1.5 bg-[oklch(0.94_0.21_118)]/10 text-[oklch(0.94_0.21_118)] border border-[oklch(0.94_0.21_118)]/30 rounded-lg hover:bg-[oklch(0.94_0.21_118)]/20 transition cursor-pointer font-bold"
                    >
                      🔄 Reset Password
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u.email)}
                      className="px-3 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-lg hover:bg-rose-500/20 transition cursor-pointer font-bold"
                    >
                      🗑️ Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const cleanText = (text) => {
  if (!text) return '';
  return String(text).replace(/â€“/g, '–').replace(/â€”/g, '—').replace(/â€™/g, "'");
};

export default function AdminUserAllocator() {
  const [users, setUsers] = useState([]);
  const [exams, setExams] = useState([]);
  const [allocations, setAllocations] = useState([]);

  const [newEmail, setNewEmail] = useState('');
  const [defaultPassword, setDefaultPassword] = useState('Tryvo@2026');

  // Allocation form states
  const [selectedUserEmail, setSelectedUserEmail] = useState('');
  const [selectedExamId, setSelectedExamId] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch whitelisted users
      const { data: userData, error: userErr } = await supabase
        .from('allowed_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (userErr) throw userErr;
      setUsers(userData || []);
      if (userData && userData.length > 0 && !selectedUserEmail) {
        setSelectedUserEmail(userData[0].email);
      }

      // 2. Fetch available exam blueprints
      const { data: examData, error: examErr } = await supabase
        .from('exams')
        .select('*');

      if (examErr) throw examErr;
      setExams(examData || []);
      if (examData && examData.length > 0 && !selectedExamId) {
        setSelectedExamId(examData[0].exam_id || examData[0].id);
      }

      // 3. Fetch current exam allocations
      const { data: allocData, error: allocErr } = await supabase
        .from('user_exam_allocations')
        .select('*');

      if (allocErr) throw allocErr;
      setAllocations(allocData || []);

    } catch (err) {
      console.error('Error fetching allocation metadata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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

      const { error: whitelistErr } = await supabase
        .from('allowed_users')
        .upsert([{ email: cleanEmail }], { onConflict: 'email' });

      if (whitelistErr) throw whitelistErr;

      const { error: rpcErr } = await supabase.rpc('admin_upsert_user_auth', {
        target_email: cleanEmail,
        new_password: pwd
      });

      if (rpcErr) throw rpcErr;

      setMessage(`Successfully authorized ${cleanEmail} with password: "${pwd}"`);
      setNewEmail('');
      setDefaultPassword('Tryvo@2026');
      fetchData();
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
      fetchData();
    } catch (err) {
      console.error('Error deleting user:', err);
      setMessage('Error deleting user: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 4. Allocate Exam to User
  const handleAllocateExam = async (e) => {
    e.preventDefault();
    if (!selectedUserEmail || !selectedExamId) return;

    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('user_exam_allocations')
        .upsert([{ email: selectedUserEmail, exam_id: selectedExamId }], { onConflict: 'email,exam_id' });

      if (error) throw error;

      setMessage(`Successfully allocated exam blueprint to ${selectedUserEmail}`);
      fetchData();
    } catch (err) {
      console.error('Error allocating exam:', err);
      setMessage('Error allocating exam: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 5. Revoke Exam Allocation
  const handleRevokeAllocation = async (email, examId) => {
    if (!window.confirm(`Revoke exam access for ${email}?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_exam_allocations')
        .delete()
        .eq('email', email)
        .eq('exam_id', examId);

      if (error) throw error;

      setMessage(`Revoked exam access for ${email}`);
      fetchData();
    } catch (err) {
      console.error('Error revoking allocation:', err);
      setMessage('Error revoking allocation: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)] p-6 sm:p-10 font-sans space-y-8 overflow-y-auto">
      <div className="bg-[oklch(0.23_0.045_265)] border border-white/10 p-6 rounded-3xl shadow-xl flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="font-mono text-xs text-[oklch(0.94_0.21_118)] uppercase tracking-widest font-bold">Security & Access Management</span>
          <h1 className="text-2xl font-black font-['Archivo_Black'] tracking-tight">Whitelisted Users & Exam Allocations</h1>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-2xl font-mono text-xs bg-white/5 border border-white/10 text-[oklch(0.94_0.21_118)] text-center">
          {message}
        </div>
      )}

      {/* Grid container for Authorize User & Allocate Exam */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Authorize User Form */}
        <div className="bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl font-mono text-xs space-y-6">
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

        {/* Allocate Exam to User Form */}
        <div className="bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl font-mono text-xs space-y-6">
          <h3 className="font-bold text-[oklch(0.94_0.21_118)] uppercase tracking-widest border-b border-white/10 pb-3">
            📝 Allocate Exam Blueprint
          </h3>

          <form onSubmit={handleAllocateExam} className="space-y-4">
            <div>
              <label className="block uppercase tracking-wider text-[oklch(0.68_0.04_265)] mb-2">Select User Email</label>
              <select
                value={selectedUserEmail}
                onChange={(e) => setSelectedUserEmail(e.target.value)}
                className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-[oklch(0.94_0.21_118)] cursor-pointer"
              >
                {users.map((u, i) => (
                  <option key={i} value={u.email}>{u.email}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block uppercase tracking-wider text-[oklch(0.68_0.04_265)] mb-2">Select Exam Blueprint</label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-[oklch(0.94_0.21_118)] cursor-pointer"
              >
                {exams.map((ex, i) => (
                  <option key={i} value={ex.exam_id || ex.id}>
                    {cleanText(ex.exam_name || ex.name)} ({ex.options_count || 4} Options)
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || users.length === 0 || exams.length === 0}
              className="w-full py-3.5 bg-[oklch(0.94_0.21_118)] hover:brightness-110 text-[oklch(0.16_0.03_265)] font-extrabold uppercase tracking-widest rounded-xl shadow transition cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Allocating...' : 'Allocate Exam Access →'}
            </button>
          </form>
        </div>

      </div>

      {/* Authorized Whitelist Directory */}
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

      {/* Current Exam Allocations Directory */}
      <div className="bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl font-mono text-xs space-y-4">
        <h3 className="font-bold text-[oklch(0.94_0.21_118)] uppercase tracking-widest border-b border-white/10 pb-3">
          🔗 Active Exam Allocations ({allocations.length})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[oklch(0.68_0.04_265)] uppercase tracking-wider">
                <th className="py-3 px-4">User Email</th>
                <th className="py-3 px-4">Allocated Exam ID</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {allocations.map((a, idx) => (
                <tr key={idx} className="hover:bg-white/5 transition">
                  <td className="py-3.5 px-4 font-bold text-[oklch(0.96_0.012_265)]">{cleanText(a.email)}</td>
                  <td className="py-3.5 px-4 text-[oklch(0.94_0.21_118)]">{cleanText(a.exam_id)}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleRevokeAllocation(a.email, a.exam_id)}
                      className="px-3 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-lg hover:bg-rose-500/20 transition cursor-pointer font-bold"
                    >
                      Revoke Exam
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
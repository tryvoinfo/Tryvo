import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; // 👈 Note the double dot (../)

export default function AdminUserActivity() {
  const [activityData, setActivityData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      const { data, error } = await supabase
        .from('user_access_summary')
        .select('*');

      if (!error && data) {
        setActivityData(data);
      }
      setLoading(false);
    }
    fetchActivity();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 font-mono text-xs text-[oklch(0.68_0.04_265)] uppercase tracking-widest animate-pulse">
        Loading user telemetry...
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)] p-6 sm:p-10 font-sans flex flex-col gap-6 overflow-y-auto">
      <div>
        <span className="font-mono text-xs text-[oklch(0.94_0.21_118)] uppercase tracking-widest font-bold">Analytics & Telemetry</span>
        <h2 className="text-2xl font-black font-['Archivo_Black'] tracking-tight mt-1">Historical User Access Logs</h2>
      </div>

      <div className="border border-white/10 rounded-3xl overflow-hidden bg-[oklch(0.23_0.045_265)] shadow-xl">
        <table className="w-full text-left border-collapse font-mono text-xs">
          <thead className="bg-white/5 border-b border-white/10 text-[oklch(0.68_0.04_265)] uppercase">
            <tr>
              <th className="p-4">User ID</th>
              <th className="p-4">Email</th>
              <th className="p-4">Total Access Count</th>
              <th className="p-4">Last Active</th>
            </tr>
          </thead>
          <tbody>
            {activityData.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-8 text-center opacity-60">
                  No access logs recorded yet. (Make sure you ran the Supabase SQL view script).
                </td>
              </tr>
            ) : (
              activityData.map((row, idx) => (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 truncate max-w-xs">{row.user_id}</td>
                  <td className="p-4 text-white font-bold">{row.user_email || 'N/A'}</td>
                  <td className="p-4 font-extrabold text-[oklch(0.94_0.21_118)] text-sm">{row.access_count}</td>
                  <td className="p-4 opacity-80">{new Date(row.last_accessed_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
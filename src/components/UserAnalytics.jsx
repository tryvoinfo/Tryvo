import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- SUPABASE CONFIG ---
const supabaseUrl = 'https://wbcdiewohpngqbeqrfmb.supabase.co';
const supabaseAnonKey = 'sb_publishable_d21wos13j9x7K-w1h8vsvw_0gPm_jlY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);
// -----------------------

export default function UserAnalytics({ user }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTests: 0,
    avgScore: 0,
    highestScore: 0,
    submissions: []
  });

  const fetchUserMetrics = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('exam_submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const totalTests = data.length;
        const scores = data.map(sub => (sub.total_marks > 0 ? (sub.score / sub.total_marks) * 100 : 0));
        const avgScore = (scores.reduce((a, b) => a + b, 0) / totalTests).toFixed(1);
        const highestScore = Math.max(...scores).toFixed(1);

        setStats({
          totalTests,
          avgScore,
          highestScore,
          submissions: data
        });
      } else {
        setStats({ totalTests: 0, avgScore: 0, highestScore: 0, submissions: [] });
      }
    } catch (err) {
      console.error("Error fetching user analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserMetrics();
  }, [user]);

  // --- UI HELPERS ---
  const getInsightTone = (avg) => {
    if (avg >= 75) return { color: 'text-emerald-600', icon: '🎉' };
    if (avg >= 50) return { color: 'text-amber-600', icon: '⚖️' };
    return { color: 'text-slate-600', icon: '📈' };
  };

  // --- LOADING STATE ---
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 font-sans text-sm text-slate-400 bg-slate-50">
        LOADING YOUR PERFORMANCE METRICS...
      </div>
    );
  }

  // --- FEEDBACK LOGIC (unchanged) ---
  const getPositives = (avg) => {
    if (avg >= 75) return "Exceptional consistency! Strong command over core syllabus concepts and time management.";
    if (avg >= 50) return "Good foundational understanding. Regular test practice is building steady momentum.";
    return "Showing great dedication by attempting tests consistently. Room for foundational growth.";
  };

  const getImprovements = (avg) => {
    if (avg >= 75) return "Focus on speed optimization during high-pressure timed sprints.";
    if (avg >= 50) return "Work on accuracy in tricky reasoning sections and review skipped questions.";
    return "Focus heavily on core concepts, topic drills, and analyzing incorrect answers post-test.";
  };

  const insight = getInsightTone(stats.avgScore);

  // --- RENDERED COMPONENT ---
  return (
    <div className="flex-1 p-6 sm:p-10 space-y-10 max-w-7xl mx-auto w-full font-sans bg-slate-50">
      
      {/* Header Section */}
      <header className="flex justify-between items-center flex-wrap gap-6 border-b border-slate-200 pb-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">
            PERFORMANCE ANALYTICS
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            STUDENT PROGRESS OVERVIEW — <span className='font-mono text-slate-700'>{user?.email}</span>
          </p>
        </div>
        <button
          onClick={fetchUserMetrics}
          className="px-6 py-3 bg-slate-950 text-white rounded-full text-xs font-bold tracking-wider uppercase hover:bg-red-600 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </header>

      {/* Top Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between gap-3">
          <div className="text-sm uppercase tracking-wider text-slate-500 font-semibold">Tests Attended</div>
          <div className="text-5xl font-extrabold text-slate-950">{stats.totalTests}</div>
          <div className="text-xs text-emerald-600 font-medium">Completed mock sessions</div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between gap-3">
          <div className="text-sm uppercase tracking-wider text-slate-500 font-semibold">Average Score</div>
          <div className={`text-5xl font-extrabold ${insight.color}`}>{stats.avgScore}%</div>
          <div className="text-xs text-slate-500 font-medium">Across all submitted exams</div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between gap-3">
          <div className="text-sm uppercase tracking-wider text-slate-500 font-semibold">Personal Best</div>
          <div className="text-5xl font-extrabold text-red-600">{stats.highestScore}%</div>
          <div className="text-xs text-red-400 font-medium">Highest score recorded</div>
        </div>
      </div>

      {/* AI Insights: Positives & Areas of Improvement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white border-l-4 border-red-600 rounded-3xl p-8 shadow-sm border border-slate-100 space-y-3">
          <div className={`text-sm font-bold uppercase tracking-widest ${insight.color} flex items-center gap-3`}>
            <span>{insight.icon}</span> KEY STRENGTHS
          </div>
          <p className="text-slate-800 leading-relaxed text-base">
            {stats.totalTests > 0 ? getPositives(stats.avgScore) : "Complete your first mock test to unlock personalized behavioral feedback."}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 space-y-3">
          <div className="text-sm font-bold uppercase tracking-widest text-slate-800 flex items-center gap-3">
            <span>🧐</span> RECOMMENDATIONS
          </div>
          <p className="text-slate-800 leading-relaxed text-base">
            {stats.totalTests > 0 ? getImprovements(stats.avgScore) : "Take practice tests regularly to identify weak subject areas and bottlenecks."}
          </p>
        </div>
      </div>

      {/* Graphical Progress List / History */}
      <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 space-y-8">
        <h3 className="text-xl font-bold text-slate-950">
          Recent Test Performance History
        </h3>

        {stats.submissions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm bg-slate-50 rounded-2xl">
            No test history found yet. Complete a Full Mock or Time Drill to populate charts!
          </div>
        ) : (
          <div className="space-y-5">
            {stats.submissions.slice(-5).reverse().map((sub, idx) => {
              const pct = sub.total_marks > 0 ? ((sub.score / sub.total_marks) * 100).toFixed(0) : 0;
              return (
                <div key={idx} className="p-5 bg-slate-50 rounded-xl space-y-2">
                  <div className="flex justify-between items-baseline gap-4">
                    <span className="font-semibold text-slate-900 text-sm truncate">{sub.exam_title || 'Mock Examination'}</span>
                    <span className={`font-mono text-xs font-bold ${insight.color} tabular-nums shrink-0`}>
                      {pct}% — {sub.score}/{sub.total_marks}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`bg-red-600 h-full rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
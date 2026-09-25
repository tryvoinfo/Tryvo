import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wbcdiewohpngqbeqrfmb.supabase.co';
const supabaseAnonKey = 'sb_publishable_d21wos13j9x7K-w1h8vsvw_0gPm_jlY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 font-mono text-xs text-[oklch(0.94_0.21_118)]">
        LOADING YOUR PERFORMANCE METRICS...
      </div>
    );
  }

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

  return (
    <div className="flex-1 p-6 sm:p-12 space-y-8 max-w-6xl mx-auto w-full font-sans">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-black font-['Archivo_Black'] text-[oklch(0.94_0.21_118)]">PERFORMANCE ANALYTICS</h1>
          <p className="font-mono text-xs text-[oklch(0.68_0.04_265)] uppercase tracking-wider">
            Student Progress Overview — {user?.email}
          </p>
        </div>
        <button
          onClick={fetchUserMetrics}
          className="px-4 py-2 bg-[oklch(0.23_0.045_265)] border border-white/15 rounded-xl font-mono text-xs text-[oklch(0.94_0.21_118)] hover:bg-white/5 transition cursor-pointer"
        >
          🔄 Refresh Metrics
        </button>
      </div>

      {/* Top Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 font-mono">
        <div className="bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-2xl p-6 shadow-xl space-y-2">
          <div className="text-xs uppercase tracking-widest text-[oklch(0.68_0.04_265)]">Tests Attended</div>
          <div className="text-4xl font-black text-white">{stats.totalTests}</div>
          <div className="text-[10px] text-emerald-400">Total completed mock sessions</div>
        </div>

        <div className="bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-2xl p-6 shadow-xl space-y-2">
          <div className="text-xs uppercase tracking-widest text-[oklch(0.68_0.04_265)]">Average Score</div>
          <div className="text-4xl font-black text-[oklch(0.94_0.21_118)]">{stats.avgScore}%</div>
          <div className="text-[10px] text-[oklch(0.68_0.04_265)]">Across all submitted exams</div>
        </div>

        <div className="bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-2xl p-6 shadow-xl space-y-2">
          <div className="text-xs uppercase tracking-widest text-[oklch(0.68_0.04_265)]">Personal Best</div>
          <div className="text-4xl font-black text-cyan-400">{stats.highestScore}%</div>
          <div className="text-[10px] text-cyan-300">Highest score recorded</div>
        </div>
      </div>

      {/* AI Insights: Positives & Areas of Improvement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
        <div className="bg-[oklch(0.23_0.045_265)]/90 border border-emerald-500/30 rounded-2xl p-6 space-y-3 shadow-xl">
          <div className="font-mono text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2">
            <span>✨</span> Key Strengths & Positives
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">
            {stats.totalTests > 0 ? getPositives(stats.avgScore) : "Complete your first mock test to unlock personalized behavioral feedback."}
          </p>
        </div>

        <div className="bg-[oklch(0.23_0.045_265)]/90 border border-amber-500/30 rounded-2xl p-6 space-y-3 shadow-xl">
          <div className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-2">
            <span>🎯</span> Recommended Areas for Improvement
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">
            {stats.totalTests > 0 ? getImprovements(stats.avgScore) : "Take practice tests regularly to identify weak subject areas and bottlenecks."}
          </p>
        </div>
      </div>

      {/* Graphical Progress List / History */}
      <div className="bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl">
        <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[oklch(0.94_0.21_118)]">
          Recent Test Performance History
        </h3>

        {stats.submissions.length === 0 ? (
          <div className="text-center py-8 font-mono text-xs text-[oklch(0.68_0.04_265)]">
            No test history found yet. Complete a Full Mock or Time Drill to populate charts!
          </div>
        ) : (
          <div className="space-y-4">
            {stats.submissions.slice(-5).reverse().map((sub, idx) => {
              const pct = sub.total_marks > 0 ? ((sub.score / sub.total_marks) * 100).toFixed(0) : 0;
              return (
                <div key={idx} className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span className="font-bold">{sub.exam_title || 'Mock Examination'}</span>
                    <span className="text-[oklch(0.94_0.21_118)] font-bold">{pct}% ({sub.score}/{sub.total_marks})</span>
                  </div>
                  <div className="w-full bg-black/40 h-3 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="bg-[oklch(0.94_0.21_118)] h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
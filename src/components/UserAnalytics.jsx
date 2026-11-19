import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const getThemeClasses = (theme) => {
  switch (theme) {
    case 'light-mono': // Black & White Mode
      return {
        bg: 'bg-white text-black',
        card: 'bg-white border-2 border-black text-black shadow-none',
        header: 'bg-white border-b-2 border-black text-black',
        buttonPrimary: 'bg-black text-white hover:bg-neutral-800',
        accentText: 'text-black font-extrabold underline',
        badge: 'bg-neutral-100 text-black border border-black',
        cardInner: 'bg-neutral-50 border-2 border-black text-black'
      };
    case 'light-blue': // Standard Modern Light Mode
      return {
        bg: 'bg-[#f9fafb] text-[#111827]',
        card: 'bg-white border-slate-200 text-slate-900 shadow-xs',
        header: 'bg-white border-b border-slate-200 text-slate-900 shadow-xs',
        buttonPrimary: 'bg-indigo-600 text-white hover:bg-indigo-700',
        accentText: 'text-indigo-600',
        badge: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
        cardInner: 'bg-slate-50 border border-slate-200 text-slate-800'
      };
    case 'dark': // Tryvo Dark Mode
    default:
      return {
        bg: 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)]',
        card: 'bg-[oklch(0.23_0.045_265)] border-white/10 text-white shadow-xl',
        header: 'bg-[oklch(0.23_0.045_265)]/80 border-white/10 text-white',
        buttonPrimary: 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] hover:brightness-110 shadow-[0_0_20px_rgba(204,255,0,0.2)]',
        accentText: 'text-[oklch(0.94_0.21_118)]',
        badge: 'bg-white/5 border-white/10 text-[oklch(0.68_0.04_265)]',
        cardInner: 'bg-[oklch(0.16_0.03_265)] border-white/5 text-[oklch(0.96_0.012_265)]'
      };
  }
};

export default function UserAnalytics({ user, theme = 'dark' }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTests: 0,
    avgScore: 0,
    avgNum: 0,
    highestScore: 0,
    submissions: []
  });

  const t = getThemeClasses(theme);
  const isDark = theme === 'dark';
  const isMono = theme === 'light-mono';

  const fetchUserMetrics = async () => {
    if (!user) return;
    try {
      setLoading(true);

      const { data: allRows, error } = await supabase
        .from('exam_submissions')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const emailLower = (user.email || '').trim().toLowerCase();
      const idStr = String(user.id || '').trim();

      const matched = (allRows || []).filter((sub) => {
        const subEmail = String(sub.user_email || '').trim().toLowerCase();
        const subUserId = String(sub.user_id || '').trim();
        return (emailLower && subEmail === emailLower) || (idStr && subUserId === idStr);
      });

      if (matched.length > 0) {
        const totalTests = matched.length;
        const scores = matched.map((sub) =>
          sub.total_marks > 0 ? (Number(sub.score) / Number(sub.total_marks)) * 100 : 0
        );
        const avgNum = Number((scores.reduce((a, b) => a + b, 0) / totalTests).toFixed(1));
        const highestScore = Number(Math.max(...scores).toFixed(1));

        setStats({
          totalTests,
          avgScore: avgNum,
          avgNum,
          highestScore,
          submissions: matched
        });
      } else {
        setStats({ totalTests: 0, avgScore: 0, avgNum: 0, highestScore: 0, submissions: [] });
      }
    } catch (err) {
      console.error('Error fetching user analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserMetrics();
  }, [user]);

  const getInsightTone = (avg) => {
    if (avg >= 75) return { color: isDark ? 'text-emerald-400' : 'text-emerald-600', icon: '🎉' };
    if (avg >= 50) return { color: isDark ? 'text-amber-400' : 'text-amber-600', icon: '⚖️' };
    return { color: isDark ? 'text-[oklch(0.68_0.04_265)]' : 'text-slate-600', icon: '📈' };
  };

  if (loading) {
    return (
      <div className={`flex-1 flex items-center justify-center p-12 font-mono text-xs ${t.bg}`}>
        LOADING YOUR PERFORMANCE METRICS...
      </div>
    );
  }

  const getPositives = (avg) => {
    if (avg >= 75) return 'Exceptional consistency! Strong command over core syllabus concepts and time management.';
    if (avg >= 50) return 'Good foundational understanding. Regular test practice is building steady momentum.';
    return 'Showing great dedication by attempting tests consistently. Room for foundational growth.';
  };

  const getImprovements = (avg) => {
    if (avg >= 75) return 'Focus on speed optimization during high-pressure timed sprints.';
    if (avg >= 50) return 'Work on accuracy in tricky reasoning sections and review skipped questions.';
    return 'Focus heavily on core concepts, topic drills, and analyzing incorrect answers post-test.';
  };

  const insight = getInsightTone(stats.avgNum);

  return (
    <div className={`flex-1 p-6 sm:p-10 space-y-10 max-w-7xl mx-auto w-full font-sans transition-colors duration-200 ${t.bg}`}>
      
      {/* Header Section */}
      <header className={`flex justify-between items-center flex-wrap gap-6 border-b pb-6 ${isDark ? 'border-white/10' : isMono ? 'border-black' : 'border-slate-200'}`}>
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">
            PERFORMANCE ANALYTICS
          </h1>
          <p className="text-sm opacity-75 font-medium">
            STUDENT PROGRESS OVERVIEW — <span className="font-mono">{user?.email}</span>
          </p>
        </div>
        <button
          onClick={fetchUserMetrics}
          className={`px-6 py-3 rounded-2xl text-xs font-bold tracking-wider uppercase transition-colors flex items-center gap-2 cursor-pointer shadow-sm ${t.buttonPrimary}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </header>

      {/* Top Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div className={`p-8 rounded-3xl border flex flex-col justify-between gap-3 ${t.card}`}>
          <div className="text-sm uppercase tracking-wider font-semibold opacity-75">Tests Attended</div>
          <div className="text-5xl font-extrabold">{stats.totalTests}</div>
          <div className={`text-xs font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Completed mock sessions</div>
        </div>

        <div className={`p-8 rounded-3xl border flex flex-col justify-between gap-3 ${t.card}`}>
          <div className="text-sm uppercase tracking-wider font-semibold opacity-75">Average Score</div>
          <div className={`text-5xl font-extrabold ${insight.color}`}>{stats.avgScore}%</div>
          <div className="text-xs opacity-75 font-medium">Across all submitted exams</div>
        </div>

        <div className={`p-8 rounded-3xl border flex flex-col justify-between gap-3 ${t.card}`}>
          <div className="text-sm uppercase tracking-wider font-semibold opacity-75">Personal Best</div>
          <div className={`text-5xl font-extrabold ${t.accentText}`}>{stats.highestScore}%</div>
          <div className={`text-xs font-medium ${t.accentText}`}>Highest score recorded</div>
        </div>
      </div>

      {/* AI Insights: Positives & Areas of Improvement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className={`rounded-3xl p-8 border space-y-3 ${t.card}`}>
          <div className={`text-sm font-bold uppercase tracking-widest ${insight.color} flex items-center gap-3`}>
            <span>{insight.icon}</span> KEY STRENGTHS
          </div>
          <p className="leading-relaxed text-base opacity-90">
            {stats.totalTests > 0 ? getPositives(stats.avgNum) : 'Complete your first mock test to unlock personalized behavioral feedback.'}
          </p>
        </div>

        <div className={`rounded-3xl p-8 border space-y-3 ${t.card}`}>
          <div className="text-sm font-bold uppercase tracking-widest flex items-center gap-3 opacity-90">
            <span>🧐</span> RECOMMENDATIONS
          </div>
          <p className="leading-relaxed text-base opacity-90">
            {stats.totalTests > 0 ? getImprovements(stats.avgNum) : 'Take practice tests regularly to identify weak subject areas and bottlenecks.'}
          </p>
        </div>
      </div>

      {/* Graphical Progress List / History */}
      <section className={`rounded-3xl p-8 border space-y-8 ${t.card}`}>
        <h3 className="text-xl font-bold">
          Recent Test Performance History
        </h3>

        {stats.submissions.length === 0 ? (
          <div className={`text-center py-12 text-sm rounded-2xl border ${t.cardInner}`}>
            No test history found yet. Complete a Full Mock or Time Drill to populate charts!
          </div>
        ) : (
          <div className="space-y-5">
            {stats.submissions.slice(-5).reverse().map((sub, idx) => {
              const pct = sub.total_marks > 0 ? ((Number(sub.score) / Number(sub.total_marks)) * 100).toFixed(0) : 0;
              return (
                <div key={idx} className={`p-5 rounded-2xl border space-y-2 ${t.cardInner}`}>
                  <div className="flex justify-between items-baseline gap-4">
                    <span className="font-semibold text-sm truncate">{sub.exam_title || 'Mock Examination'}</span>
                    <span className={`font-mono text-xs font-bold ${insight.color} tabular-nums shrink-0`}>
                      {pct}% — {sub.score}/{sub.total_marks}
                    </span>
                  </div>
                  <div className={`w-full h-1.5 rounded-full overflow-hidden border ${isDark ? 'bg-black border-white/10' : 'bg-slate-200 border-slate-300'}`}>
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${isDark ? 'bg-[oklch(0.94_0.21_118)]' : isMono ? 'bg-black' : 'bg-indigo-600'}`}
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
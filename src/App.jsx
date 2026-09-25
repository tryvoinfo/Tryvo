import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import ExamPortal from './components/ExamPortal';
import BulkExcelUploader from './components/BulkExcelUploader';
import AdminCurriculumBuilder from './components/AdminCurriculumBuilder';
import AdminExamCreator from './components/AdminExamCreator';
import AdminUserAllocator from './components/AdminUserAllocator';
import UserAnalytics from './components/UserAnalytics';
import ChangePasswordModal from './components/ChangePasswordModal';

const supabaseUrl = 'https://wbcdiewohpngqbeqrfmb.supabase.co';
const supabaseAnonKey = 'sb_publishable_d21wos13j9x7K-w1h8vsvw_0gPm_jlY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function AdminPortalWrapper() {
  const [adminTab, setAdminTab] = useState('organogram');

  return (
    <div className="flex-1 flex flex-col bg-[oklch(0.16_0.03_265)]">
      <div className="bg-[oklch(0.23_0.045_265)] border-b border-white/10 px-8 py-4 flex gap-4 font-mono text-xs flex-wrap">
        <button
          onClick={() => setAdminTab('organogram')}
          className={`px-5 py-2.5 rounded-xl font-bold tracking-wider transition cursor-pointer ${
            adminTab === 'organogram' ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)]' : 'text-white'
          }`}
        >
          🌳 Organogram Studio
        </button>
        <button
          onClick={() => setAdminTab('excel')}
          className={`px-5 py-2.5 rounded-xl font-bold tracking-wider transition cursor-pointer ${
            adminTab === 'excel' ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)]' : 'text-white'
          }`}
        >
          📊 Bulk Excel Uploader
        </button>
        <button
          onClick={() => setAdminTab('exams')}
          className={`px-5 py-2.5 rounded-xl font-bold tracking-wider transition cursor-pointer ${
            adminTab === 'exams' ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)]' : 'text-white'
          }`}
        >
          📝 Create New Exam
        </button>
        <button
          onClick={() => setAdminTab('access')}
          className={`px-5 py-2.5 rounded-xl font-bold tracking-wider transition cursor-pointer ${
            adminTab === 'access' ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)]' : 'text-white'
          }`}
        >
          🛡️ Access Control & Exams
        </button>
      </div>

      <div className="flex-1 flex flex-col">
        {adminTab === 'organogram' && <AdminCurriculumBuilder />}
        {adminTab === 'excel' && <BulkExcelUploader />}
        {adminTab === 'exams' && <AdminExamCreator />}
        {adminTab === 'access' && <AdminUserAllocator />}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [currentView, setCurrentView] = useState('exam');
  const [examPortalResetKey, setExamPortalResetKey] = useState(0);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function getSession() {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user || null;

      if (currentUser) {
        // Use .maybeSingle() instead of .single() to avoid errors if the email isn't found
        const { data: whitelist } = await supabase
          .from('allowed_users')
          .select('email')
          .eq('email', currentUser.email)
          .maybeSingle();

        if (!whitelist) {
          await supabase.auth.signOut();
          setUser(null);
          setCheckingSession(false);
          return;
        }

        setUser(currentUser);
      }
      setCheckingSession(false);
    }
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const cleanEmail = email.trim().toLowerCase();

      const { data: whitelist, error: whitelistError } = await supabase
        .from('allowed_users')
        .select('email')
        .eq('email', cleanEmail)
        .single();

      if (whitelistError || !whitelist) {
        throw new Error('Access denied. Your email is not authorized by the administrator.');
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (authError) throw authError;

      if (data?.session) {
        setUser(data.session.user);
      }
    } catch (err) {
      console.error(err);
      setMessage(err.message || 'Invalid login credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Universal handler for TESTS link across all pages
  const handleTestsClick = () => {
    setCurrentView('exam');
    if (window.scrollToConfigSection) {
      window.scrollToConfigSection();
    } else {
      setExamPortalResetKey(prev => prev + 1);
    }
  };

  // Secure Admin Keyboard Shortcut (Ctrl + Shift + A)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const ADMIN_EMAILS = ['tryvo.info@gmail.com'];
        if (user && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
          setCurrentView((prev) => (prev === 'admin' ? 'exam' : 'admin'));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user]);

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[oklch(0.16_0.03_265)] flex items-center justify-center font-mono text-xs text-[oklch(0.94_0.21_118)]">
        LOADING TRYVO...
      </div>
    );
  }

  // Pre-Login Page
  if (!user) {
    return (
      <div className="min-h-screen bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)] flex flex-col font-sans relative overflow-x-hidden">
        {/* Injecting marquee animation keyframes */}
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-50%); }
          }
          .animate-marquee {
            display: inline-block;
            white-space: nowrap;
            animation: marquee 25s linear infinite;
          }
        `}</style>

        <div className="fixed inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:44px_44px] pointer-events-none z-0"></div>
        <div className="fixed -top-40 -left-40 w-96 h-96 bg-[oklch(0.94_0.21_118)]/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
        <div className="fixed -bottom-40 -right-40 w-96 h-96 bg-[oklch(0.68_0.16_245)]/10 rounded-full blur-[120px] pointer-events-none z-0"></div>

        <header className="relative z-20 bg-[oklch(0.23_0.045_265)]/80 backdrop-blur-xl border-b border-white/10 px-6 sm:px-12 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] font-black flex items-center justify-center rounded-xl text-lg font-mono shadow-[0_0_20px_rgba(204,255,0,0.35)]">
              T
            </div>
            <span className="font-extrabold text-2xl text-[oklch(0.96_0.012_265)] tracking-tight">TRYVO</span>
          </div>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-[oklch(0.68_0.04_265)]">Open Competitive Exam Practice</span>
        </header>

        {/* Horizontal Running Marquee Banner */}
        <div className="bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] font-mono text-xs font-extrabold uppercase py-2.5 px-4 overflow-hidden whitespace-nowrap relative z-20 shadow-md">
          <div className="animate-marquee tracking-wider">
            Want free mock tests? Send us your goal at tryvo.info@gmail.com and get started today! &nbsp;&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;&nbsp; Want free mock tests? Send us your goal at tryvo.info@gmail.com and get started today! &nbsp;&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;&nbsp; Want free mock tests? Send us your goal at tryvo.info@gmail.com and get started today!
          </div>
        </div>

        <main className="flex-1 relative z-10 max-w-7xl mx-auto px-6 sm:px-12 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 font-mono text-xs text-[oklch(0.68_0.04_265)]">
              <span className="w-2 h-2 rounded-full bg-[oklch(0.94_0.21_118)] animate-pulse"></span>
              IMPOSSIBLE IS FOR THE UNWILLING - JOHN KEATS
            </div>

            <div className="space-y-5">
              <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.05]">
                Master your competitive exams with <span className="text-[oklch(0.94_0.21_118)]">precision mocks.</span>
              </h1>
              <p className="font-sans text-lg text-[oklch(0.68_0.04_265)] leading-relaxed max-w-xl">
                Access professional-grade mock exams for competitive tests completely free. Simulate real testing conditions, track your performance, and outperform the competition.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 font-mono text-xs">
              <div className="bg-[oklch(0.23_0.045_265)]/80 border border-white/10 rounded-2xl p-5 space-y-2">
                <div className="text-[oklch(0.94_0.21_118)] font-bold text-sm">⚡ Real Exam Simulations</div>
                <p className="text-[oklch(0.68_0.04_265)] font-sans text-xs">Timed sprints and structured question modules matching actual exams.</p>
              </div>
              <div className="bg-[oklch(0.23_0.045_265)]/80 border border-white/10 rounded-2xl p-5 space-y-2">
                <div className="text-[oklch(0.94_0.21_118)] font-bold text-sm">📈 Smart Analytics</div>
                <p className="text-[oklch(0.68_0.04_265)] font-sans text-xs">Instant score breakdowns and detailed solution reviews.</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 w-full max-w-md mx-auto bg-[oklch(0.23_0.045_265)] border border-white/15 rounded-3xl p-8 shadow-2xl space-y-6 backdrop-blur-xl">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black tracking-tight">Access Tryvo</h2>
              <p className="font-mono text-xs text-[oklch(0.68_0.04_265)] uppercase tracking-wider">Enter your whitelisted credentials</p>
            </div>

            {message && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-mono text-rose-400 text-center">
                {message}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block uppercase tracking-[0.15em] text-[oklch(0.68_0.04_265)] mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-[oklch(0.94_0.21_118)]"
                />
              </div>

              <div>
                <label className="block uppercase tracking-[0.15em] text-[oklch(0.68_0.04_265)] mb-2">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-[oklch(0.94_0.21_118)]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[oklch(0.94_0.21_118)] hover:brightness-110 text-[oklch(0.16_0.03_265)] font-extrabold uppercase tracking-[0.15em] rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.2)] transition cursor-pointer"
              >
                {loading ? 'AUTHENTICATING...' : 'LOGIN TO BATTLEGROUND →'}
              </button>
            </form>
          </div>
        </main>

        <footer className="relative z-10 bg-[oklch(0.16_0.03_265)] border-t border-white/10 px-6 sm:px-12 py-6 text-center font-mono text-xs text-[oklch(0.68_0.04_265)]">
          © 2026 Tryvo Labs. All rights reserved.
        </footer>
      </div>
    );
  }

  // Post-Login Page
  return (
    <div className="min-h-screen bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)] flex flex-col font-sans">
      <header className="relative z-20 bg-[oklch(0.23_0.045_265)]/80 backdrop-blur-xl border-b border-white/10 px-6 sm:px-12 py-4 flex justify-between items-center">
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={handleTestsClick}
        >
          <div className="w-9 h-9 bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] font-black flex items-center justify-center rounded-xl text-base font-mono shadow-[0_0_20px_rgba(204,255,0,0.35)]">
            T
          </div>
          <span className="font-extrabold text-xl text-[oklch(0.96_0.012_265)]">TRYVO</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 font-mono text-xs tracking-[0.15em] text-[oklch(0.68_0.04_265)] uppercase font-semibold">
          <button onClick={handleTestsClick} className="hover:text-white cursor-pointer">TESTS</button>
          <button onClick={() => setCurrentView('analytics')} className="hover:text-white cursor-pointer">ANALYTICS</button>
          <button onClick={() => setCurrentView('STUDY MATERIAL')} className="hover:text-white cursor-pointer">STUDY MATERIAL</button>
          <button onClick={() => setCurrentView('about')} className="hover:text-white cursor-pointer">ABOUT US</button>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="px-3.5 py-2 bg-[oklch(0.16_0.03_265)] text-[oklch(0.94_0.21_118)] font-mono text-xs uppercase font-bold rounded-xl border border-white/10 cursor-pointer"
          >
            🔑 Change Password
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="px-4 py-2 bg-rose-600/20 border border-rose-500/30 text-rose-300 font-mono text-xs uppercase rounded-xl cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative z-10">
        {currentView === 'exam' && <ExamPortal key={examPortalResetKey} />}
        {currentView === 'admin' && <AdminPortalWrapper />}
        {currentView === 'analytics' && <UserAnalytics user={user} />}
        {currentView === 'STUDY MATERIAL' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <h1 className="text-3xl font-extrabold text-[oklch(0.94_0.21_118)]">Under Construction</h1>
            <p className="font-mono text-sm text-[oklch(0.68_0.04_265)] uppercase">Check back soon for curated study materials!</p>
          </div>
        )}
        {currentView === 'about' && (
          <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-3xl mx-auto space-y-6 text-center">
            <h1 className="text-4xl font-black text-[oklch(0.94_0.21_118)]">About Tryvo</h1>
            <p className="font-sans text-base text-[oklch(0.96_0.012_265)] leading-relaxed">
              We are a group of friends united by a single, powerful vision: making quality education free and accessible to everyone. By providing high-quality, free mock tests for competitive exams, we are working to level the playing field. Our guiding philosophy is simple: <strong className="text-[oklch(0.94_0.21_118)]">&quot;Develop Together.&quot;</strong>
            </p>
          </div>
        )}
      </main>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
}
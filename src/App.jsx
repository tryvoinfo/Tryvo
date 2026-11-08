import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import ExamPortal from './components/ExamPortal';
import BulkExcelUploader from './components/BulkExcelUploader';
import AdminCurriculumBuilder from './components/AdminCurriculumBuilder';
import AdminExamCreator from './components/AdminExamCreator';
import AdminUserAllocator from './components/AdminUserAllocator';
import AdminQuestionManager from './components/AdminQuestionManager';
import UserAnalytics from './components/UserAnalytics';
import ChangePasswordModal from './components/ChangePasswordModal';

const supabaseUrl = 'https://wbcdiewohpngqbeqrfmb.supabase.co';
const supabaseAnonKey = 'sb_publishable_d21wos13j9x7K-w1h8vsvw_0gPm_jlY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
        input: 'bg-white border-2 border-black text-black'
      };
    case 'light-blue': // Standard Modern Light Mode
      return {
        bg: 'bg-[#f9fafb] text-[#111827]',
        card: 'bg-white border-slate-200 text-slate-900 shadow-xs',
        header: 'bg-white border-b border-slate-200 text-slate-900 shadow-xs',
        buttonPrimary: 'bg-indigo-600 text-white hover:bg-indigo-700',
        accentText: 'text-indigo-600',
        badge: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
        input: 'bg-slate-50 border-slate-300 text-slate-900'
      };
    case 'dark': // Tryvo Dark Mode
    default:
      return {
        bg: 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)]',
        card: 'bg-[oklch(0.23_0.045_265)] border-white/15 text-white',
        header: 'bg-[oklch(0.23_0.045_265)]/80 border-white/10 text-white',
        buttonPrimary: 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] hover:brightness-110 shadow-[0_0_20px_rgba(204,255,0,0.2)]',
        accentText: 'text-[oklch(0.94_0.21_118)]',
        badge: 'bg-white/5 border-white/10 text-[oklch(0.68_0.04_265)]',
        input: 'bg-[oklch(0.16_0.03_265)] border-white/10 text-white'
      };
  }
};

function AdminPortalWrapper({ theme }) {
  const [adminTab, setAdminTab] = useState('organogram');
  const t = getThemeClasses(theme);
  const isDark = theme === 'dark';

  return (
    <div className={`flex-1 flex flex-col transition-colors duration-200 ${t.bg}`}>
      <div className={`border-b px-8 py-4 flex gap-4 font-mono text-xs flex-wrap transition-colors duration-200 ${t.header}`}>
        {[
          { id: 'organogram', label: '🌳 Organogram Studio' },
          { id: 'excel', label: '📊 Bulk Excel Uploader' },
          { id: 'exams', label: '📝 Create New Exam' },
          { id: 'access', label: '🛡️ Access Control & Exams' },
          { id: 'qmanager', label: '📋 Question Manager' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setAdminTab(tab.id)}
            className={`px-5 py-2.5 rounded-xl font-bold tracking-wider transition cursor-pointer ${
              adminTab === tab.id 
                ? (isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)]' : theme === 'light-mono' ? 'bg-black text-white' : 'bg-indigo-600 text-white') 
                : (isDark ? 'text-white hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100')
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col">
        {adminTab === 'organogram' && <AdminCurriculumBuilder />}
        {adminTab === 'excel' && <BulkExcelUploader />}
        {adminTab === 'exams' && <AdminExamCreator />}
        {adminTab === 'access' && <AdminUserAllocator />}
        {adminTab === 'qmanager' && <AdminQuestionManager />}
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
  
  // Theme state: 'dark' | 'light-blue' | 'light-mono'
  const [theme, setTheme] = useState('dark');
  const t = getThemeClasses(theme);
  const isDark = theme === 'dark';

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

  const handleTestsClick = () => {
    setCurrentView('exam');
    if (window.scrollToConfigSection) {
      window.scrollToConfigSection();
    } else {
      setExamPortalResetKey(prev => prev + 1);
    }
  };

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
      <div className={`min-h-screen flex items-center justify-center font-mono text-xs ${t.bg}`}>
        LOADING TRYVO...
      </div>
    );
  }

  // Pre-Login Page
  if (!user) {
    return (
      <div className={`min-h-screen flex flex-col font-sans relative overflow-x-hidden transition-colors duration-200 ${t.bg}`}>
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

        <header className={`relative z-20 backdrop-blur-xl border-b px-6 sm:px-12 py-5 flex justify-between items-center transition-colors duration-200 ${t.header}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 font-black flex items-center justify-center rounded-xl text-lg font-mono shadow-md ${
              isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)]' : theme === 'light-mono' ? 'bg-black text-white' : 'bg-indigo-600 text-white'
            }`}>
              T
            </div>
            <span className="font-extrabold text-2xl tracking-tight">TRYVO</span>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className={`px-3.5 py-2 font-mono text-xs uppercase font-bold rounded-xl border transition cursor-pointer shadow-xs ${t.input}`}
            >
              <option value="dark">🌙 Tryvo Dark</option>
              <option value="light-blue">☀️ Modern Light</option>
              <option value="light-mono">🗞️ B&W Mode</option>
            </select>
            <span className={`font-mono text-xs uppercase tracking-widest hidden sm:inline opacity-75`}>Open Competitive Exam Practice</span>
          </div>
        </header>

        {/* Marquee Banner */}
        <div className={`font-mono text-xs font-bold uppercase py-2.5 px-4 overflow-hidden whitespace-nowrap relative z-20 shadow-xs ${
          isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)]' : theme === 'light-mono' ? 'bg-black text-white' : 'bg-indigo-600 text-white'
        }`}>
          <div className="animate-marquee tracking-wider">
            Want free mock tests? Send us your goal at tryvo.info@gmail.com and get started today! &nbsp;&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;&nbsp; Want free mock tests? Send us your goal at tryvo.info@gmail.com and get started today!
          </div>
        </div>

        <main className="flex-1 relative z-10 max-w-7xl mx-auto px-6 sm:px-12 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-8">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border font-mono text-xs shadow-xs ${t.badge}`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${isDark ? 'bg-[oklch(0.94_0.21_118)]' : 'bg-indigo-600'}`}></span>
              IMPOSSIBLE IS FOR THE UNWILLING - JOHN KEATS
            </div>

            <div className="space-y-5">
              <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.08]">
                Master your competitive exams with <span className={t.accentText}>precision mocks.</span>
              </h1>
              <p className="font-sans text-lg leading-relaxed max-w-xl opacity-80">
                Access professional-grade mock exams for competitive tests completely free. Simulate real testing conditions, track your performance, and outperform the competition.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 font-mono text-xs">
              <div className={`border rounded-2xl p-5 space-y-2 shadow-xs transition-colors duration-200 ${t.card}`}>
                <div className={`font-bold text-sm ${t.accentText}`}>⚡ Real Exam Simulations</div>
                <p className="font-sans text-xs opacity-75">Timed sprints and structured question modules matching actual exams.</p>
              </div>
              <div className={`border rounded-2xl p-5 space-y-2 shadow-xs transition-colors duration-200 ${t.card}`}>
                <div className={`font-bold text-sm ${t.accentText}`}>📈 Smart Analytics</div>
                <p className="font-sans text-xs opacity-75">Instant score breakdowns and detailed solution reviews.</p>
              </div>
            </div>
          </div>

          <div className={`lg:col-span-5 w-full max-w-md mx-auto border rounded-3xl p-8 shadow-xl space-y-6 backdrop-blur-xl transition-colors duration-200 ${t.card}`}>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black tracking-tight">Access Tryvo</h2>
              <p className="font-mono text-xs uppercase tracking-wider opacity-70">Enter your whitelisted credentials</p>
            </div>

            {message && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-mono text-rose-400 text-center">
                {message}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block uppercase tracking-[0.15em] mb-2 font-semibold opacity-80">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full border rounded-xl p-3.5 text-sm focus:outline-none transition-colors duration-200 ${t.input}`}
                />
              </div>

              <div>
                <label className="block uppercase tracking-[0.15em] mb-2 font-semibold opacity-80">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full border rounded-xl p-3.5 text-sm focus:outline-none transition-colors duration-200 ${t.input}`}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 font-extrabold uppercase tracking-[0.15em] rounded-xl transition cursor-pointer shadow-sm ${t.buttonPrimary}`}
              >
                {loading ? 'AUTHENTICATING...' : 'LOGIN TO BATTLEGROUND →'}
              </button>
            </form>
          </div>
        </main>

        <footer className={`relative z-10 border-t px-6 sm:px-12 py-6 text-center font-mono text-xs transition-colors duration-200 ${t.header}`}>
          © 2026 Tryvo Labs. All rights reserved.
        </footer>
      </div>
    );
  }

  // Post-Login Page
  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${t.bg}`}>
      <header className={`relative z-20 backdrop-blur-xl border-b px-6 sm:px-12 py-4 flex justify-between items-center transition-colors duration-200 ${t.header}`}>
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={handleTestsClick}
        >
          <div className={`w-9 h-9 font-black flex items-center justify-center rounded-xl text-base font-mono shadow-md ${
            isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)]' : theme === 'light-mono' ? 'bg-black text-white' : 'bg-indigo-600 text-white'
          }`}>
            T
          </div>
          <span className="font-extrabold text-xl tracking-tight">TRYVO</span>
        </div>

        <nav className={`hidden md:flex items-center gap-8 font-mono text-xs tracking-[0.15em] uppercase font-semibold opacity-80`}>
          <button onClick={handleTestsClick} className={`hover:cursor-pointer transition-colors ${t.accentText}`}>TESTS</button>
          <button onClick={() => setCurrentView('analytics')} className={`hover:cursor-pointer transition-colors ${t.accentText}`}>ANALYTICS</button>
          <button onClick={() => setCurrentView('STUDY MATERIAL')} className={`hover:cursor-pointer transition-colors ${t.accentText}`}>STUDY MATERIAL</button>
          <button onClick={() => setCurrentView('about')} className={`hover:cursor-pointer transition-colors ${t.accentText}`}>ABOUT US</button>
        </nav>

        <div className="flex items-center gap-3">
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className={`px-3.5 py-2 font-mono text-xs uppercase font-bold rounded-xl border transition cursor-pointer shadow-xs ${t.input}`}
          >
            <option value="dark">🌙 Tryvo Dark</option>
            <option value="light-blue">☀️ Modern Light</option>
            <option value="light-mono">🗞️ B&W Mode</option>
          </select>

          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className={`px-3.5 py-2 font-mono text-xs uppercase font-bold rounded-xl border transition cursor-pointer ${t.input}`}
          >
            🔑 Change Password
          </button>

          <button
            onClick={() => supabase.auth.signOut()}
            className="px-4 py-2 bg-rose-600/20 border border-rose-500/30 text-rose-400 font-mono text-xs uppercase rounded-xl cursor-pointer hover:bg-rose-600/30 transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative z-10">
        {currentView === 'exam' && <ExamPortal key={examPortalResetKey} theme={theme} />}
        {currentView === 'admin' && <AdminPortalWrapper theme={theme} />}
        {currentView === 'analytics' && <UserAnalytics user={user} theme={theme} />}
        {currentView === 'STUDY MATERIAL' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <h1 className={`text-3xl font-extrabold ${t.accentText}`}>Under Construction</h1>
            <p className="font-mono text-sm uppercase opacity-70">Check back soon for curated study materials!</p>
          </div>
        )}
        {currentView === 'about' && (
          <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-3xl mx-auto space-y-6 text-center">
            <h1 className={`text-4xl font-black ${t.accentText}`}>About Tryvo</h1>
            <p className="font-sans text-base leading-relaxed opacity-90">
              We are a group of friends united by a single, powerful vision: making quality education free and accessible to everyone. By providing high-quality, free mock tests for competitive exams, we are working to level the playing field. Our guiding philosophy is simple: <strong className={t.accentText}>&quot;Develop Together.&quot;</strong>
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
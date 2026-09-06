import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import ExamPortal from './components/ExamPortal';
import BulkExcelUploader from './components/BulkExcelUploader';

const supabaseUrl = 'https://wbcdiewohpngqbeqrfmb.supabase.co';
const supabaseAnonKey = 'sb_publishable_d21wos13j9x7K-w1h8vsvw_0gPm_jlY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [currentView, setCurrentView] = useState('exam'); // 'exam' | 'admin' | 'STUDY MATERIAL' | 'about'
  const [examPortalResetKey, setExamPortalResetKey] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  // Automatically log visitor telemetry once when the app loads
  useEffect(() => {
    async function logVisitor() {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();

        const town = data.city || 'Unspecified Town';
        const country = data.country_name || 'Unspecified Country';
        const ip = data.ip || '0.0.0.0';

        await supabase.from('visitor_analytics').insert([
          { 
            visited_at: new Date().toISOString(),
            town: town,
            country: country,
            ip_address: ip
          }
        ]);
      } catch (err) {
        console.error("Error logging visitor telemetry:", err);
        try {
          await supabase.from('visitor_analytics').insert([
            { visited_at: new Date().toISOString(), town: 'Unspecified Town' }
          ]);
        } catch (fallbackErr) {
          console.error("Fallback insert failed:", fallbackErr);
        }
      }
    }
    logVisitor();
  }, []);

  const handleTestsClick = () => {
    setCurrentView('exam');
    if (window.scrollToConfigSection) {
      window.scrollToConfigSection();
    } else {
      setExamPortalResetKey(prev => prev + 1);
    }
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowInstallGuide(true);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setCurrentView((prev) => (prev === 'admin' ? 'exam' : 'admin'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)] flex flex-col font-sans selection:bg-[oklch(0.94_0.21_118)] selection:text-[oklch(0.16_0.03_265)]">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:44px_44px] pointer-events-none z-0"></div>
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-[oklch(0.94_0.21_118)]/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed -bottom-40 -right-40 w-96 h-96 bg-[oklch(0.68_0.16_245)]/10 rounded-full blur-[120px] pointer-events-none z-0"></div>

      <header className="relative z-20 bg-[oklch(0.23_0.045_265)]/80 backdrop-blur-xl border-b border-white/10 px-6 sm:px-12 py-4 flex justify-between items-center">
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => {
            setCurrentView('exam');
            setExamPortalResetKey(prev => prev + 1);
          }}
        >
          <div className="w-9 h-9 bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] font-black flex items-center justify-center rounded-xl text-base font-mono shadow-[0_0_20px_rgba(204,255,0,0.35)] group-hover:scale-105 transition relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
            <span className="tracking-tighter font-['Archivo_Black']">T</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-extrabold tracking-tighter text-xl font-['Archivo_Black'] text-[oklch(0.96_0.012_265)]">TRYVO</span>
            <span className="px-2 py-0.5 bg-[oklch(0.94_0.21_118)]/10 border border-[oklch(0.94_0.21_118)]/30 text-[oklch(0.94_0.21_118)] font-mono text-[9px] tracking-[0.2em] uppercase rounded-md font-bold">beta</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 font-mono text-xs tracking-[0.15em] text-[oklch(0.68_0.04_265)] uppercase font-semibold">
          <button onClick={handleTestsClick} className="hover:text-[oklch(0.96_0.012_265)] transition cursor-pointer">TESTS</button>
          <button onClick={() => setCurrentView('STUDY MATERIAL')} className="hover:text-[oklch(0.96_0.012_265)] transition cursor-pointer">STUDY MATERIAL</button>
          <button onClick={() => setCurrentView('about')} className="hover:text-[oklch(0.96_0.012_265)] transition cursor-pointer">ABOUT US</button>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={handleInstallClick}
            className="px-5 py-2.5 bg-[oklch(0.94_0.21_118)] hover:brightness-110 text-[oklch(0.16_0.03_265)] font-mono text-xs uppercase tracking-[0.15em] font-extrabold rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.25)] transition cursor-pointer"
          >
            Install App
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative z-10">
        {currentView === 'exam' && <ExamPortal key={examPortalResetKey} />}
        {currentView === 'admin' && <BulkExcelUploader />}
        {currentView === 'STUDY MATERIAL' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <h1 className="text-3xl sm:text-5xl font-extrabold font-['Archivo_Black'] text-[oklch(0.94_0.21_118)]">Under Construction</h1>
            <p className="font-mono text-sm text-[oklch(0.68_0.04_265)] uppercase tracking-wider">We are building something awesome for Study Material. Check back soon!</p>
            <button 
              onClick={() => setCurrentView('exam')}
              className="mt-4 px-6 py-3 bg-[oklch(0.23_0.045_265)] hover:bg-[oklch(0.23_0.045_265)]/80 border border-white/10 font-mono text-xs uppercase tracking-widest rounded-xl transition cursor-pointer"
            >
              ← Return to Tests
            </button>
          </div>
        )}
        {currentView === 'about' && (
          <div className="flex-1 flex flex-col items-center justify-start p-6 sm:p-16 max-w-4xl mx-auto space-y-8">
            <div className="space-y-3 text-center">
              <h1 className="text-3xl sm:text-5xl font-black font-['Archivo_Black'] tracking-tight text-[oklch(0.94_0.21_118)]">ABOUT US</h1>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[oklch(0.68_0.04_265)] font-bold">Develop Together</p>
            </div>

            <div className="bg-[oklch(0.23_0.045_265)]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-12 space-y-6 text-sm sm:text-base font-sans text-[oklch(0.96_0.012_265)] leading-relaxed shadow-2xl">
              <div>
                <h3 className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-[oklch(0.94_0.21_118)] mb-2">Our Mission: Education for All</h3>
                <p>
                  We are a group of friends united by a single, powerful vision: making quality education free and accessible to everyone. By providing high-quality, free mock tests for competitive exams, we are working to level the playing field and contribute to the development of society as a whole. Our guiding philosophy is simple: &quot;Develop Together.&quot;
                </p>
              </div>

              <p>
                If you believe we are on the right path and share our passion for accessible education, we warmly invite you to become a part of our journey.
              </p>

              <div className="space-y-4 pt-4 border-t border-white/10">
                <h3 className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-[oklch(0.94_0.21_118)]">How You Can Be a Part of the Team</h3>
                <p className="text-xs sm:text-sm text-[oklch(0.68_0.04_265)] font-mono">There is a place for everyone in this mission. Here are a few ways you can support the cause in whatever capacity you can:</p>
                
                <ul className="space-y-3 list-disc pl-5 text-sm">
                  <li>
                    <strong className="text-white">Share Your Thoughts:</strong> Your words fuel our work. Whether it’s constructive feedback to help us improve or a simple note of appreciation, we’d love to hear from you at <a href="mailto:tryvo.info@gmail.com" className="text-[oklch(0.94_0.21_118)] underline hover:brightness-110">tryvo.info@gmail.com</a>.
                  </li>
                  <li>
                    <strong className="text-white">Share Your Expertise:</strong> Are you highly skilled in a particular subject? Reach out to us! We can collaborate to share your knowledge and content with students who need it most.
                  </li>
                  <li>
                    <strong className="text-white">Contribute Financially:</strong> If you are short on time but wish to help us keep the lights on, financial contributions toward our operating expenses are deeply appreciated. We hold ourselves to the highest standards of transparency—every single rupee is accounted for and completely auditable.
                  </li>
                  <li>
                    <strong className="text-white">Support in Kind:</strong> Hesitant to contribute financially? We completely understand and respect that trust must be earned. You can still make a massive impact by donating books, providing study materials, offering a physical space where we could host free coaching, or contributing in any other creative way you fit.
                  </li>
                </ul>
              </div>
            </div>

            <button 
              onClick={() => setCurrentView('exam')}
              className="px-6 py-3 bg-[oklch(0.23_0.045_265)] hover:bg-[oklch(0.23_0.045_265)]/80 border border-white/10 font-mono text-xs uppercase tracking-widest rounded-xl transition cursor-pointer"
            >
              ← Return to Tests
            </button>
          </div>
        )}
      </main>

      {/* Install App Instruction Modal */}
      {showInstallGuide && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[oklch(0.23_0.045_265)] border border-white/15 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl text-[oklch(0.96_0.012_265)] font-mono">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-lg font-black font-['Archivo_Black'] text-[oklch(0.94_0.21_118)]">INSTALL TRYVO</h3>
              <button 
                onClick={() => setShowInstallGuide(false)}
                className="text-xs text-white bg-white/10 px-2.5 py-1 rounded-xl hover:bg-white/25 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans text-[oklch(0.68_0.04_265)] leading-relaxed">
              <p>
                Your browser is managing the installation prompt automatically. You can install Tryvo manually in just two clicks:
              </p>
              
              <div className="space-y-3 font-mono bg-[oklch(0.16_0.03_265)] p-4 rounded-2xl border border-white/5">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 shrink-0 bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] rounded-full flex items-center justify-center font-bold text-[10px]">1</span>
                  <p><strong className="text-white">Desktop (Chrome / Edge):</strong> Click the three vertical dots (<span className="text-[oklch(0.94_0.21_118)]">⋮</span>) in the top-right corner of your browser window.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 shrink-0 bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] rounded-full flex items-center justify-center font-bold text-[10px]">2</span>
                  <p>Select <strong className="text-white">&quot;Install Tryvo...&quot;</strong> or <strong className="text-white">&quot;Save and share → Install page as app&quot;</strong>.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 shrink-0 bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] rounded-full flex items-center justify-center font-bold text-[10px]">📱</span>
                  <p><strong className="text-white">Mobile:</strong> Tap your browser menu and choose <strong className="text-white">&quot;Add to Home Screen&quot;</strong>.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowInstallGuide(false)}
              className="w-full py-3 bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] text-xs font-bold uppercase tracking-widest rounded-xl transition cursor-pointer hover:brightness-110 shadow"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      <footer className="relative z-10 bg-[oklch(0.16_0.03_265)] border-t border-white/10 px-6 sm:px-12 py-6 text-center font-mono text-xs text-[oklch(0.68_0.04_265)] flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>© 2026 Tryvo Labs. All rights reserved.</div>
        <div className="flex gap-6 uppercase tracking-[0.15em] text-[11px]">
          <span className="hover:text-[oklch(0.96_0.012_265)] cursor-pointer transition">Privacy</span>
          <span className="hover:text-[oklch(0.96_0.012_265)] cursor-pointer transition">Terms</span>
          <a href="mailto:tryvo.info@gmail.com" className="hover:text-[oklch(0.96_0.012_265)] cursor-pointer transition">Support</a>
        </div>
      </footer>
    </div>
  );
}
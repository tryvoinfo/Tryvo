import React, { useState, useEffect } from 'react';
import ExamPortal from './components/ExamPortal';
import BulkExcelUploader from './components/BulkExcelUploader';

export default function App() {
  const [currentView, setCurrentView] = useState('exam'); // 'exam' | 'admin'
  const [examPortalResetKey, setExamPortalResetKey] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const handleTestsClick = () => {
    setCurrentView('exam');
    // If already on the exam portal, scroll smoothly to the config section
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
      alert("PWA install prompt is not available yet. Use your browser's menu (Add to Home Screen / Install App).");
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
          <button onClick={handleTestsClick} className="hover:text-[oklch(0.96_0.012_265)] transition cursor-pointer">Tests</button>
          <span className="hover:text-[oklch(0.96_0.012_265)] transition cursor-pointer">Ranks</span>
          <span className="hover:text-[oklch(0.96_0.012_265)] transition cursor-pointer">Streaks</span>
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
        {currentView === 'exam' ? <ExamPortal key={examPortalResetKey} /> : <BulkExcelUploader />}
      </main>

      <footer className="relative z-10 bg-[oklch(0.16_0.03_265)] border-t border-white/10 px-6 sm:px-12 py-6 text-center font-mono text-xs text-[oklch(0.68_0.04_265)] flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>© 2026 Tryvo Labs. All rights reserved.</div>
        <div className="flex gap-6 uppercase tracking-[0.15em] text-[11px]">
          <span className="hover:text-[oklch(0.96_0.012_265)] cursor-pointer transition">Privacy</span>
          <span className="hover:text-[oklch(0.96_0.012_265)] cursor-pointer transition">Terms</span>
          <span className="hover:text-[oklch(0.96_0.012_265)] cursor-pointer transition">Support</span>
        </div>
      </footer>
    </div>
  );
}
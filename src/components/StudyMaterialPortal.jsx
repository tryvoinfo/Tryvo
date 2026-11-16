import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';

const cleanText = (text) => {
  if (!text) return '';
  return String(text).replace(/â€“/g, '–').replace(/â€”/g, '—').replace(/â€™/g, "'");
};

export default function StudyMaterialPortal({ theme = 'dark', user }) {
  const [exams, setExams] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('all');
  const [activeMaterial, setActiveMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);

  // Debug states
  const [debugAllocations, setDebugAllocations] = useState([]);
  const [debugAllMaterials, setDebugAllMaterials] = useState([]);

  // Reader States
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const pdfDocRef = useRef(null);

  const isDark = theme === 'dark';
  const isMono = theme === 'light-mono';

  // Safely resolve email
  const userEmail = typeof user === 'string' ? user : (user?.email || user?.user_metadata?.email || '');

  useEffect(() => {
    async function fetchData() {
      try {
        // 1. Fetch ALL rows from user_exam_allocations to inspect and match robustly
        const { data: allAllocations, error: allocErr } = await supabase
          .from('user_exam_allocations')
          .select('*');

        if (allocErr) console.error('Allocation fetch error:', allocErr);
        setDebugAllocations(allAllocations || []);

        // Filter allocations for current user case-insensitively
        const userAllocs = (allAllocations || []).filter(a => {
          const rowEmail = String(a.user_email || a.email || '').toLowerCase().trim();
          return userEmail && rowEmail === userEmail.toLowerCase().trim();
        });

        const allowedExamIds = new Set();
        userAllocs.forEach(a => {
          if (a.exam_id) allowedExamIds.add(String(a.exam_id).toLowerCase().trim());
        });

        // 2. Fetch all exams and study materials
        const { data: examData } = await supabase.from('exams').select('*');
        const { data: matData } = await supabase.from('study_materials').select('*');

        setDebugAllMaterials(matData || []);

        // Filter exams
        const filteredExams = (examData || []).filter(ex => {
          const exId = String(ex.exam_id || ex.id || '').toLowerCase().trim();
          // If no allocations found for testing convenience, you can also allow all or keep strict check
          return allowedExamIds.size === 0 ? true : allowedExamIds.has(exId);
        });

        // Filter materials
        const filteredMaterials = (matData || []).filter(mat => {
          const matExamId = String(mat.exam_id || '').toLowerCase().trim();
          // If no allocations found, show none or show all (let's match allowedExamIds)
          return allowedExamIds.size === 0 ? true : allowedExamIds.has(matExamId);
        });

        setExams(filteredExams);
        setMaterials(filteredMaterials);
      } catch (err) {
        console.error('Error fetching study materials:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [userEmail]);

  // Render PDF to Canvas via PDF.js CDN
  useEffect(() => {
    if (!activeMaterial) return;

    const renderPdf = async (fileUrl) => {
      setPdfLoading(true);
      setSearchResults([]);
      setSearchQuery('');
      setCurrentPage(1);

      try {
        if (!window.pdfjsLib) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.async = true;
            script.onload = () => {
              window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
              resolve();
            };
            script.onerror = reject;
            document.body.appendChild(script);
          });
        }

        const container = document.getElementById('pdf-canvas-container');
        if (!container) return;
        container.innerHTML = '';

        const loadingTask = window.pdfjsLib.getDocument(fileUrl);
        const pdfDoc = await loadingTask.promise;
        pdfDocRef.current = pdfDoc;
        setTotalPages(pdfDoc.numPages);

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const wrapper = document.createElement('div');
          wrapper.id = `pdf-page-wrapper-${i}`;
          wrapper.className = 'my-6 flex flex-col items-center relative';

          const canvas = document.createElement('canvas');
          canvas.id = `pdf-canvas-${i}`;
          canvas.className = 'shadow-2xl rounded-2xl border border-white/10 max-w-full bg-white';
          wrapper.appendChild(canvas);
          container.appendChild(wrapper);

          const context = canvas.getContext('2d');
          const viewport = page.getViewport({ scale: 1.5 });
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
        }
      } catch (err) {
        console.error('Canvas PDF render error:', err);
      } finally {
        setPdfLoading(false);
      }
    };

    if (activeMaterial.file_type === 'pdf') {
      renderPdf(activeMaterial.file_url);
    }
  }, [activeMaterial]);

  // Handle Search inside PDF text content
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || !pdfDocRef.current) return;

    const query = searchQuery.toLowerCase().trim();
    const matchedPages = [];

    setPdfLoading(true);
    try {
      for (let i = 1; i <= pdfDocRef.current.numPages; i++) {
        const page = await pdfDocRef.current.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ').toLowerCase();

        if (pageText.includes(query)) {
          matchedPages.push(i);
        }
      }

      setSearchResults(matchedPages);
      setCurrentMatchIdx(0);

      if (matchedPages.length > 0) {
        scrollToPage(matchedPages[0]);
      } else {
        alert(`No matches found for "${searchQuery}"`);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const jumpToNextMatch = () => {
    if (searchResults.length === 0) return;
    const nextIdx = (currentMatchIdx + 1) % searchResults.length;
    setCurrentMatchIdx(nextIdx);
    scrollToPage(searchResults[nextIdx]);
  };

  const scrollToPage = (pageNum) => {
    setCurrentPage(pageNum);
    const targetElement = document.getElementById(`pdf-page-wrapper-${pageNum}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Security Interceptors
  useEffect(() => {
    if (!activeMaterial) return;

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p' || e.key === 'u' || e.key === 'c' || e.key === 'a')) {
        e.preventDefault();
        alert('🔒 Security Protected: Downloading, printing, and copying are disabled.');
      }
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        alert('🔒 Security Protected: Screenshot capture is restricted.');
      }
    };

    const handleVisibilityChange = () => setIsBlurred(document.hidden);
    const handleWindowBlur = () => setIsBlurred(true);
    const handleWindowFocus = () => setIsBlurred(false);

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [activeMaterial]);

  const filteredMaterials = selectedExamId === 'all' 
    ? materials 
    : materials.filter(m => String(m.exam_id).toLowerCase().trim() === String(selectedExamId).toLowerCase().trim());

  if (loading) {
    return (
      <div className={`flex-1 flex items-center justify-center font-mono text-xs ${isDark ? 'bg-[oklch(0.16_0.03_265)] text-white' : 'bg-slate-50 text-slate-900'}`}>
        LOADING STUDY REPOSITORIES...
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col p-6 sm:p-12 font-sans space-y-8 select-none ${
      isDark ? 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)]' : isMono ? 'bg-white text-black' : 'bg-slate-50 text-slate-900'
    }`}
    onContextMenu={(e) => e.preventDefault()}
    onCopy={(e) => e.preventDefault()}
    >
      {/* Header & Exam Filter Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-6 border-white/10">
        <div>
          <span className={`font-mono text-xs uppercase tracking-widest font-bold ${isDark ? 'text-[oklch(0.94_0.21_118)]' : 'text-indigo-600'}`}>
            Secure Knowledge Repository
          </span>
          <h1 className="text-3xl font-black tracking-tight mt-1">Exam Study Materials</h1>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto max-w-full font-mono text-xs">
          <button
            onClick={() => setSelectedExamId('all')}
            className={`px-4 py-2 rounded-xl uppercase font-bold transition cursor-pointer ${
              selectedExamId === 'all'
                ? (isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)]' : 'bg-indigo-600 text-white')
                : 'bg-white/5 border border-white/10 opacity-70 hover:opacity-100'
            }`}
          >
            All Materials
          </button>
          {exams.map((ex) => (
            <button
              key={ex.exam_id || ex.id}
              onClick={() => setSelectedExamId(ex.exam_id || ex.id)}
              className={`px-4 py-2 rounded-xl uppercase font-bold transition cursor-pointer whitespace-nowrap ${
                selectedExamId === (ex.exam_id || ex.id)
                  ? (isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)]' : 'bg-indigo-600 text-white')
                  : 'bg-white/5 border border-white/10 opacity-70 hover:opacity-100'
              }`}
            >
              {cleanText(ex.exam_name || ex.name)}
            </button>
          ))}
        </div>
      </div>

      {/* Materials Card Grid */}
      {filteredMaterials.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center font-mono text-xs space-y-4 max-w-xl mx-auto">
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 space-y-1 w-full">
            <p className="font-bold uppercase tracking-wider">⚠️ No Matching Materials Found</p>
            <p className="opacity-80">Logged-in Email: <span className="text-white font-bold">{userEmail || 'None detected'}</span></p>
          </div>

          {/* Diagnostic Info Box */}
          <div className="p-4 bg-black/40 border border-white/10 rounded-2xl text-left space-y-2 w-full text-[11px]">
            <p className="font-bold text-amber-400 uppercase tracking-widest">🔍 Live Database Debugger:</p>
            <p className="opacity-80">1. Total Allocations in DB: <span className="text-white font-bold">{debugAllocations.length}</span></p>
            <p className="opacity-80">2. Total Study Materials in DB: <span className="text-white font-bold">{debugAllMaterials.length}</span></p>
            <div className="pt-2 border-t border-white/10">
              <p className="font-bold opacity-90 mb-1">Study Materials Registered in DB:</p>
              {debugAllMaterials.length === 0 ? (
                <p className="text-rose-400">None found in `study_materials` table!</p>
              ) : (
                debugAllMaterials.map((m, idx) => (
                  <div key={idx} className="flex justify-between text-[10px] opacity-75 py-0.5 border-b border-white/5">
                    <span>Title: <b>{m.title}</b></span>
                    <span>Exam ID: <code className="text-amber-300">{m.exam_id}</code></span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMaterials.map((mat) => (
            <div
              key={mat.material_id}
              className={`border rounded-3xl p-6 shadow-lg flex flex-col justify-between space-y-4 transition-transform duration-200 hover:-translate-y-1 ${
                isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10' : isMono ? 'bg-white border-2 border-black' : 'bg-white border-slate-200'
              }`}
            >
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className={`font-mono text-[10px] uppercase font-bold px-2.5 py-1 rounded-lg border ${
                    mat.file_type === 'pdf' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  }`}>
                    {mat.file_type.toUpperCase()} DOCUMENT
                  </span>
                  <span className="font-mono text-[10px] opacity-60">{new Date(mat.created_at).toLocaleDateString()}</span>
                </div>
                <h3 className="text-xl font-black tracking-tight">{cleanText(mat.title)}</h3>
                <p className="text-xs font-sans opacity-80 line-clamp-3">{cleanText(mat.description)}</p>
              </div>

              <button
                onClick={() => setActiveMaterial(mat)}
                className={`w-full py-3 font-mono text-xs uppercase tracking-wider font-extrabold rounded-xl transition cursor-pointer shadow-sm ${
                  isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] hover:brightness-110' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                🔒 Read Securely →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* PORTALLED SECURE READER MODAL */}
      {activeMaterial && createPortal(
        <div 
          className="fixed inset-0 w-screen h-screen z-[999999] bg-black/95 backdrop-blur-md flex flex-col overflow-hidden select-none"
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Top Header Toolbar with Search & Page Navigation */}
          <div className={`px-6 py-3.5 shrink-0 flex flex-wrap justify-between items-center gap-4 border-b z-50 shadow-2xl ${
            isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg uppercase font-bold">
                🛡️ Secure Vault
              </span>
              <h2 className="font-extrabold text-sm sm:text-base truncate max-w-xs">{cleanText(activeMaterial.title)}</h2>
            </div>

            {/* Center Controls: Search Bar & Page Jump */}
            <div className="flex items-center gap-3 font-mono text-xs">
              <form onSubmit={handleSearch} className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Search keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[oklch(0.94_0.21_118)] w-36 sm:w-48"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-[oklch(0.94_0.21_118)] hover:brightness-110 text-[oklch(0.16_0.03_265)] font-extrabold rounded-xl transition cursor-pointer"
                >
                  Search
                </button>
                {searchResults.length > 0 && (
                  <button
                    type="button"
                    onClick={jumpToNextMatch}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition cursor-pointer"
                    title="Next Match"
                  >
                    {currentMatchIdx + 1} of {searchResults.length} ⏭️
                  </button>
                )}
              </form>

              {totalPages > 0 && (
                <div className="flex items-center gap-1.5 bg-black/30 px-3.5 py-2 rounded-xl border border-white/10">
                  <span>Page</span>
                  <select
                    value={currentPage}
                    onChange={(e) => scrollToPage(Number(e.target.value))}
                    className="bg-transparent font-bold text-[oklch(0.94_0.21_118)] focus:outline-none cursor-pointer"
                  >
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <option key={i + 1} value={i + 1} className="bg-slate-900 text-white">
                        {i + 1}
                      </option>
                    ))}
                  </select>
                  <span>of {totalPages}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setActiveMaterial(null)}
              className="px-4 py-2 bg-rose-600/20 text-rose-400 border border-rose-500/30 font-mono text-xs uppercase rounded-xl hover:bg-rose-600/30 transition cursor-pointer font-bold"
            >
              Close ✕
            </button>
          </div>

          {/* Secure Canvas Viewport */}
          <div className="flex-1 relative overflow-y-auto flex flex-col items-center p-6 bg-slate-950">
            {/* Dynamic Anti-Screenshot Watermark Overlay */}
            <div className="absolute inset-0 pointer-events-none z-30 flex flex-wrap items-center justify-around opacity-15 overflow-hidden select-none">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="transform -rotate-30 font-mono text-sm font-bold text-white tracking-widest p-20 whitespace-nowrap">
                  TRYVO SECURE VAULT — {userEmail || 'PROTECTED SESSION'}
                </div>
              ))}
            </div>

            {/* Window Blur Shield */}
            {isBlurred && (
              <div className="absolute inset-0 bg-black/95 z-40 flex flex-col items-center justify-center text-center p-6 space-y-3 font-mono">
                <div className="text-3xl">🛡️</div>
                <h3 className="text-lg font-bold text-amber-400 uppercase tracking-widest">Display Shield Engaged</h3>
                <p className="text-xs text-slate-400 max-w-sm">Content hidden to protect intellectual property and prevent unauthorized capture.</p>
              </div>
            )}

            {pdfLoading && (
              <div className="my-auto font-mono text-xs text-amber-400 animate-pulse uppercase tracking-widest">
                Processing secure document...
              </div>
            )}

            <div id="pdf-canvas-container" className="flex flex-col items-center w-full max-w-4xl z-10" />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
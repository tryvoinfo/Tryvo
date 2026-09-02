import React, { useState } from 'react';
import ExamPortal from './components/ExamPortal';
import BulkExcelUploader from './components/BulkExcelUploader';

export default function App() {
  const [currentView, setCurrentView] = useState('exam'); // 'exam' | 'admin'

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex justify-between items-center">
        <h1 className="text-teal-400 font-bold tracking-wider text-lg cursor-pointer" onClick={() => setCurrentView('exam')}>
          TRYVO
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentView('exam')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              currentView === 'exam' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Take Exam
          </button>
          <button
            onClick={() => setCurrentView('admin')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              currentView === 'admin' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            ⚙️ Admin
          </button>
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        {currentView === 'exam' ? <ExamPortal /> : <BulkExcelUploader />}
      </main>
    </div>
  );
}
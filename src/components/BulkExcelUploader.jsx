import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

export default function BulkExcelUploader() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [adminTab, setAdminTab] = useState('uploader');

  const ADMIN_PASSWORD = 'JAZAAAIRAA'; 

  const [totalVisits, setTotalVisits] = useState(0);
  const [townStats, setTownStats] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setAuthError('');
      fetchAnalyticsData();
    } else {
      setAuthError('Incorrect password. Try again.');
    }
  };

  const fetchAnalyticsData = async () => {
    setAnalyticsLoading(true);
    const { data, error } = await supabase
      .from('visitor_analytics')
      .select('*')
      .order('visited_at', { ascending: false });

    if (!error && data) {
      setTotalVisits(data.length);
      const counts = {};
      data.forEach((visit) => {
        const town = visit.town || 'Unspecified Town';
        counts[town] = (counts[town] || 0) + 1;
      });

      const formattedStats = Object.keys(counts)
        .map((town) => ({ town, count: counts[town] }))
        .sort((a, b) => b.count - a.count);

      setTownStats(formattedStats);
    }
    setAnalyticsLoading(false);
  };

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [validRows, setValidRows] = useState([]);
  const [invalidRows, setInvalidRows] = useState([]);

  // Template supporting both 4 and 5 options
  const downloadTemplate = () => {
    const sampleData = [
      {
        subtopic_name: "Simplification & Approximation",
        difficulty_level: "Medium",
        question_text: "What is the value of 45% of 800 + 30% of 600?",
        option_1: "540",
        option_2: "520",
        option_3: "560",
        option_4: "580",
        option_5: "600", // Optional: leave blank for 4-option questions
        correct_option_number: 1,
        solution_explanation: "360 + 180 = 540."
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "QuestionsTemplate");
    XLSX.writeFile(workbook, "tryvo_flexible_options_template.xlsx");
  };

  const handleFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setStatusMessage('Analyzing rows for 4 & 5 option schema...');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        let valid = [];
        let invalid = [];

        data.forEach((row, index) => {
          let errors = [];
          const subName = row.subtopic_name;
          const qText = row.question_text;
          const opt1 = row.option_1;
          const opt2 = row.option_2;
          const correctNum = row.correct_option_number;

          if (!subName || String(subName).trim() === '') errors.push('Missing subtopic_name');
          if (!qText || String(qText).trim() === '') errors.push('Missing question_text');
          if (!opt1 || !opt2) errors.push('Requires at least option_1 and option_2');
          if (correctNum === undefined || correctNum === null || String(correctNum).trim() === '') errors.push('Missing correct_option_number');

          if (errors.length > 0) {
            invalid.push({ rowNumber: index + 2, data: row, errors });
          } else {
            valid.push({ rowNumber: index + 2, data: row });
          }
        });

        setValidRows(valid);
        setInvalidRows(invalid);
        setStatusMessage(`Validation complete: ${valid.length} valid rows ready, ${invalid.length} rejected.`);
      } catch (err) {
        console.error(err);
        setStatusMessage('Error parsing Excel file format.');
        setValidRows([]);
        setInvalidRows([]);
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const handleUpload = async () => {
    if (validRows.length === 0) {
      setStatusMessage('No valid rows available to import.');
      return;
    }

    setLoading(true);
    setStatusMessage(`Preparing ${validRows.length} questions for upload...`);

    try {
      let { data: existingSubtopics } = await supabase
        .from('subtopics')
        .select('subtopic_id, subtopic_name');

      const subtopicMap = new Map();
      existingSubtopics?.forEach(sub => {
        subtopicMap.set(sub.subtopic_name.toLowerCase().trim(), sub.subtopic_id);
      });

      let questionsToInsert = [];
      let allOptionRows = [];
      let successCount = 0;

      for (const item of validRows) {
        const row = item.data;
        const subtopicName = String(row.subtopic_name || 'General Practice').trim();
        const difficulty = String(row.difficulty_level || 'Medium').trim();
        const qText = String(row.question_text || '').trim();
        const explanation = String(row.solution_explanation || 'Standard solution.').trim();
        
        const opt1 = row.option_1;
        const opt2 = row.option_2;
        const opt3 = row.option_3;
        const opt4 = row.option_4;
        const opt5 = row.option_5; // Supports 5th option dynamically
        const correctNum = Number(row.correct_option_number);

        if (!qText) continue;

        let targetSubtopicId = subtopicMap.get(subtopicName.toLowerCase());
        if (!targetSubtopicId) {
          targetSubtopicId = 'SUB_' + Math.random().toString(36).substring(2, 9);
          const { error: subErr } = await supabase.from('subtopics').insert([
            { subtopic_id: targetSubtopicId, subtopic_name: subtopicName }
          ]);
          if (subErr) throw subErr;
          subtopicMap.set(subtopicName.toLowerCase(), targetSubtopicId);
        }

        const questionId = 'Q_' + Math.random().toString(36).substring(2, 11);
        questionsToInsert.push({
          question_id: questionId,
          subtopic_id: targetSubtopicId,
          question_text: qText,
          difficulty_level: difficulty,
          solution_explanation: explanation
        });

        // Dynamic option builder supporting both 4 and 5 options
        const questionOptionsList = [];
        if (opt1 !== undefined && opt1 !== null && String(opt1).trim() !== '') {
          questionOptionsList.push({ option_id: 'OPT_' + Math.random().toString(36).substring(2, 11), question_id: questionId, option_text: String(opt1).trim(), is_correct: correctNum === 1, option_index: 1 });
        }
        if (opt2 !== undefined && opt2 !== null && String(opt2).trim() !== '') {
          questionOptionsList.push({ option_id: 'OPT_' + Math.random().toString(36).substring(2, 11), question_id: questionId, option_text: String(opt2).trim(), is_correct: correctNum === 2, option_index: 2 });
        }
        if (opt3 !== undefined && opt3 !== null && String(opt3).trim() !== '') {
          questionOptionsList.push({ option_id: 'OPT_' + Math.random().toString(36).substring(2, 11), question_id: questionId, option_text: String(opt3).trim(), is_correct: correctNum === 3, option_index: 3 });
        }
        if (opt4 !== undefined && opt4 !== null && String(opt4).trim() !== '') {
          questionOptionsList.push({ option_id: 'OPT_' + Math.random().toString(36).substring(2, 11), question_id: questionId, option_text: String(opt4).trim(), is_correct: correctNum === 4, option_index: 4 });
        }
        if (opt5 !== undefined && opt5 !== null && String(opt5).trim() !== '') {
          questionOptionsList.push({ option_id: 'OPT_' + Math.random().toString(36).substring(2, 11), question_id: questionId, option_text: String(opt5).trim(), is_correct: correctNum === 5, option_index: 5 });
        }

        allOptionRows.push(...questionOptionsList);
        successCount++;
      }

      setStatusMessage('Uploading questions...');
      for (let i = 0; i < questionsToInsert.length; i += 100) {
        const chunk = questionsToInsert.slice(i, i + 100);
        const { error: qErr } = await supabase.from('questions').insert(chunk);
        if (qErr) throw qErr;
      }

      setStatusMessage('Uploading answer options...');
      for (let i = 0; i < allOptionRows.length; i += 100) {
        const chunk = allOptionRows.slice(i, i + 100);
        const { error: optErr } = await supabase.from('question_options').insert(chunk);
        if (optErr) throw optErr;
      }

      setStatusMessage(`Successfully uploaded ${successCount} questions (supporting 4 & 5 options)!`);
      setFile(null);
      setValidRows([]);
      setInvalidRows([]);
    } catch (err) {
      console.error(err);
      setStatusMessage('Upload failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex-1 bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)] flex items-center justify-center p-4 font-sans min-h-[80vh]">
        <div className="w-full max-w-sm bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center gap-2 justify-center mb-2">
            <div className="w-8 h-8 bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] font-black flex items-center justify-center rounded-xl text-sm font-['Archivo_Black']">T</div>
            <span className="font-extrabold tracking-tighter text-lg font-['Archivo_Black']">TRYVO</span>
          </div>
          <h2 className="text-xs font-mono tracking-[0.15em] text-center text-[oklch(0.68_0.04_265)] uppercase">Admin Access Required</h2>

          {authError && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl text-center font-mono">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="ENTER ADMIN PASSWORD"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3 text-sm text-[oklch(0.96_0.012_265)] font-mono focus:outline-none focus:border-[oklch(0.94_0.21_118)]"
            />
            <button
              type="submit"
              className="w-full py-3 bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] font-mono font-bold uppercase tracking-[0.15em] text-xs rounded-xl transition cursor-pointer"
            >
              Authenticate →
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)] p-6 sm:p-12 flex flex-col items-center font-sans">
      <div className="w-full max-w-3xl bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <div className="flex gap-2 font-mono text-xs">
            <button
              onClick={() => setAdminTab('uploader')}
              className={`px-4 py-2 rounded-xl uppercase font-bold transition cursor-pointer ${
                adminTab === 'uploader' ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)]' : 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)]'
              }`}
            >
              Uploader
            </button>
            <button
              onClick={() => { setAdminTab('analytics'); fetchAnalyticsData(); }}
              className={`px-4 py-2 rounded-xl uppercase font-bold transition cursor-pointer ${
                adminTab === 'analytics' ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)]' : 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)]'
              }`}
            >
              Analytics
            </button>
          </div>

          <button
            onClick={() => setIsAuthenticated(false)}
            className="px-3.5 py-2 bg-rose-500/10 text-rose-400 font-mono text-[11px] uppercase font-bold rounded-xl border border-rose-500/30 cursor-pointer"
          >
            Lock Out
          </button>
        </div>

        {adminTab === 'uploader' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-black font-['Archivo_Black'] tracking-tight">BULK SUBTOPIC INGESTION</h2>
                <p className="text-xs font-mono text-[oklch(0.68_0.04_265)] mt-1 uppercase">Supports 4 & 5 Option Formats</p>
              </div>
              <button
                onClick={downloadTemplate}
                className="px-4 py-2 bg-[oklch(0.16_0.03_265)] text-[oklch(0.94_0.21_118)] font-mono text-xs uppercase font-bold rounded-xl border border-[oklch(0.94_0.21_118)]/30 cursor-pointer"
              >
                ↓ Template Sheet
              </button>
            </div>

            {statusMessage && (
              <div className="p-3.5 rounded-xl text-xs font-mono bg-[oklch(0.16_0.03_265)] border border-white/10 text-[oklch(0.94_0.21_118)]">
                {statusMessage}
              </div>
            )}

            <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center bg-[oklch(0.16_0.03_265)]/50 relative group cursor-pointer">
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <div className="space-y-2 pointer-events-none">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-[oklch(0.94_0.21_118)]/10 flex items-center justify-center text-[oklch(0.94_0.21_118)] text-xl">📂</div>
                <p className="font-mono text-xs uppercase text-white font-bold">{file ? file.name : 'Drop Excel/CSV dataset or browse'}</p>
              </div>
            </div>

            <button
              onClick={handleUpload}
              disabled={loading || validRows.length === 0}
              className="w-full py-4 bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] font-mono text-xs uppercase font-extrabold rounded-xl transition disabled:opacity-40 cursor-pointer"
            >
              {loading ? 'UPLOADING...' : `DEPLOY ${validRows.length} QUESTIONS →`}
            </button>
          </div>
        )}

        {adminTab === 'analytics' && (
          <div className="space-y-6 font-mono text-xs">
            <h2 className="text-xl font-black font-['Archivo_Black']">TELEMETRY</h2>
            <p>Total Visits: {totalVisits}</p>
          </div>
        )}

      </div>
    </div>
  );
}
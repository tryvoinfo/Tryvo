import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

export default function BulkExcelUploader() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [adminTab, setAdminTab] = useState('uploader'); // 'uploader' | 'analytics'

  const ADMIN_PASSWORD = 'JAZAAAIRAA'; 

  // Analytics State
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

    if (error) {
      console.error('Error fetching analytics:', error.message);
    } else if (data) {
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

  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Validation Preview States
  const [validRows, setValidRows] = useState([]);
  const [invalidRows, setInvalidRows] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function fetchSections() {
      const { data, error } = await supabase.from('exam_sections').select('*');
      if (error) {
        setStatusMessage('Error loading sections: ' + error.message);
      } else if (data && data.length > 0) {
        setSections(data);
        setSelectedSection(data[0].section_id);
      } else {
        setStatusMessage('Warning: No sections found in Supabase database.');
      }
    }
    fetchSections();
  }, [isAuthenticated]);

  const downloadTemplate = () => {
    const sampleData = [
      {
        subtopic_name: "Data Interpretation",
        difficulty_level: "Medium",
        "Image URL": "https://example.com/chart1.png",
        passage_id: "DI_SET_01",
        passage_text: "Study the following table carefully and answer the questions given below. Data shows revenue of 3 companies over 4 years.",
        question_text: "What is the average revenue of Company A across all years?",
        option_1: "120",
        option_2: "140",
        option_3: "160",
        option_4: "180",
        correct_option_number: 2,
        solution_explanation: "Sum of revenues divided by total years gives 140."
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "QuestionsTemplate");
    XLSX.writeFile(workbook, "exam_questions_template.xlsx");
  };

  const handleFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setStatusMessage('Analyzing and validating rows...');

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
          const qText = row.question_text || row.Question;
          const opt1 = row.option_1 ?? row.Opt1;
          const opt2 = row.option_2 ?? row.Opt2;
          const correctNum = row.correct_option_number || row.CorrectAnswer;

          if (!qText || String(qText).trim() === '') {
            errors.push('Missing question text');
          }
          if (!opt1 || !opt2) {
            errors.push('Requires at least 2 options');
          }
          if (!correctNum) {
            errors.push('Missing correct option number');
          }

          if (errors.length > 0) {
            invalid.push({ rowNumber: index + 2, data: row, errors });
          } else {
            valid.push({ rowNumber: index + 2, data: row });
          }
        });

        setValidRows(valid);
        setInvalidRows(invalid);
        setStatusMessage(`Validation complete: ${valid.length} valid rows, ${invalid.length} invalid rows skipped.`);
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
    if (!selectedSection) {
      setStatusMessage('Please select a target section.');
      return;
    }

    setLoading(true);
    setStatusMessage(`Preparing ${validRows.length} validated questions for batch upload...`);

    try {
      let { data: existingSubtopics } = await supabase
        .from('subtopics')
        .select('subtopic_id, subtopic_name')
        .eq('section_id', selectedSection);

      const subtopicMap = new Map();
      existingSubtopics?.forEach(sub => {
        subtopicMap.set(sub.subtopic_name.toLowerCase().trim(), sub.subtopic_id);
      });

      let questionsToInsert = [];
      let passagesToInsert = [];
      let allOptionRows = [];
      let successCount = 0;

      let currentActivePassageText = null;
      let currentActiveImageUrl = null;

      for (const item of validRows) {
        const row = item.data;
        const subtopicName = (row.subtopic_name || row.Subtopic || 'General Practice').trim();
        const difficulty = row.difficulty_level || row.Difficulty || 'Medium';
        
        const rawPassage = row.passage_text || row.Passage;
        if (rawPassage && String(rawPassage).trim() !== '') {
          currentActivePassageText = String(rawPassage).trim();
        }

        const rawImageUrl = row['Image URL'] || row['image_url'] || row.ImageUrl;
        if (rawImageUrl && String(rawImageUrl).trim() !== '') {
          currentActiveImageUrl = String(rawImageUrl).trim();
        }

        const qText = row.question_text || row.Question;
        const explanation = row.solution_explanation || row.Explanation || 'Standard step-by-step solution.';
        
        const opt1 = row.option_1 ?? row.Opt1 ?? 'Option A';
        const opt2 = row.option_2 ?? row.Opt2 ?? 'Option B';
        const opt3 = row.option_3 ?? row.Opt3 ?? 'Option C';
        const opt4 = row.option_4 ?? row.Opt4 ?? 'Option D';
        
        const correctNum = Number(row.correct_option_number || row.CorrectAnswer || 1);

        if (!qText) continue;

        let targetSubtopicId = subtopicMap.get(subtopicName.toLowerCase());
        if (!targetSubtopicId) {
          targetSubtopicId = 'SUB_' + Math.random().toString(36).substring(2, 9);
          const { error: subErr } = await supabase.from('subtopics').insert([
            { subtopic_id: targetSubtopicId, section_id: selectedSection, subtopic_name: subtopicName }
          ]);
          if (subErr) throw subErr;
          subtopicMap.set(subtopicName.toLowerCase(), targetSubtopicId);
        }

        let passageId = null;
        const rawPassageId = row.passage_id || row.PassageId;
        if (rawPassageId && String(rawPassageId).trim() !== '') {
          passageId = String(rawPassageId).trim();
        } else if (currentActivePassageText) {
          passageId = 'PASS_' + Math.random().toString(36).substring(2, 11);
        }

        if (currentActivePassageText && passageId) {
          passagesToInsert.push({ passage_id: passageId, passage_text: currentActivePassageText });
        }

        const questionId = 'Q_' + Math.random().toString(36).substring(2, 11);
        questionsToInsert.push({
          question_id: questionId,
          subtopic_id: targetSubtopicId,
          passage_id: passageId || null,
          image_url: currentActiveImageUrl || null,
          question_text: qText,
          difficulty_level: difficulty,
          solution_explanation: explanation
        });

        allOptionRows.push(
          { option_id: 'OPT_' + Math.random().toString(36).substring(2, 11), question_id: questionId, option_text: String(opt1), is_correct: correctNum === 1 },
          { option_id: 'OPT_' + Math.random().toString(36).substring(2, 11), question_id: questionId, option_text: String(opt2), is_correct: correctNum === 2 },
          { option_id: 'OPT_' + Math.random().toString(36).substring(2, 11), question_id: questionId, option_text: String(opt3), is_correct: correctNum === 3 },
          { option_id: 'OPT_' + Math.random().toString(36).substring(2, 11), question_id: questionId, option_text: String(opt4), is_correct: correctNum === 4 }
        );

        successCount++;
      }

      if (passagesToInsert.length > 0) {
        setStatusMessage('Uploading passages in batches...');
        const uniquePassagesMap = new Map();
        passagesToInsert.forEach(p => uniquePassagesMap.set(p.passage_id, p));
        const uniquePassages = Array.from(uniquePassagesMap.values());

        for (let i = 0; i < uniquePassages.length; i += 100) {
          const chunk = uniquePassages.slice(i, i + 100);
          const { error: pErr } = await supabase.from('passages').upsert(chunk);
          if (pErr) throw pErr;
        }
      }

      setStatusMessage('Uploading questions in batches...');
      for (let i = 0; i < questionsToInsert.length; i += 100) {
        const chunk = questionsToInsert.slice(i, i + 100);
        const { error: qErr } = await supabase.from('questions').insert(chunk);
        if (qErr) throw qErr;
      }

      setStatusMessage('Uploading answer options in batches...');
      for (let i = 0; i < allOptionRows.length; i += 100) {
        const chunk = allOptionRows.slice(i, i + 100);
        const { error: optErr } = await supabase.from('question_options').insert(chunk);
        if (optErr) throw optErr;
      }

      setStatusMessage(`Successfully uploaded ${successCount} clean questions in seconds!`);
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
        <div className="w-full max-w-sm bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 backdrop-blur-xl">
          <div className="flex items-center gap-2 justify-center mb-2">
            <div className="w-8 h-8 bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] font-black flex items-center justify-center rounded-xl text-sm font-['Archivo_Black']">T</div>
            <span className="font-extrabold tracking-tighter text-lg font-['Archivo_Black'] text-[oklch(0.96_0.012_265)]">TRYVO</span>
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
              className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3 text-sm text-[oklch(0.96_0.012_265)] font-mono focus:outline-none focus:border-[oklch(0.94_0.21_118)] transition"
            />
            <button
              type="submit"
              className="w-full py-3 bg-[oklch(0.94_0.21_118)] hover:brightness-110 text-[oklch(0.16_0.03_265)] font-mono font-bold uppercase tracking-[0.15em] text-xs rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.2)] transition cursor-pointer"
            >
              Authenticate →
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)] p-6 sm:p-12 flex flex-col items-center font-sans relative">
      <div className="w-full max-w-3xl bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 backdrop-blur-xl">
        
        {/* Admin Nav Switcher Tabs */}
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <div className="flex gap-2 font-mono text-xs tracking-wider">
            <button
              onClick={() => setAdminTab('uploader')}
              className={`px-4 py-2 rounded-xl uppercase font-bold transition cursor-pointer ${
                adminTab === 'uploader' 
                  ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] shadow-[0_0_15px_rgba(204,255,0,0.2)]' 
                  : 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)] hover:text-[oklch(0.96_0.012_265)] border border-white/5'
              }`}
            >
              Uploader
            </button>
            <button
              onClick={() => {
                setAdminTab('analytics');
                fetchAnalyticsData();
              }}
              className={`px-4 py-2 rounded-xl uppercase font-bold transition cursor-pointer ${
                adminTab === 'analytics' 
                  ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] shadow-[0_0_15px_rgba(204,255,0,0.2)]' 
                  : 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)] hover:text-[oklch(0.96_0.012_265)] border border-white/5'
              }`}
            >
              Analytics
            </button>
          </div>

          <button
            onClick={() => setIsAuthenticated(false)}
            className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-mono text-[11px] tracking-wider uppercase font-bold rounded-xl border border-rose-500/30 transition cursor-pointer"
          >
            Lock Out
          </button>
        </div>

        {/* Tab 1: Bulk Question Uploader */}
        {adminTab === 'uploader' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-black font-['Archivo_Black'] tracking-tight">BULK QUESTION INGESTION</h2>
                <p className="text-xs font-mono text-[oklch(0.68_0.04_265)] mt-1 tracking-wider uppercase">Pre-flight validation engine active</p>
              </div>
              <button
                onClick={downloadTemplate}
                className="px-4 py-2 bg-[oklch(0.16_0.03_265)] hover:bg-[oklch(0.16_0.03_265)]/80 text-[oklch(0.94_0.21_118)] font-mono text-xs uppercase tracking-[0.15em] font-bold rounded-xl border border-[oklch(0.94_0.21_118)]/30 transition cursor-pointer shadow-[0_0_15px_rgba(204,255,0,0.1)]"
              >
                ↓ Template Sheet
              </button>
            </div>

            {statusMessage && (
              <div className="p-3.5 rounded-xl text-xs font-mono bg-[oklch(0.16_0.03_265)] border border-white/10 text-[oklch(0.94_0.21_118)] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[oklch(0.94_0.21_118)] animate-pulse"></span>
                {statusMessage}
              </div>
            )}

            <div>
              <label className="block font-mono text-xs uppercase tracking-[0.15em] text-[oklch(0.68_0.04_265)] mb-2">Target Section Module</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3.5 text-sm text-[oklch(0.96_0.012_265)] font-mono focus:outline-none focus:border-[oklch(0.94_0.21_118)] transition cursor-pointer"
              >
                {sections.length > 0 ? (
                  sections.map((sec) => (
                    <option key={sec.section_id} value={sec.section_id} className="bg-[oklch(0.16_0.03_265)] text-white">
                      {sec.section_name}
                    </option>
                  ))
                ) : (
                  <option value="" className="bg-[oklch(0.16_0.03_265)] text-white">No sections available</option>
                )}
              </select>
            </div>

            <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center bg-[oklch(0.16_0.03_265)]/50 hover:border-[oklch(0.94_0.21_118)]/50 transition cursor-pointer relative group">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="space-y-2 pointer-events-none">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-[oklch(0.94_0.21_118)]/10 border border-[oklch(0.94_0.21_118)]/20 flex items-center justify-center text-[oklch(0.94_0.21_118)] text-xl font-mono">
                  📂
                </div>
                <p className="font-mono text-xs uppercase tracking-wider text-[oklch(0.96_0.012_265)] font-bold">
                  {file ? file.name : 'Drop Excel/CSV dataset or browse'}
                </p>
                <p className="font-mono text-[10px] text-[oklch(0.68_0.04_265)] uppercase tracking-widest">Automatic schema pre-check enforced</p>
              </div>
            </div>

            {/* Validation Feedback Summary Cards */}
            {(validRows.length > 0 || invalidRows.length > 0) && (
              <div className="space-y-4 font-mono">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.15em] block">Ready to Drop</span>
                      <span className="text-2xl font-black text-emerald-300 font-['Archivo_Black']">{validRows.length}</span>
                    </div>
                    <span className="text-lg">⚡</span>
                  </div>
                  <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-rose-400 font-bold uppercase tracking-[0.15em] block">Rejected Rows</span>
                      <span className="text-2xl font-black text-rose-300 font-['Archivo_Black']">{invalidRows.length}</span>
                    </div>
                    <span className="text-lg">🛡️</span>
                  </div>
                </div>

                {invalidRows.length > 0 && (
                  <div className="bg-[oklch(0.16_0.03_265)] rounded-2xl border border-rose-500/20 p-4 max-h-48 overflow-y-auto space-y-2">
                    <h4 className="text-[11px] font-bold text-rose-400 uppercase tracking-[0.15em]">Rejected Dataset Log:</h4>
                    {invalidRows.map((inv, i) => (
                      <div key={i} className="text-xs text-[oklch(0.68_0.04_265)] flex justify-between items-center border-b border-white/5 pb-1.5">
                        <span className="truncate pr-2">Row #{inv.rowNumber}: <span className="text-[oklch(0.96_0.012_265)]">{inv.data.question_text || inv.data.Question || 'Blank Question'}</span></span>
                        <span className="text-rose-400 shrink-0 font-bold text-[10px] bg-rose-500/10 px-2 py-0.5 rounded">{inv.errors.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={loading || validRows.length === 0}
              className="w-full py-4 bg-[oklch(0.94_0.21_118)] hover:brightness-110 text-[oklch(0.16_0.03_265)] font-mono text-xs uppercase tracking-[0.15em] font-extrabold rounded-xl shadow-[0_0_25px_rgba(204,255,0,0.25)] transition disabled:opacity-40 cursor-pointer"
            >
              {loading ? 'PROCESSING BATCHES...' : `DEPLOY ${validRows.length} VALID QUESTIONS TO TRYVO →`}
            </button>
          </div>
        )}

        {/* Tab 2: Visitor Analytics & Geographic Dashboard */}
        {adminTab === 'analytics' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black font-['Archivo_Black'] tracking-tight">TRAFFIC TELEMETRY</h2>
                <p className="text-xs font-mono text-[oklch(0.68_0.04_265)] mt-1 tracking-wider uppercase">Live regional user distribution feed</p>
              </div>
              <button
                onClick={fetchAnalyticsData}
                className="px-4 py-2 bg-[oklch(0.16_0.03_265)] hover:bg-[oklch(0.16_0.03_265)]/80 text-[oklch(0.94_0.21_118)] font-mono text-xs uppercase tracking-[0.15em] font-bold rounded-xl border border-[oklch(0.94_0.21_118)]/30 transition cursor-pointer shadow-[0_0_15px_rgba(204,255,0,0.1)]"
              >
                ↻ Refresh Stream
              </button>
            </div>

            {analyticsLoading ? (
              <div className="text-center py-12 text-[oklch(0.68_0.04_265)] font-mono text-xs uppercase tracking-widest animate-pulse">Syncing telemetry data...</div>
            ) : (
              <div className="space-y-4 font-mono">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-2xl p-5">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-[oklch(0.68_0.04_265)] font-bold block">Total Grinders</span>
                    <span className="text-3xl font-black text-[oklch(0.94_0.21_118)] mt-2 block font-['Archivo_Black']">{totalVisits}</span>
                  </div>
                  <div className="bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-2xl p-5">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-[oklch(0.68_0.04_265)] font-bold block">Active Zones</span>
                    <span className="text-3xl font-black text-[oklch(0.68_0.16_245)] mt-2 block font-['Archivo_Black']">{townStats.length}</span>
                  </div>
                </div>

                {/* City-by-City Breakdown List */}
                <div className="bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-2xl p-5 space-y-3">
                  <h3 className="text-[11px] font-bold text-[oklch(0.96_0.012_265)] uppercase tracking-[0.15em]">Regional Grid Activity</h3>
                  
                  {townStats.length === 0 ? (
                    <p className="text-xs text-[oklch(0.68_0.04_265)] py-4 text-center">No telemetry pings recorded yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {townStats.map((stat, idx) => (
                        <div key={idx} className="bg-[oklch(0.23_0.045_265)] border border-white/5 p-3.5 rounded-xl flex justify-between items-center">
                          <span className="text-xs font-bold text-[oklch(0.96_0.012_265)]">{stat.town}</span>
                          <span className="bg-[oklch(0.94_0.21_118)]/10 border border-[oklch(0.94_0.21_118)]/30 text-[oklch(0.94_0.21_118)] px-2.5 py-1 rounded-lg font-mono font-bold text-xs">
                            {stat.count} {stat.count === 1 ? 'ping' : 'pings'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Detailed Percentage Breakdown Table */}
                <div className="bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-2xl p-5">
                  <h3 className="text-[11px] font-bold text-[oklch(0.96_0.012_265)] uppercase tracking-[0.15em] mb-4">Traffic Share Distribution</h3>
                  {townStats.length > 0 && (
                    <div className="overflow-x-auto max-h-52 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[oklch(0.23_0.045_265)] text-[oklch(0.68_0.04_265)] uppercase tracking-[0.15em] sticky top-0 font-bold">
                          <tr>
                            <th className="p-3">Zone / City</th>
                            <th className="p-3 text-right">Pings</th>
                            <th className="p-3 text-right">Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {townStats.map((stat, idx) => {
                            const percent = totalVisits > 0 ? ((stat.count / totalVisits) * 100).toFixed(1) : 0;
                            return (
                              <tr key={idx} className="hover:bg-white/[0.02] transition">
                                <td className="p-3 font-medium text-[oklch(0.96_0.012_265)]">{stat.town}</td>
                                <td className="p-3 text-right font-mono text-[oklch(0.94_0.21_118)] font-bold">{stat.count}</td>
                                <td className="p-3 text-right font-mono text-[oklch(0.68_0.04_265)]">{percent}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
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
  const [previewData, setPreviewData] = useState([]);

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
      },
      {
        subtopic_name: "Data Interpretation",
        difficulty_level: "Medium",
        "Image URL": "",
        passage_id: "DI_SET_01",
        passage_text: "",
        question_text: "What is the percentage increase in revenue for Company B from 2001 to 2002?",
        option_1: "12.5%",
        option_2: "15%",
        option_3: "20%",
        option_4: "25%",
        correct_option_number: 4,
        solution_explanation: "Percentage increase formula yields 25%."
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

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        setPreviewData(data);
      } catch (err) {
        console.error(err);
        setStatusMessage('Error parsing Excel file format.');
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const handleUpload = async () => {
    if (!file || previewData.length === 0) {
      setStatusMessage('Please select a valid Excel file first.');
      return;
    }
    if (!selectedSection) {
      setStatusMessage('Please select a target section.');
      return;
    }

    setLoading(true);
    setStatusMessage(`Preparing ${previewData.length} questions for batch upload...`);

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

      for (const row of previewData) {
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
        
        // Safeguard fallbacks for unpopulated or browser-parsed undefined option cells
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
        // Deduplicate passages by passage_id
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

      setStatusMessage(`Successfully uploaded ${successCount} questions in seconds!`);
      setFile(null);
      setPreviewData([]);
    } catch (err) {
      console.error(err);
      setStatusMessage('Upload failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl space-y-4">
          <h2 className="text-xl font-bold text-teal-400 text-center">Admin Access Required</h2>
          <p className="text-xs text-slate-400 text-center">Please enter your password to access the admin portal.</p>

          {authError && (
            <div className="p-2 bg-rose-900/50 border border-rose-700 text-rose-300 text-xs rounded text-center">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Enter Admin Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-slate-200 text-sm focus:outline-none focus:border-teal-500"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg shadow transition cursor-pointer"
            >
              Login to Admin
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl space-y-6">
        
        {/* Admin Nav Switcher Tabs */}
        <div className="flex justify-between items-center border-b border-slate-700 pb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setAdminTab('uploader')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                adminTab === 'uploader' ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              📥 Bulk Uploader
            </button>
            <button
              onClick={() => {
                setAdminTab('analytics');
                fetchAnalyticsData();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                adminTab === 'analytics' ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              📊 Visitor Analytics
            </button>
          </div>

          <button
            onClick={() => setIsAuthenticated(false)}
            className="px-3 py-1.5 bg-rose-900/50 hover:bg-rose-900 text-rose-300 text-xs font-semibold rounded-lg border border-rose-700 transition cursor-pointer"
          >
            Lock Out
          </button>
        </div>

        {/* Tab 1: Bulk Question Uploader */}
        {adminTab === 'uploader' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-teal-400">Bulk Excel Uploader</h2>
              <button
                onClick={downloadTemplate}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-teal-300 text-xs font-semibold rounded-lg border border-slate-600 transition cursor-pointer"
              >
                📥 Download Template
              </button>
            </div>

            {statusMessage && (
              <div className="p-3 rounded text-sm bg-slate-900 border border-slate-700 text-teal-300">
                {statusMessage}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Target Section</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none"
              >
                {sections.length > 0 ? (
                  sections.map((sec) => (
                    <option key={sec.section_id} value={sec.section_id}>
                      {sec.section_name}
                    </option>
                  ))
                ) : (
                  <option value="">No sections available (Check Supabase API Key)</option>
                )}
              </select>
            </div>

            <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="w-full text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-600 file:text-white hover:file:bg-teal-500 cursor-pointer"
              />
            </div>

            {previewData.length > 0 && (
              <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 max-h-48 overflow-y-auto">
                <h3 className="text-sm font-semibold text-slate-400 mb-2">Preview ({previewData.length} rows detected):</h3>
                <ul className="space-y-1 text-xs text-slate-300">
                  {previewData.slice(0, 5).map((row, i) => (
                    <li key={i} className="truncate">• [{row.subtopic_name || 'General'}] {row.question_text || row.Question}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={loading || previewData.length === 0}
              className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg shadow transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Processing Batches...' : 'Upload All to Supabase'}
            </button>
          </div>
        )}

        {/* Tab 2: Visitor Analytics & Geographic Dashboard */}
        {adminTab === 'analytics' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-teal-400">Portal Traffic & Geographic Insights</h2>
                <p className="text-xs text-slate-400">Live telemetry of user site visits sorted by town/city.</p>
              </div>
              <button
                onClick={fetchAnalyticsData}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-teal-300 text-xs font-semibold rounded-lg border border-slate-600 transition cursor-pointer"
              >
                🔄 Refresh Data
              </button>
            </div>

            {analyticsLoading ? (
              <div className="text-center py-8 text-slate-400 text-xs">Loading analytics data...</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">Total Site Visits</span>
                    <span className="text-2xl font-black text-teal-300 mt-1 block">{totalVisits}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">Active Cities / Towns</span>
                    <span className="text-2xl font-black text-indigo-400 mt-1 block">{townStats.length}</span>
                  </div>
                </div>

                {/* City-by-City Breakdown List */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Users per City / Town</h3>
                  
                  {townStats.length === 0 ? (
                    <p className="text-xs text-slate-500">No regional user data recorded yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {townStats.map((stat, idx) => (
                        <div key={idx} className="bg-slate-800 border border-slate-700/60 p-3 rounded-lg flex justify-between items-center">
                          <span className="text-xs font-semibold text-slate-200">{stat.town}</span>
                          <span className="bg-teal-950/80 border border-teal-700 text-teal-300 px-2.5 py-1 rounded-md font-mono font-bold text-xs">
                            {stat.count} {stat.count === 1 ? 'user' : 'users'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Detailed Percentage Breakdown Table */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Detailed Share Distribution</h3>
                  {townStats.length > 0 && (
                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-800 text-slate-400 uppercase tracking-wider sticky top-0">
                          <tr>
                            <th className="p-2.5">Town / City</th>
                            <th className="p-2.5 text-right">User Count</th>
                            <th className="p-2.5 text-right">Traffic Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {townStats.map((stat, idx) => {
                            const percent = totalVisits > 0 ? ((stat.count / totalVisits) * 100).toFixed(1) : 0;
                            return (
                              <tr key={idx}>
                                <td className="p-2.5 font-medium text-slate-200">{stat.town}</td>
                                <td className="p-2.5 text-right font-mono text-teal-300">{stat.count}</td>
                                <td className="p-2.5 text-right font-mono text-slate-400">{percent}%</td>
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
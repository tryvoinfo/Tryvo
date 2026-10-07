import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const cleanText = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€ /g, '"');
};

export default function AdminQuestionManager() {
  const [searchQuery, setSearchQuery] = useState('');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Edit Modal State
  const [editingQ, setEditingQ] = useState(null);
  const [editForm, setEditForm] = useState({
    question_text: '',
    difficulty_level: 'Medium',
    image_url: '',
    passage_text: '',
    solution_explanation: '',
    opt1: '',
    opt2: '',
    opt3: '',
    opt4: '',
    correct_option_number: 1
  });

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // 1. Fetch matching questions (using left joins or safe selects)
      let query = supabase.from('questions').select('*, passages(*), subtopics(*)');
      if (searchQuery.trim() !== '') {
        query = query.ilike('question_text', `%${searchQuery.trim()}%`);
      }
      const { data: qData, error: qErr } = await query.limit(50);
      if (qErr) throw qErr;

      if (!qData || qData.length === 0) {
        setQuestions([]);
        setLoading(false);
        return;
      }

      // 2. Fetch options for these questions
      const qIds = qData.map(q => q.question_id || q.id).filter(Boolean);
      let optData = [];
      if (qIds.length > 0) {
        const { data: oData, error: optErr } = await supabase
          .from('question_options')
          .select('*')
          .in('question_id', qIds);

        if (!optErr && oData) {
          optData = oData;
        }
      }

      // 3. Combine safely with null checks
      const formatted = qData.map(q => {
        const qId = q.question_id || q.id;
        const options = optData.filter(o => String(o.question_id) === String(qId));
        const correctIndex = options.findIndex(o => o.is_correct);

        return {
          ...q,
          id: qId,
          options: options || [],
          subtopic_name: q.subtopics?.subtopic_name || q.subtopic_id || 'General Practice',
          passage_text: q.passages?.passage_text || '',
          correct_option_number: correctIndex !== -1 ? correctIndex + 1 : 1
        };
      });

      setQuestions(formatted);
    } catch (err) {
      console.error(err);
      setMessage('Error searching questions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
  }, []);

  const handleDelete = async (questionId) => {
    if (!window.confirm("Are you sure you want to delete this question and its options?")) return;

    setLoading(true);
    try {
      await supabase.from('question_options').delete().eq('question_id', questionId);
      await supabase.from('questions').delete().eq('question_id', questionId);
      
      setMessage('Question successfully deleted.');
      setQuestions(prev => prev.filter(q => q.id !== questionId));
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (q) => {
    setEditingQ(q);
    setEditForm({
      question_text: q.question_text || '',
      difficulty_level: q.difficulty_level || 'Medium',
      image_url: q.image_url || '',
      passage_text: q.passage_text || '',
      solution_explanation: q.solution_explanation || '',
      opt1: q.options[0]?.option_text || '',
      opt2: q.options[1]?.option_text || '',
      opt3: q.options[2]?.option_text || '',
      opt4: q.options[3]?.option_text || '',
      correct_option_number: q.correct_option_number || 1
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingQ) return;

    setLoading(true);
    try {
      const qId = editingQ.id;

      const { error: qErr } = await supabase.from('questions').update({
        question_text: editForm.question_text,
        difficulty_level: editForm.difficulty_level,
        image_url: editForm.image_url || null,
        solution_explanation: editForm.solution_explanation
      }).eq('question_id', qId);

      if (qErr) throw qErr;

      await supabase.from('question_options').delete().eq('question_id', qId);

      const newOptions = [
        { option_id: 'OPT_' + Math.random().toString(36).substring(2, 11), question_id: qId, option_text: editForm.opt1, is_correct: Number(editForm.correct_option_number) === 1 },
        { option_id: 'OPT_' + Math.random().toString(36).substring(2, 11), question_id: qId, option_text: editForm.opt2, is_correct: Number(editForm.correct_option_number) === 2 },
        { option_id: 'OPT_' + Math.random().toString(36).substring(2, 11), question_id: qId, option_text: editForm.opt3, is_correct: Number(editForm.correct_option_number) === 3 },
        { option_id: 'OPT_' + Math.random().toString(36).substring(2, 11), question_id: qId, option_text: editForm.opt4, is_correct: Number(editForm.correct_option_number) === 4 }
      ];

      const { error: optErr } = await supabase.from('question_options').insert(newOptions);
      if (optErr) throw optErr;

      alert('Question updated successfully!');
      setEditingQ(null);
      handleSearch();
    } catch (err) {
      alert('Update failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)] p-6 sm:p-10 font-sans space-y-8 overflow-y-auto">
      
      <div className="bg-[oklch(0.23_0.045_265)] border border-white/10 p-6 rounded-3xl shadow-xl space-y-6">
        <div>
          <span className="font-mono text-xs text-[oklch(0.94_0.21_118)] uppercase tracking-widest font-bold">Database Management</span>
          <h1 className="text-2xl font-black font-['Archivo_Black'] tracking-tight">Question Manager & Editor</h1>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3 font-mono text-xs">
          <input
            type="text"
            placeholder="Search questions by text keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-[oklch(0.94_0.21_118)]"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3.5 bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] font-extrabold uppercase tracking-widest rounded-xl hover:brightness-110 transition cursor-pointer"
          >
            {loading ? 'Searching...' : '🔍 Search'}
          </button>
        </form>
      </div>

      {message && (
        <div className="p-4 rounded-2xl font-mono text-xs bg-white/5 border border-white/10 text-[oklch(0.94_0.21_118)] text-center">
          {message}
        </div>
      )}

      <div className="space-y-6">
        <div className="flex justify-between items-center font-mono text-xs text-[oklch(0.68_0.04_265)] uppercase tracking-wider">
          <span>Showing Results ({questions.length})</span>
          <span>Excel Template Format Layout</span>
        </div>

        {loading && questions.length === 0 ? (
          <div className="text-center py-12 font-mono text-xs text-[oklch(0.68_0.04_265)] uppercase tracking-widest animate-pulse">
            Loading database entries...
          </div>
        ) : questions.length === 0 ? (
          <div className="bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-12 text-center font-mono text-xs text-[oklch(0.68_0.04_265)]">
            No questions found matching your search keyword.
          </div>
        ) : (
          <div className="space-y-6">
            {questions.map((q) => (
              <div key={q.id} className="bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4 font-mono text-xs">
                
                <div className="flex flex-wrap justify-between items-center border-b border-white/10 pb-3 gap-2">
                  <div className="flex items-center gap-3">
                    <span className="bg-[oklch(0.94_0.21_118)]/10 text-[oklch(0.94_0.21_118)] border border-[oklch(0.94_0.21_118)]/30 px-3 py-1 rounded-lg font-bold">
                      Subtopic: {cleanText(q.subtopic_name)}
                    </span>
                    <span className="bg-white/5 text-[oklch(0.68_0.04_265)] px-3 py-1 rounded-lg">
                      Difficulty: {q.difficulty_level || 'Medium'}
                    </span>
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={() => handleOpenEdit(q)}
                      className="px-3 py-1.5 bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] font-bold rounded-lg hover:brightness-110 transition cursor-pointer"
                    >
                      ✏️ Edit Entry
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="px-3 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold rounded-lg hover:bg-rose-500/20 transition cursor-pointer"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>

                {q.passage_text && (
                  <div className="bg-[oklch(0.16_0.03_265)] p-4 rounded-2xl border border-white/5 space-y-1">
                    <span className="text-[10px] text-[oklch(0.94_0.21_118)] uppercase font-bold tracking-wider">Passage Context:</span>
                    <p className="font-sans text-[oklch(0.68_0.04_265)] text-xs leading-relaxed">{cleanText(q.passage_text)}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-[10px] text-[oklch(0.68_0.04_265)] uppercase font-bold tracking-wider">Question Text:</span>
                  <p className="font-sans text-sm font-semibold text-[oklch(0.96_0.012_265)]">{cleanText(q.question_text)}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-[oklch(0.68_0.04_265)] uppercase font-bold tracking-wider">Options:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt, oIdx) => (
                      <div
                        key={opt.option_id || oIdx}
                        className={`p-3 rounded-xl border flex justify-between items-center ${
                          opt.is_correct
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-bold'
                            : 'bg-[oklch(0.16_0.03_265)] border-white/5 text-[oklch(0.68_0.04_265)]'
                        }`}
                      >
                        <span>({oIdx + 1}) {cleanText(opt.option_text)}</span>
                        {opt.is_correct && <span className="text-emerald-400 text-[10px]">CORRECT</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {q.solution_explanation && (
                  <div className="bg-[oklch(0.16_0.03_265)] p-4 rounded-2xl border border-white/5 space-y-1">
                    <span className="text-[10px] text-[oklch(0.94_0.21_118)] uppercase font-bold tracking-wider">Solution Explanation:</span>
                    <p className="font-sans text-[oklch(0.68_0.04_265)] text-xs leading-relaxed">{cleanText(q.solution_explanation)}</p>
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </div>

      {editingQ && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-mono">
          <div className="bg-[oklch(0.23_0.045_265)] border border-white/20 rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-6 shadow-2xl text-[oklch(0.96_0.012_265)] max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] text-[oklch(0.94_0.21_118)] uppercase tracking-widest font-bold">Database Editor</span>
                <h3 className="text-lg font-bold font-sans">Edit Question Entry</h3>
              </div>
              <button onClick={() => setEditingQ(null)} className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block uppercase tracking-wider text-[oklch(0.68_0.04_265)] mb-1">Question Text</label>
                <textarea
                  rows="3"
                  required
                  value={editForm.question_text}
                  onChange={(e) => setEditForm({...editForm, question_text: e.target.value})}
                  className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[oklch(0.94_0.21_118)] font-sans"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block uppercase tracking-wider text-[oklch(0.68_0.04_265)] mb-1">Difficulty Level</label>
                  <select
                    value={editForm.difficulty_level}
                    onChange={(e) => setEditForm({...editForm, difficulty_level: e.target.value})}
                    className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[oklch(0.94_0.21_118)] cursor-pointer"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block uppercase tracking-wider text-[oklch(0.68_0.04_265)] mb-1">Correct Option Number (1 - 4)</label>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    required
                    value={editForm.correct_option_number}
                    onChange={(e) => setEditForm({...editForm, correct_option_number: e.target.value})}
                    className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[oklch(0.94_0.21_118)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block uppercase tracking-wider text-[oklch(0.68_0.04_265)] mb-1">Option 1 Text</label>
                  <input
                    type="text"
                    required
                    value={editForm.opt1}
                    onChange={(e) => setEditForm({...editForm, opt1: e.target.value})}
                    className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block uppercase tracking-wider text-[oklch(0.68_0.04_265)] mb-1">Option 2 Text</label>
                  <input
                    type="text"
                    required
                    value={editForm.opt2}
                    onChange={(e) => setEditForm({...editForm, opt2: e.target.value})}
                    className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block uppercase tracking-wider text-[oklch(0.68_0.04_265)] mb-1">Option 3 Text</label>
                  <input
                    type="text"
                    required
                    value={editForm.opt3}
                    onChange={(e) => setEditForm({...editForm, opt3: e.target.value})}
                    className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block uppercase tracking-wider text-[oklch(0.68_0.04_265)] mb-1">Option 4 Text</label>
                  <input
                    type="text"
                    required
                    value={editForm.opt4}
                    onChange={(e) => setEditForm({...editForm, opt4: e.target.value})}
                    className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block uppercase tracking-wider text-[oklch(0.68_0.04_265)] mb-1">Solution Explanation</label>
                <textarea
                  rows="2"
                  value={editForm.solution_explanation}
                  onChange={(e) => setEditForm({...editForm, solution_explanation: e.target.value})}
                  className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3 text-sm text-white font-sans"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingQ(null)}
                  className="flex-1 py-3 bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)] uppercase font-bold tracking-widest rounded-xl border border-white/10 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] uppercase font-extrabold tracking-widest rounded-xl shadow cursor-pointer hover:brightness-110"
                >
                  {loading ? 'Saving...' : 'Save Database Updates →'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
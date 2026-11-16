import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function AdminExamCreator({ theme = 'dark' }) {
  const [examName, setExamName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [optionsCount, setOptionsCount] = useState(4); // 👈 State properly declared here
const [sections, setSections] = useState([
    { section_id: 'ENG_' + Date.now(), section_name: 'English Language', no_of_questions: 30, duration_minutes: 20 },
    { section_id: 'NUM_' + (Date.now() + 1), section_name: 'Numerical Ability', no_of_questions: 35, duration_minutes: 20 },
    { section_id: 'REA_' + (Date.now() + 2), section_name: 'Reasoning Ability', no_of_questions: 35, duration_minutes: 20 }
  ]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const isDark = theme === 'dark';
  const isMono = theme === 'light-mono';

const handleAddSection = () => {
    setSections([
      ...sections, 
      { 
        section_id: `SEC_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, 
        section_name: '', 
        no_of_questions: 30, 
        duration_minutes: 20 
      }
    ]);
  };

  const handleRemoveSection = (index) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const handleSectionChange = (index, field, value) => {
    const updated = [...sections];
    updated[index][field] = value;
    setSections(updated);
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');

    try {
      const examId = examName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();

      // 1. Insert Exam Blueprint with options_count
      const { error: examErr } = await supabase.from('exams').insert([
        {
          exam_id: examId,
          exam_name: examName,
          duration_minutes: Number(durationMinutes),
          options_count: Number(optionsCount)
        }
      ]);

      if (examErr) throw examErr;

      // 2. Insert Sections (including maximum_marks to satisfy DB constraint)
      const sectionsToInsert = sections.map(sec => ({
        exam_id: examId,
        section_id: sec.section_id,
        section_name: sec.section_name,
        no_of_questions: Number(sec.no_of_questions),
        duration_minutes: Number(sec.duration_minutes),
        maximum_marks: Number(sec.no_of_questions)
      }));

      const { error: secErr } = await supabase.from('exam_sections').insert(sectionsToInsert);
      if (secErr) throw secErr;

      setSuccessMsg(`✅ Exam blueprint "${examName}" created successfully with ${optionsCount} MCQ options per question!`);
      setExamName('');
    } catch (err) {
      console.error(err);
      alert('Error creating exam: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`p-8 max-w-4xl mx-auto space-y-8 font-sans ${isDark ? 'text-white' : isMono ? 'text-black' : 'text-slate-900'}`}>
      <div className={`border p-8 rounded-3xl shadow-xl ${isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10' : isMono ? 'bg-white border-2 border-black' : 'bg-white border-slate-200'}`}>
        <h2 className={`text-2xl font-black mb-1 ${isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black underline' : 'text-red-600'}`}>
          📝 Create New Exam Blueprint
        </h2>
        <p className="font-mono text-xs uppercase opacity-75 mb-6">Define blueprint parameters, sections, and MCQ options count.</p>

        {successMsg && (
          <div className="p-4 mb-6 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs rounded-2xl text-center">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleCreateExam} className="space-y-6 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block uppercase tracking-[0.15em] mb-2 font-semibold opacity-80">Exam Title</label>
              <input
                type="text"
                required
                placeholder="e.g. SBI Clerk Prelims"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                className={`w-full border rounded-xl p-3.5 text-sm focus:outline-none ${isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-slate-50 border-slate-300'}`}
              />
            </div>
            <div>
              <label className="block uppercase tracking-[0.15em] mb-2 font-semibold opacity-80">Total Duration (Mins)</label>
              <input
                type="number"
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className={`w-full border rounded-xl p-3.5 text-sm focus:outline-none ${isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-slate-50 border-slate-300'}`}
              />
            </div>
            <div>
              <label className="block uppercase tracking-[0.15em] mb-2 font-semibold opacity-80">MCQ Options Count</label>
              <select
                value={optionsCount}
                onChange={(e) => setOptionsCount(Number(e.target.value))}
                className={`w-full border rounded-xl p-3.5 text-sm focus:outline-none cursor-pointer ${isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-slate-50 border-slate-300'}`}
              >
                <option value={4}>4 Options (A - D)</option>
                <option value={5}>5 Options (A - E)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/10">
            <div className="flex justify-between items-center">
              <h3 className="font-bold uppercase tracking-widest">Exam Sections</h3>
              <button
                type="button"
                onClick={handleAddSection}
                className={`px-4 py-2 rounded-xl font-bold uppercase transition cursor-pointer border ${isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-[oklch(0.94_0.21_118)]' : isMono ? 'bg-black text-white border-2 border-black' : 'bg-slate-100 text-slate-700'}`}
              >
                + Add Section
              </button>
            </div>

            {sections.map((sec, idx) => (
              <div key={idx} className={`p-4 rounded-2xl border grid grid-cols-1 sm:grid-cols-12 gap-3 items-center ${isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/5' : isMono ? 'bg-neutral-50 border-2 border-black' : 'bg-slate-50 border-slate-200'}`}>
                <div className="sm:col-span-4">
                  <label className="block text-[10px] uppercase opacity-70 mb-1">Section Name</label>
                  <input
                    type="text"
                    required
                    value={sec.section_name}
                    onChange={(e) => handleSectionChange(idx, 'section_name', e.target.value)}
                    className={`w-full border rounded-lg p-2.5 text-xs ${isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10 text-white' : 'bg-white border-slate-300'}`}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[10px] uppercase opacity-70 mb-1">No. of Questions</label>
                  <input
                    type="number"
                    required
                    value={sec.no_of_questions}
                    onChange={(e) => handleSectionChange(idx, 'no_of_questions', e.target.value)}
                    className={`w-full border rounded-lg p-2.5 text-xs ${isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10 text-white' : 'bg-white border-slate-300'}`}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[10px] uppercase opacity-70 mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    required
                    value={sec.duration_minutes}
                    onChange={(e) => handleSectionChange(idx, 'duration_minutes', e.target.value)}
                    className={`w-full border rounded-lg p-2.5 text-xs ${isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10 text-white' : 'bg-white border-slate-300'}`}
                  />
                </div>
                <div className="sm:col-span-2 text-right pt-4">
                  {sections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSection(idx)}
                      className="px-3 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg hover:bg-rose-500/20 cursor-pointer"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 font-extrabold uppercase tracking-[0.15em] rounded-2xl transition cursor-pointer shadow-sm ${
              isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] hover:brightness-110' : isMono ? 'bg-black text-white border-2 border-black' : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {loading ? 'DEPLOYING BLUEPRINT...' : 'PUBLISH EXAM BLUEPRINT →'}
          </button>
        </form>
      </div>
    </div>
  );
}
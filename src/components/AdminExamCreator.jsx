import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function AdminExamCreator() {
  const [examName, setExamName] = useState('');
  const [examId, setExamId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [sections, setSections] = useState([
    { section_id: 'sec_eng', section_name: 'English Language', no_of_questions: 30, duration_minutes: 20 },
    { section_id: 'sec_num', section_name: 'Quantitative Aptitude', no_of_questions: 35, duration_minutes: 20 },
    { section_id: 'sec_rea', section_name: 'Reasoning Ability', no_of_questions: 35, duration_minutes: 20 }
  ]);
  const [loading, setLoading] = useState(false);

  const handleNameChange = (e) => {
    const val = e.target.value;
    setExamName(val);
    setExamId(val.toLowerCase().replace(/[^a-z0-9]/g, '_'));
  };

  const handleSectionChange = (index, field, value) => {
    const updated = [...sections];
    updated[index][field] = value;
    if (field === 'section_name') {
      updated[index]['section_id'] = value.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.floor(Math.random() * 1000);
    }
    setSections(updated);
  };

  const addSection = () => {
    setSections([...sections, { section_id: 'sec_' + Date.now(), section_name: '', no_of_questions: 35, duration_minutes: 20 }]);
  };

  const removeSection = (index) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!examName || !examId) {
      alert('Please provide a valid exam name.');
      return;
    }

    setLoading(true);
    try {
      // Automatically calculate total questions and marks from sections
      const totalQuestionsCount = sections.reduce((sum, sec) => sum + Number(sec.no_of_questions || 0), 0);
      const totalMarksCount = totalQuestionsCount; // 1 mark per question standard layout

      // 1. Upsert Exam Blueprint (prevents duplicate key crashes if slug exists)
      const { error: examError } = await supabase.from('exams').upsert([
        { 
          exam_id: examId, 
          exam_name: examName, 
          duration_minutes: Number(durationMinutes),
          total_questions: totalQuestionsCount,
          total_marks: totalMarksCount
        }
      ]);
      if (examError) throw examError;

      // 2. Upsert Sections (mapping both duration fields to prevent any mismatch)
      const sectionsPayload = sections.map(sec => ({
        section_id: sec.section_id,
        exam_id: examId,
        section_name: sec.section_name,
        no_of_questions: Number(sec.no_of_questions),
        maximum_marks: Number(sec.no_of_questions), 
        duration_minutes: Number(sec.duration_minutes),
        section_duration_minutes: Number(sec.duration_minutes) // <--- Adds this to satisfy the database column constraint
      }));

      const { error: secError } = await supabase.from('exam_sections').upsert(sectionsPayload);
      if (secError) throw secError;

      alert(`Successfully deployed exam blueprint "${examName}" with ${sections.length} sections!`);
      setExamName('');
      setExamId('');
      setSections([
        { section_id: 'sec_eng', section_name: 'English Language', no_of_questions: 30, duration_minutes: 20 },
        { section_id: 'sec_num', section_name: 'Quantitative Aptitude', no_of_questions: 35, duration_minutes: 20 },
        { section_id: 'sec_rea', section_name: 'Reasoning Ability', no_of_questions: 35, duration_minutes: 20 }
      ]);
    } catch (err) {
      console.error(err);
      alert('Error creating exam blueprint: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)] p-6 sm:p-12 font-sans flex flex-col items-center overflow-y-auto">
      <div className="w-full max-w-3xl bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="border-b border-white/10 pb-4">
          <span className="font-mono text-xs text-[oklch(0.94_0.21_118)] uppercase tracking-widest font-bold">Admin Studio</span>
          <h2 className="text-2xl font-black font-['Archivo_Black'] tracking-tight">Create New Exam Blueprint</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block uppercase tracking-[0.15em] text-[oklch(0.68_0.04_265)] mb-2">Exam Name</label>
              <input
                type="text"
                required
                placeholder="e.g. IBPS PO Prelims"
                value={examName}
                onChange={handleNameChange}
                className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3.5 text-sm text-[oklch(0.96_0.012_265)] focus:outline-none focus:border-[oklch(0.94_0.21_118)]"
              />
            </div>
            <div>
              <label className="block uppercase tracking-[0.15em] text-[oklch(0.68_0.04_265)] mb-2">Generated ID / Slug</label>
              <input
                type="text"
                required
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3.5 text-sm text-[oklch(0.68_0.04_265)] focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block uppercase tracking-[0.15em] text-[oklch(0.68_0.04_265)] mb-2">Total Duration (Minutes)</label>
            <input
              type="number"
              required
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3.5 text-sm text-[oklch(0.96_0.012_265)] focus:outline-none focus:border-[oklch(0.94_0.21_118)]"
            />
          </div>

          <div className="space-y-4 pt-4 border-t border-white/10">
            <div className="flex justify-between items-center">
              <span className="font-bold text-[oklch(0.94_0.21_118)] uppercase tracking-wider">Exam Sections / Modules</span>
              <button
                type="button"
                onClick={addSection}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg uppercase text-[10px] tracking-widest font-bold transition cursor-pointer"
              >
                + Add Section
              </button>
            </div>

            <div className="space-y-3">
              {sections.map((sec, idx) => (
                <div key={idx} className="bg-[oklch(0.16_0.03_265)] p-4 rounded-2xl border border-white/5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] text-[oklch(0.68_0.04_265)] mb-1 uppercase">Section Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. English Language"
                      value={sec.section_name}
                      onChange={(e) => handleSectionChange(idx, 'section_name', e.target.value)}
                      className="w-full bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-[oklch(0.68_0.04_265)] mb-1 uppercase">Questions Count</label>
                    <input
                      type="number"
                      required
                      value={sec.no_of_questions}
                      onChange={(e) => handleSectionChange(idx, 'no_of_questions', e.target.value)}
                      className="w-full bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-[oklch(0.68_0.04_265)] mb-1 uppercase">Duration (Mins)</label>
                    <input
                      type="number"
                      required
                      value={sec.duration_minutes}
                      onChange={(e) => handleSectionChange(idx, 'duration_minutes', e.target.value)}
                      className="w-full bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-1 flex justify-end pt-4">
                    {sections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSection(idx)}
                        className="text-rose-400 hover:text-rose-300 font-bold p-2 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[oklch(0.94_0.21_118)] hover:brightness-110 text-[oklch(0.16_0.03_265)] font-mono text-xs uppercase tracking-[0.15em] font-extrabold rounded-xl shadow-[0_0_25px_rgba(204,255,0,0.25)] transition cursor-pointer"
          >
            {loading ? 'DEPLOYING BLUEPRINT...' : 'CREATE EXAM BLUEPRINT →'}
          </button>
        </form>
      </div>
    </div>
  );
}
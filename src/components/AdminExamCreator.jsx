import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function AdminExamCreator({ theme = 'dark' }) {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  
  // Creation form state
  const [examName, setExamName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [optionsCount, setOptionsCount] = useState(4);
  const [sections, setSections] = useState([
    { section_id: 'ENG_' + Date.now(), section_name: 'English Language', no_of_questions: 30, duration_minutes: 20 },
    { section_id: 'NUM_' + (Date.now() + 1), section_name: 'Numerical Ability', no_of_questions: 35, duration_minutes: 20 },
    { section_id: 'REA_' + (Date.now() + 2), section_name: 'Reasoning Ability', no_of_questions: 35, duration_minutes: 20 }
  ]);

  // Edit / Existing Blueprint State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editExamName, setEditExamName] = useState('');
  const [editDuration, setEditDuration] = useState(60);
  const [editOptionsCount, setEditOptionsCount] = useState(4);
  const [editSections, setEditSections] = useState([]);

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const isDark = theme === 'dark';
  const isMono = theme === 'light-mono';

  // Fetch existing exams for management
  useEffect(() => {
    async function fetchExams() {
      const { data } = await supabase.from('exams').select('*');
      if (data) {
        setExams(data);
        if (data.length > 0) setSelectedExamId(data[0].exam_id || data[0].id);
      }
    }
    fetchExams();
  }, [successMsg]);

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

  // Open Edit Blueprint Modal & load existing sections
  const handleOpenEditModal = async () => {
    if (!selectedExamId) return;
    const currentExam = exams.find(ex => String(ex.exam_id || ex.id) === String(selectedExamId));
    if (!currentExam) return;

    setEditExamName(currentExam.exam_name || currentExam.name || '');
    setEditDuration(currentExam.duration_minutes || 60);
    setEditOptionsCount(currentExam.options_count || 4);

    // Fetch attached sections for this exam
    const { data: secData } = await supabase
      .from('exam_sections')
      .select('*')
      .eq('exam_id', selectedExamId);

    setEditSections(secData || []);
    setIsEditModalOpen(true);
  };

  const handleAddEditSection = () => {
    setEditSections([
      ...editSections,
      {
        exam_id: selectedExamId,
        section_id: `SEC_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        section_name: '',
        no_of_questions: 20,
        duration_minutes: 20,
        maximum_marks: 20
      }
    ]);
  };

  const handleSaveBlueprintEdits = async () => {
    try {
      setLoading(true);
      // 1. Update Exam Details
      const { error: examUpdateErr } = await supabase
        .from('exams')
        .update({
          exam_name: editExamName,
          duration_minutes: Number(editDuration),
          options_count: Number(editOptionsCount)
        })
        .eq('exam_id', selectedExamId);

      if (examUpdateErr) throw examUpdateErr;

      // 2. Replace / Upsert Sections
      // First delete old sections and re-insert or upsert
      await supabase.from('exam_sections').delete().eq('exam_id', selectedExamId);

      const sectionsToInsert = editSections.map(sec => ({
        exam_id: selectedExamId,
        section_id: sec.section_id || `SEC_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        section_name: sec.section_name,
        no_of_questions: Number(sec.no_of_questions),
        duration_minutes: Number(sec.duration_minutes),
        maximum_marks: Number(sec.no_of_questions)
      }));

      const { error: secInsertErr } = await supabase.from('exam_sections').insert(sectionsToInsert);
      if (secInsertErr) throw secInsertErr;

      setSuccessMsg(`✅ Exam blueprint "${editExamName}" updated successfully!`);
      setIsEditModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error updating exam: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');

    try {
      const examId = examName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();

      const { error: examErr } = await supabase.from('exams').insert([
        {
          exam_id: examId,
          exam_name: examName,
          duration_minutes: Number(durationMinutes),
          options_count: Number(optionsCount)
        }
      ]);

      if (examErr) throw examErr;

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
      
      {/* Existing Blueprints Quick Manager */}
      {exams.length > 0 && (
        <div className={`border p-6 rounded-3xl shadow-lg flex flex-wrap justify-between items-center gap-4 ${isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10' : isMono ? 'bg-white border-2 border-black' : 'bg-white border-slate-200'}`}>
          <div>
            <h3 className="font-bold uppercase tracking-wider text-xs mb-1">Manage Existing Blueprints</h3>
            <p className="font-mono text-[11px] opacity-75">Select an exam to edit its title, duration, or add/remove categories.</p>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className={`border rounded-xl p-3 text-xs focus:outline-none cursor-pointer ${isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-slate-50 border-slate-300'}`}
            >
              {exams.map(ex => (
                <option key={ex.exam_id || ex.id} value={ex.exam_id || ex.id}>
                  {ex.exam_name || ex.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleOpenEditModal}
              className={`px-5 py-3 rounded-xl font-bold uppercase transition cursor-pointer ${isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)]' : isMono ? 'bg-black text-white border-2 border-black' : 'bg-red-600 text-white'}`}
            >
              Edit Selected Blueprint ✏️
            </button>
          </div>
        </div>
      )}

      {/* Create New Exam Blueprint Section */}
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
              <h3 className="font-bold uppercase tracking-widest">Exam Sections / Categories</h3>
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
                  <label className="block text-[10px] uppercase opacity-70 mb-1">Section / Category Name</label>
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

      {/* Edit Blueprint Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className={`border rounded-3xl p-8 max-w-2xl w-full space-y-6 shadow-2xl font-mono max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/15 text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-white border-slate-200 text-slate-900 shadow-xl'
          }`}>
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className={`text-xl font-black tracking-tight ${isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black underline' : 'text-red-600'}`}>
                BLUEPRINT EDITOR
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-xs font-bold px-3 py-1 rounded bg-white/10 hover:bg-white/20 cursor-pointer">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block uppercase tracking-[0.15em] mb-1 font-semibold opacity-80">Exam Name</label>
                <input
                  type="text"
                  value={editExamName}
                  onChange={(e) => setEditExamName(e.target.value)}
                  className={`w-full border rounded-xl p-3 text-xs ${isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-white' : 'bg-slate-50 border-slate-300'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block uppercase tracking-[0.15em] mb-1 font-semibold opacity-80">Total Duration (Mins)</label>
                  <input
                    type="number"
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className={`w-full border rounded-xl p-3 text-xs ${isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-white' : 'bg-slate-50 border-slate-300'}`}
                  />
                </div>
                <div>
                  <label className="block uppercase tracking-[0.15em] mb-1 font-semibold opacity-80">Options Count</label>
                  <select
                    value={editOptionsCount}
                    onChange={(e) => setEditOptionsCount(Number(e.target.value))}
                    className={`w-full border rounded-xl p-3 text-xs cursor-pointer ${isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-white' : 'bg-slate-50 border-slate-300'}`}
                  >
                    <option value={4}>4 Options</option>
                    <option value={5}>5 Options</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold uppercase tracking-widest">Attached Sections / Categories</span>
                  <button
                    type="button"
                    onClick={handleAddEditSection}
                    className="px-3 py-1.5 rounded-xl font-bold uppercase border bg-indigo-600 text-white hover:bg-indigo-700 transition cursor-pointer"
                  >
                    + Add Category
                  </button>
                </div>

                {editSections.map((sec, idx) => (
                  <div key={idx} className={`p-4 rounded-2xl border flex flex-wrap sm:flex-nowrap gap-3 items-center ${isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10' : 'bg-slate-50 border-slate-300'}`}>
                    <div className="flex-1 space-y-1">
                      <label className="block text-[10px] uppercase opacity-70">Category / Section Name</label>
                      <input
                        type="text"
                        value={sec.section_name || ''}
                        onChange={(e) => {
                          const updated = [...editSections];
                          updated[idx].section_name = e.target.value;
                          setEditSections(updated);
                        }}
                        placeholder="e.g. Financial Results"
                        className={`w-full border rounded-xl p-2.5 text-xs ${isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10 text-white' : 'bg-white border-slate-300'}`}
                      />
                    </div>
                    <div className="w-32 space-y-1">
                      <label className="block text-[10px] uppercase opacity-70">Questions</label>
                      <input
                        type="number"
                        value={sec.no_of_questions || 20}
                        onChange={(e) => {
                          const updated = [...editSections];
                          updated[idx].no_of_questions = Number(e.target.value);
                          setEditSections(updated);
                        }}
                        className={`w-full border rounded-xl p-2.5 text-xs ${isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10 text-white' : 'bg-white border-slate-300'}`}
                      />
                    </div>
                    {editSections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editSections.filter((_, i) => i !== idx);
                          setEditSections(updated);
                        }}
                        className="mt-5 p-2.5 rounded-xl bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 transition cursor-pointer"
                        title="Remove Category"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-xl border transition cursor-pointer ${isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-white' : 'bg-slate-100 border-slate-300 text-slate-700'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBlueprintEdits}
                disabled={loading}
                className={`flex-1 py-3 text-xs font-extrabold uppercase tracking-widest rounded-xl transition cursor-pointer shadow-sm ${isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] hover:brightness-110' : 'bg-black text-white'}`}
              >
                {loading ? 'SAVING...' : 'Save Changes →'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
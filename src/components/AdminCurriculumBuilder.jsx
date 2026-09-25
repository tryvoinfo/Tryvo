import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const cleanText = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"');
};

export default function AdminCurriculumBuilder() {
  const [activeStudioTab, setActiveStudioTab] = useState('canvas'); // 'canvas' | 'manager'
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  
  // Master elements palette
  const [availableCategories, setAvailableCategories] = useState([
    { id: 'cat_num', name: 'Numerical Ability' },
    { id: 'cat_eng', name: 'English Language' },
    { id: 'cat_reas', name: 'Reasoning Ability' },
    { id: 'cat_gk', name: 'General Awareness' }
  ]);

  const [availableSubtopics, setAvailableSubtopics] = useState([
    { id: 'sub_app', name: 'Approximation & Simplification', category: 'Numerical Ability' },
    { id: 'sub_di', name: 'Data Interpretation (DI)', category: 'Numerical Ability' },
    { id: 'sub_ser', name: 'Number Series', category: 'Numerical Ability' },
    { id: 'sub_cloze', name: 'Cloze Test', category: 'English Language' },
    { id: 'sub_err', name: 'Error Detection', category: 'English Language' },
    { id: 'sub_rc', name: 'Reading Comprehension', category: 'English Language' },
    { id: 'sub_puz', name: 'Seating Arrangement & Puzzles', category: 'Reasoning Ability' },
    { id: 'sub_syl', name: 'Syllogism', category: 'Reasoning Ability' }
  ]);

  // 3-Tier Tree Structure: [ { categoryName: 'Numerical Ability', subtopics: [...] } ]
  const [examTree, setExamTree] = useState([]);
  const [sectionsMap, setSectionsMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  // Edit Modal State for Manager Tab
  const [editingExam, setEditingExam] = useState(null);
  const [editExamName, setEditExamName] = useState('');
  const [editDuration, setEditDuration] = useState(60);
  const [editSections, setEditSections] = useState([]);

  // Fetch initial data from Supabase
  const fetchBlueprintData = async () => {
    setLoading(true);
    try {
      const { data: examsData } = await supabase.from('exams').select('*');
      const { data: sectionsData } = await supabase.from('exam_sections').select('*');
      const { data: subtopicsData } = await supabase.from('subtopics').select('*');

      if (examsData && examsData.length > 0) {
        setExams(examsData);
        if (!selectedExamId) {
          setSelectedExamId(examsData[0].exam_id || examsData[0].id);
        }
      } else {
        const defaultExam = { exam_id: 'E0001', exam_name: 'SBI Clerical Prelims', duration_minutes: 60 };
        setExams([defaultExam]);
        setSelectedExamId('E0001');
      }

      if (sectionsData) {
        const map = {};
        sectionsData.forEach(sec => {
          const eId = sec.exam_id;
          if (!map[eId]) map[eId] = [];
          map[eId].push(sec);
        });
        setSectionsMap(map);
      }

      if (subtopicsData && subtopicsData.length > 0) {
        // Merge DB subtopics with default ones if needed
        const dbSubs = subtopicsData.map(s => ({
          id: s.subtopic_id || s.id,
          name: s.subtopic_name || s.name,
          category: s.category || 'Numerical Ability',
          section_id: s.section_id
        }));
        setAvailableSubtopics(dbSubs);
      }
    } catch (err) {
      console.error('Error loading blueprints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlueprintData();
  }, []);

  // Sync 3-tier tree whenever selected exam changes
  useEffect(() => {
    if (!selectedExamId) return;
    const examSections = sectionsMap[selectedExamId] || [];
    
    const tree = examSections.map(sec => {
      const secId = sec.section_id || sec.id;
      const secName = (sec.section_name || '').toLowerCase();
      
      // Match subtopics linked via section_id or category text
      const matchedSubs = availableSubtopics.filter(sub => {
        const subCat = (sub.category || '').toLowerCase();
        return sub.section_id === secId || subCat.includes(secName.split(' ')[0]);
      });

      return {
        name: sec.section_name,
        section_id: secId,
        subtopics: matchedSubs.map(s => ({ id: s.id, name: s.name }))
      };
    });

    setExamTree(tree);
  }, [selectedExamId, sectionsMap, availableSubtopics]);

  // Drag & Drop Handlers
  const handleDragStart = (e, item, type) => {
    setDraggedItem({ item, type });
  };

  const handleDropOnCanvas = (e) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.type !== 'category') return;

    const category = draggedItem.item;
    if (!examTree.some(c => c.name.toLowerCase() === category.name.toLowerCase())) {
      setExamTree([...examTree, { name: category.name, subtopics: [] }]);
    }
    setDraggedItem(null);
  };

  const handleDropOnCategory = (e, categoryName) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.type !== 'subtopic') return;

    const subtopic = draggedItem.item;
    const targetCat = examTree.find(c => c.name.toLowerCase() === categoryName.toLowerCase());

    if (targetCat) {
      if (!targetCat.subtopics.some(s => s.id === subtopic.id)) {
        targetCat.subtopics.push({ id: subtopic.id, name: subtopic.name });
        setExamTree([...examTree]);
      }
    }
    setDraggedItem(null);
  };

  const allowDrop = (e) => e.preventDefault();

  const removeItem = (catIndex, subIndex = null) => {
    if (subIndex !== null) {
      examTree[catIndex].subtopics.splice(subIndex, 1);
      setExamTree([...examTree]);
    } else {
      examTree.splice(catIndex, 1);
      setExamTree([...examTree]);
    }
  };

  // Save 3-tier hierarchy to Supabase
  const handleSaveBlueprint = async () => {
    setLoading(true);
    try {
      // Clear old sections for this exam and re-insert current tree layout
      await supabase.from('exam_sections').delete().eq('exam_id', selectedExamId);

      for (const cat of examTree) {
        const secId = cat.section_id || `${selectedExamId}_${Math.random().toString(36).substring(2, 7)}`;
        const { error: secErr } = await supabase.from('exam_sections').upsert([
          {
            section_id: secId,
            exam_id: selectedExamId,
            section_name: cat.name,
            no_of_questions: 35,
            maximum_marks: 35,
            duration_minutes: 20,
            section_duration_minutes: 20
          }
        ]);
        if (secErr) throw secErr;

        // Update subtopics mapping in DB
        if (cat.subtopics && cat.subtopics.length > 0) {
          const subIds = cat.subtopics.map(s => s.id);
          await supabase
            .from('subtopics')
            .update({ section_id: secId, category: cat.name })
            .in('subtopic_id', subIds);
        }
      }

      alert('3-tier exam blueprint and organogram successfully synchronized!');
      fetchBlueprintData();
    } catch (err) {
      console.error(err);
      alert('Error saving structure: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (exam) => {
    setEditingExam(exam);
    setEditExamName(exam.exam_name || exam.name || '');
    setEditDuration(exam.duration_minutes || 60);
    const examSecs = sectionsMap[exam.exam_id || exam.id] || [];
    setEditSections(JSON.parse(JSON.stringify(examSecs)));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingExam) return;

    const examId = editingExam.exam_id || editingExam.id;
    setLoading(true);

    try {
      await supabase.from('exams').update({
        exam_name: editExamName,
        duration_minutes: Number(editDuration)
      }).eq('exam_id', examId);

      for (const sec of editSections) {
        const secId = sec.section_id || sec.id;
        await supabase.from('exam_sections').update({
          section_name: sec.section_name,
          no_of_questions: Number(sec.no_of_questions),
          duration_minutes: Number(sec.duration_minutes || sec.section_duration_minutes || 20)
        }).eq('section_id', secId);
      }

      alert(`Updated blueprint for "${editExamName}"!`);
      setEditingExam(null);
      fetchBlueprintData();
    } catch (err) {
      alert('Failed to update: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExam = async (examId) => {
    if (!window.confirm("Cancel and delete this exam blueprint?")) return;
    setLoading(true);
    try {
      await supabase.from('exam_sections').delete().eq('exam_id', examId);
      await supabase.from('exams').delete().eq('exam_id', examId);
      alert('Exam blueprint deleted.');
      fetchBlueprintData();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedExamObj = exams.find(ex => String(ex.exam_id || ex.id) === String(selectedExamId));

  return (
    <div className="flex-1 bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)] p-6 sm:p-10 font-sans flex flex-col gap-8 overflow-y-auto">
      
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-wrap justify-between items-center bg-[oklch(0.23_0.045_265)] border border-white/10 p-6 rounded-3xl shadow-xl gap-4">
        <div>
          <span className="font-mono text-xs text-[oklch(0.94_0.21_118)] uppercase tracking-widest font-bold">3-Tier Organogram Studio</span>
          <h1 className="text-2xl font-black font-['Archivo_Black'] tracking-tight">Exams ➔ Categories ➔ Subtopics Builder</h1>
        </div>

        <div className="flex gap-2 font-mono text-xs">
          <button
            onClick={() => setActiveStudioTab('canvas')}
            className={`px-4 py-2 rounded-xl font-bold uppercase transition cursor-pointer ${
              activeStudioTab === 'canvas'
                ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                : 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)] border border-white/5 hover:text-white'
            }`}
          >
            🎨 Visual Canvas
          </button>
          <button
            onClick={() => {
              setActiveStudioTab('manager');
              fetchBlueprintData();
            }}
            className={`px-4 py-2 rounded-xl font-bold uppercase transition cursor-pointer ${
              activeStudioTab === 'manager'
                ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                : 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)] border border-white/5 hover:text-white'
            }`}
          >
            📋 Manage Blueprints ({exams.length})
          </button>
        </div>
      </div>

      {/* TAB 1: VISUAL CANVAS BUILDER */}
      {activeStudioTab === 'canvas' && (
        <>
          {/* Target Exam Dropdown Bar */}
          <div className="flex flex-wrap justify-between items-center bg-[oklch(0.23_0.045_265)] border border-white/10 p-6 rounded-3xl shadow-xl gap-4">
            <div className="font-mono text-xs text-[oklch(0.68_0.04_265)] uppercase tracking-wider flex items-center gap-2">
              <span>Tier 1 Target Exam:</span>
              <select
                className="bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl px-4 py-2 text-white font-bold focus:outline-none focus:border-[oklch(0.94_0.21_118)] cursor-pointer"
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
              >
                {exams.map(ex => (
                  <option key={ex.exam_id || ex.id} value={ex.exam_id || ex.id}>
                    {cleanText(ex.exam_name || ex.name)}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSaveBlueprint}
              disabled={loading}
              className="px-6 py-2.5 bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] font-mono font-extrabold uppercase tracking-widest rounded-xl hover:brightness-110 transition cursor-pointer"
            >
              {loading ? 'Saving...' : '💾 Save Blueprint Hierarchy'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start font-mono text-xs">
            
            {/* Left Palette: Drag Source Elements */}
            <div className="lg:col-span-4 bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl">
              <h3 className="font-bold text-[oklch(0.94_0.21_118)] uppercase tracking-widest border-b border-white/10 pb-3">
                📦 Available Elements (Drag)
              </h3>

              <div className="space-y-4">
                <div>
                  <span className="text-[oklch(0.68_0.04_265)] uppercase tracking-wider block mb-2 font-bold">Tier 2: Categories / Subjects</span>
                  <div className="flex flex-wrap gap-2">
                    {availableCategories.map(cat => (
                      <div
                        key={cat.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, cat, 'category')}
                        className="px-3.5 py-2 rounded-xl bg-[oklch(0.16_0.03_265)] border border-white/15 text-[oklch(0.96_0.012_265)] font-bold cursor-grab active:cursor-grabbing hover:border-[oklch(0.94_0.21_118)] transition shadow"
                      >
                        📂 {cat.name}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-[oklch(0.68_0.04_265)] uppercase tracking-wider block mb-2 font-bold">Tier 3: Subtopics</span>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {availableSubtopics.map(sub => (
                      <div
                        key={sub.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, sub, 'subtopic')}
                        className="p-3 rounded-xl bg-[oklch(0.16_0.03_265)] border border-white/10 text-[oklch(0.96_0.012_265)] cursor-grab active:cursor-grabbing hover:border-[oklch(0.94_0.21_118)] transition flex justify-between items-center"
                      >
                        <span>📄 {sub.name}</span>
                        <span className="text-[9px] text-[oklch(0.68_0.04_265)]">({sub.category})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Canvas: 3-Tier Hierarchy Tree */}
            <div 
              className="lg:col-span-8 bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-8 shadow-xl min-h-[500px] flex flex-col items-center relative overflow-x-auto"
              onDragOver={allowDrop}
              onDrop={handleDropOnCanvas}
            >
              <div className="w-full flex justify-between items-center border-b border-white/10 pb-4 mb-6">
                <span className="font-bold text-[oklch(0.94_0.21_118)] uppercase tracking-widest">
                  🌳 Organogram Tree Canvas
                </span>
                <span className="text-[oklch(0.68_0.04_265)]">Drop Category here, then drop Subtopics inside</span>
              </div>

              {/* Tier 1 Root Node: Selected Exam */}
              <div className="px-8 py-3.5 rounded-2xl bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] uppercase tracking-widest font-black shadow-[0_0_25px_rgba(204,255,0,0.3)] text-center">
                🎓 {cleanText(selectedExamObj?.exam_name || selectedExamObj?.name || 'Selected Exam')}
              </div>

              <div className="w-0.5 h-6 bg-white/20"></div>

              {examTree.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-white/10 rounded-2xl w-full text-[oklch(0.68_0.04_265)] space-y-2 mt-2">
                  <p className="uppercase tracking-widest font-bold">Canvas is Empty</p>
                  <p>Drag a Subject Category from the left palette onto this canvas.</p>
                </div>
              ) : (
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                  {examTree.map((cat, cIdx) => (
                    <div
                      key={cIdx}
                      onDragOver={allowDrop}
                      onDrop={(e) => handleDropOnCategory(e, cat.name)}
                      className="bg-[oklch(0.16_0.03_265)] border border-white/15 rounded-2xl p-5 space-y-4 shadow-lg relative"
                    >
                      {/* Tier 2 Header: Category */}
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                        <span className="font-bold text-[oklch(0.94_0.21_118)] uppercase tracking-wider">
                          📂 {cat.name}
                        </span>
                        <button
                          onClick={() => removeItem(cIdx)}
                          className="text-rose-400 hover:text-rose-300 font-bold text-xs cursor-pointer"
                        >
                          ✕ Remove
                        </button>
                      </div>

                      {/* Tier 3 Container: Subtopics */}
                      <div className="space-y-2 min-h-[70px] p-2 bg-white/5 rounded-xl border border-dashed border-white/10">
                        {cat.subtopics.length === 0 ? (
                          <div className="text-center py-4 text-[oklch(0.68_0.04_265)] text-[11px] italic">
                            Drop subtopics here
                          </div>
                        ) : (
                          cat.subtopics.map((sub, sIdx) => (
                            <div
                              key={sIdx}
                              className="flex justify-between items-center p-2.5 rounded-lg bg-[oklch(0.23_0.045_265)] border border-white/10 text-[oklch(0.96_0.012_265)]"
                            >
                              <span>↳ 📄 {sub.name}</span>
                              <button
                                onClick={() => removeItem(cIdx, sIdx)}
                                className="text-rose-400 hover:text-rose-300 text-[10px] cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </>
      )}

      {/* TAB 2: EXAMS & BLUEPRINT MANAGER */}
      {activeStudioTab === 'manager' && (
        <div className="space-y-6 font-mono">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black font-['Archivo_Black'] tracking-tight">Existing Exam Blueprints</h2>
              <p className="text-xs text-[oklch(0.68_0.04_265)] mt-1 uppercase tracking-wider">Inspect, modify, or cancel active database exam structures</p>
            </div>
            <button
              onClick={fetchBlueprintData}
              className="px-4 py-2 bg-[oklch(0.23_0.045_265)] hover:bg-[oklch(0.23_0.045_265)]/80 text-[oklch(0.94_0.21_118)] text-xs uppercase tracking-wider font-bold rounded-xl border border-[oklch(0.94_0.21_118)]/30 transition cursor-pointer"
            >
              ↻ Refresh List
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-xs text-[oklch(0.68_0.04_265)] uppercase tracking-widest animate-pulse">Loading blueprints...</div>
          ) : exams.length === 0 ? (
            <div className="bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-12 text-center text-xs text-[oklch(0.68_0.04_265)]">
              No exam blueprints found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {exams.map((exam) => {
                const eId = exam.exam_id || exam.id;
                const examSections = sectionsMap[eId] || [];

                return (
                  <div key={eId} className="bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-[oklch(0.94_0.21_118)] font-bold uppercase tracking-widest bg-[oklch(0.94_0.21_118)]/10 px-2.5 py-1 rounded-lg">
                          ID: {eId}
                        </span>
                        <span className="text-xs text-[oklch(0.68_0.04_265)] font-bold">
                          ⏱️ {exam.duration_minutes || 60} Mins
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-[oklch(0.96_0.012_265)] font-sans">{cleanText(exam.exam_name || exam.name)}</h3>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
                      <span className="text-[10px] text-[oklch(0.68_0.04_265)] uppercase tracking-wider block font-bold">Attached Categories & Subtopics ({examSections.length}):</span>
                      <div className="flex flex-wrap gap-1.5">
                        {examSections.length === 0 ? (
                          <span className="text-rose-400 italic text-[11px]">No sections attached</span>
                        ) : (
                          examSections.map((sec, sIdx) => (
                            <span key={sIdx} className="bg-[oklch(0.16_0.03_265)] border border-white/5 text-[oklch(0.96_0.012_265)] px-2.5 py-1 rounded-lg text-[11px]">
                              {cleanText(sec.section_name)} ({sec.no_of_questions || 35} Qs)
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={() => handleOpenEdit(exam)}
                        className="py-2.5 bg-[oklch(0.94_0.21_118)] hover:brightness-110 text-[oklch(0.16_0.03_265)] text-xs uppercase tracking-wider font-extrabold rounded-xl transition cursor-pointer shadow"
                      >
                        ✏️ Edit Blueprint
                      </button>
                      <button
                        onClick={() => handleDeleteExam(eId)}
                        className="py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs uppercase tracking-wider font-bold rounded-xl transition cursor-pointer"
                      >
                        🗑️ Cancel Exam
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* EDIT BLUEPRINT MODAL */}
      {editingExam && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-mono">
          <div className="bg-[oklch(0.23_0.045_265)] border border-white/20 rounded-3xl p-6 sm:p-8 max-w-xl w-full space-y-6 shadow-2xl text-[oklch(0.96_0.012_265)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] text-[oklch(0.94_0.21_118)] uppercase tracking-widest font-bold">Blueprint Editor</span>
                <h3 className="text-lg font-bold font-sans">{cleanText(editingExam.exam_name || editingExam.name)}</h3>
              </div>
              <button onClick={() => setEditingExam(null)} className="text-slate-400 hover:text-white text-lg font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block uppercase tracking-wider text-[oklch(0.68_0.04_265)] mb-1">Exam Name</label>
                <input
                  type="text"
                  required
                  value={editExamName}
                  onChange={(e) => setEditExamName(e.target.value)}
                  className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[oklch(0.94_0.21_118)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block uppercase tracking-wider text-[oklch(0.68_0.04_265)] mb-1">Total Duration (Minutes)</label>
                <input
                  type="number"
                  required
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[oklch(0.94_0.21_118)] focus:outline-none"
                />
              </div>

              <div className="space-y-3 pt-2 border-t border-white/10">
                <span className="font-bold text-[oklch(0.94_0.21_118)] uppercase tracking-wider block">Attached Sections / Categories</span>
                {editSections.map((sec, idx) => (
                  <div key={idx} className="bg-[oklch(0.16_0.03_265)] p-4 rounded-2xl border border-white/5 space-y-3">
                    <div>
                      <label className="block text-[10px] text-[oklch(0.68_0.04_265)] mb-1 uppercase">Category / Section Name</label>
                      <input
                        type="text"
                        value={sec.section_name}
                        onChange={(e) => {
                          const updated = [...editSections];
                          updated[idx].section_name = e.target.value;
                          setEditSections(updated);
                        }}
                        className="w-full bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-xl p-2.5 text-xs text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingExam(null)}
                  className="flex-1 py-3 bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)] uppercase font-bold tracking-widest rounded-xl border border-white/10 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] uppercase font-extrabold tracking-widest rounded-xl shadow cursor-pointer hover:brightness-110"
                >
                  {loading ? 'Saving...' : 'Save Changes →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
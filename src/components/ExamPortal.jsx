import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wbcdiewohpngqbeqrfmb.supabase.co';
const supabaseAnonKey = 'sb_publishable_d21wos13j9x7K-w1h8vsvw_0gPm_jlY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ExamPortal() {
  const [stage, setStage] = useState('config'); // 'config' | 'exam' | 'result' | 'solutions' | 'swot'
  const [exams, setExams] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  
  const [selectedExamId, setSelectedExamId] = useState('');
  const [testMode, setTestMode] = useState('Full-Length Mock');
  const [mockTimingMode, setMockTimingMode] = useState('liberal'); // 'liberal' | 'strict'
  const [selectedSubtopicId, setSelectedSubtopicId] = useState('');
  const [practiceMinutes, setPracticeMinutes] = useState(15);
  const [loading, setLoading] = useState(false);

  // Multi-section structure state
  const [sections, setSections] = useState([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [sectionQuestionsMap, setSectionQuestionsMap] = useState({}); // { section_id: [questions] }
  const [sectionTimeLefts, setSectionTimeLefts] = useState({}); // { section_id: secondsLeft }
  const [completedSections, setCompletedSections] = useState(new Set());

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [questionTimers, setQuestionTimers] = useState({});
  const [reviewStatus, setReviewStatus] = useState({});
  const [visitedQuestions, setVisitedQuestions] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [attemptResult, setAttemptResult] = useState(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // CRITICAL HELPER: Groups all passage-based questions tightly and contiguously together
  const groupPassageQuestions = (questionsArray) => {
    const passageMap = new Map();
    const standaloneQuestions = [];

    questionsArray.forEach((q) => {
      if (q.passage_id) {
        if (!passageMap.has(q.passage_id)) {
          passageMap.set(q.passage_id, []);
        }
        passageMap.get(q.passage_id).push(q);
      } else {
        standaloneQuestions.push(q);
      }
    });

    let sortedQuestions = [...standaloneQuestions];
    passageMap.forEach((group) => {
      sortedQuestions.push(...group);
    });

    return sortedQuestions;
  };

  useEffect(() => {
    async function loadMeta() {
      const { data: examsData } = await supabase.from('exams').select('*');
      const { data: subtopicsData } = await supabase.from('subtopics').select('*');
      
      if (examsData && examsData.length > 0) {
        setExams(examsData);
        setSelectedExamId(examsData[0].exam_id || examsData[0].id);
      }
      if (subtopicsData && subtopicsData.length > 0) {
        setSubtopics(subtopicsData);
        setSelectedSubtopicId(subtopicsData[0].subtopic_id || subtopicsData[0].id);
      }
    }
    loadMeta();
  }, []);

  const startExam = async () => {
    setLoading(true);
    let testDurationMinutes = 60;

    try {
      const activeExam = exams.find((e) => (e.exam_id || e.id) === selectedExamId);
      if (activeExam) {
        testDurationMinutes = activeExam.duration_minutes || 60;
      }

      if (testMode === 'Full-Length Mock') {
        const examIdValue = selectedExamId;

        const { data: sectionsData, error: secError } = await supabase
          .from('exam_sections')
          .select('*')
          .eq('exam_id', examIdValue);

        if (secError) throw secError;

        if (!sectionsData || sectionsData.length === 0) {
          alert('No sections defined for this exam blueprint.');
          setLoading(false);
          return;
        }

        let finalSectionMap = {};
        let allQIds = [];
        let initialSectionTimes = {};

        const defaultSecDurationSecs = Math.round((testDurationMinutes * 60) / sectionsData.length);

        // Fetch all questions and subtopics once to ensure robust distribution across modules
        const { data: allQuestions } = await supabase.from('questions').select('*, passages(*)');
        const { data: allSubtopics } = await supabase.from('subtopics').select('*');

        for (let i = 0; i < sectionsData.length; i++) {
          const sec = sectionsData[i];
          const secId = sec.section_id || sec.id;
          const quota = sec.no_of_questions || 35;

          initialSectionTimes[secId] = sec.duration_minutes ? sec.duration_minutes * 60 : defaultSecDurationSecs;

          // Find subtopics belonging to this section ID or matching section name keywords
          const matchingSubIds = allSubtopics
            ?.filter(s => s.section_id === secId || s.subtopic_name?.toLowerCase().includes(sec.section_name?.toLowerCase().split(' ')[0]))
            ?.map(s => s.subtopic_id || s.id) || [];

          let qData = [];
          if (matchingSubIds.length > 0 && allQuestions) {
            qData = allQuestions.filter(q => matchingSubIds.includes(q.subtopic_id));
          }

          // Fallback chunking if taxonomy linkage is partial
          if ((!qData || qData.length === 0) && allQuestions && allQuestions.length > 0) {
            const chunkSize = Math.ceil(allQuestions.length / sectionsData.length);
            const startIndex = i * chunkSize;
            qData = allQuestions.slice(startIndex, startIndex + quota);
          }

          // Enforce strict continuous passage grouping and module isolation
          const groupedQData = groupPassageQuestions(qData || []);
          const limitedQuestions = groupedQData.slice(0, quota);

          finalSectionMap[secId] = limitedQuestions;
          allQIds.push(...limitedQuestions.map(q => q.question_id || q.id));
        }

        let optData = [];
        if (allQIds.length > 0) {
          const { data: fetchedOpts } = await supabase
            .from('question_options')
            .select('*')
            .in('question_id', allQIds);
          optData = fetchedOpts || [];
        }

        let processedSectionMap = {};
        for (const secId of Object.keys(finalSectionMap)) {
          processedSectionMap[secId] = finalSectionMap[secId].map(q => {
            const qId = q.question_id || q.id;
            return {
              ...q,
              question_id: qId,
              question_options: optData.filter(o => o.question_id === qId)
            };
          });
        }

        setSections(sectionsData);
        setSectionQuestionsMap(processedSectionMap);
        setSectionTimeLefts(initialSectionTimes);
        setCompletedSections(new Set());
        setActiveSectionIndex(0);
        setCurrentIndex(0);
        setTimeLeft(testDurationMinutes * 60);
        setUserAnswers({});
        setQuestionTimers({});
        setReviewStatus({});
        const firstSecId = sectionsData[0]?.section_id || sectionsData[0]?.id;
        const firstQId = processedSectionMap[firstSecId]?.[0]?.question_id;
        setVisitedQuestions(firstQId ? new Set([firstQId]) : new Set());
        setStage('exam');
      } 
      else {
        let loadedQuestions = [];
        if (testMode === 'Time-Based Practice') {
          testDurationMinutes = practiceMinutes;
          const { data: qData } = await supabase.from('questions').select('*, passages(*)').limit(20);
          loadedQuestions = groupPassageQuestions(qData || []);
        } else {
          testDurationMinutes = 15;
          const { data: qData } = await supabase.from('questions').select('*, passages(*)').eq('subtopic_id', selectedSubtopicId);
          loadedQuestions = groupPassageQuestions(qData || []);
        }

        if (loadedQuestions.length === 0) {
          alert('No questions found.');
          setLoading(false);
          return;
        }

        const qIdKey = loadedQuestions[0].question_id !== undefined ? 'question_id' : 'id';
        const qIds = loadedQuestions.map(q => q[qIdKey]);
        const { data: optData } = await supabase.from('question_options').select('*').in('question_id', qIds);

        const finalQuestions = loadedQuestions.map(q => ({
          ...q,
          question_id: q[qIdKey],
          question_options: optData?.filter(o => o.question_id === q[qIdKey]) || []
        }));

        setSections([{ section_id: 'PRACTICE', section_name: testMode }]);
        setSectionQuestionsMap({ PRACTICE: finalQuestions });
        setSectionTimeLefts({ PRACTICE: testDurationMinutes * 60 });
        setCompletedSections(new Set());
        setActiveSectionIndex(0);
        setCurrentIndex(0);
        setTimeLeft(testDurationMinutes * 60);
        setUserAnswers({});
        setQuestionTimers({});
        setReviewStatus({});
        setVisitedQuestions(new Set([finalQuestions[0]?.question_id]));
        setStage('exam');
      }
    } catch (err) {
      console.error(err);
      alert('Error initializing test environment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentActiveQuestions = () => {
    if (sections.length === 0) return [];
    const activeSecId = sections[activeSectionIndex]?.section_id || sections[activeSectionIndex]?.id;
    return sectionQuestionsMap[activeSecId] || [];
  };

  useEffect(() => {
    if (stage !== 'exam') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitTest();
          return 0;
        }
        return prev - 1;
      });

      if (testMode === 'Full-Length Mock' && mockTimingMode === 'strict' && sections.length > 0) {
        const activeSecId = sections[activeSectionIndex]?.section_id || sections[activeSectionIndex]?.id;
        if (activeSecId) {
          setSectionTimeLefts((prev) => {
            const currentSecTime = prev[activeSecId] ?? 0;
            if (currentSecTime <= 1) {
              if (activeSectionIndex < sections.length - 1) {
                setCompletedSections((comp) => new Set([...comp, activeSecId]));
                setActiveSectionIndex((idx) => {
                  const nextIdx = idx + 1;
                  const nextSecId = sections[nextIdx]?.section_id || sections[nextIdx]?.id;
                  const firstQId = sectionQuestionsMap[nextSecId]?.[0]?.question_id;
                  if (firstQId) {
                    setVisitedQuestions((vSet) => new Set([...vSet, firstQId]));
                  }
                  return nextIdx;
                });
                setCurrentIndex(0);
                return { ...prev, [activeSecId]: 0 };
              } else {
                clearInterval(timer);
                handleSubmitTest();
                return { ...prev, [activeSecId]: 0 };
              }
            }
            return { ...prev, [activeSecId]: currentSecTime - 1 };
          });
        }
      }

      const currentQList = getCurrentActiveQuestions();
      const currentQId = currentQList[currentIndex]?.question_id;
      if (currentQId) {
        setQuestionTimers((prev) => ({
          ...prev,
          [currentQId]: (prev[currentQId] || 0) + 1
        }));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [stage, currentIndex, activeSectionIndex, sections, sectionQuestionsMap, testMode, mockTimingMode]);

  const handleSelectSection = (index) => {
    if (mockTimingMode === 'strict') {
      alert('Sectional navigation is locked. You must complete the current module within its allocated time.');
      return;
    }

    setActiveSectionIndex(index);
    setCurrentIndex(0);
    const secId = sections[index]?.section_id || sections[index]?.id;
    const firstQ = sectionQuestionsMap[secId]?.[0];
    if (firstQ) {
      setVisitedQuestions((prev) => new Set([...prev, firstQ.question_id]));
    }
  };

  const handleSelectQuestion = (index) => {
    setCurrentIndex(index);
    setIsPaletteOpen(false);
    const currentQList = getCurrentActiveQuestions();
    if (currentQList[index]) {
      setVisitedQuestions((prev) => new Set([...prev, currentQList[index].question_id]));
    }
  };

  const handleOptionSelect = (optionId) => {
    const currentQList = getCurrentActiveQuestions();
    const qId = currentQList[currentIndex]?.question_id;
    if (qId) {
      setUserAnswers((prev) => ({ ...prev, [qId]: optionId }));
    }
  };

  const handleClearResponse = () => {
    const currentQList = getCurrentActiveQuestions();
    const qId = currentQList[currentIndex]?.question_id;
    if (qId) {
      setUserAnswers((prev) => {
        const copy = { ...prev };
        delete copy[qId];
        return copy;
      });
    }
  };

  const handleMarkForReviewAndNext = () => {
    const currentQList = getCurrentActiveQuestions();
    const qId = currentQList[currentIndex]?.question_id;
    if (qId) {
      setReviewStatus((prev) => ({ ...prev, [qId]: true }));
    }
    if (currentIndex < currentQList.length - 1) {
      handleSelectQuestion(currentIndex + 1);
    } else if (activeSectionIndex < sections.length - 1 && mockTimingMode !== 'strict') {
      handleSelectSection(activeSectionIndex + 1);
    }
  };

  const handleSaveAndNext = () => {
    const currentQList = getCurrentActiveQuestions();
    const qId = currentQList[currentIndex]?.question_id;
    if (qId) {
      setReviewStatus((prev) => ({ ...prev, [qId]: false }));
    }
    if (currentIndex < currentQList.length - 1) {
      handleSelectQuestion(currentIndex + 1);
    } else if (activeSectionIndex < sections.length - 1 && mockTimingMode !== 'strict') {
      handleSelectSection(activeSectionIndex + 1);
    }
  };

  const handleSubmitTest = () => {
    let score = 0;
    let attempted = 0;
    let correctCount = 0;
    let totalQCount = 0;

    Object.values(sectionQuestionsMap).forEach((qList) => {
      totalQCount += qList.length;
      qList.forEach((q) => {
        const selectedOptId = userAnswers[q.question_id];
        const correctOpt = q.question_options?.find((o) => o.is_correct);

        if (selectedOptId) {
          attempted += 1;
          if (correctOpt && (correctOpt.option_id === selectedOptId || correctOpt.id === selectedOptId)) {
            score += 1;
            correctCount += 1;
          } else {
            score -= 0.25;
          }
        }
      });
    });

    const accuracy = attempted > 0 ? ((correctCount / attempted) * 100).toFixed(2) : 0;

    setAttemptResult({
      totalQuestions: totalQCount,
      attempted,
      correctCount,
      score: score.toFixed(2),
      accuracy
    });

    setStage('result');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPaletteSummary = () => {
    const currentQList = getCurrentActiveQuestions();
    let answered = 0;
    let notAnswered = 0;
    let marked = 0;
    let answeredAndMarked = 0;
    let notVisited = 0;

    currentQList.forEach((q) => {
      const qId = q.question_id;
      const isAns = !!userAnswers[qId];
      const isMark = !!reviewStatus[qId];
      const isVisited = visitedQuestions.has(qId);

      if (isAns && isMark) {
        answeredAndMarked++;
      } else if (isMark) {
        marked++;
      } else if (isAns) {
        answered++;
      } else if (isVisited) {
        notAnswered++;
      } else {
        notVisited++;
      }
    });

    return { answered, notAnswered, marked, answeredAndMarked, notVisited };
  };

  const getQuestionPaletteStyle = (qId) => {
    const isAnswered = !!userAnswers[qId];
    const isMarked = !!reviewStatus[qId];
    const isVisited = visitedQuestions.has(qId);

    if (isAnswered && isMarked) return 'bg-purple-600 text-white ring-2 ring-purple-300';
    if (isMarked) return 'bg-amber-500 text-white';
    if (isAnswered) return 'bg-emerald-600 text-white';
    if (isVisited) return 'bg-rose-500 text-white';
    return 'bg-slate-200 text-slate-700 hover:bg-slate-300';
  };

  if (stage === 'config') {
    return (
      <div className="flex-1 bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-700 pb-4">
            <h1 className="text-2xl font-bold tracking-tight text-teal-400">Mock Exam & Practice Portal</h1>
            <p className="text-sm text-slate-400 mt-1">Select your target exam and practice mode to begin.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">Select Target Exam</label>
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none"
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
              >
                {exams.length > 0 ? (
                  exams.map((ex) => (
                    <option key={ex.exam_id || ex.id} value={ex.exam_id || ex.id}>
                      {ex.exam_name || ex.name}
                    </option>
                  ))
                ) : (
                  <option value="">No exams found in database</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">Test Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'Full-Length Mock', label: '1. Full-Length Mock' },
                  { id: 'Time-Based Practice', label: '2. Time-Based Practice' },
                  { id: 'Topic-Based', label: '3. Topic-Based Test' }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setTestMode(mode.id)}
                    className={`py-2 px-1 text-xs font-medium rounded-lg border transition cursor-pointer ${
                      testMode === mode.id
                        ? 'bg-teal-600/20 border-teal-500 text-teal-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {testMode === 'Full-Length Mock' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">Sectional Timing Strategy</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMockTimingMode('strict')}
                    className={`p-3 text-left rounded-lg border transition cursor-pointer ${
                      mockTimingMode === 'strict'
                        ? 'bg-teal-600/20 border-teal-500 text-teal-300 ring-1 ring-teal-500'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span className="font-bold block text-xs uppercase">a. Strict Sectional Timer</span>
                    <span className="text-[11px] opacity-85 block mt-0.5">Fixed time per section (Locked navigation)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMockTimingMode('liberal')}
                    className={`p-3 text-left rounded-lg border transition cursor-pointer ${
                      mockTimingMode === 'liberal'
                        ? 'bg-teal-600/20 border-teal-500 text-teal-300 ring-1 ring-teal-500'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span className="font-bold block text-xs uppercase">b. Liberal Sectional Timer</span>
                    <span className="text-[11px] opacity-85 block mt-0.5">Flexible navigation across all sections</span>
                  </button>
                </div>
              </div>
            )}

            {testMode === 'Topic-Based' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">Select Subtopic Taxonomy</label>
                <select
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none"
                  value={selectedSubtopicId}
                  onChange={(e) => setSelectedSubtopicId(e.target.value)}
                >
                  {subtopics.map((sub) => (
                    <option key={sub.subtopic_id || sub.id} value={sub.subtopic_id || sub.id}>{sub.subtopic_name || sub.name}</option>
                  ))}
                </select>
              </div>
            )}

            {testMode === 'Time-Based Practice' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">Practice Duration (Minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={practiceMinutes}
                  onChange={(e) => setPracticeMinutes(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none"
                />
              </div>
            )}
          </div>

          <button
            onClick={startExam}
            disabled={loading}
            className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg shadow transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Preparing Session...' : 'Start Assessment'}
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'exam') {
    const currentQList = getCurrentActiveQuestions();
    const currentQ = currentQList[currentIndex];
    const paletteCounts = getPaletteSummary();
    const activeSecId = sections[activeSectionIndex]?.section_id || sections[activeSectionIndex]?.id;
    const activeSecTimeLeft = sectionTimeLefts[activeSecId];

    return (
      <div className="flex flex-col flex-1 bg-slate-100 text-slate-800 font-sans select-none relative min-h-screen">
        <header className="bg-slate-800 text-white px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between border-b border-slate-700 gap-2">
          <div>
            <span className="text-[10px] sm:text-xs uppercase tracking-wider text-teal-400 font-bold block">Assessment Environment</span>
            <h2 className="font-semibold text-xs sm:text-base">{testMode} Session</h2>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            {mockTimingMode === 'strict' && activeSecTimeLeft !== undefined && (
              <div className="text-right border-r border-slate-700 pr-3 sm:pr-6">
                <span className="text-[10px] sm:text-[11px] text-teal-300 block font-bold uppercase tracking-wider">Section Time</span>
                <span className="text-sm sm:text-base font-mono font-bold text-teal-300">{formatTime(activeSecTimeLeft)}</span>
              </div>
            )}
            <div className="text-right">
              <span className="text-[10px] sm:text-xs text-slate-400 block">Total Time</span>
              <span className="text-sm sm:text-lg font-mono font-bold text-amber-400">{formatTime(timeLeft)}</span>
            </div>
            
            <button
              onClick={() => setIsPaletteOpen(!isPaletteOpen)}
              className="lg:hidden bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-2 rounded shadow transition"
            >
              {isPaletteOpen ? 'Close Grid' : 'Question Grid'}
            </button>

            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] sm:text-xs font-bold uppercase tracking-wider px-3 sm:px-4 py-2 rounded shadow transition cursor-pointer"
            >
              Submit
            </button>
          </div>
        </header>

        <div className="bg-slate-700 px-3 sm:px-6 py-2 flex items-center gap-2 border-b border-slate-600 overflow-x-auto">
          <span className="text-[11px] sm:text-xs text-slate-300 uppercase font-bold tracking-wider mr-2 shrink-0">Modules:</span>
          {sections.map((sec, idx) => {
            const secId = sec.section_id || sec.id;
            const isCurrent = activeSectionIndex === idx;
            return (
              <button
                key={secId}
                onClick={() => handleSelectSection(idx)}
                className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold tracking-wide transition shrink-0 ${
                  isCurrent
                    ? 'bg-teal-600 text-white shadow'
                    : mockTimingMode === 'strict'
                    ? 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-600 cursor-pointer'
                }`}
              >
                {sec.section_name} ({sectionQuestionsMap[secId]?.length || 0}) {mockTimingMode === 'strict' && !isCurrent && '🔒'}
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 relative overflow-hidden">
          <main className="flex-1 flex flex-col bg-white border-r border-slate-200 overflow-hidden w-full">
            <div className="px-4 sm:px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-xs sm:text-sm text-slate-700">
                {sections[activeSectionIndex]?.section_name} &gt; Q.No. {currentIndex + 1}
              </span>
              <span className="text-[11px] sm:text-xs text-slate-500 font-medium">Difficulty: {currentQ?.difficulty_level || 'Moderate'}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {(currentQ?.passages?.passage_text || currentQ?.passage_text) && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs sm:text-sm text-slate-700">
                  <h4 className="font-bold text-slate-900 mb-1 border-b pb-1">Reading Passage / Context</h4>
                  <p className="leading-relaxed whitespace-pre-line">
                    {currentQ?.passages?.passage_text || currentQ?.passage_text}
                  </p>
                </div>
              )}

              {currentQ?.image_url && (
                <div className="my-3 flex justify-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <img 
                    src={currentQ.image_url} 
                    alt="Question Diagram or Graph" 
                    className="max-h-48 sm:max-h-64 object-contain rounded"
                  />
                </div>
              )}

              <div className="text-sm sm:text-base font-medium text-slate-900 leading-relaxed">
                {currentQ?.question_text}
              </div>

              <div className="space-y-2.5 pt-2">
                {currentQ?.question_options?.map((opt, oIndex) => {
                  const optId = opt.option_id || opt.id;
                  const isChecked = userAnswers[currentQ.question_id] === optId;
                  return (
                    <label
                      key={optId}
                      onClick={() => handleOptionSelect(optId)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                        isChecked
                          ? 'bg-teal-50 border-teal-500 text-teal-900 ring-1 ring-teal-500'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 flex items-center justify-center rounded-full text-xs font-semibold border border-slate-300 bg-white">
                        {String.fromCharCode(65 + oIndex)}
                      </span>
                      <span className="text-xs sm:text-sm font-medium">{opt.option_text}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  onClick={handleMarkForReviewAndNext}
                  className="px-3 sm:px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-[11px] sm:text-xs font-semibold rounded shadow transition cursor-pointer"
                >
                  Mark & Next
                </button>
                <button
                  onClick={handleClearResponse}
                  className="px-3 sm:px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] sm:text-xs font-semibold rounded transition cursor-pointer"
                >
                  Clear
                </button>
              </div>

              <button
                onClick={handleSaveAndNext}
                className="px-5 sm:px-6 py-2 bg-teal-700 hover:bg-teal-800 text-white text-[11px] sm:text-xs font-semibold rounded shadow transition cursor-pointer"
              >
                Save & Next
              </button>
            </div>
          </main>

          <aside className={`absolute lg:relative top-0 right-0 h-full w-full sm:w-80 bg-slate-50 flex flex-col border-l border-slate-200 z-40 transition-transform duration-300 ${isPaletteOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
            <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center lg:block">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 lg:mb-2.5">Palette Summary</h5>
              <button onClick={() => setIsPaletteOpen(false)} className="lg:hidden text-slate-500 font-bold text-sm px-2 py-1 bg-slate-100 rounded">✕ Close</button>
              
              <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 px-2 py-1 rounded text-emerald-900">
                  <span>Answered</span>
                  <span className="font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded-full text-[10px]">{paletteCounts.answered}</span>
                </div>
                <div className="flex items-center justify-between bg-rose-50 border border-rose-200 px-2 py-1 rounded text-rose-900">
                  <span>Not Answered</span>
                  <span className="font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{paletteCounts.notAnswered}</span>
                </div>
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 px-2 py-1 rounded text-amber-900">
                  <span>Marked</span>
                  <span className="font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{paletteCounts.marked}</span>
                </div>
                <div className="flex items-center justify-between bg-purple-50 border border-purple-200 px-2 py-1 rounded text-purple-900">
                  <span>Ans & Marked</span>
                  <span className="font-bold bg-purple-600 text-white px-1.5 py-0.5 rounded-full text-[10px]">{paletteCounts.answeredAndMarked}</span>
                </div>
                <div className="col-span-2 flex items-center justify-between bg-slate-100 border border-slate-200 px-2 py-1 rounded text-slate-700">
                  <span>Not Visited</span>
                  <span className="font-bold bg-slate-400 text-white px-1.5 py-0.5 rounded-full text-[10px]">{paletteCounts.notVisited}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-b border-slate-200 flex-1 overflow-y-auto bg-slate-50">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                {sections[activeSectionIndex]?.section_name} Grid
              </h5>
              <div className="grid grid-cols-5 gap-2 pb-12 lg:pb-0">
                {currentQList.map((q, idx) => (
                  <button
                    key={q.question_id}
                    onClick={() => handleSelectQuestion(idx)}
                    className={`h-10 rounded font-bold text-xs shadow-sm transition cursor-pointer ${getQuestionPaletteStyle(q.question_id)} ${
                      currentIndex === idx ? 'ring-2 ring-slate-900 ring-offset-1' : ''
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {showSubmitConfirm && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-6 shadow-2xl text-slate-100">
              <div className="text-center space-y-1">
                <h3 className="text-xl font-bold text-teal-400">Ready to Submit Exam?</h3>
                <p className="text-xs text-slate-400">Please review your final question status summary below.</p>
              </div>

              <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 space-y-3">
                {(() => {
                  let totalQ = 0;
                  let answered = 0;
                  let marked = 0;
                  let unattempted = 0;

                  Object.values(sectionQuestionsMap).forEach((qList) => {
                    totalQ += qList.length;
                    qList.forEach((q) => {
                      const qId = q.question_id;
                      const isAns = !!userAnswers[qId];
                      const isMark = !!reviewStatus[qId];
                      if (isAns) answered++;
                      if (isMark) marked++;
                      if (!isAns) unattempted++;
                    });
                  });

                  return (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-800 p-2.5 rounded border border-slate-700 flex justify-between items-center">
                        <span className="text-slate-400">Total Questions:</span>
                        <span className="font-bold text-slate-200">{totalQ}</span>
                      </div>
                      <div className="bg-emerald-950/40 p-2.5 rounded border border-emerald-900/60 flex justify-between items-center">
                        <span className="text-emerald-300">Answered:</span>
                        <span className="font-bold text-emerald-400">{answered}</span>
                      </div>
                      <div className="bg-amber-950/40 p-2.5 rounded border border-amber-900/60 flex justify-between items-center">
                        <span className="text-amber-300">Marked for Review:</span>
                        <span className="font-bold text-amber-400">{marked}</span>
                      </div>
                      <div className="bg-rose-950/40 p-2.5 rounded border border-rose-900/60 flex justify-between items-center">
                        <span className="text-rose-300">Unattempted:</span>
                        <span className="font-bold text-rose-400">{unattempted}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSubmitConfirm(false)}
                  className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  Resume Test
                </button>
                <button
                  onClick={() => {
                    setShowSubmitConfirm(false);
                    handleSubmitTest();
                  }}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-xs font-bold uppercase tracking-wider rounded-lg shadow transition cursor-pointer"
                >
                  Confirm & Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (stage === 'result' && attemptResult) {
    let sectionStats = sections.map((sec) => {
      const secId = sec.section_id || sec.id;
      const qList = sectionQuestionsMap[secId] || [];
      let correct = 0;
      let incorrect = 0;
      let unattempted = 0;
      let totalTime = 0;

      qList.forEach((q) => {
        const studentAns = userAnswers[q.question_id];
        const correctOpt = q.question_options?.find((o) => o.is_correct);
        const correctOptId = correctOpt?.option_id || correctOpt?.id;
        totalTime += questionTimers[q.question_id] || 0;

        if (!studentAns) {
          unattempted++;
        } else if (studentAns === correctOptId) {
          correct++;
        } else {
          incorrect++;
        }
      });

      const attempted = correct + incorrect;
      const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
      return {
        name: sec.section_name,
        total: qList.length,
        correct,
        incorrect,
        unattempted,
        accuracy,
        totalTime
      };
    });

    return (
      <div className="flex-1 bg-slate-900 text-slate-100 p-4 sm:p-6 flex flex-col items-center overflow-y-auto">
        <div className="w-full max-w-3xl space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-6 shadow-xl text-center space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-teal-400">Assessment Performance Dashboard</h2>
            <p className="text-xs text-slate-400">Detailed breakdown of your accuracy, speed, and identified weak areas.</p>

            <div className="bg-slate-900 rounded-xl p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 border border-slate-700 text-left">
              <div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 block uppercase font-bold">Total Questions</span>
                <span className="text-base sm:text-lg font-bold text-slate-200">{attemptResult.totalQuestions}</span>
              </div>
              <div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 block uppercase font-bold">Attempted</span>
                <span className="text-base sm:text-lg font-bold text-amber-400">{attemptResult.attempted}</span>
              </div>
              <div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 block uppercase font-bold">Overall Accuracy</span>
                <span className="text-base sm:text-lg font-bold text-teal-300">{attemptResult.accuracy}%</span>
              </div>
              <div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 block uppercase font-bold">Final Score</span>
                <span className="text-base sm:text-lg font-bold text-emerald-400">{attemptResult.score} Marks</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
            <h3 className="text-sm sm:text-base font-bold text-teal-400 border-b border-slate-700 pb-3">📊 Section-wise Accuracy & Weak Areas</h3>

            <div className="space-y-4">
              {sectionStats.map((stat, idx) => {
                const isWeak = stat.accuracy < 50 && stat.total > 0;
                return (
                  <div key={idx} className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-200">{stat.name}</span>
                        {isWeak ? (
                          <span className="bg-rose-950/80 border border-rose-700 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            ⚠️ Weak Area - Focus Here
                          </span>
                        ) : (
                          <span className="bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            ✅ Strong Zone
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono font-bold text-teal-300">{stat.accuracy}% Accuracy</span>
                    </div>

                    <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex border border-slate-700">
                      <div style={{ width: `${stat.total ? (stat.correct / stat.total) * 100 : 0}%` }} className="bg-emerald-500 transition-all duration-500" title="Correct"></div>
                      <div style={{ width: `${stat.total ? (stat.incorrect / stat.total) * 100 : 0}%` }} className="bg-rose-500 transition-all duration-500" title="Incorrect"></div>
                      <div style={{ width: `${stat.total ? (stat.unattempted / stat.total) * 100 : 0}%` }} className="bg-slate-600 transition-all duration-500" title="Unattempted"></div>
                    </div>

                    <div className="flex flex-wrap justify-between text-[11px] text-slate-400 pt-1 gap-1">
                      <span className="text-emerald-400 font-semibold">Correct: {stat.correct}</span>
                      <span className="text-rose-400 font-semibold">Incorrect: {stat.incorrect}</span>
                      <span className="text-slate-400 font-semibold">Unattempted: {stat.unattempted}</span>
                      <span className="text-amber-300 font-semibold">Time: {Math.floor(stat.totalTime / 60)}m {stat.totalTime % 60}s</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setStage('solutions')}
              className="py-3 bg-indigo-600 hover:bg-indigo-500 font-semibold rounded-xl shadow transition cursor-pointer text-xs"
            >
              📖 View Detailed Solutions
            </button>
            <button
              onClick={() => setStage('swot')}
              className="py-3 bg-purple-600 hover:bg-purple-500 font-semibold rounded-xl shadow transition cursor-pointer text-xs"
            >
              📊 SWOT Report
            </button>
            <button
              onClick={() => setStage('config')}
              className="py-3 bg-slate-700 hover:bg-slate-600 font-semibold rounded-xl shadow transition cursor-pointer text-xs"
            >
              🏠 Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'solutions') {
    const allQs = Object.values(sectionQuestionsMap).flat();

    return (
      <div className="flex-1 bg-slate-900 text-slate-100 p-4 sm:p-6 flex flex-col items-center overflow-y-auto">
        <div className="w-full max-w-3xl space-y-6">
          <div className="flex justify-between items-center bg-slate-800 border border-slate-700 p-4 rounded-xl shadow">
            <h2 className="text-lg sm:text-xl font-bold text-teal-400">Detailed Solutions</h2>
            <button
              onClick={() => setStage('result')}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              Back
            </button>
          </div>

          <div className="space-y-4">
            {allQs.map((q, idx) => {
              const studentAnswerId = userAnswers[q.question_id];
              const correctOption = q.question_options?.find((o) => o.is_correct);
              const correctOptId = correctOption?.option_id || correctOption?.id;
              const isCorrect = studentAnswerId === correctOptId;
              const timeSpentSecs = questionTimers[q.question_id] || 0;

              return (
                <div key={q.question_id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 sm:p-6 shadow space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-700 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-slate-300">Q.No. {idx + 1}</span>
                      <span className="text-xs font-mono text-amber-400 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                        ⏱️ {timeSpentSecs}s
                      </span>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      !studentAnswerId ? 'bg-slate-700 text-slate-400' : isCorrect ? 'bg-emerald-900/50 text-emerald-300' : 'bg-rose-900/50 text-rose-300'
                    }`}>
                      {!studentAnswerId ? 'Unattempted' : isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>

                  {(q?.passages?.passage_text || q?.passage_text) && (
                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 text-xs text-slate-300">
                      <span className="font-bold text-teal-400 block mb-1">Context / Passage:</span>
                      {q?.passages?.passage_text || q?.passage_text}
                    </div>
                  )}

                  {q?.image_url && (
                    <div className="my-2 flex justify-center bg-slate-900 p-2 rounded-lg border border-slate-700">
                      <img src={q.image_url} alt="Question Diagram" className="max-h-48 object-contain rounded" />
                    </div>
                  )}

                  <p className="text-sm font-medium text-slate-100">{q.question_text}</p>

                  <div className="space-y-2">
                    {q.question_options?.map((opt, oIndex) => {
                      const optId = opt.option_id || opt.id;
                      const isStudentChoice = studentAnswerId === optId;
                      const isRightChoice = opt.is_correct;

                      let badgeStyle = 'bg-slate-900 border-slate-700 text-slate-300';
                      if (isRightChoice) badgeStyle = 'bg-emerald-950/60 border-emerald-600 text-emerald-200';
                      else if (isStudentChoice && !isRightChoice) badgeStyle = 'bg-rose-950/60 border-rose-600 text-rose-200';

                      return (
                        <div key={optId} className={`p-3 rounded-lg border text-xs sm:text-sm flex items-center justify-between ${badgeStyle}`}>
                          <span>({String.fromCharCode(65 + oIndex)}) {opt.option_text}</span>
                          <span className="text-[10px] sm:text-xs font-semibold shrink-0 ml-2">
                            {isStudentChoice && '[Your Answer] '}
                            {isRightChoice && '[Correct]'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {q.solution_explanation && (
                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 text-xs text-slate-300 mt-2">
                      <span className="font-bold text-teal-400 block mb-1">Explanation:</span>
                      {q.solution_explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'swot') {
    return (
      <div className="flex-1 bg-slate-900 text-slate-100 p-4 sm:p-6 flex flex-col items-center">
        <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-xl p-4 sm:p-6 shadow-xl space-y-6">
          <div className="flex justify-between items-center border-b border-slate-700 pb-4">
            <h2 className="text-lg sm:text-xl font-bold text-purple-400">SWOT Analytics Report</h2>
            <button
              onClick={() => setStage('result')}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              Back
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-emerald-950/40 border border-emerald-700 rounded-lg">
              <h3 className="text-sm font-bold text-emerald-400">💪 Strengths</h3>
              <p className="text-xs text-slate-300 mt-1">High command over core reasoning and quantitative questions.</p>
            </div>

            <div className="p-4 bg-amber-950/40 border border-amber-700 rounded-lg">
              <h3 className="text-sm font-bold text-amber-400">⚠️ Weaknesses</h3>
              <p className="text-xs text-slate-300 mt-1">Calculation-heavy items required longer time allocations.</p>
            </div>

            <div className="p-4 bg-blue-950/40 border border-blue-700 rounded-lg">
              <h3 className="text-sm font-bold text-blue-400">🎯 Opportunities</h3>
              <p className="text-xs text-slate-300 mt-1">Improve reading comprehension pacing to secure easy points.</p>
            </div>

            <div className="p-4 bg-rose-950/40 border border-rose-700 rounded-lg">
              <h3 className="text-sm font-bold text-rose-400">🚨 Threats</h3>
              <p className="text-xs text-slate-300 mt-1">Negative marking risk from uncalculated guesswork.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
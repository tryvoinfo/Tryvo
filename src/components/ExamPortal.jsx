import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wbcdiewohpngqbeqrfmb.supabase.co';
const supabaseAnonKey = 'sb_publishable_d21wos13j9x7K-w1h8vsvw_0gPm_jlY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export default function ExamPortal() {
  const [stage, setStage] = useState('config'); // 'config' | 'exam' | 'result' | 'solutions' | 'swot'
  const [exams, setExams] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  
  const [selectedExamId, setSelectedExamId] = useState('');
  const [testMode, setTestMode] = useState('Full-Length Mock'); // 'Full-Length Mock' | 'Time-Based Practice' | 'Topic-Based'
  const [mockTimingMode, setMockTimingMode] = useState('liberal'); // 'liberal' | 'strict'
  const [selectedSubtopicId, setSelectedSubtopicId] = useState('');
  const [practiceMinutes, setPracticeMinutes] = useState(15);
  const [loading, setLoading] = useState(false);

  // Daily Dilemma Hero Card State
  const [dilemmaQuestion, setDilemmaQuestion] = useState(null);
  const [dilemmaOptions, setDilemmaOptions] = useState([]);
  const [dilemmaSelectedIndex, setDilemmaSelectedIndex] = useState(null);
  const [dilemmaSubmitted, setDilemmaSubmitted] = useState(false);
  const [dilemmaTimer, setDilemmaTimer] = useState(60);

  // Multi-section structure state
  const [sections, setSections] = useState([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [sectionQuestionsMap, setSectionQuestionsMap] = useState({}); 
  const [sectionTimeLefts, setSectionTimeLefts] = useState({}); 
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

  // Expose global navigation handler so parent App.jsx can trigger 'tests' view smoothly
  useEffect(() => {
    window.scrollToConfigSection = () => {
      setStage('config');
      const configElement = document.getElementById('session-config-section');
      if (configElement) {
        configElement.scrollIntoView({ behavior: 'smooth' });
      }
    };
  }, []);

  // Intercept browser back button during an active exam to prevent accidental exit
  useEffect(() => {
    if (stage !== 'exam') return;

    window.history.pushState(null, '', window.location.href);

    const handlePopState = (e) => {
      const confirmLeave = window.confirm("Warning: Leaving this page will disrupt your live test session. Are you sure you want to exit?");
      if (confirmLeave) {
        setStage('config');
      } else {
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [stage]);

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

  // Load metadata and pick a random Daily Dilemma from the dedicated DB table, strictly limited to 4 options
  useEffect(() => {
    async function loadMetaAndDilemma() {
      try {
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

        const { data: dilemmas } = await supabase.from('daily_dilemmas').select('*');
        if (dilemmas && dilemmas.length > 0) {
          const randomIndex = Math.floor(Math.random() * dilemmas.length);
          const chosenDilemma = dilemmas[randomIndex];
          const dId = chosenDilemma.dilemma_id || chosenDilemma.id;
          setDilemmaQuestion(chosenDilemma);

          const { data: optData } = await supabase
            .from('dilemma_options')
            .select('*')
            .eq('dilemma_id', dId);

          const shuffled = optData && optData.length > 0 ? shuffleArray(optData) : [];
          setDilemmaOptions(shuffled.slice(0, 4));
        }
      } catch (err) {
        console.error('Error loading metadata:', err);
      }
    }
    loadMetaAndDilemma();
  }, []);

  // Dilemma 1-minute countdown tick
  useEffect(() => {
    if (stage !== 'config') return;
    const ticker = setInterval(() => {
      setDilemmaTimer((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);
    return () => clearInterval(ticker);
  }, [stage]);

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
        let initialSectionTimes = {};
        const defaultSecDurationSecs = Math.round((testDurationMinutes * 60) / sectionsData.length);

        const { data: allQuestions } = await supabase.from('questions').select('*, passages(*)');
        const { data: allSubtopics } = await supabase.from('subtopics').select('*');

        for (let i = 0; i < sectionsData.length; i++) {
          const sec = sectionsData[i];
          const secId = sec.section_id || sec.id;
          const quota = sec.no_of_questions || 35;

          initialSectionTimes[secId] = sec.duration_minutes ? sec.duration_minutes * 60 : defaultSecDurationSecs;

          const matchingSubIds = allSubtopics
            ?.filter(s => s.section_id === secId || s.subtopic_name?.toLowerCase().includes(sec.section_name?.toLowerCase().split(' ')[0]))
            ?.map(s => s.subtopic_id || s.id) || [];

          let qData = [];
          if (matchingSubIds.length > 0 && allQuestions) {
            qData = allQuestions.filter(q => matchingSubIds.includes(q.subtopic_id));
          }

          if ((!qData || qData.length === 0) && allQuestions && allQuestions.length > 0) {
            const chunkSize = Math.ceil(allQuestions.length / sectionsData.length);
            const startIndex = i * chunkSize;
            qData = allQuestions.slice(startIndex, startIndex + quota);
          }

          const shuffledQData = shuffleArray(qData || []);
          const groupedQData = groupPassageQuestions(shuffledQData);
          const limitedQuestions = groupedQData.slice(0, quota);

          // Collect question IDs for this section to fetch options safely
          const qIds = limitedQuestions.map(q => q.question_id || q.id);

          // Fetch options matching these specific questions
          const { data: sectionOptions, error: optErr } = await supabase
            .from('question_options')
            .select('*')
            .in('question_id', qIds);

          if (optErr) console.error("Error fetching options:", optErr);

          console.log(`Section ${sec.section_name}: Loaded`, limitedQuestions.length, "questions and", sectionOptions?.length || 0, "options.");

          finalSectionMap[secId] = limitedQuestions.map(q => {
            const qId = q.question_id || q.id;
            
            const rawOpts = (sectionOptions || []).filter(o => {
              const optQId = String(o.question_id || o.qid || o.questionId || o.q_id || '').trim();
              return optQId === String(qId).trim() || optQId === String(q.id).trim();
            });

            return {
              ...q,
              question_id: qId,
              question_options: rawOpts.length > 0 ? shuffleArray(rawOpts) : []
            };
          });
        }

        setSections(sectionsData);
        setSectionQuestionsMap(finalSectionMap);
        setSectionTimeLefts(initialSectionTimes);
        setCompletedSections(new Set());
        setActiveSectionIndex(0);
        setCurrentIndex(0);
        setTimeLeft(testDurationMinutes * 60);
        setUserAnswers({});
        setQuestionTimers({});
        setReviewStatus({});
        const firstSecId = sectionsData[0]?.section_id || sectionsData[0]?.id;
        const firstQId = finalSectionMap[firstSecId]?.[0]?.question_id;
        setVisitedQuestions(firstQId ? new Set([firstQId]) : new Set());
        setStage('exam');
      } 
      else {
        let loadedQuestions = [];
        if (testMode === 'Time-Based Practice') {
          testDurationMinutes = Number(practiceMinutes);
          const { data: qData } = await supabase.from('questions').select('*, passages(*)').limit(20);
          loadedQuestions = groupPassageQuestions(shuffleArray(qData || []));
        } else {
          testDurationMinutes = 15;
          const { data: qData } = await supabase.from('questions').select('*, passages(*)').eq('subtopic_id', selectedSubtopicId);
          loadedQuestions = groupPassageQuestions(shuffleArray(qData || []));
        }

        if (loadedQuestions.length === 0) {
          alert('No questions found for this configuration.');
          setLoading(false);
          return;
        }

        const qIds = loadedQuestions.map(q => q.question_id || q.id);
        const { data: sectionOptions } = await supabase
          .from('question_options')
          .select('*')
          .in('question_id', qIds);

        const qIdKey = loadedQuestions[0].question_id !== undefined ? 'question_id' : 'id';

        const finalQuestions = loadedQuestions.map(q => {
          const qId = q[qIdKey];
          
          const rawOpts = (sectionOptions || []).filter(o => {
            const optQId = String(o.question_id || o.qid || o.questionId || o.q_id || '').trim();
            return optQId === String(qId).trim() || optQId === String(q.id).trim();
          });

          return {
            ...q,
            question_id: qId,
            question_options: rawOpts.length > 0 ? shuffleArray(rawOpts) : []
          };
        });

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
    if (isMarked) return 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] font-bold';
    if (isAnswered) return 'bg-emerald-600 text-white';
    if (isVisited) return 'bg-rose-500 text-white';
    return 'bg-[oklch(0.23_0.045_265)] text-[oklch(0.68_0.04_265)] hover:border-[oklch(0.94_0.21_118)]';
  };

  // CONFIG STAGE
  if (stage === 'config') {
    return (
      <div className="flex-1 bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)] flex flex-col justify-center px-6 lg:px-20 py-12 relative overflow-hidden font-sans">
        
        {/* Running Marquee Banner */}
        <div className="w-full bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] font-mono text-xs font-bold uppercase tracking-widest py-2.5 px-4 overflow-hidden whitespace-nowrap mb-12 rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.2)]">
          <div className="inline-block animate-[marquee_25s_linear_infinite]">
            SBI Clerk 2026 Exam Dates: Prelims on Sept 26 & 27 | Mains on Nov 23 — Start Your Prep Now! &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; SBI Clerk 2026 Exam Dates: Prelims on Sept 26 & 27 | Mains on Nov 23 — Start Your Prep Now!
          </div>
        </div>

        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          
          {/* Hero Left */}
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[oklch(0.23_0.045_265)] border border-white/10 font-mono text-xs tracking-[0.15em] text-[oklch(0.68_0.04_265)] uppercase">
              <span className="w-2 h-2 rounded-full bg-[oklch(0.94_0.21_118)] animate-pulse"></span>
             The Daily Dilemma: 1 minute, 1 moral choice, endless perspectives
            </div>

            <div className="space-y-2">
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight font-['Archivo_Black'] leading-[1.05]">
                Beat the clock.<br />
                <span className="text-[oklch(0.94_0.21_118)] drop-shadow-[0_0_30px_rgba(204,255,0,0.3)]">Own the rank.</span>
              </h1>
              <p className="text-sm sm:text-base text-[oklch(0.68_0.04_265)] font-sans max-w-xl leading-relaxed pt-2">
                Real timed mock tests, live percentile drops, and streaks that punish you for quitting. Built for the JEE, NEET, UPSC, SSC and CAT grinders who play to win.
              </p>
            </div>

            {/* Exam Tag Row */}
            <div className="flex flex-wrap gap-2 pt-2">
              {['JEE', 'NEET', 'UPSC', 'SSC', 'CAT'].map((tag, i) => (
                <span key={i} className="px-3 py-1 rounded-lg bg-[oklch(0.23_0.045_265)] border border-white/10 font-mono text-[11px] uppercase tracking-[0.15em] text-[oklch(0.68_0.04_265)]">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Hero Right: Live Daily Dilemma Preview Card */}
          <div className="lg:col-span-5">
            <div className="bg-[oklch(0.23_0.045_265)]/90 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-6 group hover:border-[oklch(0.94_0.21_118)]/40 transition">
              
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <span className="font-mono text-xs uppercase tracking-[0.1em] text-[oklch(0.94_0.21_118)] font-bold">The Daily Dilemma: Challenge your choice</span>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[oklch(0.16_0.03_265)] border border-[oklch(0.94_0.21_118)]/30 text-[oklch(0.94_0.21_118)] font-mono text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.94_0.21_118)] animate-ping"></span>
                  0:{dilemmaTimer < 10 ? `0${dilemmaTimer}` : dilemmaTimer}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm sm:text-base font-semibold text-[oklch(0.96_0.012_265)] min-h-[48px]">
                  {dilemmaQuestion ? dilemmaQuestion.question_text : 'Loading dilemma from separate table...'}
                </p>

                <div className="space-y-2.5 font-mono text-xs">
                  {dilemmaOptions.length > 0 ? (
                    dilemmaOptions.map((opt, oIdx) => {
                      const optId = opt.option_id || opt.id;
                      const isSelected = dilemmaSelectedIndex === oIdx;
                      const isCorrect = opt.is_correct;

                      let borderStyle = 'border-white/5 bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)]';
                      if (dilemmaSubmitted) {
                        if (isCorrect) {
                          borderStyle = 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold';
                        } else if (isSelected && !isCorrect) {
                          borderStyle = 'border-rose-500 bg-rose-500/20 text-rose-300';
                        }
                      } else if (isSelected) {
                        borderStyle = 'border-[oklch(0.94_0.21_118)] bg-[oklch(0.94_0.21_118)]/10 text-[oklch(0.96_0.012_265)] shadow-[0_0_15px_rgba(204,255,0,0.15)]';
                      }

                      return (
                        <div
                          key={optId}
                          onClick={() => !dilemmaSubmitted && setDilemmaSelectedIndex(oIdx)}
                          className={`p-3 rounded-xl border transition cursor-pointer flex justify-between items-center ${borderStyle}`}
                        >
                          <span>{String.fromCharCode(65 + oIdx)} — {opt.option_text}</span>
                          {dilemmaSubmitted && isCorrect && <span className="text-emerald-400 font-bold">✓ CORRECT</span>}
                          {!dilemmaSubmitted && isSelected && <span className="text-[oklch(0.94_0.21_118)] font-bold">SELECTED</span>}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-3 text-center text-slate-500">Fetching options...</div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={() => setDilemmaSubmitted(true)}
                  disabled={dilemmaSelectedIndex === null || dilemmaSubmitted}
                  className="px-4 py-2 bg-[oklch(0.94_0.21_118)] hover:brightness-110 text-[oklch(0.16_0.03_265)] font-mono text-xs uppercase tracking-wider font-extrabold rounded-xl shadow transition disabled:opacity-40 cursor-pointer"
                >
                  Submit Answer
                </button>
                {dilemmaSubmitted && (
                  <button
                    onClick={() => {
                      setDilemmaSubmitted(false);
                      setDilemmaSelectedIndex(null);
                    }}
                    className="font-mono text-[10px] uppercase tracking-wider text-[oklch(0.68_0.04_265)] hover:text-white underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Configuration Selector Modal/Box inline with Conditional Options */}
        <div id="session-config-section" className="max-w-3xl mx-auto w-full mt-16 bg-[oklch(0.23_0.045_265)]/90 backdrop-blur-2xl border border-white/15 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6 scroll-mt-24">
          <div className="border-b border-white/10 pb-4">
            <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-[oklch(0.94_0.21_118)] font-bold mb-1">Session Configuration</h3>
            <h2 className="text-xl font-black font-['Archivo_Black'] tracking-tight">Configure Your Battleground</h2>
          </div>

          <div className="space-y-5 font-mono text-xs">
            <div>
              <label className="block uppercase tracking-[0.15em] text-[oklch(0.68_0.04_265)] mb-2">Select Target Exam Blueprint</label>
              <select
                className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3.5 text-sm text-[oklch(0.96_0.012_265)] focus:outline-none focus:border-[oklch(0.94_0.21_118)] transition cursor-pointer"
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
                  <option value="">No exam blueprints found</option>
                )}
              </select>
            </div>

            <div>
              <label className="block uppercase tracking-[0.15em] text-[oklch(0.68_0.04_265)] mb-2">Execution Mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'Full-Length Mock', label: 'Full Mock' },
                  { id: 'Time-Based Practice', label: 'Timed Sprint' },
                  { id: 'Topic-Based', label: 'Topic Drill' }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setTestMode(mode.id)}
                    className={`p-3.5 rounded-xl border text-center transition cursor-pointer uppercase font-bold tracking-wider ${
                      testMode === mode.id
                        ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] border-[oklch(0.94_0.21_118)] shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                        : 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)] border-white/10 hover:text-[oklch(0.96_0.012_265)]'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* CONDITIONAL SETTINGS BASED ON EXECUTION MODE */}
            {testMode === 'Full-Length Mock' && (
              <div>
                <label className="block uppercase tracking-[0.15em] text-[oklch(0.68_0.04_265)] mb-2">Timer Protocol</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMockTimingMode('strict')}
                    className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                      mockTimingMode === 'strict'
                        ? 'bg-[oklch(0.94_0.21_118)]/10 border-[oklch(0.94_0.21_118)] text-[oklch(0.94_0.21_118)] font-bold'
                        : 'bg-[oklch(0.16_0.03_265)] border-white/10 text-[oklch(0.68_0.04_265)]'
                    }`}
                  >
                    <span className="block uppercase font-bold text-xs tracking-wider">Strict Timer</span>
                    <span className="text-[11px] opacity-75 font-sans mt-0.5 block">Locked module pacing</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMockTimingMode('liberal')}
                    className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                      mockTimingMode === 'liberal'
                        ? 'bg-[oklch(0.94_0.21_118)]/10 border-[oklch(0.94_0.21_118)] text-[oklch(0.94_0.21_118)] font-bold'
                        : 'bg-[oklch(0.16_0.03_265)] border-white/10 text-[oklch(0.68_0.04_265)]'
                    }`}
                  >
                    <span className="block uppercase font-bold text-xs tracking-wider">Liberal Timer</span>
                    <span className="text-[11px] opacity-75 font-sans mt-0.5 block">Flexible navigation</span>
                  </button>
                </div>
              </div>
            )}

            {testMode === 'Time-Based Practice' && (
              <div>
                <label className="block uppercase tracking-[0.15em] text-[oklch(0.68_0.04_265)] mb-2">Select Sprint Duration</label>
                <div className="grid grid-cols-4 gap-2.5">
                  {[10, 15, 30, 45].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setPracticeMinutes(mins)}
                      className={`p-3 rounded-xl border text-center transition cursor-pointer font-bold ${
                        Number(practiceMinutes) === mins
                          ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] border-[oklch(0.94_0.21_118)] shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                          : 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)] border-white/10 hover:text-[oklch(0.96_0.012_265)]'
                      }`}
                    >
                      {mins} MINS
                    </button>
                  ))}
                </div>
              </div>
            )}

            {testMode === 'Topic-Based' && (
              <div>
                <label className="block uppercase tracking-[0.15em] text-[oklch(0.68_0.04_265)] mb-2">Select Target Topic / Subtopic</label>
                <select
                  className="w-full bg-[oklch(0.16_0.03_265)] border border-white/10 rounded-xl p-3.5 text-sm text-[oklch(0.96_0.012_265)] focus:outline-none focus:border-[oklch(0.94_0.21_118)] transition cursor-pointer"
                  value={selectedSubtopicId}
                  onChange={(e) => setSelectedSubtopicId(e.target.value)}
                >
                  {subtopics.length > 0 ? (
                    subtopics.map((sub) => (
                      <option key={sub.subtopic_id || sub.id} value={sub.subtopic_id || sub.id}>
                        {sub.subtopic_name || sub.name}
                      </option>
                    ))
                  ) : (
                    <option value="">No subtopics available in database</option>
                  )}
                </select>
              </div>
            )}
          </div>

          <button
            onClick={startExam}
            disabled={loading}
            className="w-full py-4 bg-[oklch(0.94_0.21_118)] hover:brightness-110 text-[oklch(0.16_0.03_265)] font-mono text-xs uppercase tracking-[0.15em] font-extrabold rounded-xl shadow-[0_0_25px_rgba(204,255,0,0.25)] transition cursor-pointer"
          >
            {loading ? 'BUILDING QUESTION BANK...' : 'INITIALIZE MOCK SESSION →'}
          </button>
        </div>

      </div>
    );
  }

  // EXAM STAGE HUD
  if (stage === 'exam') {
    const currentQList = getCurrentActiveQuestions();
    const currentQ = currentQList[currentIndex];
    const paletteCounts = getPaletteSummary();
    const activeSecId = sections[activeSectionIndex]?.section_id || sections[activeSectionIndex]?.id;
    const activeSecTimeLeft = sectionTimeLefts[activeSecId];

    return (
      <div className="flex flex-col flex-1 bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)] font-sans select-none relative min-h-screen">
        <header className="bg-[oklch(0.23_0.045_265)] text-white px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between border-b border-white/10 gap-4">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[oklch(0.94_0.21_118)] font-bold block">Live Execution HUD</span>
            <h2 className="font-bold text-xs sm:text-sm font-mono tracking-wider">{testMode.toUpperCase()}</h2>
          </div>

          <div className="flex items-center gap-4 sm:gap-8">
            {mockTimingMode === 'strict' && activeSecTimeLeft !== undefined && (
              <div className="text-right border-r border-white/10 pr-4 sm:pr-8">
                <span className="font-mono text-[10px] text-[oklch(0.94_0.21_118)] block uppercase tracking-widest font-bold">Module Clock</span>
                <span className="text-sm sm:text-base font-mono font-bold text-[oklch(0.94_0.21_118)]">{formatTime(activeSecTimeLeft)}</span>
              </div>
            )}
            <div className="text-right">
              <span className="font-mono text-[10px] text-[oklch(0.68_0.04_265)] block uppercase tracking-widest">Total Countdown</span>
              <span className="text-sm sm:text-lg font-mono font-bold text-amber-400">{formatTime(timeLeft)}</span>
            </div>
            
            <button
              onClick={() => setIsPaletteOpen(!isPaletteOpen)}
              className="lg:hidden bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] font-mono text-xs font-bold px-3 py-2 rounded-xl"
            >
              {isPaletteOpen ? 'Close Grid' : 'Grid'}
            </button>

            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold uppercase tracking-[0.15em] px-4 py-2.5 rounded-xl shadow-lg transition cursor-pointer"
            >
              Submit Test
            </button>
          </div>
        </header>

        {/* Module Switcher Row */}
        <div className="bg-[oklch(0.23_0.045_265)]/50 px-4 sm:px-8 py-2.5 flex items-center gap-2 border-b border-white/10 overflow-x-auto font-mono text-xs">
          <span className="text-[oklch(0.68_0.04_265)] uppercase font-bold tracking-[0.15em] mr-2 shrink-0">Modules:</span>
          {sections.map((sec, idx) => {
            const secId = sec.section_id || sec.id;
            const isCurrent = activeSectionIndex === idx;
            return (
              <button
                key={secId}
                onClick={() => handleSelectSection(idx)}
                className={`px-4 py-2 rounded-xl font-bold tracking-wider transition shrink-0 cursor-pointer ${
                  isCurrent
                    ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                    : mockTimingMode === 'strict'
                    ? 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)] opacity-50 cursor-not-allowed border border-white/5'
                    : 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)] hover:text-[oklch(0.96_0.012_265)] border border-white/5'
                }`}
              >
                {sec.section_name.toUpperCase()} ({sectionQuestionsMap[secId]?.length || 0}) {mockTimingMode === 'strict' && !isCurrent && '🔒'}
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 relative overflow-hidden">
          <main className="flex-1 flex flex-col bg-[oklch(0.16_0.03_265)] border-r border-white/10 overflow-hidden w-full">
            <div className="px-6 py-3.5 bg-[oklch(0.23_0.045_265)]/30 border-b border-white/10 flex items-center justify-between font-mono text-xs">
              <span className="font-bold text-[oklch(0.96_0.012_265)] tracking-wider">
                {sections[activeSectionIndex]?.section_name.toUpperCase()} &gt; Q.{currentIndex + 1}
              </span>
              <span className="text-[oklch(0.68_0.04_265)] uppercase tracking-widest">Difficulty: {currentQ?.difficulty_level || 'Moderate'}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-6">
              {(currentQ?.passages?.passage_text || currentQ?.passage_text) && (
                <div className="bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-2xl p-6 text-sm text-[oklch(0.96_0.012_265)] space-y-2">
                  <h4 className="font-mono text-xs uppercase tracking-[0.15em] text-[oklch(0.94_0.21_118)] font-bold border-b border-white/10 pb-2">Reading Context / Passage</h4>
                  <p className="leading-relaxed whitespace-pre-line font-sans">
                    {currentQ?.passages?.passage_text || currentQ?.passage_text}
                  </p>
                </div>
              )}

              {currentQ?.image_url && (
                <div className="flex justify-center bg-[oklch(0.23_0.045_265)] p-4 rounded-2xl border border-white/10">
                  <img src={currentQ.image_url} alt="Question Graphic" className="max-h-64 object-contain rounded" />
                </div>
              )}

              <div className="text-base sm:text-lg font-medium text-[oklch(0.96_0.012_265)] leading-relaxed font-sans">
                {currentQ?.question_text}
              </div>

              <div className="space-y-3 pt-2">
                {currentQ?.question_options?.map((opt, oIndex) => {
                  const optId = opt.option_id || opt.id;
                  const isChecked = userAnswers[currentQ.question_id] === optId;
                  return (
                    <div
                      key={optId}
                      onClick={() => handleOptionSelect(optId)}
                      className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition ${
                        isChecked
                          ? 'bg-[oklch(0.94_0.21_118)]/10 border-[oklch(0.94_0.21_118)] text-[oklch(0.96_0.012_265)] shadow-[0_0_20px_rgba(204,255,0,0.15)] ring-1 ring-[oklch(0.94_0.21_118)]'
                          : 'bg-[oklch(0.23_0.045_265)]/50 border-white/10 text-[oklch(0.68_0.04_265)] hover:border-white/30 hover:text-[oklch(0.96_0.012_265)]'
                      }`}
                    >
                      <span className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-xl font-mono text-xs font-bold border ${
                        isChecked ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] border-[oklch(0.94_0.21_118)]' : 'bg-[oklch(0.16_0.03_265)] border-white/20 text-[oklch(0.96_0.012_265)]'
                      }`}>
                        {String.fromCharCode(65 + oIndex)}
                      </span>
                      <span className="text-sm font-medium font-sans">{opt.option_text}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 bg-[oklch(0.23_0.045_265)]/40 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 font-mono">
              <div className="flex gap-3">
                <button
                  onClick={handleMarkForReviewAndNext}
                  className="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider rounded-xl border border-amber-500/30 transition cursor-pointer"
                >
                  Mark & Next
                </button>
                <button
                  onClick={handleClearResponse}
                  className="px-4 py-2.5 bg-[oklch(0.16_0.03_265)] hover:bg-[oklch(0.16_0.03_265)]/80 text-[oklch(0.68_0.04_265)] text-xs font-bold uppercase tracking-wider rounded-xl border border-white/10 transition cursor-pointer"
                >
                  Clear
                </button>
              </div>

              <button
                onClick={handleSaveAndNext}
                className="px-6 py-2.5 bg-[oklch(0.94_0.21_118)] hover:brightness-110 text-[oklch(0.16_0.03_265)] text-xs font-extrabold uppercase tracking-[0.15em] rounded-xl shadow-[0_0_15px_rgba(204,255,0,0.2)] transition cursor-pointer"
              >
                Save & Next →
              </button>
            </div>
          </main>

          {/* Question Grid Sidebar */}
          <aside className={`absolute lg:relative top-0 right-0 h-full w-full sm:w-80 bg-[oklch(0.23_0.045_265)] flex flex-col border-l border-white/10 z-40 transition-transform duration-300 ${isPaletteOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
            <div className="p-5 border-b border-white/10 bg-[oklch(0.16_0.03_265)]/50">
              <div className="flex justify-between items-center mb-3">
                <h5 className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-[oklch(0.68_0.04_265)]">HUD Palette Summary</h5>
                <button onClick={() => setIsPaletteOpen(false)} className="lg:hidden text-xs text-white font-mono bg-white/10 px-2 py-1 rounded">✕</button>
              </div>
              
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl text-emerald-300">
                  <span>Answered</span>
                  <span className="font-bold">{paletteCounts.answered}</span>
                </div>
                <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-xl text-rose-300">
                  <span>Unanswered</span>
                  <span className="font-bold">{paletteCounts.notAnswered}</span>
                </div>
                <div className="flex items-center justify-between bg-[oklch(0.94_0.21_118)]/10 border border-[oklch(0.94_0.21_118)]/20 px-2.5 py-1.5 rounded-xl text-[oklch(0.94_0.21_118)]">
                  <span>Marked</span>
                  <span className="font-bold">{paletteCounts.marked}</span>
                </div>
                <div className="flex items-center justify-between bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl text-[oklch(0.68_0.04_265)]">
                  <span>Unvisited</span>
                  <span className="font-bold">{paletteCounts.notVisited}</span>
                </div>
              </div>
            </div>

            <div className="p-5 flex-1 overflow-y-auto">
              <h5 className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-[oklch(0.68_0.04_265)] mb-3">
                Question Navigator
              </h5>
              <div className="grid grid-cols-5 gap-2">
                {currentQList.map((q, idx) => (
                  <button
                    key={q.question_id}
                    onClick={() => handleSelectQuestion(idx)}
                    className={`h-11 rounded-xl font-mono font-bold text-xs shadow transition cursor-pointer ${getQuestionPaletteStyle(q.question_id)} ${
                      currentIndex === idx ? 'ring-2 ring-[oklch(0.94_0.21_118)] ring-offset-2 ring-offset-[oklch(0.23_0.045_265)]' : ''
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* Submit Confirmation Modal */}
        {showSubmitConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-[oklch(0.23_0.045_265)] border border-white/15 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl text-[oklch(0.96_0.012_265)] font-mono">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black font-['Archivo_Black'] tracking-tight text-[oklch(0.94_0.21_118)]">CONFIRM SUBMISSION</h3>
                <p className="text-xs text-[oklch(0.68_0.04_265)] uppercase tracking-wider">Final lock-in of your answers.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowSubmitConfirm(false)}
                  className="flex-1 py-3 bg-[oklch(0.16_0.03_265)] hover:bg-[oklch(0.16_0.03_265)]/80 text-xs font-bold uppercase tracking-widest rounded-xl border border-white/10 transition cursor-pointer"
                >
                  Resume
                </button>
                <button
                  onClick={() => {
                    setShowSubmitConfirm(false);
                    handleSubmitTest();
                  }}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg transition cursor-pointer"
                >
                  Lock In
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // RESULTS STAGE
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
      <div className="flex-1 bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)] p-6 sm:p-12 flex flex-col items-center overflow-y-auto font-sans">
        <div className="w-full max-w-4xl space-y-8">
          
          <div className="bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-8 shadow-2xl text-center space-y-6 backdrop-blur-xl">
            <div className="inline-flex px-4 py-1 rounded-full bg-[oklch(0.94_0.21_118)]/10 border border-[oklch(0.94_0.21_118)]/30 font-mono text-xs uppercase tracking-[0.2em] text-[oklch(0.94_0.21_118)] font-bold">
              Mission Debrief
            </div>
            <h2 className="text-3xl font-black font-['Archivo_Black'] tracking-tight">ASSESSMENT PERFORMANCE HUD</h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 font-mono">
              <div className="bg-[oklch(0.16_0.03_265)] p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] text-[oklch(0.68_0.04_265)] block uppercase tracking-widest font-bold">Total Items</span>
                <span className="text-xl font-black text-white font-['Archivo_Black']">{attemptResult.totalQuestions}</span>
              </div>
              <div className="bg-[oklch(0.16_0.03_265)] p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] text-[oklch(0.68_0.04_265)] block uppercase tracking-widest font-bold">Attempted</span>
                <span className="text-xl font-black text-amber-400 font-['Archivo_Black']">{attemptResult.attempted}</span>
              </div>
              <div className="bg-[oklch(0.16_0.03_265)] p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] text-[oklch(0.68_0.04_265)] block uppercase tracking-widest font-bold">Accuracy</span>
                <span className="text-xl font-black text-[oklch(0.94_0.21_118)] font-['Archivo_Black']">{attemptResult.accuracy}%</span>
              </div>
              <div className="bg-[oklch(0.16_0.03_265)] p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] text-[oklch(0.68_0.04_265)] block uppercase tracking-widest font-bold">Final Score</span>
                <span className="text-xl font-black text-emerald-400 font-['Archivo_Black']">{attemptResult.score}</span>
              </div>
            </div>
          </div>

          {/* Module breakdown */}
          <div className="bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
            <h3 className="font-mono text-xs font-bold text-[oklch(0.94_0.21_118)] uppercase tracking-[0.2em] border-b border-white/10 pb-3">Module-wise Precision & Weak Zones</h3>

            <div className="space-y-4 font-mono">
              {sectionStats.map((stat, idx) => {
                const isWeak = stat.accuracy < 50 && stat.total > 0;
                return (
                  <div key={idx} className="bg-[oklch(0.16_0.03_265)] border border-white/5 rounded-2xl p-5 space-y-3">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-[oklch(0.96_0.012_265)]">{stat.name.toUpperCase()}</span>
                        {isWeak ? (
                          <span className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-widest">
                            ⚠️ WEAK ZONE
                          </span>
                        ) : (
                          <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-widest">
                            ✅ LOCKED IN
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-[oklch(0.94_0.21_118)]">{stat.accuracy}% PRECISION</span>
                    </div>

                    <div className="w-full bg-[oklch(0.23_0.045_265)] h-2.5 rounded-full overflow-hidden flex border border-white/10">
                      <div style={{ width: `${stat.total ? (stat.correct / stat.total) * 100 : 0}%` }} className="bg-emerald-500"></div>
                      <div style={{ width: `${stat.total ? (stat.incorrect / stat.total) * 100 : 0}%` }} className="bg-rose-500"></div>
                      <div style={{ width: `${stat.total ? (stat.unattempted / stat.total) * 100 : 0}%` }} className="bg-white/20"></div>
                    </div>

                    <div className="flex flex-wrap justify-between text-[11px] text-[oklch(0.68_0.04_265)] pt-1">
                      <span className="text-emerald-400">Correct: {stat.correct}</span>
                      <span className="text-rose-400">Incorrect: {stat.incorrect}</span>
                      <span>Unattempted: {stat.unattempted}</span>
                      <span className="text-[oklch(0.94_0.21_118)]">Time: {Math.floor(stat.totalTime / 60)}m {stat.totalTime % 60}s</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
            <button
              onClick={() => setStage('solutions')}
              className="py-4 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-bold uppercase tracking-[0.15em] rounded-2xl transition cursor-pointer shadow-lg"
            >
              📖 View Solutions
            </button>
            <button
              onClick={() => setStage('swot')}
              className="py-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-bold uppercase tracking-[0.15em] rounded-2xl transition cursor-pointer shadow-lg"
            >
              📊 SWOT Analysis
            </button>
            <button
              onClick={() => setStage('config')}
              className="py-4 bg-[oklch(0.23_0.045_265)] hover:bg-[oklch(0.23_0.045_265)]/80 border border-white/10 text-[oklch(0.96_0.012_265)] font-bold uppercase tracking-[0.15em] rounded-2xl transition cursor-pointer shadow-lg"
            >
              🏠 Main HUD
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SOLUTIONS STAGE
  if (stage === 'solutions') {
    const allQs = Object.values(sectionQuestionsMap).flat();

    return (
      <div className="flex-1 bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)] p-6 sm:p-12 flex flex-col items-center overflow-y-auto font-sans">
        <div className="w-full max-w-4xl space-y-6">
          <div className="flex justify-between items-center bg-[oklch(0.23_0.045_265)] border border-white/10 p-6 rounded-2xl shadow-xl">
            <h2 className="text-xl font-black font-['Archivo_Black'] tracking-tight text-[oklch(0.94_0.21_118)]">DETAILED SOLUTIONS</h2>
            <button
              onClick={() => setStage('result')}
              className="px-4 py-2 bg-[oklch(0.16_0.03_265)] hover:bg-[oklch(0.16_0.03_265)]/80 border border-white/10 font-mono text-xs uppercase tracking-wider font-bold rounded-xl transition cursor-pointer"
            >
              ← Back to Debrief
            </button>
          </div>

          <div className="space-y-6">
            {allQs.map((q, idx) => {
              const studentAnswerId = userAnswers[q.question_id];
              const correctOption = q.question_options?.find((o) => o.is_correct);
              const correctOptId = correctOption?.option_id || correctOption?.id;
              const isCorrect = studentAnswerId === correctOptId;
              const timeSpentSecs = questionTimers[q.question_id] || 0;

              return (
                <div key={q.question_id} className="bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
                  <div className="flex justify-between items-center border-b border-white/10 pb-4 font-mono text-xs flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[oklch(0.96_0.012_265)]">Q.No. {idx + 1}</span>
                      <span className="text-[oklch(0.94_0.21_118)] bg-[oklch(0.16_0.03_265)] px-2.5 py-1 rounded-xl border border-white/10">
                        ⏱️ {timeSpentSecs}s
                      </span>
                    </div>
                    <span className={`font-bold px-3 py-1 rounded-xl uppercase tracking-wider text-[11px] ${
                      !studentAnswerId ? 'bg-white/5 text-[oklch(0.68_0.04_265)]' : isCorrect ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}>
                      {!studentAnswerId ? 'Unattempted' : isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>

                  <p className="text-base font-medium font-sans">{q.question_text}</p>

                  <div className="space-y-2 font-mono text-xs">
                    {q.question_options?.map((opt, oIndex) => {
                      const optId = opt.option_id || opt.id;
                      const isStudentChoice = studentAnswerId === optId;
                      const isRightChoice = opt.is_correct;

                      let badgeStyle = 'bg-[oklch(0.16_0.03_265)] border-white/5 text-[oklch(0.68_0.04_265)]';
                      if (isRightChoice) badgeStyle = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
                      else if (isStudentChoice && !isRightChoice) badgeStyle = 'bg-rose-500/10 border-rose-500/30 text-rose-300';

                      return (
                        <div key={optId} className={`p-3.5 rounded-2xl border flex items-center justify-between ${badgeStyle}`}>
                          <span>({String.fromCharCode(65 + oIndex)}) {opt.option_text}</span>
                          <span className="font-bold tracking-wider">
                            {isStudentChoice && '[YOUR PICK] '}
                            {isRightChoice && '[CORRECT]'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {q.solution_explanation && (
                    <div className="bg-[oklch(0.16_0.03_265)] p-4 rounded-2xl border border-white/10 font-mono text-xs space-y-1">
                      <span className="text-[oklch(0.94_0.21_118)] font-bold uppercase tracking-wider block">Solution Breakdown:</span>
                      <p className="font-sans text-[oklch(0.68_0.04_265)] leading-relaxed">{q.solution_explanation}</p>
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

  // SWOT STAGE
  if (stage === 'swot') {
    return (
      <div className="flex-1 bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)] p-6 sm:p-12 flex flex-col items-center font-sans">
        <div className="w-full max-w-2xl bg-[oklch(0.23_0.045_265)] border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h2 className="text-xl font-black font-['Archivo_Black'] tracking-tight text-purple-400">SWOT ANALYTICS REPORT</h2>
            <button
              onClick={() => setStage('result')}
              className="px-4 py-2 bg-[oklch(0.16_0.03_265)] hover:bg-[oklch(0.16_0.03_265)]/80 border border-white/10 font-mono text-xs uppercase tracking-wider font-bold rounded-xl transition cursor-pointer"
            >
              ← Back
            </button>
          </div>

          <div className="space-y-4 font-mono text-xs">
            <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-1">
              <h3 className="font-bold text-emerald-400 uppercase tracking-widest">💪 Strengths</h3>
              <p className="font-sans text-[oklch(0.68_0.04_265)]">High command over core reasoning and quantitative modules.</p>
            </div>

            <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-1">
              <h3 className="font-bold text-amber-400 uppercase tracking-widest">⚠️ Weaknesses</h3>
              <p className="font-sans text-[oklch(0.68_0.04_265)]">Calculation-heavy items required excessive time allocations.</p>
            </div>

            <div className="p-5 bg-blue-500/10 border border-blue-500/30 rounded-2xl space-y-1">
              <h3 className="font-bold text-blue-400 uppercase tracking-widest">🎯 Opportunities</h3>
              <p className="font-sans text-[oklch(0.68_0.04_265)]">Improve reading comprehension pacing to secure quick points.</p>
            </div>

            <div className="p-5 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-1">
              <h3 className="font-bold text-rose-400 uppercase tracking-widest">🚨 Threats</h3>
              <p className="font-sans text-[oklch(0.68_0.04_265)]">Negative marking exposure from uncalculated guesswork.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
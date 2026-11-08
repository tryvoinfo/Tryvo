import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import katex from 'katex';
import ReactApexChart from 'react-apexcharts';

function DIChartRenderer({ chartType, categories, data, tableData, theme }) {
  const isLine = chartType === 'line';
  const isPie = chartType === 'pie' || chartType === 'donut';
  const isDark = theme === 'dark';

  let parsedTable = tableData;
  if (typeof tableData === 'string') {
    try {
      parsedTable = JSON.parse(tableData);
    } catch (e) {
      parsedTable = null;
    }
  }

  const chartOptions = {
    chart: { 
      toolbar: { show: false }, 
      background: 'transparent',
      type: chartType || 'bar'
    },
    theme: { mode: isDark ? 'dark' : 'light' },
    colors: ['#6366f1', '#2563eb', '#10b981', '#f59e0b', '#ec4899'],
    ...(isPie ? {
      labels: categories || [],
      legend: { position: 'bottom', labels: { colors: isDark ? '#fff' : '#0f172a' } }
    } : {
      xaxis: { categories: categories || [], labels: { style: { colors: isDark ? '#94a3b8' : '#64748b' } } },
      yaxis: { labels: { style: { colors: isDark ? '#94a3b8' : '#64748b' } } },
      ...(isLine ? {
        stroke: { curve: 'smooth', width: 3 },
        markers: { size: 5 }
      } : {})
    })
  };

  const chartSeries = isPie ? (data || []) : [{ name: 'Values', data: data || [] }];
  const hasChartData = data && Array.isArray(data) && data.length > 0;

  return (
    <div className="space-y-4 w-full">
      {parsedTable && parsedTable.headers && parsedTable.rows ? (
        <div className={`overflow-x-auto rounded-xl border shadow-xs ${isDark ? 'border-slate-800 bg-slate-950/80 text-slate-200' : theme === 'light-mono' ? 'border-2 border-black bg-white text-black' : 'border-slate-200 bg-white text-slate-800'}`}>
          <table className="w-full text-left text-xs font-mono">
            <thead className={`uppercase tracking-wider border-b ${isDark ? 'bg-slate-900 text-indigo-400 border-slate-800' : theme === 'light-mono' ? 'bg-neutral-100 text-black border-b-2 border-black' : 'bg-slate-100 text-blue-600 border-slate-200'}`}>
              <tr>
                {parsedTable.headers.map((header, idx) => (
                  <th key={idx} className="px-3 py-2.5 font-bold">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : theme === 'light-mono' ? 'divide-black' : 'divide-slate-200'}`}>
              {parsedTable.rows.map((row, rIdx) => (
                <tr key={rIdx} className={`transition-colors ${isDark ? 'hover:bg-slate-900/50' : 'hover:bg-slate-50'}`}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 font-sans">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {hasChartData && (
        <div className={`p-3 rounded-xl border shadow-xs w-full flex justify-center items-center ${isDark ? 'bg-slate-900 border-slate-800' : theme === 'light-mono' ? 'border-2 border-black bg-white' : 'bg-white border-slate-200'}`}>
          <ReactApexChart 
            options={chartOptions} 
            series={chartSeries} 
            type={chartType || 'bar'} 
            height={240} 
            width="100%"
          />
        </div>
      )}
    </div>
  );
}

const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const cleanText = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â□□/g, ', ')
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€ /g, '"')
    .replace(/â€¦/g, '…');
};

function MathText({ text }) {
  const htmlContent = useMemo(() => {
    if (!text) return '';
    let processed = cleanText(text);

    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (m, f) => `$$${f.trim()}$$`);

    while (processed.includes('\\(') && processed.includes('\\)')) {
      const startIndex = processed.indexOf('\\(');
      const endIndex = processed.indexOf('\\)', startIndex);
      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        const formula = processed.substring(startIndex + 2, endIndex);
        try {
          const renderedMath = katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
          processed = processed.substring(0, startIndex) + renderedMath + processed.substring(endIndex + 2);
        } catch (e) {
          break;
        }
      } else {
        break;
      }
    }

    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
      try {
        return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
      } catch (e) {
        return match;
      }
    });

    processed = processed.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
      try {
        return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
      } catch (e) {
        return match;
      }
    });

    return processed;
  }, [text]);

  return <span className="break-words" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
}

export default function ExamPortal({ theme = 'dark' }) {
  const [stage, setStage] = useState('config'); // 'config' | 'exam' | 'result' | 'solutions' | 'swot' | 'construction'
  const [exams, setExams] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [constructionTitle, setConstructionTitle] = useState('');
  
  const [selectedExamId, setSelectedExamId] = useState('');
  const [testMode, setTestMode] = useState('Full-Length Mock'); 
  const [mockTimingMode, setMockTimingMode] = useState('liberal'); 
  
  const [selectedMainCategory, setSelectedMainCategory] = useState('');
  const [selectedSubtopicId, setSelectedSubtopicId] = useState('');

  const [practiceMinutes, setPracticeMinutes] = useState(15);
  const [loading, setLoading] = useState(false);

  const [dilemmaQuestion, setDilemmaQuestion] = useState(null);
  const [dilemmaOptions, setDilemmaOptions] = useState([]);
  const [dilemmaSelectedIndex, setDilemmaSelectedIndex] = useState(null);
  const [dilemmaSubmitted, setDilemmaSubmitted] = useState(false);
  const [dilemmaTimer, setDilemmaTimer] = useState(60);

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

  const isDark = theme === 'dark';
  const isMono = theme === 'light-mono';

  useEffect(() => {
    window.scrollToConfigSection = () => {
      setStage('config');
      const configElement = document.getElementById('session-config-section');
      if (configElement) {
        configElement.scrollIntoView({ behavior: 'smooth' });
      }
    };
  }, []);

  useEffect(() => {
    if (stage !== 'exam') return;

    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      const confirmLeave = window.confirm("⚠️ Active Exam Warning: You cannot leave this page until you submit your test. Are you sure you want to terminate your session?");
      if (confirmLeave) {
        setStage('config');
      } else {
        window.history.pushState(null, '', window.location.href);
      }
    };

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Your exam is currently in progress. Leaving will discard your session progress.';
      return e.returnValue;
    };

    const handleDocumentClick = (e) => {
      const targetLink = e.target.closest('a, button');
      if (!targetLink) return;

      if (targetLink.closest('.exam-active-container') || targetLink.classList.contains('exam-nav-action')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      window.alert("🔒 Exam Lock Active: You cannot switch tabs or leave during an active exam session. Please submit your test when finished.");
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
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

  useEffect(() => {
    async function loadMetaAndDilemma() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userSessionStr = localStorage.getItem('tryvo_user_session');
        const parsedUser = userSessionStr ? JSON.parse(userSessionStr) : null;
        const userEmail = session?.user?.email || parsedUser?.email;

        const { data: examsData } = await supabase.from('exams').select('*');
        const { data: subtopicsData } = await supabase.from('subtopics').select('*');
        
        if (examsData && examsData.length > 0) {
          if (userEmail) {
            const { data: allocations } = await supabase
              .from('user_exam_allocations')
              .select('exam_id')
              .eq('email', userEmail);

            const allocatedIds = allocations ? allocations.map(a => String(a.exam_id)) : [];
            const filteredExams = examsData.filter(ex => allocatedIds.includes(String(ex.exam_id || ex.id)));
            
            setExams(filteredExams);
            if (filteredExams.length > 0) {
              setSelectedExamId(filteredExams[0].exam_id || filteredExams[0].id);
            }
          } else {
            setExams([]);
          }
        }

        if (subtopicsData && subtopicsData.length > 0) {
          setSubtopics(subtopicsData);
          const firstSub = subtopicsData[0];
          setSelectedMainCategory(firstSub.category || firstSub.section_name || 'Numerical Ability');
          setSelectedSubtopicId(firstSub.subtopic_id || firstSub.id);
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

      const { data: allQuestions } = await supabase.from('questions').select('*, passages(*)');
      const { data: allSubtopics } = await supabase.from('subtopics').select('*');
      const { data: allOptions } = await supabase.from('question_options').select('*').range(0, 9999).limit(5000);

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

        for (let i = 0; i < sectionsData.length; i++) {
          const sec = sectionsData[i];
          const secId = sec.section_id || sec.id;
          const quota = sec.no_of_questions || 35;
          const secNameLower = (sec.section_name || '').toLowerCase();

          initialSectionTimes[secId] = sec.duration_minutes ? sec.duration_minutes * 60 : defaultSecDurationSecs;

          let matchingSubIds = allSubtopics
            ?.filter(s => s.section_id === secId || s.section_id?.toLowerCase() === secId.toLowerCase())
            ?.map(s => s.subtopic_id || s.id) || [];

          let qData = [];
          if (matchingSubIds.length > 0 && allQuestions) {
            qData = allQuestions.filter(q => matchingSubIds.includes(q.subtopic_id));
          }

          if ((!qData || qData.length === 0) && allQuestions) {
            qData = allQuestions.filter(q => {
              const subObj = allSubtopics?.find(s => (s.subtopic_id || s.id) === q.subtopic_id);
              const subName = (subObj?.subtopic_name || '').toLowerCase();
              
              if (secNameLower.includes('english')) {
                return subName.includes('cloze') || subName.includes('reading') || subName.includes('error') || subName.includes('vocab');
              } else if (secNameLower.includes('numerical') || secNameLower.includes('quant')) {
                return subName.includes('approxi') || subName.includes('average') || subName.includes('series') || subName.includes('profit') || subName.includes('ratio');
              } else if (secNameLower.includes('reasoning')) {
                return subName.includes('puzzle') || subName.includes('seating') || subName.includes('syllogism') || subName.includes('blood');
              } else {
                return false;
              }
            });
          }

          const shuffledQData = shuffleArray(qData || []);
          const groupedQData = groupPassageQuestions(shuffledQData);
          const limitedQuestions = groupedQData.slice(0, quota);

          finalSectionMap[secId] = limitedQuestions.map(q => {
            const qId = q.question_id || q.id;
            const rawOpts = (allOptions || []).filter(o => {
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
      else if (testMode === 'Time-Based Practice') {
        testDurationMinutes = Number(practiceMinutes);
        const totalSeconds = testDurationMinutes * 60;
        const timePerCategory = totalSeconds / 3;

        const englishQuota = Math.max(1, Math.floor(timePerCategory / 30));
        const numericalQuota = Math.max(1, Math.floor(timePerCategory / 40));
        const reasoningQuota = Math.max(1, Math.floor(timePerCategory / 40));

        const sprintSections = [
          { section_id: 'SPRINT_ENG', section_name: 'English Language', quota: englishQuota, timeSec: timePerCategory },
          { section_id: 'SPRINT_NUM', section_name: 'Numerical Ability', quota: numericalQuota, timeSec: timePerCategory },
          { section_id: 'SPRINT_REA', section_name: 'Reasoning Ability', quota: reasoningQuota, timeSec: timePerCategory }
        ];

        if (!allQuestions || allQuestions.length === 0) {
          alert('No questions found in database.');
          setLoading(false);
          return;
        }

        let finalSectionMap = {};
        let initialSectionTimes = {};

        sprintSections.forEach(sec => {
          initialSectionTimes[sec.section_id] = sec.timeSec;
          const targetKey = sec.section_name.toLowerCase().split(' ')[0];

          let matchingSubs = allSubtopics?.filter(s => {
            const name = (s.subtopic_name || s.name || '').toLowerCase();
            const cat = (s.category || s.section_name || '').toLowerCase();
            return name.includes(targetKey) || cat.includes(targetKey);
          })?.map(s => s.subtopic_id || s.id) || [];
          
          let secQuestions = allQuestions.filter(q => matchingSubs.includes(q.subtopic_id));
          
          if (secQuestions.length === 0 && allQuestions.length > 0) {
            secQuestions = allQuestions;
          }

          const shuffled = groupPassageQuestions(shuffleArray(secQuestions)).slice(0, sec.quota);
          
          finalSectionMap[sec.section_id] = shuffled.map(q => {
            const qId = q.question_id || q.id;
            const rawOpts = (allOptions || []).filter(o => {
              const optQId = String(o.question_id || o.qid || o.questionId || o.q_id || '').trim();
              return optQId === String(qId).trim() || optQId === String(q.id).trim();
            });

            return {
              ...q,
              question_id: qId,
              question_options: rawOpts.length > 0 ? shuffleArray(rawOpts) : []
            };
          });
        });

        setSections(sprintSections);
        setSectionQuestionsMap(finalSectionMap);
        setSectionTimeLefts(initialSectionTimes);
        setCompletedSections(new Set());
        setActiveSectionIndex(0);
        setCurrentIndex(0);
        setTimeLeft(totalSeconds);
        setUserAnswers({});
        setQuestionTimers({});
        setReviewStatus({});
        const firstSecId = sprintSections[0].section_id;
        const firstQId = finalSectionMap[firstSecId]?.[0]?.question_id;
        setVisitedQuestions(firstQId ? new Set([firstQId]) : new Set());
        setStage('exam');
      }
      else {
        // Topic-Based Drill
        testDurationMinutes = 15;
        
        const selectedSub = subtopics.find(s => (s.subtopic_id || s.id) === selectedSubtopicId);
        const subName = (selectedSub?.subtopic_name || selectedSub?.name || '').toLowerCase();

        let loadedQuestions = [];

        // STRICT CHECK: Only load DI table if subtopic explicitly equals Data Interpretation (removed "testing")
        if (subName === 'data interpretation (di)' || subName === 'di') {
          const { data: diData } = await supabase.from('di_questions').select('*');
          if (diData && diData.length > 0) {
            loadedQuestions = diData.map((di) => {
              let parsedOptions = [];
              try {
                parsedOptions = typeof di.options === 'string' ? JSON.parse(di.options) : di.options;
              } catch (e) {
                parsedOptions = [];
              }

              const formattedOptions = parsedOptions.map((optText, oIdx) => ({
                id: `di_opt_${oIdx}`,
                option_text: optText,
                is_correct: oIdx === 1
              }));

              return {
                ...di,
                question_id: di.id,
                question_text: di.question_text,
                question_options: formattedOptions,
                chart_data: typeof di.chart_data === 'string' ? JSON.parse(di.chart_data) : di.chart_data,
                chart_categories: typeof di.chart_categories === 'string' ? JSON.parse(di.chart_categories) : di.chart_categories,
                table_data: typeof di.table_data === 'string' ? JSON.parse(di.table_data) : di.table_data
              };
            });
          }
        } else {
          // STRICT SUBTOPIC FILTERING: Query standard questions table using exact selectedSubtopicId
          const { data: qData, error: qErr } = await supabase
            .from('questions')
            .select('*, passages(*)')
            .eq('subtopic_id', selectedSubtopicId);

          if (qErr) throw qErr;
          loadedQuestions = groupPassageQuestions(shuffleArray(qData || []));
        }

        if (loadedQuestions.length === 0) {
          alert('No questions found for this specific subtopic in the database.');
          setLoading(false);
          return;
        }

        const qIdKey = loadedQuestions[0].question_id !== undefined ? 'question_id' : 'id';

        const finalQuestions = loadedQuestions.map(q => {
          const qId = q[qIdKey];
          const rawOpts = q.question_options || (allOptions || []).filter(o => {
            const optQId = String(o.question_id || o.qid || o.questionId || o.q_id || '').trim();
            return optQId === String(qId).trim() || optQId === String(q.id).trim();
          });

          return {
            ...q,
            question_id: qId,
            question_options: rawOpts.length > 0 ? shuffleArray(rawOpts) : []
          };
        });

        const moduleDisplayName = selectedSub?.subtopic_name || selectedSub?.name || testMode;

        setSections([{ section_id: 'PRACTICE', section_name: moduleDisplayName }]);
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

  const handleSubmitTest = async () => {
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

    const resultData = {
      totalQuestions: totalQCount,
      attempted,
      correctCount,
      score: Number(score.toFixed(2)),
      accuracy
    };

    setAttemptResult(resultData);
    setStage('result');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userSessionStr = localStorage.getItem('tryvo_user_session');
      const parsedUser = userSessionStr ? JSON.parse(userSessionStr) : null;
      const userId = session?.user?.id || parsedUser?.id;

      if (userId) {
        const activeExamObj = exams.find((e) => (e.exam_id || e.id) === selectedExamId);
        const examTitleName = testMode === 'Full-Length Mock' 
          ? (activeExamObj?.exam_name || activeExamObj?.name || 'Full Mock Exam') 
          : `${testMode} Session`;

        await supabase.from('exam_submissions').insert([
          {
            user_id: userId,
            exam_title: examTitleName,
            score: Number(score.toFixed(2)),
            total_marks: totalQCount,
            category: testMode
          }
        ]);
      }
    } catch (err) {
      console.error("Error recording exam submission to analytics:", err);
    }
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
    if (isMarked) return isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] font-bold' : isMono ? 'bg-black text-white font-bold' : 'bg-red-600 text-white font-bold';
    if (isAnswered) return 'bg-emerald-600 text-white';
    if (isVisited) return 'bg-rose-500 text-white';
    return isDark ? 'bg-[oklch(0.23_0.045_265)] text-[oklch(0.68_0.04_265)] border border-white/5' : isMono ? 'bg-white text-black border-2 border-black' : 'bg-slate-100 text-slate-700 hover:border-red-600 border border-slate-200';
  };

  if (stage === 'construction') {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 font-sans ${isDark ? 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)]' : isMono ? 'bg-white text-black' : 'bg-slate-50 text-slate-900'}`}>
        <h1 className={`text-3xl sm:text-5xl font-extrabold ${isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black underline' : 'text-red-600'}`}>
          {cleanText(constructionTitle)} Under Construction
        </h1>
        <p className={`font-mono text-sm uppercase tracking-wider ${isDark ? 'text-[oklch(0.68_0.04_265)]' : 'opacity-70'}`}>
          We are building something awesome. Check back soon!
        </p>
        <button 
          onClick={() => setStage('config')}
          className={`mt-4 px-6 py-3 font-mono text-xs uppercase tracking-widest rounded-full transition cursor-pointer border ${isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10 hover:bg-white/5 text-white' : isMono ? 'bg-white border-2 border-black text-black font-bold' : 'bg-white border-slate-300 hover:bg-slate-100 shadow-xs'}`}
        >
          ← Return to Config
        </button>
      </div>
    );
  }

  if (stage === 'config') {
    const getSubtopicCategory = (sub) => {
      if (sub.category) return sub.category;
      if (sub.section_name) return sub.section_name;
      
      const name = (sub.subtopic_name || sub.name || '').toLowerCase();
      if (name.includes('simplification') || name.includes('arithmetic') || name.includes('series') || name.includes('data interpretation') || name.includes('approximation')) {
        return 'Numerical Ability';
      } else if (name.includes('cloze') || name.includes('error') || name.includes('filler') || name.includes('reading') || name.includes('vocab')) {
        return 'English Language';
      } else if (name.includes('puzzle') || name.includes('seating') || name.includes('syllogism') || name.includes('blood') || name.includes('testing')) {
        return 'Reasoning Ability';
      }
      return 'General Awareness / Other';
    };
    const mainCategories = [...new Set(subtopics.map(sub => getSubtopicCategory(sub)))];
    
    if (!selectedMainCategory && mainCategories.length > 0) {
      setSelectedMainCategory(mainCategories[0]);
    }

    const filteredSubtopics = subtopics.filter(sub => {
      return getSubtopicCategory(sub) === selectedMainCategory;
    });

    return (
      <div className={`flex-1 flex flex-col justify-center px-6 lg:px-20 py-12 relative overflow-hidden font-sans transition-colors duration-200 ${
        isDark ? 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)]' : isMono ? 'bg-white text-black' : 'bg-slate-50 text-slate-900'
      }`}>
        
        <div className={`w-full font-mono text-xs font-bold uppercase tracking-widest py-2.5 px-4 overflow-hidden whitespace-nowrap mb-12 rounded-2xl shadow-xs ${
          isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] shadow-[0_0_20px_rgba(204,255,0,0.25)]' : isMono ? 'bg-black text-white border-2 border-black' : 'bg-slate-950 text-white shadow-xs'
        }`}>
          <div className="inline-block animate-[marquee_25s_linear_infinite]">
            SBI Clerk 2026 Exam Dates: Prelims on Sept 26 & 27 | Mains on Nov 23 — Start Your Prep Now! &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; SBI Clerk 2026 Exam Dates: Prelims on Sept 26 & 27 | Mains on Nov 23 — Start Your Prep Now!
          </div>
        </div>

        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          
          <div className="lg:col-span-7 space-y-8">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border font-mono text-xs shadow-xs ${
              isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10 text-[oklch(0.68_0.04_265)]' : isMono ? 'bg-white border-2 border-black text-black font-bold' : 'bg-white border-slate-200 text-slate-600'
            }`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${isDark ? 'bg-[oklch(0.94_0.21_118)]' : isMono ? 'bg-black' : 'bg-red-600'}`}></span>
              The Daily Dilemma: 1 minute, 1 moral choice, endless perspectives
            </div>

            <div className="space-y-2">
              <h1 className={`text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] ${isDark ? 'text-white' : 'text-slate-950'}`}>
                Beat the clock.<br />
                <span className={isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'underline' : 'text-red-600'}>Own the rank.</span>
              </h1>
              <p className={`text-sm sm:text-base font-sans max-w-xl leading-relaxed pt-2 ${isDark ? 'text-[oklch(0.68_0.04_265)]' : isMono ? 'text-black font-medium' : 'text-slate-600'}`}>
                Students who consistently practice with mock tests outperform passive learners by an average of 15 to 25 percentage points.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 items-center font-mono text-xs">
              <span className={`uppercase tracking-wider mr-1 ${isDark ? 'text-[oklch(0.68_0.04_265)]' : 'text-slate-500'}`}>Grinders:</span>
              {['JEE', 'NEET', 'UPSC', 'SSC', 'CAT'].map((tag, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setConstructionTitle(tag);
                    setStage('construction');
                  }}
                  className={`px-3.5 py-1.5 rounded-full border font-mono text-[11px] uppercase tracking-[0.15em] transition cursor-pointer font-bold shadow-xs ${
                    isDark 
                      ? 'bg-[oklch(0.23_0.045_265)] border-white/10 text-[oklch(0.94_0.21_118)] hover:bg-[oklch(0.94_0.21_118)] hover:text-[oklch(0.16_0.03_265)]' 
                      : isMono
                      ? 'bg-white border-2 border-black text-black hover:bg-black hover:text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-red-600 hover:text-red-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
              <button
                onClick={() => {
                  const configElement = document.getElementById('session-config-section');
                  if (configElement) configElement.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`px-4 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-[0.15em] transition cursor-pointer font-extrabold shadow-sm ${
                  isDark 
                    ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] hover:brightness-110 shadow-[0_0_15px_rgba(204,255,0,0.2)]' 
                    : isMono
                    ? 'bg-black text-white border-2 border-black hover:bg-neutral-800'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                SBI →
              </button>
            </div>
          </div>

          <div className="lg:col-span-5" id="session-config-section">
            <div className={`border rounded-3xl p-6 sm:p-8 shadow-xl relative z-10 space-y-6 transition-colors duration-200 ${
              isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10 text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-white border-slate-200 text-slate-900'
            }`}>
              <div className={`border-b pb-4 ${isDark ? 'border-white/10' : isMono ? 'border-black' : 'border-slate-200'}`}>
                <h3 className={`font-mono text-xs uppercase tracking-[0.2em] font-bold mb-1 ${isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black underline' : 'text-red-600'}`}>Session Configuration</h3>
                <h2 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>Configure Your Battleground</h2>
              </div>

              <div className="space-y-5 font-mono text-xs">
                <div>
                  <label className={`block uppercase tracking-[0.15em] mb-2 ${isDark ? 'text-[oklch(0.68_0.04_265)]' : 'text-slate-700'}`}>Select Target Exam Blueprint</label>
                  <select
                    className={`w-full border rounded-2xl p-4 text-sm transition cursor-pointer focus:outline-none ${
                      isDark 
                        ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-white focus:border-[oklch(0.94_0.21_118)]' 
                        : isMono
                        ? 'bg-white border-2 border-black text-black'
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-red-600'
                    }`}
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                  >
                    {exams.length > 0 ? (
                      exams.map((ex) => (
                        <option key={ex.exam_id || ex.id} value={ex.exam_id || ex.id}>
                          {cleanText(ex.exam_name || ex.name)}
                        </option>
                      ))
                    ) : (
                      <option value="">No exams allocated to your account</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className={`block uppercase tracking-[0.15em] mb-2 ${isDark ? 'text-[oklch(0.68_0.04_265)]' : 'text-slate-700'}`}>Execution Mode</label>
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
                        className={`p-3.5 rounded-2xl border text-center transition cursor-pointer uppercase font-bold tracking-wider ${
                          testMode === mode.id
                            ? (isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] border-[oklch(0.94_0.21_118)] shadow-[0_0_15px_rgba(204,255,0,0.2)]' : isMono ? 'bg-black text-white border-2 border-black' : 'bg-red-600 text-white border-red-600 shadow-sm')
                            : (isDark ? 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)] border-white/10 hover:text-white' : isMono ? 'bg-white text-black border-2 border-black hover:bg-neutral-100' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100')
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {testMode === 'Full-Length Mock' && (
                  <div>
                    <label className={`block uppercase tracking-[0.15em] mb-2 ${isDark ? 'text-[oklch(0.68_0.04_265)]' : 'text-slate-700'}`}>Timer Protocol</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setMockTimingMode('strict')}
                        className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                          mockTimingMode === 'strict'
                            ? (isDark ? 'bg-[oklch(0.94_0.21_118)]/10 border-[oklch(0.94_0.21_118)] text-[oklch(0.94_0.21_118)] font-bold' : isMono ? 'bg-neutral-100 border-2 border-black text-black font-bold' : 'bg-red-50 border-red-600 text-red-700 font-bold')
                            : (isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-[oklch(0.68_0.04_265)]' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-slate-50 border-slate-200 text-slate-600')
                        }`}
                      >
                        <span className="block uppercase font-bold text-xs tracking-wider">Strict Timer</span>
                        <span className="text-[11px] opacity-75 font-sans mt-0.5 block">Locked module pacing</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMockTimingMode('liberal')}
                        className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                          mockTimingMode === 'liberal'
                            ? (isDark ? 'bg-[oklch(0.94_0.21_118)]/10 border-[oklch(0.94_0.21_118)] text-[oklch(0.94_0.21_118)] font-bold' : isMono ? 'bg-neutral-100 border-2 border-black text-black font-bold' : 'bg-red-50 border-red-600 text-red-700 font-bold')
                            : (isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-[oklch(0.68_0.04_265)]' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-slate-50 border-slate-200 text-slate-600')
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
                    <label className={`block uppercase tracking-[0.15em] mb-2 ${isDark ? 'text-[oklch(0.68_0.04_265)]' : 'text-slate-700'}`}>Select Sprint Duration</label>
                    <div className="grid grid-cols-4 gap-2.5">
                      {[10, 15, 30, 45].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setPracticeMinutes(mins)}
                          className={`p-3 rounded-2xl border text-center transition cursor-pointer font-bold ${
                            Number(practiceMinutes) === mins
                              ? (isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] border-[oklch(0.94_0.21_118)] shadow-[0_0_15px_rgba(204,255,0,0.2)]' : isMono ? 'bg-black text-white border-2 border-black' : 'bg-red-600 text-white border-red-600 shadow-sm')
                              : (isDark ? 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)] border-white/10 hover:text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-slate-50 text-slate-700 border-slate-200')
                          }`}
                        >
                          {mins} Mins
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {testMode === 'Topic-Based' && (
                  <div className="space-y-4">
                    <div>
                      <label className={`block uppercase tracking-[0.15em] mb-2 ${isDark ? 'text-[oklch(0.68_0.04_265)]' : 'text-slate-700'}`}>Select Main Category</label>
                      <select
                        className={`w-full border rounded-2xl p-4 text-sm transition cursor-pointer focus:outline-none ${
                          isDark 
                            ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-white focus:border-[oklch(0.94_0.21_118)]' 
                            : isMono ? 'bg-white border-2 border-black text-black' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-red-600'
                        }`}
                        value={selectedMainCategory}
                        onChange={(e) => {
                          const newCat = e.target.value;
                          setSelectedMainCategory(newCat);
                          const matchingSubs = subtopics.filter(sub => (sub.category || sub.section_name || 'General') === newCat);
                          if (matchingSubs.length > 0) {
                            setSelectedSubtopicId(matchingSubs[0].subtopic_id || matchingSubs[0].id);
                          }
                        }}
                      >
                        {mainCategories.length > 0 ? (
                          mainCategories.map((cat, idx) => (
                            <option key={idx} value={cat}>{cleanText(cat)}</option>
                          ))
                        ) : (
                          <option value="">No categories found</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className={`block uppercase tracking-[0.15em] mb-2 ${isDark ? 'text-[oklch(0.68_0.04_265)]' : 'text-slate-700'}`}>Select Target Subtopic</label>
                      <select
                        className={`w-full border rounded-2xl p-4 text-sm transition cursor-pointer focus:outline-none ${
                          isDark 
                            ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-white focus:border-[oklch(0.94_0.21_118)]' 
                            : isMono ? 'bg-white border-2 border-black text-black' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-red-600'
                        }`}
                        value={selectedSubtopicId}
                        onChange={(e) => setSelectedSubtopicId(e.target.value)}
                      >
                        {filteredSubtopics.length > 0 ? (
                          filteredSubtopics.map((sub) => (
                            <option key={sub.subtopic_id || sub.id} value={sub.subtopic_id || sub.id}>
                              {cleanText(sub.subtopic_name || sub.name)}
                            </option>
                          ))
                        ) : (
                          <option value="">No subtopics available</option>
                        )}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={startExam}
                disabled={loading || exams.length === 0}
                className={`w-full py-4 font-mono text-xs uppercase tracking-[0.15em] font-extrabold rounded-2xl transition cursor-pointer disabled:opacity-50 ${
                  isDark 
                    ? 'bg-[oklch(0.94_0.21_118)] hover:brightness-110 text-[oklch(0.16_0.03_265)] shadow-[0_0_25px_rgba(204,255,0,0.25)]' 
                    : isMono ? 'bg-black text-white border-2 border-black hover:bg-neutral-800' : 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                }`}
              >
                {loading ? 'BUILDING QUESTION BANK...' : exams.length === 0 ? 'NO EXAMS ALLOCATED TO YOU' : 'INITIALIZE MOCK SESSION →'}
              </button>
            </div>
          </div>

        </div>

        {/* Daily Dilemma Section */}
        <div className={`max-w-3xl mx-auto w-full mt-16 border rounded-3xl p-8 shadow-xl relative z-10 space-y-6 transition-colors duration-200 ${
          isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10 text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className={`flex justify-between items-center border-b pb-4 ${isDark ? 'border-white/10' : isMono ? 'border-black' : 'border-slate-200'}`}>
            <span className={`font-mono text-xs uppercase tracking-[0.1em] font-bold ${isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black underline' : 'text-red-600'}`}>The Daily Dilemma: Challenge your choice</span>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border font-mono text-xs font-bold ${
              isDark ? 'bg-[oklch(0.16_0.03_265)] border-[oklch(0.94_0.21_118)]/30 text-[oklch(0.94_0.21_118)]' : isMono ? 'bg-neutral-100 border-2 border-black text-black' : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-ping ${isDark ? 'bg-[oklch(0.94_0.21_118)]' : isMono ? 'bg-black' : 'bg-red-600'}`}></span>
              0:{dilemmaTimer < 10 ? `0${dilemmaTimer}` : dilemmaTimer}
            </div>
          </div>

          <div className="space-y-4">
            <p className={`text-sm sm:text-base font-semibold min-h-[48px] ${isDark ? 'text-white' : isMono ? 'text-black' : 'text-slate-800'}`}>
              <MathText text={dilemmaQuestion ? dilemmaQuestion.question_text : 'Loading dilemma from separate table...'} />
            </p>

            <div className="space-y-2.5 font-mono text-xs">
              {dilemmaOptions.length > 0 ? (
                dilemmaOptions.map((opt, oIdx) => {
                  const optId = opt.option_id || opt.id;
                  const isSelected = dilemmaSelectedIndex === oIdx;
                  const isCorrect = opt.is_correct;

                  let borderStyle = isDark ? 'border-white/5 bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)]' : isMono ? 'border-2 border-black bg-white text-black' : 'border-slate-200 bg-slate-50 text-slate-700';
                  if (dilemmaSubmitted) {
                    if (isCorrect) {
                      borderStyle = isMono ? 'border-2 border-black bg-neutral-200 text-black font-bold' : 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold';
                    } else if (isSelected && !isCorrect) {
                      borderStyle = isMono ? 'border-2 border-dashed border-black bg-neutral-100 text-black' : 'border-rose-500 bg-rose-50 text-rose-700';
                    }
                  } else if (isSelected) {
                    borderStyle = isDark 
                      ? 'border-[oklch(0.94_0.21_118)] bg-[oklch(0.94_0.21_118)]/10 text-white shadow-[0_0_15px_rgba(204,255,0,0.15)]' 
                      : isMono ? 'border-2 border-black bg-black text-white font-bold' : 'border-red-600 bg-red-50 text-red-900 shadow-xs';
                  }

                  return (
                    <div
                      key={optId}
                      onClick={() => !dilemmaSubmitted && setDilemmaSelectedIndex(oIdx)}
                      className={`p-4 rounded-2xl border transition cursor-pointer flex justify-between items-center ${borderStyle}`}
                    >
                      <span>{String.fromCharCode(65 + oIdx)} — <MathText text={opt.option_text} /></span>
                      {dilemmaSubmitted && isCorrect && <span className="font-bold">✓ CORRECT</span>}
                      {!dilemmaSubmitted && isSelected && <span className="font-bold">SELECTED</span>}
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center opacity-60">Fetching options...</div>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              onClick={() => setDilemmaSubmitted(true)}
              disabled={dilemmaSelectedIndex === null || dilemmaSubmitted}
              className={`px-6 py-3 font-mono text-xs uppercase tracking-wider font-extrabold rounded-full shadow-sm transition disabled:opacity-40 cursor-pointer ${
                isDark ? 'bg-[oklch(0.94_0.21_118)] hover:brightness-110 text-[oklch(0.16_0.03_265)]' : isMono ? 'bg-black text-white border-2 border-black hover:bg-neutral-800' : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              Submit Answer
            </button>
            {dilemmaSubmitted && (
              <button
                onClick={() => {
                  setDilemmaSubmitted(false);
                  setDilemmaSelectedIndex(null);
                }}
                className={`font-mono text-[10px] uppercase tracking-wider underline cursor-pointer opacity-70 hover:opacity-100`}
              >
                Reset
              </button>
            )}
          </div>
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

    const rawPassage = currentQ?.passages?.passage_text || currentQ?.passage_text;

    return (
      <div className={`flex flex-col flex-1 font-sans select-none relative min-h-screen exam-active-container transition-colors duration-200 ${
        isDark ? 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)]' : isMono ? 'bg-white text-black' : 'bg-slate-50 text-slate-900'
      }`}>
        <header className={`px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between border-b gap-4 transition-colors duration-200 ${
          isDark ? 'bg-[oklch(0.23_0.045_265)] text-white border-white/10' : isMono ? 'bg-white text-black border-b-2 border-black' : 'bg-white text-slate-900 border-slate-200 shadow-xs'
        }`}>
          <div>
            <span className={`font-mono text-[10px] uppercase tracking-[0.2em] font-bold block ${isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black underline' : 'text-red-600'}`}>Live Execution HUD</span>
            <h2 className="font-bold text-xs sm:text-sm font-mono tracking-wider">{testMode.toUpperCase()}</h2>
          </div>

          <div className="flex items-center gap-4 sm:gap-8">
            {mockTimingMode === 'strict' && activeSecTimeLeft !== undefined && (
              <div className={`text-right border-r pr-4 sm:pr-8 ${isDark ? 'border-white/10' : isMono ? 'border-black' : 'border-slate-200'}`}>
                <span className={`font-mono text-[10px] block uppercase tracking-widest font-bold ${isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black' : 'text-red-600'}`}>Module Clock</span>
                <span className={`text-sm sm:text-base font-mono font-bold ${isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black' : 'text-red-600'}`}>{formatTime(activeSecTimeLeft)}</span>
              </div>
            )}
            <div className="text-right">
              <span className={`font-mono text-[10px] block uppercase tracking-widest opacity-75`}>Total Countdown</span>
              <span className="text-sm sm:text-lg font-mono font-bold text-amber-500">{formatTime(timeLeft)}</span>
            </div>
            
            <button
              onClick={() => setIsPaletteOpen(!isPaletteOpen)}
              className={`lg:hidden font-mono text-xs font-bold px-4 py-2 rounded-full exam-nav-action ${
                isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)]' : isMono ? 'bg-black text-white border-2 border-black' : 'bg-red-600 text-white shadow-sm'
              }`}
            >
              {isPaletteOpen ? 'Close Grid' : 'Grid'}
            </button>

            <button
              onClick={() => setShowSubmitConfirm(true)}
              className={`${isMono ? 'bg-neutral-200 text-black border-2 border-black hover:bg-black hover:text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'} font-mono text-xs font-bold uppercase tracking-[0.15em] px-5 py-2.5 rounded-full shadow-sm transition cursor-pointer exam-nav-action`}
            >
              Submit Test
            </button>
          </div>
        </header>

        <div className={`px-4 sm:px-8 py-3 flex items-center gap-2 border-b overflow-x-auto font-mono text-xs transition-colors duration-200 ${
          isDark ? 'bg-[oklch(0.23_0.045_265)]/50 border-white/10' : isMono ? 'bg-neutral-50 border-b-2 border-black' : 'bg-slate-100 border-slate-200'
        }`}>
          <span className={`uppercase font-bold tracking-[0.15em] mr-2 shrink-0 opacity-75`}>Modules:</span>
          {sections.map((sec, idx) => {
            const secId = sec.section_id || sec.id;
            const isCurrent = activeSectionIndex === idx;
            return (
              <button
                key={secId}
                onClick={() => handleSelectSection(idx)}
                className={`px-4 py-2 rounded-full font-bold tracking-wider transition shrink-0 cursor-pointer exam-nav-action ${
                  isCurrent
                    ? (isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] shadow-[0_0_15px_rgba(204,255,0,0.2)]' : isMono ? 'bg-black text-white border-2 border-black' : 'bg-red-600 text-white shadow-sm')
                    : mockTimingMode === 'strict'
                    ? (isDark ? 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)] opacity-50 cursor-not-allowed border border-white/5' : isMono ? 'bg-neutral-200 text-neutral-500 border-2 border-black opacity-50 cursor-not-allowed' : 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed border border-slate-300')
                    : (isDark ? 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.68_0.04_265)] hover:text-white border border-white/5' : isMono ? 'bg-white text-black border-2 border-black hover:bg-neutral-100' : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-300 shadow-xs')
                }`}
              >
                {cleanText(sec.section_name).toUpperCase()} ({sectionQuestionsMap[secId]?.length || 0}) {mockTimingMode === 'strict' && !isCurrent && '🔒'}
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 relative overflow-hidden">
          <main className={`flex-1 flex flex-col border-r overflow-hidden w-full transition-colors duration-200 ${
            isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10' : isMono ? 'bg-white border-black' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className={`px-6 py-3.5 border-b flex items-center justify-between font-mono text-xs ${
              isDark ? 'bg-[oklch(0.23_0.045_265)]/30 border-white/10' : isMono ? 'bg-neutral-100 border-b-2 border-black' : 'bg-white border-slate-200'
            }`}>
              <span className="font-bold tracking-wider">
                {cleanText(sections[activeSectionIndex]?.section_name).toUpperCase()} {currentQ ? `> Q.${currentIndex + 1}` : ''}
              </span>
              <span className="uppercase tracking-widest opacity-70">Difficulty: {currentQ?.difficulty_level || 'Moderate'}</span>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto">
              
              {currentQ?.chart_data || currentQ?.table_data ? (
                <div className={`w-full lg:w-1/2 p-6 border-b lg:border-b-0 lg:border-r flex flex-col justify-center ${
                  isDark ? 'border-white/10 bg-[oklch(0.18_0.03_265)]' : isMono ? 'border-black bg-white' : 'border-slate-200 bg-white'
                }`}>
                  <h3 className={`font-mono text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black underline' : 'text-red-600'}`}>Data Interpretation</h3>
                  <h2 className="text-xl font-bold mb-4">{currentQ.title}</h2>
                  <DIChartRenderer 
                    chartType={currentQ.chart_type} 
                    categories={currentQ.chart_categories} 
                    data={currentQ.chart_data} 
                    tableData={currentQ.table_data}
                    theme={theme}
                  />
                </div>
              ) : rawPassage ? (
                <div className={`w-full lg:w-1/2 p-6 sm:p-10 space-y-6 overflow-y-auto ${isDark ? 'bg-[oklch(0.18_0.03_265)] text-slate-300 border-r border-white/10' : isMono ? 'bg-white text-black border-r-2 border-black' : 'bg-white text-slate-700 border-r border-slate-200'}`}>
                  <p className="leading-relaxed whitespace-pre-line font-sans"><MathText text={rawPassage} /></p>
                </div>
              ) : null}

              <div className={`w-full ${currentQ?.chart_data || rawPassage ? 'lg:w-1/2' : 'lg:w-full'} p-6 sm:p-10 space-y-6 overflow-y-auto ${isDark ? 'bg-[oklch(0.16_0.03_265)]' : isMono ? 'bg-white' : 'bg-slate-50'}`}>
                {!currentQ ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center font-mono text-xs my-auto">
                    <div className={`border p-6 rounded-3xl space-y-3 max-w-md mx-auto ${
                      isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10' : isMono ? 'bg-white border-2 border-black' : 'bg-white border-slate-200 shadow-sm'
                    }`}>
                      <p className="font-bold uppercase tracking-wider">No Questions Deployed</p>
                      <p className="leading-relaxed opacity-75">
                        There are no active questions loaded for <span className={isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black underline' : 'text-red-600'}>{cleanText(sections[activeSectionIndex]?.section_name)}</span>. Please check your database.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {currentQ?.image_url && (
                      <div className={`flex justify-center p-4 rounded-2xl border ${isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10' : isMono ? 'bg-white border-2 border-black' : 'bg-white border-slate-200 shadow-sm'}`}>
                        <img src={currentQ.image_url} alt="Question Graphic" className="max-h-64 object-contain rounded" />
                      </div>
                    )}

                    <div className="text-base sm:text-lg font-medium leading-relaxed font-sans">
                      <MathText text={currentQ?.question_text} />
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
                                ? (isDark 
                                    ? 'bg-[oklch(0.94_0.21_118)]/10 border-[oklch(0.94_0.21_118)] text-white shadow-[0_0_20px_rgba(204,255,0,0.15)] ring-1 ring-[oklch(0.94_0.21_118)]' 
                                    : isMono ? 'bg-black text-white border-2 border-black' : 'bg-red-50 border-red-600 text-slate-900 shadow-sm ring-1 ring-red-600')
                                : (isDark 
                                    ? 'bg-[oklch(0.23_0.045_265)]/50 border-white/10 text-[oklch(0.68_0.04_265)] hover:border-white/30 hover:text-white' 
                                    : isMono ? 'bg-white border-2 border-black text-black hover:bg-neutral-100' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 shadow-xs')
                            }`}
                          >
                            <span className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-xl font-mono text-xs font-bold border ${
                              isChecked 
                                ? (isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] border-[oklch(0.94_0.21_118)]' : isMono ? 'bg-white text-black border-2 border-black' : 'bg-red-600 text-white border-red-600') 
                                : (isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/20 text-white' : isMono ? 'bg-neutral-100 border-2 border-black text-black' : 'bg-slate-100 border-slate-300 text-slate-800')
                            }`}>
                              {String.fromCharCode(65 + oIndex)}
                            </span>
                            <span className="text-sm font-medium font-sans"><MathText text={opt.option_text} /></span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

            </div>

            <div className={`px-6 py-4 border-t flex flex-wrap items-center justify-between gap-4 font-mono ${
              isDark ? 'bg-[oklch(0.23_0.045_265)]/40 border-white/10' : isMono ? 'bg-neutral-100 border-t-2 border-black' : 'bg-white border-slate-200'
            }`}>
              <div className="flex gap-3">
                <button
                  onClick={handleMarkForReviewAndNext}
                  disabled={!currentQ}
                  className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-full border transition cursor-pointer disabled:opacity-40 exam-nav-action ${
                    isMono ? 'bg-white border-2 border-black text-black hover:bg-neutral-200' : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border-amber-500/30'
                  }`}
                >
                  Mark & Next
                </button>
                <button
                  onClick={handleClearResponse}
                  disabled={!currentQ}
                  className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-full border transition cursor-pointer disabled:opacity-40 exam-nav-action ${
                    isDark ? 'bg-[oklch(0.16_0.03_265)] hover:bg-[oklch(0.16_0.03_265)]/80 text-[oklch(0.68_0.04_265)] border-white/10' : isMono ? 'bg-white border-2 border-black text-black hover:bg-neutral-200' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-300 shadow-xs'
                  }`}
                >
                  Clear
                </button>
              </div>

              <button
                onClick={handleSaveAndNext}
                disabled={!currentQ}
                className={`px-6 py-2.5 text-xs font-extrabold uppercase tracking-[0.15em] rounded-full transition cursor-pointer disabled:opacity-40 exam-nav-action ${
                  isDark ? 'bg-[oklch(0.94_0.21_118)] hover:brightness-110 text-[oklch(0.16_0.03_265)] shadow-[0_0_15px_rgba(204,255,0,0.2)]' : isMono ? 'bg-black text-white border-2 border-black hover:bg-neutral-800' : 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                }`}
              >
                Save & Next →
              </button>
            </div>
          </main>

          <aside className={`absolute lg:relative top-0 right-0 h-full w-full sm:w-80 flex flex-col border-l z-40 transition-transform duration-300 ${isPaletteOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'} ${
            isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10' : isMono ? 'bg-white border-l-2 border-black' : 'bg-white border-slate-200 shadow-xl'
          }`}>
            <div className={`p-5 border-b ${isDark ? 'border-white/10 bg-[oklch(0.16_0.03_265)]/50' : isMono ? 'border-b-2 border-black bg-neutral-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex justify-between items-center mb-3">
                <h5 className="font-mono text-xs font-bold uppercase tracking-[0.15em] opacity-75">HUD Palette Summary</h5>
                <button onClick={() => setIsPaletteOpen(false)} className={`lg:hidden text-xs font-mono px-2 py-1 rounded exam-nav-action ${isDark ? 'text-white bg-white/10' : isMono ? 'border border-black bg-white' : 'text-slate-700 bg-slate-200'}`}>✕</button>
              </div>
              
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl font-semibold ${isMono ? 'border-2 border-black bg-white text-black' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>
                  <span>Answered</span>
                  <span className="font-bold">{paletteCounts.answered}</span>
                </div>
                <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl font-semibold ${isMono ? 'border-2 border-black bg-neutral-100 text-black' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'}`}>
                  <span>Unanswered</span>
                  <span className="font-bold">{paletteCounts.notAnswered}</span>
                </div>
                <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl font-semibold ${
                  isDark ? 'bg-[oklch(0.94_0.21_118)]/10 border border-[oklch(0.94_0.21_118)]/20 text-[oklch(0.94_0.21_118)]' : isMono ? 'border-2 border-black bg-neutral-200 text-black' : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  <span>Marked</span>
                  <span className="font-bold">{paletteCounts.marked}</span>
                </div>
                <div className={`flex items-center justify-between border px-2.5 py-1.5 rounded-xl font-semibold ${
                  isDark ? 'bg-white/5 border-white/10 text-[oklch(0.68_0.04_265)]' : isMono ? 'border-2 border-black bg-white text-black' : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}>
                  <span>Unvisited</span>
                  <span className="font-bold">{paletteCounts.notVisited}</span>
                </div>
              </div>
            </div>

            <div className="p-5 flex-1 overflow-y-auto">
              <h5 className="font-mono text-xs font-bold uppercase tracking-[0.15em] mb-3 opacity-75">
                Question Navigator
              </h5>
              {currentQList.length === 0 ? (
                <p className="text-xs font-mono italic opacity-60">No items in this module.</p>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {currentQList.map((q, idx) => (
                    <button
                      key={q.question_id}
                      onClick={() => handleSelectQuestion(idx)}
                      className={`h-11 rounded-xl font-mono font-bold text-xs shadow transition cursor-pointer exam-nav-action ${getQuestionPaletteStyle(q.question_id)} ${
                        currentIndex === idx ? (isDark ? 'ring-2 ring-[oklch(0.94_0.21_118)] ring-offset-2 ring-offset-[oklch(0.23_0.045_265)]' : isMono ? 'ring-2 ring-black ring-offset-2 ring-offset-white' : 'ring-2 ring-red-600 ring-offset-2 ring-offset-white') : ''
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>

        {showSubmitConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className={`border rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl font-mono ${
              isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/15 text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-white border-slate-200 text-slate-900 shadow-xl'
            }`}>
              <div className="text-center space-y-2">
                <h3 className={`text-xl font-black tracking-tight ${isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black underline' : 'text-red-600'}`}>CONFIRM SUBMISSION</h3>
                <p className="text-xs uppercase tracking-wider opacity-70">Final lock-in of your answers.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowSubmitConfirm(false)}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-full border transition cursor-pointer ${
                    isDark ? 'bg-[oklch(0.16_0.03_265)] hover:bg-[oklch(0.16_0.03_265)]/80 border-white/10 text-white' : isMono ? 'bg-white border-2 border-black text-black hover:bg-neutral-100' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  }`}
                >
                  Resume
                </button>
                <button
                  onClick={() => {
                    setShowSubmitConfirm(false);
                    handleSubmitTest();
                  }}
                  className={`flex-1 py-3 ${isMono ? 'bg-black text-white border-2 border-black hover:bg-neutral-800' : 'bg-rose-600 hover:bg-rose-700 text-white'} text-xs font-bold uppercase tracking-widest rounded-full shadow-sm transition cursor-pointer`}
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
      <div className={`flex-1 p-6 sm:p-12 flex flex-col items-center overflow-y-auto font-sans transition-colors duration-200 ${
        isDark ? 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)]' : isMono ? 'bg-white text-black' : 'bg-slate-50 text-slate-900'
      }`}>
        <div className="w-full max-w-4xl space-y-8">
          
          <div className={`border rounded-3xl p-8 shadow-sm text-center space-y-6 backdrop-blur-xl transition-colors duration-200 ${
            isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10 text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-white border-slate-200 shadow-xl'
          }`}>
            <div className={`inline-flex px-4 py-1 rounded-full border font-mono text-xs uppercase tracking-[0.2em] font-bold ${
              isDark ? 'bg-[oklch(0.94_0.21_118)]/10 border-[oklch(0.94_0.21_118)]/30 text-[oklch(0.94_0.21_118)]' : isMono ? 'bg-neutral-100 border-2 border-black text-black' : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              Mission Debrief
            </div>
            <h2 className="text-3xl font-black tracking-tight">ASSESSMENT PERFORMANCE HUD</h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 font-mono">
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/5' : isMono ? 'bg-white border-2 border-black' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] block uppercase tracking-widest font-bold opacity-70">Total Items</span>
                <span className="text-xl font-black">{attemptResult.totalQuestions}</span>
              </div>
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/5' : isMono ? 'bg-white border-2 border-black' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] block uppercase tracking-widest font-bold opacity-70">Attempted</span>
                <span className="text-xl font-black text-amber-500">{attemptResult.attempted}</span>
              </div>
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/5' : isMono ? 'bg-white border-2 border-black' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] block uppercase tracking-widest font-bold opacity-70">Accuracy</span>
                <span className={`text-xl font-black ${isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black underline' : 'text-red-600'}`}>{attemptResult.accuracy}%</span>
              </div>
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/5' : isMono ? 'bg-white border-2 border-black' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] block uppercase tracking-widest font-bold opacity-70">Final Score</span>
                <span className="text-xl font-black text-emerald-500">{attemptResult.score}</span>
              </div>
            </div>
          </div>

          <div className={`border rounded-3xl p-8 shadow-sm space-y-6 transition-colors duration-200 ${
            isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10 text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-white border-slate-200 shadow-xl'
          }`}>
            <h3 className={`font-mono text-xs font-bold uppercase tracking-[0.2em] border-b pb-3 ${
              isDark ? 'text-[oklch(0.94_0.21_118)] border-white/10' : isMono ? 'border-black text-black' : 'text-red-600 border-slate-200'
            }`}>Module-wise Precision & Weak Zones</h3>

            <div className="space-y-4 font-mono">
              {sectionStats.map((stat, idx) => {
                const isWeak = stat.accuracy < 50 && stat.total > 0;
                return (
                  <div key={idx} className={`border rounded-2xl p-5 space-y-3 ${
                    isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/5' : isMono ? 'bg-neutral-50 border-2 border-black' : 'bg-slate-50 border-slate-200 shadow-xs'
                  }`}>
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm">{cleanText(stat.name).toUpperCase()}</span>
                        {isWeak ? (
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-widest ${isMono ? 'bg-neutral-200 border border-black text-black' : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'}`}>
                            ⚠️ WEAK ZONE
                          </span>
                        ) : (
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-widest ${isMono ? 'bg-neutral-200 border border-black text-black' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'}`}>
                            ✅ LOCKED IN
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-bold ${isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black' : 'text-red-600'}`}>{stat.accuracy}% PRECISION</span>
                    </div>

                    <div className={`h-2.5 rounded-full overflow-hidden flex border ${
                      isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10' : isMono ? 'bg-neutral-200 border-2 border-black' : 'bg-slate-200 border-slate-300'
                    }`}>
                      <div style={{ width: `${stat.total ? (stat.correct / stat.total) * 100 : 0}%` }} className={isMono ? 'bg-black' : 'bg-emerald-500'}></div>
                      <div style={{ width: `${stat.total ? (stat.incorrect / stat.total) * 100 : 0}%` }} className={isMono ? 'bg-neutral-400' : 'bg-rose-500'}></div>
                      <div style={{ width: `${stat.total ? (stat.unattempted / stat.total) * 100 : 0}%` }} className={isDark ? 'bg-white/20' : isMono ? 'bg-neutral-100' : 'bg-slate-400'}></div>
                    </div>

                    <div className="flex flex-wrap justify-between text-[11px] pt-1 opacity-75">
                      <span className="font-semibold">Correct: {stat.correct}</span>
                      <span className="font-semibold">Incorrect: {stat.incorrect}</span>
                      <span>Unattempted: {stat.unattempted}</span>
                      <span className={isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black font-bold' : 'text-red-600'}>Time: {Math.floor(stat.totalTime / 60)}m {stat.totalTime % 60}s</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
            <button
              onClick={() => setStage('solutions')}
              className={`py-4 border font-bold uppercase tracking-[0.15em] rounded-2xl transition cursor-pointer shadow-lg ${
                isDark ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' : isMono ? 'bg-white border-2 border-black text-black hover:bg-neutral-100' : 'bg-red-50 hover:bg-red-100 border border-red-200 text-red-700'
              }`}
            >
              📖 View Solutions
            </button>
            <button
              onClick={() => setStage('swot')}
              className={`py-4 border font-bold uppercase tracking-[0.15em] rounded-2xl transition cursor-pointer shadow-lg ${
                isDark ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20' : isMono ? 'bg-neutral-100 border-2 border-black text-black hover:bg-neutral-200' : 'bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700'
              }`}
            >
              📊 SWOT Analysis
            </button>
            <button
              onClick={() => setStage('config')}
              className={`py-4 border font-bold uppercase tracking-[0.15em] rounded-2xl transition cursor-pointer shadow-lg ${
                isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10 text-white hover:bg-[oklch(0.23_0.045_265)]/80' : isMono ? 'bg-black border-2 border-black text-white hover:bg-neutral-800' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
            >
              🏠 Main HUD
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'solutions') {
    const allQs = Object.values(sectionQuestionsMap).flat();

    return (
      <div className={`flex-1 p-6 sm:p-12 flex flex-col items-center overflow-y-auto font-sans transition-colors duration-200 ${
        isDark ? 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)]' : isMono ? 'bg-white text-black' : 'bg-slate-50 text-slate-900'
      }`}>
        <div className="w-full max-w-4xl space-y-6">
          <div className={`border p-6 rounded-3xl shadow-sm flex justify-between items-center ${
            isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10 text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-white border-slate-200 shadow-md'
          }`}>
            <h2 className={`text-xl font-black tracking-tight ${isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black underline' : 'text-red-600'}`}>DETAILED SOLUTIONS</h2>
            <button
              onClick={() => setStage('result')}
              className={`px-4 py-2 border font-mono text-xs uppercase tracking-wider font-bold rounded-full transition cursor-pointer ${
                isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10 hover:bg-[oklch(0.16_0.03_265)]/80 text-white' : isMono ? 'bg-white border-2 border-black text-black hover:bg-neutral-100' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-700'
              }`}
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
                <div key={q.question_id} className={`border rounded-3xl p-6 sm:p-8 shadow-sm space-y-4 ${
                  isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10 text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-white border-slate-200 shadow-md'
                }`}>
                  <div className={`flex justify-between items-center border-b pb-4 font-mono text-xs flex-wrap gap-2 ${isDark ? 'border-white/10' : isMono ? 'border-black' : 'border-slate-200'}`}>
                    <div className="flex items-center gap-3">
                      <span className="font-bold">Q.No. {idx + 1}</span>
                      <span className={`px-3 py-1 rounded-full border ${isDark ? 'text-[oklch(0.94_0.21_118)] bg-[oklch(0.16_0.03_265)] border-white/10' : isMono ? 'bg-neutral-100 border-2 border-black text-black' : 'text-red-600 bg-red-50 border-red-200'}`}>
                        ⏱ {timeSpentSecs}s
                      </span>
                    </div>
                    <span className={`font-bold px-3 py-1 rounded-full uppercase tracking-wider text-[11px] ${
                      !studentAnswerId 
                        ? (isDark ? 'bg-white/5 opacity-60' : isMono ? 'border border-black bg-neutral-100 text-black' : 'bg-slate-100 text-slate-500 border border-slate-200') 
                        : isCorrect 
                          ? (isMono ? 'border border-black bg-neutral-200 text-black' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30') 
                          : (isMono ? 'border border-dashed border-black bg-neutral-100 text-black' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30')
                    }`}>
                      {!studentAnswerId ? 'Unattempted' : isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>

                  <p className="text-base font-medium font-sans"><MathText text={q.question_text} /></p>

                  <div className="space-y-2 font-mono text-xs">
                    {q.question_options?.map((opt, oIndex) => {
                      const optId = opt.option_id || opt.id;
                      const isStudentChoice = studentAnswerId === optId;
                      const isRightChoice = opt.is_correct;

                      let badgeStyle = isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/5 opacity-70' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-slate-50 border-slate-200 text-slate-600';
                      if (isRightChoice) badgeStyle = isMono ? 'bg-neutral-200 border-2 border-black text-black font-bold' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold';
                      else if (isStudentChoice && !isRightChoice) badgeStyle = isMono ? 'bg-neutral-100 border-2 border-dashed border-black text-black' : 'bg-rose-500/10 border-rose-500/30 text-rose-400 font-semibold';

                      return (
                        <div key={optId} className={`p-4 rounded-2xl border flex items-center justify-between ${badgeStyle}`}>
                          <span>({String.fromCharCode(65 + oIndex)}) <MathText text={opt.option_text} /></span>
                          <span className="font-bold tracking-wider">
                            {isStudentChoice && '[YOUR PICK] '}
                            {isRightChoice && '[CORRECT]'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {q.solution_explanation && (
                    <div className={`p-4 rounded-2xl border font-mono text-xs space-y-1 ${isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10' : isMono ? 'bg-neutral-50 border-2 border-black' : 'bg-slate-50 border-slate-200'}`}>
                      <span className={`font-bold uppercase tracking-wider block ${isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black underline' : 'text-red-600'}`}>Solution Breakdown:</span>
                      <p className={`font-sans leading-relaxed opacity-90`}><MathText text={q.solution_explanation} /></p>
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
      <div className={`flex-1 p-6 sm:p-12 flex flex-col items-center font-sans transition-colors duration-200 ${
        isDark ? 'bg-[oklch(0.16_0.03_265)] text-[oklch(0.96_0.012_265)]' : isMono ? 'bg-white text-black' : 'bg-slate-50 text-slate-900'
      }`}>
        <div className={`border rounded-3xl p-8 shadow-sm w-full max-w-2xl space-y-6 ${
          isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10 text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-white border-slate-200 shadow-xl'
        }`}>
          <div className={`flex justify-between items-center border-b pb-4 ${isDark ? 'border-white/10' : isMono ? 'border-black' : 'border-slate-200'}`}>
            <h2 className={`text-xl font-black tracking-tight ${isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black underline' : 'text-red-600'}`}>SWOT ANALYTICS REPORT</h2>
            <button
              onClick={() => setStage('result')}
              className={`px-4 py-2 border font-mono text-xs uppercase tracking-wider font-bold rounded-full transition cursor-pointer ${
                isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10 hover:bg-[oklch(0.16_0.03_265)]/80 text-white' : isMono ? 'bg-white border-2 border-black text-black hover:bg-neutral-100' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-700'
              }`}
            >
              ← Back
            </button>
          </div>

          <div className="space-y-4 font-mono text-xs">
            <div className={`p-5 rounded-2xl border space-y-1 ${isMono ? 'border-2 border-black bg-neutral-50 text-black' : 'bg-emerald-500/15 border-emerald-500/30'}`}>
              <h3 className="font-bold uppercase tracking-widest">💪 Strengths</h3>
              <p className="font-sans opacity-90">High command over core reasoning and quantitative modules.</p>
            </div>

            <div className={`p-5 rounded-2xl border space-y-1 ${isMono ? 'border-2 border-black bg-neutral-100 text-black' : 'bg-amber-500/15 border-amber-500/30'}`}>
              <h3 className="font-bold uppercase tracking-widest">⚠️ Weaknesses</h3>
              <p className="font-sans opacity-90">Calculation-heavy items required excessive time allocations.</p>
            </div>

            <div className={`p-5 rounded-2xl border space-y-1 ${isMono ? 'border-2 border-black bg-neutral-50 text-black' : 'bg-blue-500/15 border-blue-500/30'}`}>
              <h3 className="font-bold uppercase tracking-widest">🎯 Opportunities</h3>
              <p className="font-sans opacity-90">Improve reading comprehension pacing to secure quick points.</p>
            </div>

            <div className={`p-5 rounded-2xl border space-y-1 ${isMono ? 'border-2 border-black bg-neutral-100 text-black' : 'bg-rose-500/15 border-rose-500/30'}`}>
              <h3 className="font-bold uppercase tracking-widest">🚨 Threats</h3>
              <p className="font-sans opacity-90">Negative marking exposure from uncalculated guesswork.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
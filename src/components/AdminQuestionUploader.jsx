import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase (Use your actual URL and public/publishable key)
const supabaseUrl = 'https://wbcdiewohpngqbeqrfmb.supabase.co';
const supabaseAnonKey = 'sb_publishable_d21wos13j9x7K-w1h8vsw_0gPm_j1y'; 
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AdminQuestionUploader() {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [questionText, setQuestionText] = useState('');
  
  // 4 Options state and tracking which one is correct (index 0 to 3)
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch available sections on load
  useEffect(() => {
    async function fetchSections() {
      const { data, error } = await supabase.from('sections').select('*');
      if (error) console.error('Error fetching sections:', error);
      else if (data && data.length > 0) {
        setSections(data);
        setSelectedSection(data[0].id);
      }
    }
    fetchSections();
  }, []);

  // Handle saving the question and its options to Supabase
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!questionText.trim() || !selectedSection) {
      setMessage('Please enter question text and select a section.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // 1. Insert the question into the 'questions' table
      const { data: qData, error: qError } = await supabase
        .from('questions')
        .insert([
          {
            section_id: selectedSection,
            type: 'standalone',
            question_text: questionText,
          },
        ])
        .select()
        .single();

      if (qError) throw qError;

      // 2. Prepare and insert the 4 options linked to the new question's ID
      const optionRows = options.map((optText, index) => ({
        question_id: qData.id,
        option_text: optText,
        is_correct: index === Number(correctIndex),
      }));

      const { error: optError } = await supabase.from('options').insert(optionRows);
      if (optError) throw optError;

      setMessage('Success! Question and options saved to Supabase.');
      // Reset form fields
      setQuestionText('');
      setOptions(['', '', '', '']);
      setCorrectIndex(0);
    } catch (err) {
      console.error(err);
      setMessage('Error saving question: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 flex justify-center items-center">
      <div className="w-full max-w-xl bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
        <h2 className="text-2xl font-bold text-teal-400 mb-4">Admin: Add Exam Question</h2>

        {message && (
          <div className={`p-3 mb-4 rounded text-sm ${message.includes('Success') ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700' : 'bg-rose-900/50 text-rose-300 border border-rose-700'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Target Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-teal-500"
            >
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name}
                </option>
              ))}
            </select>
          </div>

          {/* Question Text */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Question Text</label>
            <textarea
              rows="3"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Type or paste the exam question here..."
              className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Options Inputs & Radio Selection for Correct Answer */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">Options (Select the radio button for the correct answer)</label>
            {options.map((opt, index) => (
              <div key={index} className="flex items-center space-x-3 bg-slate-900/60 p-2 rounded border border-slate-800">
                <input
                  type="radio"
                  name="correctOption"
                  checked={correctIndex === index}
                  onChange={() => setCorrectIndex(index)}
                  className="w-4 h-4 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-400 w-6">Option {index + 1}</span>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const newOpts = [...options];
                    newOpts[index] = e.target.value;
                    setOptions(newOpts);
                  }}
                  placeholder={`Enter option ${index + 1} text`}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200 text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
            ))}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg shadow transition disabled:opacity-50 mt-4 cursor-pointer"
          >
            {loading ? 'Saving to Database...' : 'Save Question to Supabase'}
          </button>
        </form>
      </div>
    </div>
  );
}
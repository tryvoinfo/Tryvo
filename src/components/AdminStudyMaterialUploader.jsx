import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const cleanText = (text) => {
  if (!text) return '';
  return String(text).replace(/â€“/g, '–').replace(/â€”/g, '—').replace(/â€™/g, "'");
};

export default function AdminStudyMaterialUploader({ theme = 'dark' }) {
  const [exams, setExams] = useState([]);
  const [existingMaterials, setExistingMaterials] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const isDark = theme === 'dark';
  const isMono = theme === 'light-mono';

  const fetchData = async () => {
    const { data: examData } = await supabase.from('exams').select('*');
    if (examData && examData.length > 0) {
      setExams(examData);
      setSelectedExamId(examData[0].exam_id || examData[0].id);
    }

    const { data: matData } = await supabase.from('study_materials').select('*').order('created_at', { ascending: false });
    setExistingMaterials(matData || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileChange = (e) => {
    const uploaded = e.target.files[0];
    if (!uploaded) return;
    
    const fileExt = uploaded.name.split('.').pop().toLowerCase();
    if (fileExt !== 'pdf' && fileExt !== 'docx') {
      alert('Only PDF and DOCX files are allowed.');
      e.target.value = null;
      return;
    }
    setFile(uploaded);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !selectedExamId || !title) {
      alert('Please fill in all required fields and select a file.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const fileExt = file.name.split('.').pop().toLowerCase();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `${selectedExamId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('study_materials')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicURLData } = supabase.storage
        .from('study_materials')
        .getPublicUrl(filePath);

      const fileUrl = publicURLData.publicUrl;

      const { error: dbError } = await supabase.from('study_materials').insert([
        {
          exam_id: selectedExamId,
          title: title.trim(),
          description: description.trim(),
          file_url: fileUrl,
          file_type: fileExt
        }
      ]);

      if (dbError) throw dbError;

      setMessage(`✅ Study material "${title}" uploaded and deployed successfully!`);
      setTitle('');
      setDescription('');
      setFile(null);
      const fileInput = document.getElementById('study-file-input');
      if (fileInput) fileInput.value = '';
      fetchData();
    } catch (err) {
      console.error('Error uploading study material:', err);
      setMessage('❌ Upload failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (materialId, fileUrl) => {
    if (!window.confirm('Are you sure you want to delete this study material?')) return;

    try {
      // Delete from database
      const { error } = await supabase
        .from('study_materials')
        .delete()
        .eq('material_id', materialId);

      if (error) throw error;

      setMessage('🗑️ Study material deleted successfully.');
      fetchData();
    } catch (err) {
      console.error('Error deleting material:', err);
      alert('Failed to delete material: ' + err.message);
    }
  };

  return (
    <div className={`p-8 max-w-4xl mx-auto space-y-12 font-sans ${isDark ? 'text-white' : isMono ? 'text-black' : 'text-slate-900'}`}>
      {/* Upload Card */}
      <div className={`border p-8 rounded-3xl shadow-xl ${
        isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10' : isMono ? 'bg-white border-2 border-black' : 'bg-white border-slate-200'
      }`}>
        <h2 className={`text-2xl font-black mb-1 ${isDark ? 'text-[oklch(0.94_0.21_118)]' : isMono ? 'text-black underline' : 'text-indigo-600'}`}>
          📚 Upload Secure Study Material
        </h2>
        <p className="font-mono text-xs uppercase opacity-75 mb-6">Attach encrypted PDF or DOCX documents to specific exam repositories.</p>

        {message && (
          <div className={`p-4 mb-6 rounded-2xl font-mono text-xs text-center border ${
            message.includes('✅') || message.includes('🗑️') ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-6 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block uppercase tracking-[0.15em] mb-2 font-semibold opacity-85">Target Exam Blueprint</label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className={`w-full border rounded-xl p-3.5 text-sm focus:outline-none cursor-pointer ${
                  isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-slate-50 border-slate-300'
                }`}
              >
                {exams.map((ex) => (
                  <option key={ex.exam_id || ex.id} value={ex.exam_id || ex.id}>
                    {cleanText(ex.exam_name || ex.name)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block uppercase tracking-[0.15em] mb-2 font-semibold opacity-85">Document Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Advanced Algebra Quick Notes"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`w-full border rounded-xl p-3.5 text-sm focus:outline-none ${
                  isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block uppercase tracking-[0.15em] mb-2 font-semibold opacity-85">Short Description / Overview</label>
            <textarea
              rows="3"
              placeholder="Briefly describe what students will learn from this document..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full border rounded-xl p-3.5 text-sm focus:outline-none ${
                isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-slate-50 border-slate-300'
              }`}
            />
          </div>

          <div>
            <label className="block uppercase tracking-[0.15em] mb-2 font-semibold opacity-85">Upload Document (.pdf or .docx)</label>
            <input
              id="study-file-input"
              type="file"
              accept=".pdf,.docx"
              required
              onChange={handleFileChange}
              className={`w-full border rounded-xl p-3.5 text-sm focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-bold file:bg-[oklch(0.94_0.21_118)] file:text-[oklch(0.16_0.03_265)] cursor-pointer ${
                isDark ? 'bg-[oklch(0.16_0.03_265)] border-white/10 text-white' : isMono ? 'bg-white border-2 border-black text-black' : 'bg-slate-50 border-slate-300'
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 font-extrabold uppercase tracking-[0.15em] rounded-2xl transition cursor-pointer shadow-sm disabled:opacity-50 ${
              isDark ? 'bg-[oklch(0.94_0.21_118)] text-[oklch(0.16_0.03_265)] hover:brightness-110' : isMono ? 'bg-black text-white border-2 border-black' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {loading ? 'UPLOADING TO SECURE VAULT...' : 'PUBLISH STUDY MATERIAL →'}
          </button>
        </form>
      </div>

      {/* Existing Materials Management List */}
      <div className={`border p-8 rounded-3xl shadow-xl ${
        isDark ? 'bg-[oklch(0.23_0.045_265)] border-white/10' : isMono ? 'bg-white border-2 border-black' : 'bg-white border-slate-200'
      }`}>
        <h3 className="text-xl font-black mb-4">Manage Deployed Study Materials ({existingMaterials.length})</h3>
        
        {existingMaterials.length === 0 ? (
          <p className="font-mono text-xs opacity-60">No study materials currently in repository.</p>
        ) : (
          <div className="space-y-3">
            {existingMaterials.map((mat) => (
              <div key={mat.material_id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-2xl bg-black/20 border border-white/5 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded">
                      {mat.exam_id}
                    </span>
                    <span className="font-mono text-[10px] opacity-60 uppercase">{mat.file_type}</span>
                  </div>
                  <h4 className="font-bold text-sm">{cleanText(mat.title)}</h4>
                </div>
                <button
                  onClick={() => handleDelete(mat.material_id, mat.file_url)}
                  className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono text-xs font-bold rounded-xl transition cursor-pointer shrink-0"
                >
                  🗑️ Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
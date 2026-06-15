import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { adminQuizApi } from '../../api/adminQuizApi.js';
import '../../components/quiz/quizStyles.css';

const QUESTION_TYPES = [
  { value: 'single_choice', label: 'Single Choice' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True/False' },
];

function emptyQuestion() {
  return {
    questionText: '',
    questionType: 'single_choice',
    options: [{ value: 'A', label: '' }, { value: 'B', label: '' }],
    correctAnswer: '',
    explanation: '',
    points: 1,
  };
}

export default function AdminQuizEditPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const isNew = quizId === 'new';

  const [quiz, setQuiz] = useState({
    title: '', description: '', courseId: '', lessonId: '',
    timeLimitMinutes: '', passingScore: 70, status: 'draft',
  });
  const [questions, setQuestions] = useState([]);
  const [questionForm, setQuestionForm] = useState(emptyQuestion());
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [showImport, setShowImport] = useState(false);

  // Load quiz data
  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    (async () => {
      try {
        const [quizRes, questionsRes] = await Promise.all([
          adminQuizApi.getQuiz(quizId),
          adminQuizApi.listQuestions(quizId),
        ]);
        if (quizRes.data) {
          const q = quizRes.data;
          setQuiz({
            title: q.title || '',
            description: q.description || '',
            courseId: q.courseId || '',
            lessonId: q.lessonId || '',
            timeLimitMinutes: q.timeLimitMinutes !== null ? String(q.timeLimitMinutes) : '',
            passingScore: q.passingScore || 70,
            status: q.status || 'draft',
          });
        }
        setQuestions(questionsRes.data?.questions || []);
      } catch (err) {
        toast.error(err.message || 'Failed to load quiz.');
        navigate('/admin/quizzes');
      } finally {
        setLoading(false);
      }
    })();
  }, [quizId, isNew, navigate]);

  const handleQuizSave = async () => {
    if (!quiz.title.trim() || !quiz.courseId.trim()) {
      toast.error('Title and Course ID are required.');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await adminQuizApi.createQuiz(quiz);
        toast.success('Quiz created.');
        navigate('/admin/quizzes');
      } else {
        await adminQuizApi.updateQuiz(quizId, quiz);
        toast.success('Quiz updated.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save quiz.');
    } finally {
      setSaving(false);
    }
  };

  // Question CRUD
  const handleQuestionSave = async (saveAndNew = false) => {
    if (!questionForm.questionText.trim()) {
      toast.error('Question text is required.');
      return;
    }
    const data = {
      questionText: questionForm.questionText,
      questionType: questionForm.questionType,
      options: questionForm.options.filter((o) => o.label.trim()),
      correctAnswer: questionForm.correctAnswer,
      explanation: questionForm.explanation || null,
      points: parseInt(questionForm.points, 10) || 1,
    };
    if (data.options.length < 2 && data.questionType !== 'true_false') {
      toast.error('At least 2 options are required.');
      return;
    }
    setSaving(true);
    try {
      const targetQuizId = isNew ? quizId : quizId;
      if (editingQuestionId) {
        await adminQuizApi.updateQuestion(targetQuizId, editingQuestionId, data);
        toast.success('Question updated.');
      } else {
        await adminQuizApi.createQuestion(targetQuizId, data);
        toast.success('Question created.');
      }
      // Reload questions
      const res = await adminQuizApi.listQuestions(targetQuizId);
      setQuestions(res.data?.questions || []);
      if (saveAndNew) {
        setQuestionForm(emptyQuestion());
        setEditingQuestionId(null);
      } else {
        setQuestionForm(emptyQuestion());
        setEditingQuestionId(null);
        setShowQuestionForm(false);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save question.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditQuestion = (q) => {
    setQuestionForm({
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || '',
      points: q.points,
    });
    setEditingQuestionId(q.id);
    setShowQuestionForm(true);
  };

  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm('Are you sure you want to delete this question? This cannot be undone.')) return;
    try {
      await adminQuizApi.deleteQuestion(quizId, qId);
      toast.success('Question deleted.');
      const res = await adminQuizApi.listQuestions(quizId);
      setQuestions(res.data?.questions || []);
    } catch (err) {
      toast.error(err.message || 'Failed to delete question.');
    }
  };

  const handleBulkImport = async () => {
    if (!importJson.trim()) {
      toast.error('Please enter JSON data.');
      return;
    }
    let questions;
    try {
      questions = JSON.parse(importJson);
      if (!Array.isArray(questions)) throw new Error('Must be an array.');
    } catch (err) {
      toast.error('Invalid JSON: ' + err.message);
      return;
    }
    setSaving(true);
    try {
      const res = await adminQuizApi.bulkImportQuestions(quizId, questions);
      if (res.data?.errors?.length > 0) {
        toast.warning(`${res.data.created} imported, ${res.data.errors.length} errors.`);
      } else {
        toast.success(`${res.data.created} questions imported.`);
      }
      const qRes = await adminQuizApi.listQuestions(quizId);
      setQuestions(qRes.data?.questions || []);
      setImportJson('');
      setShowImport(false);
    } catch (err) {
      toast.error(err.message || 'Import failed.');
    } finally {
      setSaving(false);
    }
  };

  const addOption = () => {
    const nextChar = String.fromCharCode(65 + questionForm.options.length);
    setQuestionForm({ ...questionForm, options: [...questionForm.options, { value: nextChar, label: '' }] });
  };

  const removeOption = (idx) => {
    if (questionForm.options.length <= 2) return;
    const opts = questionForm.options.filter((_, i) => i !== idx);
    setQuestionForm({ ...questionForm, options: opts });
  };

  const updateOption = (idx, field, value) => {
    const opts = [...questionForm.options];
    opts[idx] = { ...opts[idx], [field]: value };
    setQuestionForm({ ...questionForm, options: opts });
  };

  const resetQuestionForm = () => {
    setQuestionForm(emptyQuestion());
    setEditingQuestionId(null);
    setShowQuestionForm(true);
  };

  if (loading) return <div className="quiz-loading"><p>Loading...</p></div>;

  return (
    <div className="quiz-list-shell" style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h3 style={{ margin: 0 }}>{isNew ? 'Create Quiz' : 'Edit Quiz'}</h3>
        <button className="nav-btn nav-btn-prev" onClick={() => navigate('/admin/quizzes')}>
          ← Back to List
        </button>
      </div>

      {/* Quiz Form */}
      <div className="question-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#292827' }}>Title *</label>
            <input value={quiz.title} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1.5px solid #e8e4dd', fontSize: 15 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#292827' }}>Course ID *</label>
            <input value={quiz.courseId} onChange={(e) => setQuiz({ ...quiz, courseId: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1.5px solid #e8e4dd', fontSize: 15 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#292827' }}>Lesson ID</label>
            <input value={quiz.lessonId} onChange={(e) => setQuiz({ ...quiz, lessonId: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1.5px solid #e8e4dd', fontSize: 15 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#292827' }}>Description</label>
            <textarea value={quiz.description} onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1.5px solid #e8e4dd', fontSize: 15, minHeight: 60, resize: 'vertical' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#292827' }}>Time Limit (minutes, empty = no limit)</label>
            <input type="number" min="0" value={quiz.timeLimitMinutes} onChange={(e) => setQuiz({ ...quiz, timeLimitMinutes: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1.5px solid #e8e4dd', fontSize: 15 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#292827' }}>Passing Score (%)</label>
            <input type="number" min="0" max="100" value={quiz.passingScore} onChange={(e) => setQuiz({ ...quiz, passingScore: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1.5px solid #e8e4dd', fontSize: 15 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#292827' }}>Status</label>
            <select value={quiz.status} onChange={(e) => setQuiz({ ...quiz, status: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1.5px solid #e8e4dd', fontSize: 15 }}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>
        <button className="nav-btn nav-btn-next" onClick={handleQuizSave} disabled={saving} style={{ marginTop: 16 }}>
          {saving ? 'Saving...' : isNew ? 'Create Quiz' : 'Save Changes'}
        </button>
      </div>

      {/* Questions Section (only for existing quizzes) */}
      {!isNew && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 16px' }}>
            <h4 style={{ margin: 0, fontSize: 20, fontWeight: 540, color: '#292827' }}>
              Questions ({questions.length})
            </h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="nav-btn nav-btn-prev" onClick={() => setShowImport(!showImport)}>
                {showImport ? 'Close Import' : '📥 Import JSON'}
              </button>
              <button className="nav-btn nav-btn-next" onClick={resetQuestionForm}>
                + Add Question
              </button>
            </div>
          </div>

          {/* Bulk Import */}
          {showImport && (
            <div className="question-card">
              <h5 style={{ marginBottom: 12 }}>Bulk Import Questions (JSON)</h5>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder={`[\n  {\n    "questionText": "What is...?",\n    "questionType": "single_choice",\n    "options": [{"value":"A","label":"Option 1"},{"value":"B","label":"Option 2"}],\n    "correctAnswer": "A",\n    "explanation": "...",\n    "points": 1\n  }\n]`}
                style={{ width: '100%', minHeight: 150, padding: 12, borderRadius: 6, border: '1.5px solid #e8e4dd', fontSize: 14, fontFamily: 'monospace' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="nav-btn nav-btn-next" onClick={handleBulkImport} disabled={saving}>
                  {saving ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          )}

          {/* Question Form */}
          {showQuestionForm && (
            <div className="question-card" style={{ borderLeft: '4px solid #14312f' }}>
              <h5 style={{ marginBottom: 16 }}>
                {editingQuestionId ? 'Edit Question' : 'Create Question'}
              </h5>

              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#292827' }}>Question Type</label>
                  <select value={questionForm.questionType}
                    onChange={(e) => {
                      const type = e.target.value;
                      let opts = questionForm.options;
                      if (type === 'true_false') {
                        opts = [{ value: true, label: 'True' }, { value: false, label: 'False' }];
                      } else if (questionForm.questionType === 'true_false' && type !== 'true_false') {
                        opts = [{ value: 'A', label: '' }, { value: 'B', label: '' }];
                      }
                      setQuestionForm({ ...questionForm, questionType: type, options: opts, correctAnswer: type === 'multiple_choice' ? [] : '' });
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1.5px solid #e8e4dd', fontSize: 15 }}
                  >
                    {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#292827' }}>Question Text *</label>
                  <textarea value={questionForm.questionText}
                    onChange={(e) => setQuestionForm({ ...questionForm, questionText: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1.5px solid #e8e4dd', fontSize: 15, minHeight: 60, resize: 'vertical' }}
                  />
                </div>

                {/* Options */}
                {questionForm.questionType !== 'true_false' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#292827' }}>
                      Answer Options
                    </label>
                    {questionForm.options.map((opt, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Option value (e.g. A)"
                          value={opt.value}
                          onChange={(e) => updateOption(idx, 'value', e.target.value)}
                          style={{ width: 60, padding: '8px 8px', borderRadius: 6, border: '1.5px solid #e8e4dd', fontSize: 14 }}
                        />
                        <input
                          type="text"
                          placeholder="Option label"
                          value={opt.label}
                          onChange={(e) => updateOption(idx, 'label', e.target.value)}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1.5px solid #e8e4dd', fontSize: 14 }}
                        />
                        {/* Correct answer selector */}
                        {questionForm.questionType === 'single_choice' && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13 }}>
                            <input
                              type="radio"
                              name="correct"
                              checked={String(questionForm.correctAnswer) === String(opt.value)}
                              onChange={() => setQuestionForm({ ...questionForm, correctAnswer: opt.value })}
                            />
                            Correct
                          </label>
                        )}
                        {questionForm.questionType === 'multiple_choice' && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13 }}>
                            <input
                              type="checkbox"
                              checked={Array.isArray(questionForm.correctAnswer) && questionForm.correctAnswer.includes(opt.value)}
                              onChange={() => {
                                const current = Array.isArray(questionForm.correctAnswer) ? [...questionForm.correctAnswer] : [];
                                const idx2 = current.indexOf(opt.value);
                                if (idx2 >= 0) current.splice(idx2, 1);
                                else current.push(opt.value);
                                setQuestionForm({ ...questionForm, correctAnswer: current });
                              }}
                            />
                            Correct
                          </label>
                        )}
                        <button onClick={() => removeOption(idx)}
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 18, padding: '4px' }}>
                          ×
                        </button>
                      </div>
                    ))}
                    <button className="nav-btn nav-btn-prev" onClick={addOption} style={{ padding: '6px 14px', fontSize: 13, minHeight: 36 }}>
                      + Add Option
                    </button>
                  </div>
                )}

                {/* Points */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#292827' }}>Points</label>
                    <input type="number" min="1" value={questionForm.points}
                      onChange={(e) => setQuestionForm({ ...questionForm, points: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1.5px solid #e8e4dd', fontSize: 15 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#292827' }}>Explanation (shown after submission)</label>
                    <textarea value={questionForm.explanation}
                      onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1.5px solid #e8e4dd', fontSize: 15, minHeight: 50, resize: 'vertical' }} />
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="nav-btn nav-btn-next" onClick={() => handleQuestionSave(false)} disabled={saving}>
                    {saving ? 'Saving...' : editingQuestionId ? 'Save Changes' : 'Save Question'}
                  </button>
                  <button className="nav-btn nav-btn-prev" onClick={() => handleQuestionSave(true)} disabled={saving} style={{ borderColor: '#14312f', color: '#14312f' }}>
                    {saving ? 'Saving...' : 'Save & Create New'}
                  </button>
                  <button className="nav-btn nav-btn-prev" onClick={() => { setShowQuestionForm(false); setEditingQuestionId(null); }} style={{ color: '#73706d' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Questions List */}
          {questions.map((q, idx) => (
            <div key={q.id} className="review-card" style={{ borderLeftColor: '#14312f' }}>
              <div className="question-info">
                <span style={{ fontSize: 13, fontWeight: 600, color: '#73706d', textTransform: 'uppercase' }}>Question {idx + 1}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="nav-btn nav-btn-prev" onClick={() => handleEditQuestion(q)}
                    style={{ padding: '4px 12px', fontSize: 12, minHeight: 30 }}>Edit</button>
                  <button className="nav-btn nav-btn-prev" onClick={() => handleDeleteQuestion(q.id)}
                    style={{ padding: '4px 12px', fontSize: 12, minHeight: 30, color: '#dc2626', borderColor: '#dc2626' }}>Delete</button>
                </div>
              </div>
              <div className="q-text">{q.questionText}</div>
              <div style={{ fontSize: 13, color: '#73706d' }}>
                Type: {q.questionType} · Points: {q.points}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth.js';
import { useQuiz } from '../../hooks/useQuiz.js';
import '../../components/quiz/quizStyles.css';

export default function QuizTakingPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loading, startQuiz, submitQuiz, scheduleAutoSave } = useQuiz();

  const [quizData, setQuizData] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [bookmarked, setBookmarked] = useState(new Set());
  const [startedAt, setStartedAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const timerRef = useRef(null);

  // Initialize quiz
  useEffect(() => {
    if (!quizId || initialized) return;
    setInitialized(true);

    (async () => {
      const data = await startQuiz(quizId);
      if (!data) {
        toast.error('Không thể tải bài kiểm tra.');
        navigate(-1);
        return;
      }
      setQuizData(data);
      const now = new Date().toISOString();
      setStartedAt(now);

      if (data.timeLimitMinutes) {
        setTimeLeft(data.timeLimitMinutes * 60);
      }
    })();
  }, [quizId, initialized, startQuiz, navigate]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          // Auto-submit when time runs out
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft !== null]);

  // Auto-save on answer changes
  useEffect(() => {
    if (!quizData || !startedAt) return;
    const answerArray = Object.entries(answers).map(([questionId, selectedOptions]) => ({
      questionId,
      selectedOptions,
    }));
    if (answerArray.length > 0) {
      scheduleAutoSave(quizData.quizId, answerArray);
    }
  }, [answers, quizData, startedAt, scheduleAutoSave]);

  const handleAutoSubmit = useCallback(async () => {
    if (submitting || !quizData) return;
    setSubmitting(true);
    const answerArray = Object.entries(answers).map(([questionId, selectedOptions]) => ({
      questionId,
      selectedOptions,
    }));
    const result = await submitQuiz(quizData.quizId, answerArray, startedAt);
    if (result) {
      toast.info('Đã hết thời gian! Bài làm đã được nộp tự động.');
      navigate(`/learner/quizzes/${result.submissionId}/result`, { state: { result } });
    } else {
      toast.error('Không thể nộp bài. Vui lòng thử lại.');
      setSubmitting(false);
    }
  }, [submitting, quizData, answers, startedAt, submitQuiz, navigate]);

  const handleSelectOption = useCallback(
    (questionId, optionValue, questionType) => {
      setAnswers((prev) => {
        const prevSelected = prev[questionId] || [];

        if (questionType === 'single_choice' || questionType === 'true_false') {
          return { ...prev, [questionId]: [optionValue] };
        }

        // Multiple choice
        const exists = prevSelected.includes(optionValue);
        if (exists) {
          return {
            ...prev,
            [questionId]: prevSelected.filter((v) => v !== optionValue),
          };
        }
        return {
          ...prev,
          [questionId]: [...prevSelected, optionValue],
        };
      });
    },
    [],
  );

  const toggleBookmark = useCallback(
    (questionId) => {
      setBookmarked((prev) => {
        const next = new Set(prev);
        if (next.has(questionId)) {
          next.delete(questionId);
        } else {
          next.add(questionId);
        }
        return next;
      });
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!quizData) return;
    setShowConfirm(false);
    setSubmitting(true);

    const answerArray = Object.entries(answers).map(([questionId, selectedOptions]) => ({
      questionId,
      selectedOptions,
    }));

    const result = await submitQuiz(quizData.quizId, answerArray, startedAt);
    if (result) {
      toast.success('Nộp bài thành công!');
      navigate(`/learner/quizzes/${result.submissionId}/result`, { state: { result } });
    } else {
      toast.error('Không thể nộp bài. Vui lòng thử lại.');
      setSubmitting(false);
    }
  }, [quizData, answers, startedAt, submitQuiz, navigate]);

  const questions = quizData?.questions || [];
  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.length;

  // Format time
  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const timerWarning = timeLeft !== null && timeLeft <= 120;
  const timerClass = timerWarning ? 'warning' : 'normal';

  // Return early states
  if (loading && !quizData) {
    return <div className="quiz-loading"><p>Đang tải bài kiểm tra...</p></div>;
  }

  if (!quizData) {
    return (
      <div className="quiz-error">
        <p>Không thể tải bài kiểm tra. Vui lòng thử lại.</p>
        <button className="nav-btn nav-btn-next" onClick={() => navigate(-1)}>Quay lại</button>
      </div>
    );
  }

  return (
    <div className="quiz-shell">
      {/* Header with Timer */}
      <div className="quiz-header">
        <h4>{quizData.title}</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 14, opacity: 0.8 }}>
            {answeredCount}/{totalQuestions} câu
          </span>
          {timeLeft !== null && (
            <div className={`quiz-timer ${timerClass}`}>
              {formatTime(timeLeft)}
            </div>
          )}
        </div>
      </div>

      <div className="quiz-body">
        {/* Main Question Area */}
        <div className="quiz-main">
          {currentQuestion && (
            <div className="question-card">
              <div className="question-header">
                <span className="question-number">
                  Câu {currentIndex + 1} / {totalQuestions}
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="question-points">
                    {currentQuestion.points} điểm
                  </span>
                  <button
                    className={`bookmark-btn ${bookmarked.has(currentQuestion.id) ? 'active' : ''}`}
                    onClick={() => toggleBookmark(currentQuestion.id)}
                  >
                    {bookmarked.has(currentQuestion.id) ? '★ Đã đánh dấu' : '☆ Đánh dấu'}
                  </button>
                </div>
              </div>

              <div className="question-text">{currentQuestion.questionText}</div>

              <div className="answer-options">
                {currentQuestion.options.map((option, idx) => {
                  const optionValue = option.value !== undefined ? option.value : option;
                  const optionLabel = option.label || option;
                  const isSelected = (answers[currentQuestion.id] || []).includes(optionValue);
                  const inputType =
                    currentQuestion.questionType === 'multiple_choice' ? 'checkbox' : 'radio';
                  const inputName = `q_${currentQuestion.id}`;

                  return (
                    <label
                      key={idx}
                      className={`option-item ${isSelected ? 'selected' : ''}`}
                    >
                      <input
                        type={inputType}
                        name={inputName}
                        checked={isSelected}
                        onChange={() =>
                          handleSelectOption(currentQuestion.id, optionValue, currentQuestion.questionType)
                        }
                      />
                      <span className="option-label">{optionLabel}</span>
                    </label>
                  );
                })}
              </div>

              {/* Navigation Buttons */}
              <div className="question-nav-buttons">
                <button
                  className="nav-btn nav-btn-prev"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                >
                  ← Câu trước
                </button>

                <div style={{ display: 'flex', gap: 8 }}>
                  {currentIndex === totalQuestions - 1 ? (
                    <button
                      className="nav-btn nav-btn-submit"
                      onClick={() => setShowConfirm(true)}
                      disabled={submitting}
                    >
                      {submitting ? 'Đang nộp...' : 'Nộp bài'}
                    </button>
                  ) : (
                    <button
                      className="nav-btn nav-btn-next"
                      onClick={() => setCurrentIndex((i) => Math.min(totalQuestions - 1, i + 1))}
                    >
                      Câu tiếp →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {!currentQuestion && totalQuestions === 0 && (
            <div className="quiz-empty">
              <div className="empty-icon">❓</div>
              <p>Bài kiểm tra này chưa có câu hỏi nào.</p>
            </div>
          )}
        </div>

        {/* Sidebar Navigation Grid */}
        <div className="quiz-sidebar">
          <div className="quiz-nav-grid">
            <h6>Danh sách câu hỏi</h6>
            <div className="grid-container">
              {questions.map((q, idx) => {
                const isAnswered = answers[q.id] && answers[q.id].length > 0;
                const isActive = idx === currentIndex;
                const isBookmarked = bookmarked.has(q.id);

                let className = 'quiz-nav-btn';
                if (isActive) className += ' active';
                if (isAnswered && isActive) className += ' answered';
                else if (isAnswered) className += ' answered';
                if (isBookmarked) className += ' bookmarked';

                return (
                  <button
                    key={q.id}
                    className={className}
                    onClick={() => setCurrentIndex(idx)}
                    title={`Câu ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="quiz-nav-legend">
              <div className="legend-item">
                <div className="legend-dot answered" />
                Đã làm
              </div>
              <div className="legend-item">
                <div className="legend-dot active" />
                Đang xem
              </div>
              <div className="legend-item">
                <div className="legend-dot bookmarked" />
                Đánh dấu
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="dialog-overlay" onClick={() => setShowConfirm(false)}>
          <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
            <h4>Xác nhận nộp bài</h4>
            <p>
              Bạn đã trả lời {answeredCount}/{totalQuestions} câu hỏi.
              {answeredCount < totalQuestions && (
                <span style={{ color: '#f59e0b', display: 'block', marginTop: 8 }}>
                  ⚠ Còn {totalQuestions - answeredCount} câu chưa trả lời.
                </span>
              )}
              <br />
              Sau khi nộp, bạn không thể thay đổi câu trả lời.
            </p>
            <div className="dialog-actions">
              <button
                className="nav-btn nav-btn-prev"
                onClick={() => setShowConfirm(false)}
              >
                Tiếp tục làm bài
              </button>
              <button
                className="nav-btn nav-btn-submit"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Đang nộp...' : 'Xác nhận nộp bài'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
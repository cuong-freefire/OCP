import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth.js';
import { useQuiz } from '../../hooks/useQuiz.js';
import '../../components/quiz/quizStyles.css';

export default function QuizListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loading, listQuizzes } = useQuiz();
  const [quizzes, setQuizzes] = useState([]);
  const [courseId, setCourseId] = useState(null);

  useEffect(() => {
    // Try to get courseId from URL params or a default
    const params = new URLSearchParams(window.location.search);
    const cId = params.get('courseId');
    setCourseId(cId);

    (async () => {
      const data = await listQuizzes(cId ? { courseId: cId } : {});
      setQuizzes(data || []);
    })();
  }, []);

  const handleStartQuiz = (quizId) => {
    navigate(`/learner/quizzes/${quizId}/take`);
  };

  const handleViewHistory = (quizId) => {
    navigate(`/learner/quizzes/history?quizId=${quizId}`);
  };

  return (
    <div className="quiz-list-shell">
      <h3>Danh sách bài kiểm tra</h3>

      {loading && <div className="quiz-loading"><p>Đang tải...</p></div>}

      {!loading && quizzes.length === 0 && (
        <div className="quiz-empty">
          <div className="empty-icon">📝</div>
          <p>Chưa có bài kiểm tra nào trong khóa học này.</p>
        </div>
      )}

      {quizzes.map((quiz) => (
        <div key={quiz.id} className="quiz-card">
          <h5>{quiz.title}</h5>
          {quiz.description && (
            <p style={{ fontSize: 14, color: '#73706d', marginBottom: 12 }}>
              {quiz.description}
            </p>
          )}
          <div className="quiz-meta">
            <span>📄 {quiz.questionCount} câu hỏi</span>
            {quiz.timeLimitMinutes && <span>⏱ {quiz.timeLimitMinutes} phút</span>}
            <span>🎯 Đạt từ {quiz.passingScore}%</span>
          </div>

          {quiz.attemptSummary && (
            <div className="attempt-info">
              Đã làm {quiz.attemptSummary.attempts} lần ·
              Điểm cao nhất: {quiz.attemptSummary.bestScore} ·
              {quiz.attemptSummary.lastPassed ? ' ✅ Đã đạt' : ' ❌ Chưa đạt'}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button
              className="start-quiz-btn"
              onClick={() => handleStartQuiz(quiz.id)}
            >
              {quiz.attemptSummary ? 'Làm lại' : 'Làm bài'}
            </button>
            {quiz.attemptSummary && (
              <button
                className="nav-btn nav-btn-prev"
                onClick={() => handleViewHistory(quiz.id)}
                style={{ marginTop: 0 }}
              >
                Lịch sử
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
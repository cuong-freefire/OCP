import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuiz } from '../../hooks/useQuiz.js';
import '../../components/quiz/quizStyles.css';

export default function QuizHistoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loading, getSubmissionHistory } = useQuiz();

  const quizId = searchParams.get('quizId');
  const courseId = searchParams.get('courseId');
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    (async () => {
      const params = {};
      if (quizId) params.quizId = quizId;
      if (courseId) params.courseId = courseId;
      const data = await getSubmissionHistory(params);
      setSubmissions(data || []);
    })();
  }, []);

  const formatDateTime = (isoString) => {
    if (!isoString) return '--';
    const d = new Date(isoString);
    return d.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="quiz-list-shell">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button
          className="nav-btn nav-btn-prev"
          onClick={() => navigate(-1)}
          style={{ minHeight: 44 }}
        >
          ← Quay lại
        </button>
        <h3 style={{ margin: 0 }}>Lịch sử bài kiểm tra</h3>
      </div>

      {loading && <div className="quiz-loading"><p>Đang tải lịch sử...</p></div>}

      {!loading && submissions.length === 0 && (
        <div className="quiz-empty">
          <div className="empty-icon">📋</div>
          <p>Chưa có bài nộp nào.</p>
        </div>
      )}

      <ul className="history-list">
        {submissions.map((sub) => (
          <li key={sub.id} className="history-item">
            <div className="history-info">
              <h6>{sub.quiz?.title || 'Bài kiểm tra'}</h6>
              <div className="history-meta">
                Nộp lúc: {formatDateTime(sub.submittedAt)}
              </div>
              <div className="history-meta" style={{ marginTop: 4 }}>
                {sub.passed ? '✅ Đạt' : '❌ Chưa đạt'}
              </div>
            </div>
            <div className="history-score">
              <div className="score">
                {sub.score}/{sub.maxScore}
              </div>
              <div className="score-label">
                {sub.maxScore > 0 ? Math.round((sub.score / sub.maxScore) * 100) : 0}%
              </div>
              <button
                className="nav-btn nav-btn-next"
                style={{ marginTop: 8, padding: '6px 16px', fontSize: 13, minHeight: 36 }}
                onClick={() => navigate(`/learner/quizzes/${sub.id}/result`)}
              >
                Xem chi tiết
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuiz } from '../../hooks/useQuiz.js';
import { useAuth } from '../../hooks/useAuth.js';
import '../../components/quiz/quizStyles.css';

export default function QuizResultPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { loading, getResult } = useQuiz();

  const [result, setResult] = useState(location.state?.result || null);
  const [fetched, setFetched] = useState(!!location.state?.result);

  useEffect(() => {
    if (!submissionId || fetched) return;
    setFetched(true);

    (async () => {
      const data = await getResult(submissionId);
      if (data) setResult(data);
    })();
  }, [submissionId, fetched, getResult]);

  if (loading && !result) {
    return <div className="quiz-loading"><p>Đang tải kết quả...</p></div>;
  }

  if (!result) {
    return (
      <div className="result-shell">
        <div className="quiz-error">
          <p>Không thể tải kết quả bài kiểm tra.</p>
          <button className="nav-btn nav-btn-next" onClick={() => navigate(-1)}>Quay lại</button>
        </div>
      </div>
    );
  }

  const percentage = result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0;
  const circumference = 2 * Math.PI * 78;
  const offset = circumference - (percentage / 100) * circumference;

  const formatTime = (isoString) => {
    if (!isoString) return '--';
    const d = new Date(isoString);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (startIso, endIso) => {
    if (!startIso || !endIso) return '--';
    const diff = Math.round((new Date(endIso) - new Date(startIso)) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const correctCount = result.details ? result.details.filter((d) => d.correctAnswer !== undefined).length : 0;
  const answeredCount = result.details ? result.details.length : 0;

  return (
    <div className="result-shell">
      <div className="result-header">
        <h3 style={{ fontSize: 28, fontWeight: 540, color: '#292827', marginBottom: 8 }}>
          {result.quizTitle || 'Kết quả bài kiểm tra'}
        </h3>

        {/* Donut Chart */}
        <div className="result-score-ring">
          <svg width="180" height="180" viewBox="0 0 180 180">
            <circle className="bg-circle" cx="90" cy="90" r="78" />
            <circle
              className={`progress-circle ${result.passed ? 'passed' : 'failed'}`}
              cx="90"
              cy="90"
              r="78"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="result-score-text">
            <span className="score-value">{result.score}</span>
            <span className="score-max">/{result.maxScore}</span>
          </div>
        </div>

        <div className={`result-status ${result.passed ? 'passed' : 'failed'}`}>
          {result.passed ? '🎉 Đạt yêu cầu' : '😞 Chưa đạt yêu cầu'}
        </div>
        <div style={{ fontSize: 14, color: '#73706d', marginBottom: 24 }}>
          Điểm đạt tối thiểu: {result.passedScore}%
        </div>

        <div className="result-meta">
          <div className="result-meta-item">
            <div className="label">Tỉ lệ đúng</div>
            <div className="value">{percentage}%</div>
          </div>
          <div className="result-meta-item">
            <div className="label">Thời gian làm bài</div>
            <div className="value">{formatDuration(result.startedAt, result.submittedAt)}</div>
          </div>
          <div className="result-meta-item">
            <div className="label">Thời gian nộp</div>
            <div className="value">{formatTime(result.submittedAt)}</div>
          </div>
        </div>
      </div>

      {/* Detailed Review */}
      {result.details && result.details.length > 0 && (
        <div className="review-section">
          <h5>Chi tiết câu hỏi</h5>
          {result.details.map((detail, idx) => {
            const correct = detail.correct !== undefined ? detail.correct : true;
            return (
              <div key={detail.questionId || idx} className={`review-card ${correct ? 'correct' : 'incorrect'}`}>
                <div className="question-info">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#73706d', textTransform: 'uppercase' }}>
                    Câu {idx + 1}
                  </span>
                  <span className={`answer-badge ${correct ? 'correct' : 'incorrect'}`}>
                    {correct ? '✓ Đúng' : '✗ Sai'} · {detail.points || 0}/{detail.maxPoints || 0} điểm
                  </span>
                </div>
                <div className="q-text">{detail.questionText}</div>

                {/* Show selected & correct answers */}
                <div style={{ fontSize: 14, color: '#292827', marginBottom: 8 }}>
                  <strong>Đáp án của bạn:</strong>{' '}
                  {detail.selectedOptions && detail.selectedOptions.length > 0
                    ? detail.selectedOptions.map((opt) => String(opt)).join(', ')
                    : '(Chưa trả lời)'}
                </div>
                <div style={{ fontSize: 14, color: '#22c55e', marginBottom: 12 }}>
                  <strong>Đáp án đúng:</strong>{' '}
                  {Array.isArray(detail.correctAnswer)
                    ? detail.correctAnswer.map((c) => String(c)).join(', ')
                    : String(detail.correctAnswer || '')}
                </div>

                {detail.explanation && (
                  <div className="explanation">
                    💡 {detail.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 40, marginBottom: 60 }}>
        <button
          className="nav-btn nav-btn-prev"
          onClick={() => navigate('/learner/quizzes')}
        >
          ← Danh sách bài kiểm tra
        </button>
        <button
          className="nav-btn nav-btn-next"
          onClick={() => navigate('/learner')}
        >
          Về trang học tập
        </button>
      </div>
    </div>
  );
}
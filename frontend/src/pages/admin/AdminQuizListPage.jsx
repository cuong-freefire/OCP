import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { adminQuizApi } from '../../api/adminQuizApi.js';
import '../../components/quiz/quizStyles.css';

export default function AdminQuizListPage() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const loadQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminQuizApi.listQuizzes({ page, pageSize: 20, search, status: statusFilter });
      setQuizzes(response.data?.quizzes || []);
      setPagination(response.data?.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 0 });
    } catch (err) {
      toast.error(err.message || 'Failed to load quizzes.');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { loadQuizzes(); }, [loadQuizzes]);

  const handleDelete = async (quizId, title) => {
    if (!window.confirm(`⚠️ DELETE CONFIRMATION\n\nAre you sure you want to delete "${title}"?\n\nThis will permanently delete ALL questions and submission history for this quiz. This action CANNOT be undone.`)) {
      return;
    }
    try {
      await adminQuizApi.deleteQuiz(quizId);
      toast.success(`Quiz "${title}" deleted.`);
      loadQuizzes();
    } catch (err) {
      toast.error(err.message || 'Failed to delete quiz.');
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadQuizzes();
  };

  const statusBadge = (status) => (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
      background: status === 'published' ? '#f0fdf4' : '#fef3c7',
      color: status === 'published' ? '#16a34a' : '#d97706',
    }}>
      {status === 'published' ? 'Published' : 'Draft'}
    </span>
  );

  return (
    <div className="quiz-list-shell" style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h3 style={{ margin: 0 }}>Quiz Management</h3>
        <button className="nav-btn nav-btn-next" onClick={() => navigate('/admin/quizzes/new')}>
          + Create Quiz
        </button>
      </div>

      {/* Search & Filter */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200, padding: '10px 12px', borderRadius: 6, border: '1.5px solid #e8e4dd',
            fontSize: 15, fontFamily: 'inherit',
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{
            padding: '10px 12px', borderRadius: 6, border: '1.5px solid #e8e4dd',
            fontSize: 15, fontFamily: 'inherit', minWidth: 130,
          }}
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
        <button type="submit" className="nav-btn nav-btn-next" style={{ padding: '10px 20px' }}>
          Search
        </button>
      </form>

      {loading && <div className="quiz-loading"><p>Loading...</p></div>}

      {!loading && quizzes.length === 0 && (
        <div className="quiz-empty"><p>No quizzes found.</p></div>
      )}

      {/* Quiz Table */}
      {quizzes.map((quiz) => (
        <div key={quiz.id} className="quiz-card" onClick={() => navigate(`/admin/quizzes/${quiz.id}`)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h5>{quiz.title}</h5>
              <div className="quiz-meta">
                <span>📄 {quiz.questionCount} questions</span>
                {quiz.timeLimitMinutes && <span>⏱ {quiz.timeLimitMinutes} min</span>}
                <span>🎯 Pass: {quiz.passingScore}%</span>
                {statusBadge(quiz.status)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              className="nav-btn nav-btn-next"
              style={{ padding: '6px 16px', fontSize: 13, minHeight: 36 }}
              onClick={(e) => { e.stopPropagation(); navigate(`/admin/quizzes/${quiz.id}`); }}
            >
              Edit
            </button>
            <button
              className="nav-btn nav-btn-prev"
              style={{ padding: '6px 16px', fontSize: 13, minHeight: 36, color: '#dc2626', borderColor: '#dc2626' }}
              onClick={(e) => { e.stopPropagation(); handleDelete(quiz.id, quiz.title); }}
            >
              Delete
            </button>
          </div>
        </div>
      ))}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
          <button
            className="nav-btn nav-btn-prev"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Previous
          </button>
          <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', color: '#73706d', fontSize: 14 }}>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <button
            className="nav-btn nav-btn-next"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
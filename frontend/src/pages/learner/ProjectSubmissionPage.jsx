import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { projectApi } from '../../api/projectApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import '../../components/quiz/quizStyles.css';

const STATUS_STYLES = {
  PENDING: { bg: '#fef3c7', color: '#d97706', label: 'Pending Review' },
  GRADED: { bg: '#f0fdf4', color: '#16a34a', label: 'Graded' },
  REJECTED: { bg: '#fef2f2', color: '#dc2626', label: 'Rejected' },
  ARCHIVED: { bg: '#f5f5f5', color: '#73706d', label: 'Archived' },
};

export default function ProjectSubmissionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('courseId') || '';
  const finalProjectId = searchParams.get('finalProjectId') || '';

  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [errors, setErrors] = useState({});

  // Load submissions and status
  const loadData = useCallback(async () => {
    if (!courseId && !finalProjectId) return;
    setLoading(true);
    try {
      const [historyRes, statusRes] = await Promise.all([
        projectApi.getSubmissionHistory({ finalProjectId: finalProjectId || undefined }),
        finalProjectId ? projectApi.getCurrentStatus(finalProjectId) : Promise.resolve({ data: null }),
      ]);
      setSubmissions(historyRes.data?.submissions || []);
      setCurrentStatus(statusRes.data);
    } catch (err) {
      // Silently handle - may be first submission
    } finally {
      setLoading(false);
    }
  }, [courseId, finalProjectId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Trim paste
  const handlePaste = (e, setter) => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    setTimeout(() => {
      setter((prev) => prev.trim());
    }, 0);
  };

  // Validate URLs
  const validate = () => {
    const newErrors = {};
    const trimmedRepo = repositoryUrl.trim();
    const trimmedDemo = demoUrl.trim();

    if (!trimmedRepo) {
      newErrors.repositoryUrl = 'Repository URL is required.';
    } else if (!/^https?:\/\/.+/.test(trimmedRepo)) {
      newErrors.repositoryUrl = 'URL must start with http:// or https://';
    }

    if (trimmedDemo && !/^https?:\/\/.+/.test(trimmedDemo)) {
      newErrors.demoUrl = 'URL must start with http:// or https://';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitClick = (e) => {
    e.preventDefault();
    // Trim first
    setRepositoryUrl((prev) => prev.trim());
    setDemoUrl((prev) => prev.trim());
    if (!validate()) return;
    setShowConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirm(false);
    setSubmitting(true);
    try {
      const result = await projectApi.submitProject({
        courseId,
        repositoryUrl: repositoryUrl.trim(),
        demoUrl: demoUrl.trim(),
      });
      toast.success('Project submitted successfully!');
      setRepositoryUrl('');
      setDemoUrl('');
      setErrors({});
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to submit project.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !currentStatus || currentStatus.canSubmit === true;
  const statusMessage = currentStatus?.message || null;
  const latestSubmission = submissions[0] || null;
  const currentSubmission = submissions.find((s) => s.isCurrent) || latestSubmission;

  const StatusBadge = ({ submission }) => {
    const status = submission?.status || 'PENDING';
    const style = STATUS_STYLES[status] || STATUS_STYLES.PENDING;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
        background: style.bg, color: style.color,
      }}>
        {submission?.submittedLate && <span style={{ fontSize: 10 }}>⚠</span>}
        {style.label}
        {submission?.submittedLate && ' (Late)'}
      </span>
    );
  };

  const formatDateTime = (iso) => {
    if (!iso) return '--';
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="quiz-list-shell" style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h3 style={{ margin: 0 }}>Final Project Submission</h3>
      </div>

      {/* Current Status Banner */}
      {statusMessage && (
        <div style={{
          padding: '14px 20px', borderRadius: 12, marginBottom: 24,
          background: currentStatus?.currentStatus === 'PENDING' ? '#fffbeb' :
            currentStatus?.currentStatus === 'GRADED' ? '#f0fdf4' : '#fef2f2',
          border: `1.5px solid ${currentStatus?.currentStatus === 'PENDING' ? '#f59e0b' :
            currentStatus?.currentStatus === 'GRADED' ? '#22c55e' : '#ef4444'}`,
        }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#292827' }}>
            {statusMessage}
          </p>
        </div>
      )}

      {/* Submission Form */}
      <div className="question-card">
        <h5 style={{ marginBottom: 16 }}>
          {currentStatus?.currentStatus === 'REJECTED' ? 'Resubmit Your Project' : 'Submit Your Final Project'}
        </h5>

        {!canSubmit && currentStatus && (
          <div style={{
            padding: 12, borderRadius: 8, marginBottom: 16,
            background: '#f0fdf4', color: '#16a34a', fontSize: 14, fontWeight: 500,
          }}>
            ✓ Your project has been {currentStatus.currentStatus === 'GRADED' ? 'graded' : 'submitted and is pending review'}. No further action needed.
          </div>
        )}

        <form onSubmit={handleSubmitClick}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#292827' }}>
              Repository URL (GitHub/GitLab) *
            </label>
            <input
              type="url"
              placeholder="https://github.com/username/project"
              value={repositoryUrl}
              onChange={(e) => setRepositoryUrl(e.target.value)}
              onPaste={(e) => handlePaste(e, setRepositoryUrl)}
              disabled={!canSubmit}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 6, fontSize: 15,
                border: `1.5px solid ${errors.repositoryUrl ? '#ef4444' : '#e8e4dd'}`,
                fontFamily: 'inherit',
              }}
            />
            {errors.repositoryUrl && (
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#ef4444' }}>{errors.repositoryUrl}</p>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#292827' }}>
              Demo URL (optional)
            </label>
            <input
              type="url"
              placeholder="https://my-app.vercel.app"
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              onPaste={(e) => handlePaste(e, setDemoUrl)}
              disabled={!canSubmit}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 6, fontSize: 15,
                border: `1.5px solid ${errors.demoUrl ? '#ef4444' : '#e8e4dd'}`,
                fontFamily: 'inherit',
              }}
            />
            {errors.demoUrl && (
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#ef4444' }}>{errors.demoUrl}</p>
            )}
          </div>

          {canSubmit && (
            <button
              type="submit"
              className="nav-btn nav-btn-next"
              disabled={submitting}
              style={{ minHeight: 44, width: '100%' }}
            >
              {submitting ? 'Submitting...' : currentStatus?.currentStatus === 'REJECTED' ? 'Resubmit Project' : 'Submit Project'}
            </button>
          )}
        </form>
      </div>

      {/* Submission Dashboard */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h4 style={{ margin: 0, fontSize: 20, fontWeight: 540, color: '#292827' }}>
            Submission History ({submissions.length})
          </h4>
          {submissions.length > 1 && (
            <button
              className="nav-btn nav-btn-prev"
              onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
              style={{ padding: '6px 14px', fontSize: 13, minHeight: 36 }}
            >
              {showHistoryDropdown ? 'Hide History' : 'View All Attempts ▼'}
            </button>
          )}
        </div>

        {loading && <div className="quiz-loading"><p>Loading submissions...</p></div>}

        {!loading && submissions.length === 0 && (
          <div className="quiz-empty">
            <p>No submissions yet. Submit your project above.</p>
          </div>
        )}

        {/* Current / Latest Submission */}
        {currentSubmission && (
          <div className="question-card" style={{ borderLeft: '4px solid #14312f' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#73706d', textTransform: 'uppercase' }}>
                  {currentSubmission.isCurrent ? 'Current Attempt' : 'Latest Submission'}
                </span>
                <span style={{ marginLeft: 8, fontSize: 12, color: '#9a9794' }}>
                  #{currentSubmission.attemptNumber}
                </span>
              </div>
              <StatusBadge submission={currentSubmission} />
            </div>

            <div style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: 14, color: '#292827' }}>Repository:</strong>{' '}
              <a href={currentSubmission.repositoryUrl} target="_blank" rel="noopener noreferrer"
                style={{ color: '#14312f', fontSize: 14 }}>
                {currentSubmission.repositoryUrl}
              </a>
            </div>

            {currentSubmission.demoUrl && (
              <div style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 14, color: '#292827' }}>Demo:</strong>{' '}
                <a href={currentSubmission.demoUrl} target="_blank" rel="noopener noreferrer"
                  style={{ color: '#14312f', fontSize: 14 }}>
                  {currentSubmission.demoUrl}
                </a>
              </div>
            )}

            <div style={{ fontSize: 13, color: '#73706d', marginTop: 8 }}>
              Submitted: {formatDateTime(currentSubmission.submittedAt)}
            </div>

            {currentSubmission.mentorNotes && (
              <div style={{
                marginTop: 12, padding: 12, background: '#fafaf8', borderRadius: 8, fontSize: 14, color: '#292827',
              }}>
                <strong>Mentor Notes:</strong> {currentSubmission.mentorNotes}
              </div>
            )}
          </div>
        )}

        {/* Full Attempt History Dropdown */}
        {showHistoryDropdown && submissions.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h6 style={{ fontSize: 14, fontWeight: 600, color: '#73706d', marginBottom: 12, textTransform: 'uppercase' }}>
              All Attempts
            </h6>
            {submissions.map((s, idx) => (
              <div key={s.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 18px', background: '#ffffff', borderRadius: 8, marginBottom: 8,
                border: '1.5px solid #e8e4dd', opacity: s.isCurrent ? 1 : 0.7,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#292827' }}>
                    Attempt #{s.attemptNumber} {s.isCurrent ? '(Current)' : ''}
                  </div>
                  <div style={{ fontSize: 13, color: '#73706d', marginTop: 2 }}>
                    {formatDateTime(s.submittedAt)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <StatusBadge submission={s} />
                  <div style={{ marginTop: 4, fontSize: 12 }}>
                    <a href={s.repositoryUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#14312f' }}>
                      Repo
                    </a>
                    {s.demoUrl && (
                      <>
                        {' · '}
                        <a href={s.demoUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#14312f' }}>
                          Demo
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="dialog-overlay" onClick={() => setShowConfirm(false)}>
          <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
            <h4>Confirm Submission</h4>
            <p>
              Are you sure you want to submit this project? You will not be able to edit this submission until you receive feedback from your mentor.
            </p>
            <div style={{
              background: '#fafaf8', borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 14,
            }}>
              <div style={{ marginBottom: 8 }}>
                <strong>Repository URL:</strong><br />
                <span style={{ color: '#73706d', wordBreak: 'break-all' }}>{repositoryUrl.trim()}</span>
              </div>
              {demoUrl.trim() && (
                <div>
                  <strong>Demo URL:</strong><br />
                  <span style={{ color: '#73706d', wordBreak: 'break-all' }}>{demoUrl.trim()}</span>
                </div>
              )}
            </div>
            <div className="dialog-actions">
              <button className="nav-btn nav-btn-prev" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button className="nav-btn nav-btn-submit" onClick={handleConfirmSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Confirm Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
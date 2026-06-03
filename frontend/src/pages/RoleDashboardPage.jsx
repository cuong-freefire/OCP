import { useNavigate } from 'react-router-dom';
import { SecondaryButton } from '../components/auth/AuthFormControls.jsx';
import AuthStatusMessage from '../components/auth/AuthStatusMessage.jsx';
import { useAuth } from '../hooks/useAuth.js';

const roleCopy = {
  LEARNER: {
    title: 'Learner dashboard',
    subtitle: 'Khu vực học tập của learner.',
  },
  MENTOR: {
    title: 'Mentor dashboard',
    subtitle: 'Khu vực dành cho mentor theo dõi và chấm bài.',
  },
  ADMIN: {
    title: 'Admin dashboard',
    subtitle: 'Khu vực quản trị hệ thống OCP.',
  },
};

function InfoRow({ label, value }) {
  return (
    <div className="dashboard-info-row">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

export default function RoleDashboardPage({ role }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const copy = roleCopy[role] || roleCopy.LEARNER;

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login', { replace: true });
  };

  return (
    <main className="dashboard-shell">
      <section className="dashboard-panel">
        <div className="dashboard-heading">
          <p className="dashboard-eyebrow">OCP</p>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>

        <div className="dashboard-card">
          <AuthStatusMessage message="Phiên đăng nhập đang hoạt động." tone="success" />
          <div className="dashboard-info-grid">
            <InfoRow label="Name" value={user?.name} />
            <InfoRow label="Email" value={user?.email} />
            <InfoRow label="Role" value={user?.role} />
            <InfoRow label="Status" value={user?.status} />
            <InfoRow label="Email verified" value={user?.emailVerified ? 'Có' : 'Chưa'} />
            <InfoRow label="Local password" value={user?.hasLocalPassword ? 'Đã thiết lập' : 'Chưa thiết lập'} />
          </div>
          <SecondaryButton onClick={handleLogout}>Logout</SecondaryButton>
        </div>
      </section>
    </main>
  );
}

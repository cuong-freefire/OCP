export default function AuthStatusMessage({ message, tone = 'neutral' }) {
  if (!message) return null;
  return (
    <div className={`auth-status auth-status-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {message}
    </div>
  );
}

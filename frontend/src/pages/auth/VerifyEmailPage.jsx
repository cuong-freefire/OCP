import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/authApi.js';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import { PrimaryButton, SecondaryButton, TextField } from '../../components/auth/AuthFormControls.jsx';
import AuthStatusMessage from '../../components/auth/AuthStatusMessage.jsx';
import { getDashboardPathForRole, useAuth } from '../../hooks/useAuth.js';
import { validateForm, verifyEmailFormSchema } from '../../utils/authFormSchemas.js';
import { showErrorToast, showSuccessToast } from '../../utils/toastMessages.js';

const RESEND_COOLDOWN_SECONDS = 60;

function getInitialResendCountdown(locationState, email) {
  if (!email) return 0;

  const verificationSentAt = Number(locationState?.verificationSentAt);
  if (!Number.isFinite(verificationSentAt)) return RESEND_COOLDOWN_SECONDS;

  const elapsedSeconds = Math.floor((Date.now() - verificationSentAt) / 1000);
  return Math.max(RESEND_COOLDOWN_SECONDS - elapsedSeconds, 0);
}

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyEmail } = useAuth();
  const email = location.state?.email || '';
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(() => getInitialResendCountdown(location.state, email));

  useEffect(() => {
    if (resendCountdown <= 0) return undefined;

    const timerId = window.setTimeout(() => {
      setResendCountdown((seconds) => Math.max(seconds - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [resendCountdown]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = validateForm(verifyEmailFormSchema, { email, otp });
    if (!validation.success) {
      showErrorToast(validation.message);
      return;
    }

    setSubmitting(true);
    try {
      const user = await verifyEmail(validation.data);
      showSuccessToast('Xác thực email thành công.');
      navigate(getDashboardPathForRole(user?.role), { replace: true });
    } catch (requestError) {
      showErrorToast(requestError);
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (resending || resendCountdown > 0) return;

    setResending(true);
    try {
      await authApi.resendVerification({ email });
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
      showSuccessToast('Đã gửi mã mới.');
    } catch (requestError) {
      showErrorToast(requestError);
      if (requestError.code === 'OTP_COOLDOWN') {
        setResendCountdown(RESEND_COOLDOWN_SECONDS);
      }
    } finally {
      setResending(false);
    }
  };

  const resendLabel =
    resendCountdown > 0 ? `Gửi lại sau ${resendCountdown}s` : resending ? 'Đang gửi...' : 'Gửi mã mới';

  if (!email) {
    return (
      <AuthLayout title="Verify your email">
        <div className="auth-form">
          <AuthStatusMessage message="Vui lòng đăng ký lại để nhận mã xác thực." tone="neutral" />
          <SecondaryButton onClick={() => navigate('/auth/register')}>Quay lại đăng ký</SecondaryButton>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Verify your email">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField
          id="otp"
          label="Six-digit code"
          value={otp}
          onChange={setOtp}
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={6}
        />
        <PrimaryButton disabled={submitting}>Verify</PrimaryButton>
        <SecondaryButton disabled={resending || resendCountdown > 0} onClick={resend}>
          {resendLabel}
        </SecondaryButton>
      </form>
    </AuthLayout>
  );
}

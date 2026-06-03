import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/authApi.js';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import { PrimaryButton, TextField } from '../../components/auth/AuthFormControls.jsx';
import { emailOnlyFormSchema, validateForm } from '../../utils/authFormSchemas.js';
import { showErrorToast, showSuccessToast } from '../../utils/toastMessages.js';

const RESET_CODE_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(0);

  useEffect(() => {
    if (resetCountdown <= 0) return undefined;

    const timerId = window.setTimeout(() => {
      setResetCountdown((seconds) => Math.max(seconds - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [resetCountdown]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || resetCountdown > 0) return;

    const validation = validateForm(emailOnlyFormSchema, { email });
    if (!validation.success) {
      showErrorToast(validation.message);
      return;
    }

    setSubmitting(true);
    try {
      await authApi.forgotPassword({ email: validation.data.email });
      showSuccessToast('Nếu hợp lệ, mã đặt lại đã được gửi.');
      setResetCountdown(RESET_CODE_COOLDOWN_SECONDS);
      navigate('/auth/reset-password', { state: { email: validation.data.email, resetSentAt: Date.now() } });
    } catch (requestError) {
      showErrorToast(requestError);
      if (requestError.code === 'OTP_COOLDOWN') {
        setResetCountdown(RESET_CODE_COOLDOWN_SECONDS);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const sendResetLabel =
    resetCountdown > 0 ? `Gửi lại sau ${resetCountdown}s` : submitting ? 'Đang gửi...' : 'Gửi mã đặt lại';

  return (
    <AuthLayout
      title="Reset your password"
      footer={
        <div className="auth-switch">
          <Link to="/auth/login">Quay lại đăng nhập</Link>
        </div>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <PrimaryButton disabled={submitting || resetCountdown > 0}>{sendResetLabel}</PrimaryButton>
      </form>
    </AuthLayout>
  );
}

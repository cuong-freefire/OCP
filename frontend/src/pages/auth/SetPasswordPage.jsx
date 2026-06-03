import { useState } from 'react';
import { authApi } from '../../api/authApi.js';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import { PrimaryButton, TextField } from '../../components/auth/AuthFormControls.jsx';
import { setPasswordFormSchema, validateForm } from '../../utils/authFormSchemas.js';
import { showErrorToast, showSuccessToast } from '../../utils/toastMessages.js';

export default function SetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = validateForm(setPasswordFormSchema, { newPassword });
    if (!validation.success) {
      showErrorToast(validation.message);
      return;
    }

    try {
      await authApi.setPassword(validation.data);
      showSuccessToast('Đã tạo mật khẩu.');
    } catch (requestError) {
      showErrorToast(requestError);
    }
  };

  return (
    <AuthLayout title="Create a local password">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField
          id="newPassword"
          label="New password"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
        />
        <PrimaryButton>Set password</PrimaryButton>
      </form>
    </AuthLayout>
  );
}

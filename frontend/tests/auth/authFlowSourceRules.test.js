import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('register confirms password locally without sending confirmPassword to backend', () => {
  const source = readFileSync(new URL('../../src/pages/auth/RegisterPage.jsx', import.meta.url), 'utf8');
  const schemaSource = readFileSync(new URL('../../src/utils/authFormSchemas.js', import.meta.url), 'utf8');

  assert.match(source, /confirmPassword/);
  assert.match(source, /registerFormSchema/);
  assert.match(schemaSource, /data\.password\s*!==\s*data\.confirmPassword/);
  assert.match(source, /authApi\.register\(\{\s*fullName:\s*data\.fullName,\s*email:\s*data\.email,\s*password:\s*data\.password\s*\}\)/);
  assert.equal(source.includes('confirmPassword: data.confirmPassword'), false);
});

test('verify email keeps registration email locked and submits only OTP input', () => {
  const source = readFileSync(new URL('../../src/pages/auth/VerifyEmailPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /const email = location\.state\?\.email \|\| ''/);
  assert.equal(source.includes('setEmail'), false);
  assert.equal(source.includes('id="email"'), false);
  assert.match(source, /verifyEmail\(validation\.data\)/);
});

test('auth forms use Zod and disable browser-native validation', () => {
  const formFiles = [
    '../../src/pages/auth/LoginPage.jsx',
    '../../src/pages/auth/RegisterPage.jsx',
    '../../src/pages/auth/ForgotPasswordPage.jsx',
    '../../src/pages/auth/VerifyEmailPage.jsx',
    '../../src/pages/auth/ResetPasswordPage.jsx',
    '../../src/pages/auth/SetPasswordPage.jsx',
  ];
  const schemaSource = readFileSync(new URL('../../src/utils/authFormSchemas.js', import.meta.url), 'utf8');
  const controlSource = readFileSync(new URL('../../src/components/auth/AuthFormControls.jsx', import.meta.url), 'utf8');

  assert.match(schemaSource, /import \{ z \} from 'zod'/);
  assert.match(schemaSource, /safeParse/);
  assert.equal(controlSource.includes('required='), false);

  for (const file of formFiles) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /validateForm/);
    assert.match(source, /noValidate/);
  }
});

test('auth form messages use React Toastify', () => {
  const appSource = readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8');
  const toastSource = readFileSync(new URL('../../src/utils/toastMessages.js', import.meta.url), 'utf8');
  const formFiles = [
    '../../src/pages/auth/LoginPage.jsx',
    '../../src/pages/auth/RegisterPage.jsx',
    '../../src/pages/auth/ForgotPasswordPage.jsx',
    '../../src/pages/auth/VerifyEmailPage.jsx',
    '../../src/pages/auth/ResetPasswordPage.jsx',
    '../../src/pages/auth/SetPasswordPage.jsx',
  ];

  assert.match(appSource, /ToastContainer/);
  assert.match(appSource, /react-toastify\/dist\/ReactToastify\.css/);
  assert.match(toastSource, /toast\.success/);
  assert.match(toastSource, /toast\.error/);

  for (const file of formFiles) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /showErrorToast/);
    assert.equal(source.includes('message={error}'), false);
  }
});

test('verify email shows resend countdown during OTP cooldown', () => {
  const source = readFileSync(new URL('../../src/pages/auth/VerifyEmailPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /RESEND_COOLDOWN_SECONDS\s*=\s*60/);
  assert.match(source, /setResendCountdown/);
  assert.match(source, /window\.setTimeout/);
  assert.match(source, /resendCountdown\s*>\s*0/);
  assert.match(source, /Gửi lại sau \$\{resendCountdown\}s/);
  assert.match(source, /disabled=\{resending \|\| resendCountdown > 0\}/);
});

test('forgot password shows reset-code countdown during OTP cooldown', () => {
  const source = readFileSync(new URL('../../src/pages/auth/ForgotPasswordPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /RESET_CODE_COOLDOWN_SECONDS\s*=\s*60/);
  assert.match(source, /setResetCountdown/);
  assert.match(source, /window\.setTimeout/);
  assert.match(source, /requestError\.code === 'OTP_COOLDOWN'/);
  assert.match(source, /Gửi lại sau \$\{resetCountdown\}s/);
  assert.match(source, /disabled=\{submitting \|\| resetCountdown > 0\}/);
});

test('auth toast messages are concise Vietnamese copy', () => {
  const schemaSource = readFileSync(new URL('../../src/utils/authFormSchemas.js', import.meta.url), 'utf8');
  const toastSource = readFileSync(new URL('../../src/utils/toastMessages.js', import.meta.url), 'utf8');
  const loginSource = readFileSync(new URL('../../src/pages/auth/LoginPage.jsx', import.meta.url), 'utf8');
  const verifySource = readFileSync(new URL('../../src/pages/auth/VerifyEmailPage.jsx', import.meta.url), 'utf8');
  const forgotSource = readFileSync(new URL('../../src/pages/auth/ForgotPasswordPage.jsx', import.meta.url), 'utf8');

  assert.match(schemaSource, /Vui lòng nhập email/);
  assert.match(schemaSource, /Mã xác thực gồm 6 chữ số/);
  assert.match(toastSource, /INVALID_CREDENTIALS:\s*'Email hoặc mật khẩu không đúng.'/);
  assert.match(toastSource, /OTP_COOLDOWN:\s*'Vui lòng chờ hết thời gian đếm ngược.'/);
  assert.match(loginSource, /Đăng nhập thành công/);
  assert.match(verifySource, /Đã gửi mã mới/);
  assert.match(forgotSource, /Nếu hợp lệ, mã đặt lại đã được gửi/);
});

test('successful auth navigation lands on role dashboard route', () => {
  const loginSource = readFileSync(new URL('../../src/pages/auth/LoginPage.jsx', import.meta.url), 'utf8');
  const verifySource = readFileSync(new URL('../../src/pages/auth/VerifyEmailPage.jsx', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8');

  assert.match(loginSource, /getDashboardPathForRole\(user\?\.role\)/);
  assert.match(verifySource, /getDashboardPathForRole\(user\?\.role\)/);
  assert.match(appSource, /path="\/" element=\{<HomePage \/>\}/);
});

test('auth pages expose contextual account links', () => {
  const loginSource = readFileSync(new URL('../../src/pages/auth/LoginPage.jsx', import.meta.url), 'utf8');
  const registerSource = readFileSync(new URL('../../src/pages/auth/RegisterPage.jsx', import.meta.url), 'utf8');
  const forgotSource = readFileSync(new URL('../../src/pages/auth/ForgotPasswordPage.jsx', import.meta.url), 'utf8');
  const resetSource = readFileSync(new URL('../../src/pages/auth/ResetPasswordPage.jsx', import.meta.url), 'utf8');
  const layoutSource = readFileSync(new URL('../../src/components/auth/AuthLayout.jsx', import.meta.url), 'utf8');

  assert.match(loginSource, /Chưa có tài khoản\?/);
  assert.match(loginSource, /\/auth\/register/);
  assert.match(loginSource, /Quên mật khẩu\?/);
  assert.match(loginSource, /\/auth\/forgot-password/);
  assert.match(registerSource, /Đã có tài khoản\?/);
  assert.match(registerSource, /\/auth\/login/);
  assert.match(forgotSource, /Quay lại đăng nhập/);
  assert.match(forgotSource, /\/auth\/login/);
  assert.match(resetSource, /Quay lại đăng nhập/);
  assert.match(resetSource, /\/auth\/login/);
  assert.equal(layoutSource.includes('auth-links'), false);
});

test('Google sign-in slot uses full-width auth button layout', () => {
  const cssSource = readFileSync(new URL('../../src/components/auth/authStyles.css', import.meta.url), 'utf8');
  const googleSource = readFileSync(new URL('../../src/components/auth/GoogleSignInButton.jsx', import.meta.url), 'utf8');

  assert.match(cssSource, /\.auth-button\s*\{[\s\S]*width:\s*100%;/);
  assert.match(cssSource, /\.google-button-slot\s*\{[\s\S]*width:\s*100%;/);
  assert.match(googleSource, /buttonRef\.current\.clientWidth/);
});

test('auth hero includes OCP brand system and supporting copy', () => {
  const layoutSource = readFileSync(new URL('../../src/components/auth/AuthLayout.jsx', import.meta.url), 'utf8');
  const cssSource = readFileSync(new URL('../../src/components/auth/authStyles.css', import.meta.url), 'utf8');

  assert.match(layoutSource, /auth-logo/);
  assert.match(layoutSource, /Online Course Platform/);
  assert.match(layoutSource, /auth-logo-cap/);
  assert.match(layoutSource, /auth-logo-screen/);
  assert.match(layoutSource, /auth-logo-play/);
  assert.match(layoutSource, /auth-hero-subtitle/);
  assert.match(layoutSource, /auth-hero-points/);
  assert.match(cssSource, /\.auth-logo-mark/);
  assert.match(cssSource, /\.auth-logo-symbol/);
  assert.match(cssSource, /letter-spacing:\s*0;/);
});

test('auth state is provided through context and redirects by role', () => {
  const hookSource = readFileSync(new URL('../../src/hooks/useAuth.js', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8');
  const protectedRouteSource = readFileSync(new URL('../../src/routes/ProtectedRoute.jsx', import.meta.url), 'utf8');

  assert.match(hookSource, /createContext/);
  assert.match(hookSource, /AuthProvider/);
  assert.match(hookSource, /LEARNER:\s*'\/learner'/);
  assert.match(hookSource, /MENTOR:\s*'\/mentor'/);
  assert.match(hookSource, /ADMIN:\s*'\/admin'/);
  assert.match(appSource, /<AuthProvider>/);
  assert.match(appSource, /path="\/learner"/);
  assert.match(appSource, /path="\/mentor"/);
  assert.match(appSource, /path="\/admin"/);
  assert.match(protectedRouteSource, /allowedRoles/);
  assert.match(protectedRouteSource, /Navigate to="\/auth\/login"/);
});

test('role dashboard shows safe user fields only', () => {
  const dashboardSource = readFileSync(new URL('../../src/pages/RoleDashboardPage.jsx', import.meta.url), 'utf8');

  assert.match(dashboardSource, /user\?\.name/);
  assert.match(dashboardSource, /user\?\.email/);
  assert.match(dashboardSource, /user\?\.role/);
  assert.match(dashboardSource, /user\?\.status/);
  assert.equal(dashboardSource.includes('accessToken'), false);
  assert.equal(dashboardSource.includes('refreshToken'), false);
});

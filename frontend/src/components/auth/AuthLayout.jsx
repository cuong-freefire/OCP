export default function AuthLayout({ title, children, footer }) {
  return (
    <main className="auth-shell">
      <section className="auth-hero" aria-label="OCP authentication">
        <div className="auth-logo" aria-label="OCP Online Course Platform">
          <span className="auth-logo-mark" aria-hidden="true">
            <svg className="auth-logo-symbol" viewBox="0 0 64 64" focusable="false">
              <path className="auth-logo-cap" d="M32 8 50 17 32 26 14 17Z" />
              <path className="auth-logo-cap-band" d="M22 22v5.5c3 2.3 6.3 3.4 10 3.4s7-1.1 10-3.4V22" />
              <rect className="auth-logo-screen" x="12" y="25" width="40" height="28" rx="7" />
              <path className="auth-logo-play" d="M29 33.5v10l9-5Z" />
              <path className="auth-logo-progress" d="M20 47.5h24" />
              <path className="auth-logo-stand" d="M32 53v5M24 58h16" />
            </svg>
          </span>
          <span className="auth-logo-copy">
            <strong>OCP</strong>
            <span>Online Course Platform</span>
          </span>
        </div>

        <div className="auth-hero-copy">
          <p className="auth-kicker">Học trực tuyến có lộ trình</p>
          <h1>{title}</h1>
          <p className="auth-hero-subtitle">
            Khám phá khóa học, mở quyền học an toàn và theo dõi hành trình của bạn trong một tài khoản duy nhất.
          </p>
        </div>

        <div className="auth-hero-points" aria-label="OCP highlights">
          <div className="auth-hero-point">
            <span className="auth-point-indicator" aria-hidden="true" />
            <span>Ghi danh khóa học nhanh chóng</span>
          </div>
          <div className="auth-hero-point">
            <span className="auth-point-indicator" aria-hidden="true" />
            <span>Quyền truy cập được xác thực an toàn</span>
          </div>
          <div className="auth-hero-point">
            <span className="auth-point-indicator" aria-hidden="true" />
            <span>Mentor đồng hành đến cuối khóa</span>
          </div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-inner">{children}</div>
        {footer ? <div className="auth-footer">{footer}</div> : null}
      </section>
    </main>
  );
}

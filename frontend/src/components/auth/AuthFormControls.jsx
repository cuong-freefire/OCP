export function TextField({ label, id, type = 'text', value, onChange, autoComplete, inputMode, maxLength }) {
  return (
    <label className="auth-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
      />
    </label>
  );
}

export function PrimaryButton({ children, disabled = false, type = 'submit' }) {
  return (
    <button className="auth-button auth-button-primary" type={type} disabled={disabled}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, disabled = false, type = 'button', onClick }) {
  return (
    <button className="auth-button auth-button-secondary" type={type} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

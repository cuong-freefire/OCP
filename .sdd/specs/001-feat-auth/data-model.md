# Data Model: feat-auth

## Role

**Table**: `roles`

**Purpose**: Backend-controlled role lookup. Public registration assigns the active `LEARNER` role from this table.

**Key fields**

- `id`: UUID primary key.
- `code`: Unique role code, including `LEARNER`.
- `name`: Display name.
- `is_active`: Whether the role can be assigned.
- `created_at`, `updated_at`: Audit timestamps.

**Rules**

- Registration never accepts a frontend role.
- If the active `LEARNER` role is missing, registration must fail safely.

## User

**Table**: `users`

**Purpose**: OCP identity and account-status source of truth.

**Key fields**

- `id`: UUID primary key.
- `role_id`: Foreign key to `roles.id`.
- `name`: User display name. Public registration maps `fullName` here.
- `email`: Unique normalized email address.
- `avatar_url`: Nullable. Public registration leaves this unset.
- `password_hash`: Nullable only for Google-only users.
- `email_verified`: Boolean email ownership state.
- `status`: Account state such as `pending_verification`, `active`, `blocked`.
- `deleted_at`: Soft-delete marker.
- `created_at`, `updated_at`: Audit timestamps.

**Validation**

- `fullName` is required for registration and maps to `name`.
- `email` is trimmed and matched case-insensitively before lookup or storage.
- `password` is validated and hashed before storage.
- Role, user id, status, payment state, enrollment state, course access, image, avatar, and avatar URL are not accepted from public registration input.

**State transitions**

- Public registration: no user or pending local user -> `pending_verification`, `email_verified = false`.
- Email OTP verified: `pending_verification` -> `active`, `email_verified = true`.
- Admin/account management outside this feature may set `blocked` or `deleted_at`; Auth must reject those users.

## Email Verification OTP

**Table**: `email_verifications`

**Purpose**: Secure proof of email verification OTPs for pending local users.

**Key fields**

- `id`: UUID primary key.
- `user_id`: Foreign key to `users.id`.
- `otp_hash`: Hash/proof of the six-digit OTP.
- `expires_at`: Expiry timestamp, 10 minutes after issue.
- `used_at`: Consumption timestamp.
- `failed_attempts`: Number of wrong submissions.
- `locked_at`: Timestamp when failed attempts exceed the allowed maximum.
- `last_sent_at`: Timestamp used for 60-second resend cooldown.
- `created_at`: Creation timestamp.

**Rules**

- Store only `otp_hash`, never raw OTP.
- Maximum 5 failed attempts.
- Latest unused OTP for the user is the only valid OTP.
- Resend invalidates older unused OTPs for the same user.
- Successful verification consumes the OTP, activates the user, and issues auth cookies.

## Refresh Token Session

**Table**: `refresh_tokens`

**Purpose**: Refresh-session storage for cookie-based session continuation, rotation, and revocation.

**Key fields**

- `id`: UUID primary key.
- `user_id`: Foreign key to `users.id`.
- `token_hash`: Hash/proof of the refresh token.
- `expires_at`: Expiry timestamp, 7 days after issue.
- `revoked_at`: Revocation timestamp.
- `replaced_by_token_id`: Nullable link to the rotated replacement session.
- `created_at`: Creation timestamp.

**Rules**

- Store only hashed token proof.
- Refresh rotates the token, revokes the previous record, and rejects reused/revoked/expired records.
- Logout revokes the active refresh token and clears both auth cookies.
- Blocked or deleted users cannot continue a refresh session.

## Password Reset OTP

**Table**: `password_reset_tokens`

**Purpose**: Secure proof of password-reset OTPs for eligible local accounts.

**Key fields**

- `id`: UUID primary key.
- `user_id`: Foreign key to `users.id`.
- `otp_hash`: Hash/proof of the six-digit reset OTP.
- `expires_at`: Expiry timestamp, 10 minutes after issue.
- `used_at`: Consumption timestamp.
- `failed_attempts`: Number of wrong submissions.
- `locked_at`: Timestamp when failed attempts exceed the allowed maximum.
- `last_sent_at`: Timestamp used for 60-second resend cooldown.
- `created_at`: Creation timestamp.

**Rules**

- Create reset OTP only when the email belongs to an existing local account with `password_hash`.
- Do not create reset OTP for unknown email, blocked/deleted user, or Google-only user with `password_hash = NULL`.
- Public forgot-password response remains non-enumerating.
- Resend invalidates older unused reset OTPs.
- Successful reset consumes the OTP and updates `users.password_hash`.

## OAuth Account

**Table**: `oauth_accounts`

**Purpose**: Link an OCP user to a backend-verified Google identity.

**Key fields**

- `id`: UUID primary key.
- `user_id`: Foreign key to `users.id`.
- `provider`: Must be `GOOGLE` for this feature.
- `provider_user_id`: Google subject id.
- `provider_email`: Backend-verified Google email.
- `provider_name`: Optional verified display name.
- `provider_avatar_url`: Optional provider avatar URL retained outside `users.avatar_url`.
- `metadata`: Optional sanitized provider metadata without tokens or secrets.
- `created_at`, `updated_at`: Audit timestamps.

**Rules**

- Unique by `(provider, provider_user_id)`.
- Unique by `(user_id, provider)`.
- Do not store Google `id_token`, `access_token`, or `refresh_token`.
- Verified Google email for a new OCP user creates an active email-verified learner.
- Verified Google email matching an existing active user links to that user rather than creating a duplicate.
- Pending local user auto-link/auto-activation remains out of scope unless clarified later.

## Current User/Profile View

**Purpose**: Safe API response derived from backend session.

**Fields**

- `id`
- `name`
- `email`
- `avatarUrl`
- `role`
- `status`
- `emailVerified`
- `hasLocalPassword`

**Rules**

- Never include `password_hash`, raw OTP, raw refresh token, JWT value, cookie value, OAuth token, SMTP credential, secret, raw SQL error, or raw Prisma error.
- Frontend displays this data for UX only. Backend authorization remains authoritative.

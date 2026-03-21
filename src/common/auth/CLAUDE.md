# Authentication & Authorization Service

## What This Module Does
JWT-based stateless authentication with MFA (TOTP), RBAC for 4 roles, and API key authentication for partners.

## Key Rules
- JWT access token expiry: ≤ 1 hour
- Refresh token expiry: 7 days
- MFA (TOTP) is **mandatory** for Admin and Auditor roles
- Session timeout: 30 minutes of inactivity
- Passwords hashed with bcrypt
- API keys shown once on creation, stored as hash

## Four Roles (RBAC)
| Role | Data Scope | MFA |
|------|-----------|-----|
| Exporter | Own lanes only | Optional |
| Partner | Assigned lane data only | API Key |
| Admin | All lanes (partially anonymized) | Mandatory |
| Auditor | Read-only all lanes | Mandatory |

## Guards and Decorators
- `@Roles('exporter', 'admin')` — role requirement on controller methods
- `RolesGuard` — checks JWT role claim
- `LaneOwnerGuard` — ensures Exporters only access own lanes
- `PartnerScopeGuard` — ensures Partners only access assigned lanes
- `AuditorReadOnlyGuard` — prevents write operations for Auditor role

## Testing
- JWT: generation, verification, expiry, refresh
- TOTP: generation, verification, mandatory enforcement for Admin/Auditor
- Guards: role escalation prevented, scope enforcement per role
- API keys: creation, validation, IP whitelisting, revocation

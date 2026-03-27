# Authentication Setup Quick Reference

## Authentication Modes

This application supports two authentication modes:

### 1. Auth0 (Default) - Full OAuth2/OIDC

- Google, Microsoft, GitHub, Facebook, ORCID
- Enterprise SSO
- Managed authentication service

### 2. Local Auth - Open Source

- Simple email/password authentication
- Optional LDAP/Active Directory integration
- No external dependencies
- Perfect for self-hosted/on-premise deployments

## Quick Start

### Use Auth0 (default)

```bash
AUTH_MODE=auth0
AUTH0_SECRET=your_auth0_secret
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
```

### Use Local Auth

```bash
AUTH_MODE=local
AUTH_SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

### Use Local Auth + LDAP

```bash
AUTH_MODE=local
AUTH_SESSION_SECRET=your-secure-random-secret
LDAP_ENABLED=true
LDAP_URL=ldap://ldap.example.com:389
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_PASSWORD=password
LDAP_SEARCH_BASE=ou=users,dc=example,dc=com
LDAP_SEARCH_FILTER=(uid={{username}})
```

## Features

### Auth0 Mode

✅ Social login (Google, Microsoft, GitHub, Facebook)  
✅ Academic login (ORCID for researchers)  
✅ Email/password via Auth0  
✅ Enterprise SSO  
✅ Email verification  
✅ Password reset

### Local Mode

✅ Simple email/password (no verification)  
✅ LDAP/Active Directory integration  
✅ Perfect for universities and research institutions  
✅ No external service dependencies  
✅ Full control over user data  
✅ Self-registration (when LDAP disabled)

## Logo Setup

Place your logo files in the `public/` folder:

- `logo-colors.svg` - Light mode logo
- `logo-white.svg` - Dark mode logo

## Documentation

- **LDAP Setup**: See [LDAP_SETUP.md](./LDAP_SETUP.md) for detailed configuration
- **Auth0 Setup**: See Auth0 dashboard documentation

## Security Notes

- Always use strong random secrets
- Use LDAPS (SSL) in production
- Enable HTTPS for production deployments
- Secure service accounts properly

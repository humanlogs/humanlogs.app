# Local Authentication & LDAP Setup Guide

This application supports two authentication modes:

- **Auth0** - Full-featured OAuth2/OIDC with social providers
- **Local** - Open-source local authentication with optional LDAP/Active Directory integration

## Quick Start: Local Authentication

### 1. Enable Local Auth

Set the environment variable:

```bash
export AUTH_MODE=local
export AUTH_SESSION_SECRET="your-secure-random-secret-here"
```

Or in your `.env` file:

```env
AUTH_MODE=local
AUTH_SESSION_SECRET=your-secure-random-secret-here
```

### 2. Generate a Secure Session Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and use it as your `AUTH_SESSION_SECRET`.

### 3. Restart Your Application

```bash
npm run dev
```

### 4. Register Users

When in local auth mode without LDAP, users can register directly at the login page. The first time you visit `/login`, you'll see a "Register" option.

## LDAP / Active Directory Integration

### Why Use LDAP?

LDAP integration allows you to:

- Authenticate users against your existing directory (Active Directory, OpenLDAP, etc.)
- Eliminate the need for separate user management
- Perfect for universities, research institutions, and enterprises
- No email verification needed - users authenticate with existing credentials

### Prerequisites

Install the LDAP client library:

```bash
npm install ldapjs
npm install -D @types/ldapjs
```

### Configuration

#### 1. Environment Variables

Add these to your `.env` file:

```env
# Authentication Mode
AUTH_MODE=local
AUTH_SESSION_SECRET=your-secure-session-secret

# LDAP Configuration
LDAP_ENABLED=true
LDAP_URL=ldap://your-ldap-server.example.com:389
LDAP_BIND_DN=cn=service-account,dc=example,dc=com
LDAP_BIND_PASSWORD=service-account-password
LDAP_SEARCH_BASE=ou=users,dc=example,dc=com
LDAP_SEARCH_FILTER=(uid={{username}})
```

#### 2. LDAP Configuration Details

**LDAP_URL**: The URL of your LDAP server

- OpenLDAP: `ldap://localhost:389` or `ldaps://localhost:636` (SSL)
- Active Directory: `ldap://ad.example.com:389`

**LDAP_BIND_DN**: Service account for searching users

- OpenLDAP: `cn=admin,dc=example,dc=com`
- Active Directory: `CN=Service Account,OU=Service Accounts,DC=example,DC=com`

**LDAP_BIND_PASSWORD**: Password for the service account

**LDAP_SEARCH_BASE**: Where to search for users

- OpenLDAP: `ou=users,dc=example,dc=com`
- Active Directory: `OU=Users,DC=example,DC=com`

**LDAP_SEARCH_FILTER**: How to find users

- By username: `(uid={{username}})`
- By email: `(mail={{username}})`
- Active Directory: `(sAMAccountName={{username}})`
- Multiple options: `(|(uid={{username}})(mail={{username}}))`

### Examples for Common LDAP Servers

#### OpenLDAP

```env
LDAP_ENABLED=true
LDAP_URL=ldap://ldap.example.com:389
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_PASSWORD=adminpassword
LDAP_SEARCH_BASE=ou=users,dc=example,dc=com
LDAP_SEARCH_FILTER=(uid={{username}})
```

#### Active Directory (Windows Server)

```env
LDAP_ENABLED=true
LDAP_URL=ldap://ad.university.edu:389
LDAP_BIND_DN=CN=ServiceAccount,OU=ServiceAccounts,DC=university,DC=edu
LDAP_BIND_PASSWORD=servicepassword
LDAP_SEARCH_BASE=OU=Faculty,DC=university,DC=edu
LDAP_SEARCH_FILTER=(sAMAccountName={{username}})
```

#### Universities with Shibboleth/EduPerson

```env
LDAP_ENABLED=true
LDAP_URL=ldaps://ldap.university.edu:636
LDAP_BIND_DN=uid=service,ou=special,dc=university,dc=edu
LDAP_BIND_PASSWORD=servicepassword
LDAP_SEARCH_BASE=ou=people,dc=university,dc=edu
LDAP_SEARCH_FILTER=(|(uid={{username}})(mail={{username}}))
```

### Testing LDAP Connection

You can test your LDAP configuration using the `ldapsearch` command:

```bash
ldapsearch -H ldap://your-server:389 \
  -D "cn=admin,dc=example,dc=com" \
  -w "password" \
  -b "ou=users,dc=example,dc=com" \
  "(uid=testuser)"
```

### Security Considerations

#### 1. Use LDAPS (LDAP over SSL) in Production

```env
LDAP_URL=ldaps://ldap.example.com:636
```

#### 2. Secure Service Account

- Use a dedicated service account with minimal permissions
- Only grant read access to user attributes
- Never use an admin account

#### 3. Restrict Search Base

- Limit search to specific OUs containing valid users
- Prevents unauthorized access to system accounts

#### 4. Session Security

- Always use a strong, random session secret
- Set `NODE_ENV=production` in production
- Ensure cookies are HTTPS-only (automatic in production)

### User Flow with LDAP

1. User visits `/login`
2. User enters their LDAP username/email and password
3. Application queries LDAP server to find the user
4. Application attempts to bind (authenticate) as that user
5. On success:
   - User is created/updated in local database
   - Session cookie is set
   - User is redirected to application

### Troubleshooting

#### "LDAP authentication error"

Check:

- LDAP server is accessible (firewall rules)
- Service account credentials are correct
- Search base and filter are correct

#### "Invalid email or password"

Check:

- User exists in LDAP
- User DN matches the search filter
- User password is correct

#### Debug Mode

Add logging to see LDAP queries:

```typescript
// In lib/local-auth.ts, add console.log statements
console.log("Searching LDAP with filter:", searchFilter);
console.log("LDAP search base:", ldapConfig.searchBase);
```

### Disabling Local Registration

When LDAP is enabled, local user registration is automatically disabled. Users must exist in your LDAP directory to authenticate.

To allow both LDAP and local registration:

Edit `app/api/local-auth/register/route.ts` and remove the LDAP check.

## Switching Between Auth Modes

### From Auth0 to Local

1. Set `AUTH_MODE=local`
2. Configure LDAP or allow local registration
3. Restart application
4. Existing users with email/password can still log in
5. LDAP users will be auto-created on first login

### From Local to Auth0

1. Set `AUTH_MODE=auth0`
2. Configure Auth0 credentials
3. Restart application
4. Users will need to re-authenticate via Auth0

## Production Checklist

- [ ] Use LDAPS (SSL) instead of plain LDAP
- [ ] Generate a strong random session secret
- [ ] Set `NODE_ENV=production`
- [ ] Use a dedicated LDAP service account
- [ ] Enable HTTPS on your application
- [ ] Configure proper CORS policies
- [ ] Set up monitoring for failed auth attempts
- [ ] Back up user database regularly
- [ ] Test LDAP failover if available

## Support

For issues or questions:

- Check LDAP server logs
- Verify network connectivity
- Test with `ldapsearch` command
- Review application logs for errors

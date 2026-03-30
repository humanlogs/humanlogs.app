# Configuration de l'Authentification - Guide Rapide

## Modes d'Authentification

Cette application prend en charge deux modes d'authentification :

### 1. Auth0 (Par défaut) - OAuth2/OIDC Complet

- Google, Microsoft, GitHub, Facebook, ORCID
- SSO Entreprise
- Service d'authentification géré

### 2. Auth Locale - Open Source

- Authentification simple par email/mot de passe
- Intégration LDAP/Active Directory optionnelle
- Aucune dépendance externe
- Parfait pour les déploiements auto-hébergés/sur site

## Démarrage Rapide

### Utiliser Auth0 (par défaut)

```bash
AUTH_MODE=auth0
AUTH0_SECRET=votre_secret_auth0
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://votre-tenant.auth0.com
AUTH0_CLIENT_ID=votre_client_id
AUTH0_CLIENT_SECRET=votre_client_secret
```

### Utiliser l'Auth Locale

```bash
AUTH_MODE=local
AUTH_SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

### Utiliser l'Auth Locale + LDAP

```bash
AUTH_MODE=local
AUTH_SESSION_SECRET=votre-secret-aléatoire-sécurisé
LDAP_ENABLED=true
LDAP_URL=ldap://ldap.exemple.com:389
LDAP_BIND_DN=cn=admin,dc=exemple,dc=com
LDAP_BIND_PASSWORD=motdepasse
LDAP_SEARCH_BASE=ou=utilisateurs,dc=exemple,dc=com
LDAP_SEARCH_FILTER=(uid={{username}})
```

## Informations Supplémentaires

Pour plus de détails sur la configuration LDAP, consultez le [guide de configuration LDAP](LDAP_SETUP).

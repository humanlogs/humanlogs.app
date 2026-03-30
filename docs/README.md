# Documentation System

This folder contains all the documentation files that are automatically rendered on the `/resources` page of the application.

## Features

### Automatic Discovery

- All `.md` files in this folder and subfolders are automatically discovered and displayed in the sidebar
- Folders create navigation groups
- Files are sorted alphabetically with folders appearing first

### Localization Support

- The system automatically checks for localized versions of documents based on the user's language preference
- Naming convention: `FILENAME_<locale>.md` (e.g., `AUTH_SETUP_fr.md` for French)
- The system first checks for `FILENAME_<locale>.md`, and falls back to `FILENAME.md` if not found
- Supported locales: `en`, `fr`, `es`, `de`

### Examples

- `AUTH_SETUP.md` - English version (default)
- `AUTH_SETUP_fr.md` - French version
- `AUTH_SETUP_es.md` - Spanish version
- `AUTH_SETUP_de.md` - German version

When a French user visits the docs, the system will automatically show `AUTH_SETUP_fr.md` if it exists, otherwise it will show `AUTH_SETUP.md`.

## Organization

You can organize documentation in subfolders:

```
docs/
  ├── AUTH_SETUP.md
  ├── AUTH_SETUP_fr.md
  ├── LDAP_SETUP.md
  ├── api/
  │   ├── overview.md
  │   └── endpoints.md
  └── guides/
      ├── getting-started.md
      └── deployment.md
```

This will create a hierarchical navigation in the sidebar.

## Markdown Support

All standard Markdown features are supported:

- Headings
- Links
- Code blocks with syntax highlighting
- Lists (ordered and unordered)
- Tables
- Blockquotes
- Images
- And more (GitHub Flavored Markdown)

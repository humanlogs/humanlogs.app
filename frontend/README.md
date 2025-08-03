# Frontend - React + TypeScript + Vite + shadcn/ui

A modern React frontend application built with TypeScript, Vite, and shadcn/ui components.

## Features

- React 18 with TypeScript
- Vite for fast development and building
- Tailwind CSS for styling
- shadcn/ui component library
- Path aliases configured (@/* imports)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application will start on http://localhost:5173

### Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   └── ui/           # shadcn/ui components
│   ├── lib/
│   │   └── utils.ts      # Utility functions
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── components.json       # shadcn/ui configuration
└── tsconfig.json
```

## shadcn/ui Components

This project includes shadcn/ui components. To add more components:

```bash
npx shadcn@latest add [component-name]
```

Available components: https://ui.shadcn.com/docs/components

## Styling

- Tailwind CSS is configured and ready to use
- shadcn/ui components use Tailwind CSS classes
- Custom styles can be added to `src/index.css`
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

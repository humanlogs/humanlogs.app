<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Frontend Project Instructions

This is a React TypeScript frontend application using Vite and shadcn/ui. When working on this project:

## Code Style
- Use TypeScript for all components and logic
- Use functional components with hooks
- Follow React best practices and conventions
- Use proper TypeScript types and interfaces
- Implement proper error boundaries

## Component Design
- Use shadcn/ui components when available
- Create reusable custom components in `src/components/`
- Use Tailwind CSS for styling
- Follow component composition patterns
- Implement proper prop types

## Import Conventions
- Use the `@/` alias for src imports (e.g., `@/components/ui/button`)
- Import shadcn/ui components from `@/components/ui/`
- Group imports: external libraries, internal components, relative imports

## State Management
- Use React hooks for local state
- Consider context for shared state
- Implement proper loading and error states
- Use proper TypeScript types for state

## Styling
- Use Tailwind CSS utility classes
- Follow shadcn/ui design system conventions
- Use CSS custom properties for theming
- Ensure responsive design with Tailwind breakpoints

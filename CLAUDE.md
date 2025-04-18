# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- `bun --bun next dev -p 3005` - Start development server
- `next build` - Build for production
- `node .next/standalone/server.js` - Run production server
- `next lint` - Run linting
- `bun run scripts/run-migrations.js` - Run Supabase migrations

## Code Style Guidelines
- **TypeScript**: Use strict mode, explicit types for functions/components
- **Imports**: Group by: 1) React/Next, 2) Components, 3) Utils/types, 4) Libraries
- **Components**: Functional style with "use client" directive when needed
- **Naming**: PascalCase for components/interfaces, camelCase for variables/functions
- **Files**: kebab-case for component files
- **Error Handling**: Use try/catch with toast notifications for user feedback
- **Styling**: Use Tailwind with cn utility for conditional classes
- **State**: useState/useEffect for local state, props for component communication
- **Database**: Supabase for data storage and authentication
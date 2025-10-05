# Appeal Shark Frontend

Next.js 15 + TypeScript app configured with Tailwind CSS v4, ESLint, Prettier, and Vitest for the Appeal Shark property tax appeal platform.

## Prerequisites

- Node.js 20.11+
- npm 10+

### Environment Variables

Create a `.env.local` file in `frontend/` with the following entries before running the app locally:

```
SUPABASE_URL=your-supabase-instance-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
DATABASE_URL=postgresql://user:password@host:5432/database
PDFCO_API_KEY=your-pdfco-api-key
OPENAI_API_KEY=your-openai-api-key
# Optional override if you prefer a different model than the default gpt-4o-mini-2024-07-18
OPENAI_EXTRACTION_MODEL=gpt-4.1-mini
NEXT_PUBLIC_DEMO_USER_ID=00000000-0000-4000-8000-000000000000
# Optional helpers for local testing
NEXT_PUBLIC_DEMO_USER_EMAIL=demo@appealshark.test
DEMO_USER_PASSWORD=DemoUserPass123!
```

The upload and parsing APIs use the Supabase service role on the server only. The parsing pipeline securely hands a short-lived signed URL to PDF.co, then sends the extracted text to OpenAI for structured data. Supabase encrypts bucket objects at rest by default.

After configuring environment variables you can seed a Supabase Auth user (and mirror Prisma record) for the `NEXT_PUBLIC_DEMO_USER_ID` value via:

```bash
npm run seed:demo-user
```

The script is idempotent and safe to re-run; it will create the user if missing and then upsert the corresponding Prisma row so local uploads succeed.

Install dependencies:

```bash
npm install
```

## Available Scripts

- `npm run dev` — start the Next.js development server on [http://localhost:3000](http://localhost:3000)
- `npm run build` — create a production build
- `npm run start` — serve the production build locally
- `npm run lint` — run ESLint across the project
- `npm run lint:fix` — autofix lint issues when possible
- `npm run format` / `npm run format:check` — format with Prettier or verify formatting
- `npm run test` / `npm run test:watch` — run Vitest test suites once or in watch mode
- `npm run type-check` — verify TypeScript types without emitting output
- `npm run prisma:generate` — regenerate the Prisma client after schema changes

## Testing Setup

- Vitest configured with the React plugin and jsdom environment
- Testing Library for component tests (`@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`)
- Example spec: `src/app/page.test.tsx`

## Linting & Formatting

- Flat ESLint config extending `next/core-web-vitals`, `next/typescript`, and `prettier`
- Vitest globals added for specs
- Prettier 3 with project-wide configuration (`prettier.config.mjs`)

## Project Structure

```
frontend/
  src/
    app/
      layout.tsx
      page.tsx
      page.test.tsx
    test/
      setup.ts
  eslint.config.mjs
  prettier.config.mjs
  postcss.config.mjs
  vitest.config.ts
```

## Next Steps

- Connect Supabase, PDF.co, OpenAI, Zillow, and Stripe credentials via environment variables when ready
- Flesh out domain-specific features referenced in the PRD (upload workflow, admin dashboard, etc.)

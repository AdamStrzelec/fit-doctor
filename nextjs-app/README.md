This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## AI SDK (Vercel)

This project includes a minimal integration of the Vercel AI SDK:

- API route: `app/api/ai/chat/route.ts` (streams responses using OpenAI via `@ai-sdk/openai`).
- Client page: `app/(main)/ai/page.tsx` (simple chat UI with `useChat`).

Setup:

1. Add your API key to `.env.local`:

```bash
OPENAI_API_KEY=sk-...
```

2. Install deps and run the app:

```bash
npm install
npm run dev
```

3. Open http://localhost:3000/ai and start chatting.

Notes:

- The default model is `gpt-4o-mini` via OpenAI. You can change it in `app/api/ai/chat/route.ts`.
- To use another provider, install the corresponding connector (e.g. `@ai-sdk/anthropic`) and update the route accordingly.

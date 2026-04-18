This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Environment

Create a `.env` file in this directory with your OpenAI API key:

```bash
OPENAI_API_KEY=sk-...
```

Optionally set the chat model (defaults to `gpt-4o-mini`):

```bash
OPENAI_MODEL=gpt-4o-mini
```

Other examples: `gpt-4o`, `gpt-3.5-turbo`.

### “Insufficient quota” / 429 from OpenAI

That response means **your OpenAI project has no paid quota left** (or billing is not set up). **Changing `OPENAI_MODEL` does not fix it.** Fix it in the OpenAI dashboard: [Billing](https://platform.openai.com/account/billing) and [Usage](https://platform.openai.com/usage). Use an API key from an account that has access and credits.

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

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

https://www.youtube.com/watch?v=tZGSGTxXfuw

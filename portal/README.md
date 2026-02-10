This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment Variables

### Required Environment Variables

Before deploying or running locally, you need to configure these environment variables:

1. **Database Configuration**
   - `DATABASE_URL`: PostgreSQL connection string (required)

2. **Authentication**
   - `NEXTAUTH_SECRET`: Secret for session encryption (generate with `openssl rand -base64 32`)
   - `NEXTAUTH_URL`: Base URL where the app is hosted

3. **License Management**
   - `LICENSE_SIGNING_SECRET`: Secret for JWT license signing (generate with `openssl rand -base64 32`)
   - `SETUP_SECRET`: Secret for admin setup API (generate with `openssl rand -base64 32`)

4. **API Proxy Configuration (CRITICAL for Production)**
   - `CLICKPRO_API_URL`: **Server-side** URL for the ClickPro/WhatsApp Integration API
     - Example: `https://api.clickpro.example.com` or `http://localhost:3001` for local dev
     - **IMPORTANT**: Do NOT use `NEXT_PUBLIC_` prefix for this variable
     - This is used by the server-side proxy at `/api/clients/[...path]`
     - Must be set in Vercel: **Project Settings > Environment Variables**
     - Apply to all environments (Production, Preview, Development)

### Understanding NEXT_PUBLIC_ vs Server-Side Variables

- **`NEXT_PUBLIC_*` variables** are bundled at build time and exposed to the browser
  - Available in client-side code
  - NOT available in API routes at runtime on Vercel
  - Use only for client-side features

- **Server-side variables** (without `NEXT_PUBLIC_` prefix) are available at runtime
  - Available in API routes, server components, and server actions
  - NOT exposed to the browser
  - Use for sensitive data and server-side configuration

### Vercel Deployment Setup

1. Go to your Vercel project dashboard
2. Navigate to **Settings > Environment Variables**
3. Add `CLICKPRO_API_URL` with the URL of your ClickPro API server
4. Apply to all environments (Production, Preview, Development)
5. Redeploy the application for changes to take effect

See `.env.example` for a complete list of available environment variables.

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

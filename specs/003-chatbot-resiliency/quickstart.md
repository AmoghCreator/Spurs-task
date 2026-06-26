# Quickstart Guide: Chatbot Resiliency & Streaming

This guide explains how to spin up the local development environment, perform migrations, and run automated tests.

---

## 1. Prerequisites & Environment Setup

Ensure you have Node.js and `pnpm` installed.

1. Install dependencies from the project root:
   ```bash
   pnpm install
   ```

2. Copy the environment template and ensure your API keys are configured:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to include your `GEMINI_API_KEY` or `OPENAI_API_KEY`.

---

## 2. Database Migrations

Generate and run the SQLite database migrations to support the conversation metadata columns:

```bash
# Generate the SQL migration schema
pnpm db:generate

# Execute migration on the SQLite database (chat.db)
pnpm db:migrate
```

---

## 3. Launching the Services

Start both the backend API server (port 3002) and frontend web client (port 3000) concurrently:

```bash
pnpm dev
```

- **Frontend Chat UI**: Navigate to [http://localhost:3000/chat](http://localhost:3000/chat) in your browser.
- **Backend API Docs / Health**: Access [http://localhost:3002/health](http://localhost:3002/health) to verify backend connectivity.

---

## 4. Running Automated Tests

Execute the API test suite using Vitest:

```bash
pnpm test
```

# Data Model: UI Revamp

This document describes the state models, CSS custom variables (design tokens), and TypeScript interfaces used to support the dual-theme UI revamp.

## Color Tokens & Theme Configuration

Themes are controlled via CSS custom properties dynamically loaded based on user's system preferences (`prefers-color-scheme`).

### CSS custom properties (`globals.css`)

```css
:root {
  /* Common font */
  --font-outfit: 'Outfit', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

  /* Light Theme defaults */
  --bg-page: radial-gradient(ellipse at 20% 50%, #f1f5f9 0%, #e2e8f0 100%);
  --bg-card: rgba(255, 255, 255, 0.8);
  --border-card: rgba(15, 23, 42, 0.08);
  --bg-header: rgba(248, 250, 252, 0.7);
  --border-header: rgba(15, 23, 42, 0.06);
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;
  --bg-input: rgba(255, 255, 255, 0.9);
  --border-input: rgba(15, 23, 42, 0.12);
  --bg-bubble-ai: rgba(241, 245, 249, 0.95);
  --text-bubble-ai: #0f172a;
  --shadow-card: 0 20px 40px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  --shadow-bubble-ai: 0 2px 8px rgba(0, 0, 0, 0.04);
  --bg-blob-1: radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%);
  --bg-blob-2: radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%);
  --chip-bg: rgba(59, 130, 246, 0.06);
  --chip-text: #1d4ed8;
  --chip-border: rgba(59, 130, 246, 0.2);
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Dark Theme */
    --bg-page: radial-gradient(ellipse at 20% 50%, #0d1729 0%, #080c14 100%);
    --bg-card: rgba(10, 16, 30, 0.72);
    --border-card: rgba(255, 255, 255, 0.07);
    --bg-header: rgba(15, 23, 42, 0.5);
    --border-header: rgba(255, 255, 255, 0.06);
    --text-primary: #f1f5f9;
    --text-secondary: #94a3b8;
    --text-muted: #64748b;
    --bg-input: rgba(15, 23, 42, 0.8);
    --border-input: rgba(255, 255, 255, 0.08);
    --bg-bubble-ai: rgba(30, 41, 59, 0.85);
    --text-bubble-ai: #f1f5f9;
    --shadow-card: 0 25px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06);
    --shadow-bubble-ai: 0 2px 8px rgba(0, 0, 0, 0.3);
    --bg-blob-1: radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%);
    --bg-blob-2: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%);
    --chip-bg: rgba(59, 130, 246, 0.1);
    --chip-text: #93c5fd;
    --chip-border: rgba(59, 130, 246, 0.25);
  }
}
```

## Component State Structure

No changes to structural schemas are made. All UI improvements use modern CSS state transitions.

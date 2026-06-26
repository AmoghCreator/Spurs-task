# Quickstart Guide: UI Revamp

This quickstart guides you on how to start the local Next.js development server and verify the redesigned UI.

## Start Development Server

Run the following command from the repository root:

```bash
pnpm --filter web dev
```

The application will be accessible at:
[http://localhost:3000](http://localhost:3000)

## Testing the Layout

1. **Dual Theme Validation**: Toggle your OS system light/dark preference to verify the UI dynamically updates to support both dark mode and light mode aesthetics.
2. **Responsive Checks**: Use browser inspector to check viewports for:
   - Mobile: `<768px`
   - Tablet: `768px-1024px`
   - Desktop: `>1024px`
3. **Micro-animations**: Verify the following hover/focus states:
   - Floating CTA and suggestion chips.
   - Message animation scales.
   - Smooth text-typing indicators.

# Research: UI Revamp

This document captures the styling decisions, theme integration, animation strategies, and UX details chosen to align with the Spur branding while delivering a premium, dual-theme experience.

## Theme Architecture & Color Palette
- **Aesthetic Direction**: A hybrid light/dark system targeting system preferences, leveraging Spur's trust-focused corporate identity (deep blues, clean indigos, and neutral slate tones).
- **Core Palette**:
  - Primary: `#2563eb` (Spur Blue) to `#4f46e5` (Indigo) gradients for accents/cta.
  - Light Theme: Pure/snow background (`#ffffff` / `#f8fafc`), clean borders (`#e2e8f0`), text (`#0f172a`), muted text (`#475569`).
  - Dark Theme: Deep slate-blue canvas (`#0b0f19` / `#0f172a`), borders (`rgba(255,255,255,0.08)`), text (`#f8fafc`), muted text (`#94a3b8`).
- **Implementation**: Pure CSS Custom Variables (`var(--bg-primary)`, `var(--text-primary)`, etc.) toggled automatically via `@media (prefers-color-scheme: dark)` in `globals.css`.

## Animation and Micro-interactions
- **Framework**: CSS transitions and keyframes to keep dependencies lightweight and performance high (supporting 60fps).
- **Interactions**:
  - Soft bounce on typing dots.
  - Elegant float and hover animations for buttons and chips.
  - Message bubble entrance: 3D scale-up and fade-in to feel modern.
  - Custom scrollbar fading.

## Verification
- Test responsive states across Mobile (<768px), Tablet (768px-1024px), and Desktop (>1024px).
- Verify standard contract integration with `apps/api`.

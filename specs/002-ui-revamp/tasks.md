# Tasks: UI Revamp

**Input**: Design documents from `/specs/002-ui-revamp/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: Tests are NOT requested in the spec, so visual validation will be performed manually.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Style token definition and environment preparation

- [X] T001 Define modern design tokens (CSS variables) for gradients, glassmorphism, glows, and custom font weights in [globals.css](file:///home/ascii_heart/Documents/spur-agent/apps/web/app/globals.css)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core animations and global styles needed before screen-level changes

- [X] T002 Implement core keyframes for glow effects, pulsing blobs, and float animations in [globals.css](file:///home/ascii_heart/Documents/spur-agent/apps/web/app/globals.css)

---

## Phase 3: User Story 1 - Visually Engaging Experience (Priority: P1) 🎯 MVP

**Goal**: Complete visual overhaul of landing page and main chat container with a glassmorphic aesthetic.

**Independent Test**: Run the web server and verify that the homepage and main chat container show modern glassmorphism styling, clean layout, and rich fonts.

### Implementation for User Story 1

- [X] T003 [US1] Overhaul landing page design with modern layout, floating visual blobs, typography, and glowing call-to-action button in [page.tsx](file:///home/ascii_heart/Documents/spur-agent/apps/web/app/page.tsx)
- [X] T004 [US1] Redesign chat window backdrop, floating layout blobs, and outer glass container with backdrop blur, border glowing, and header in [page.tsx](file:///home/ascii_heart/Documents/spur-agent/apps/web/app/chat/page.tsx)

**Checkpoint**: Landing page and main chat shell look premium and load without visual errors.

---

## Phase 4: User Story 2 - Consistent Premium Styling Across Components (Priority: P2)

**Goal**: Style chat bubble details, inputs, suggestions, typing indicators, and interactive micro-animations.

**Independent Test**: Send messages in the chat, check typing indicators, hover over buttons/suggestions, and check visual aesthetics of input.

### Implementation for User Story 2

- [X] T005 [P] [US2] Update global scrollbar thumb/track and text selection styles to match theme in [globals.css](file:///home/ascii_heart/Documents/spur-agent/apps/web/app/globals.css)
- [X] T006 [US2] Revamp the suggestion chips, empty state styling, and typing indicator animation in [page.tsx](file:///home/ascii_heart/Documents/spur-agent/apps/web/app/chat/page.tsx)
- [X] T007 [US2] Overhaul message bubbles (user and AI) with translucent color backgrounds, glowing box-shadows, and smooth entry animations in [page.tsx](file:///home/ascii_heart/Documents/spur-agent/apps/web/app/chat/page.tsx)
- [X] T008 [US2] Redesign text input field and send button with micro-animations, active glow borders, and disabled state styling in [page.tsx](file:///home/ascii_heart/Documents/spur-agent/apps/web/app/chat/page.tsx)

**Checkpoint**: Full chat interface interactions (sending messages, animations) look premium, fluid, and visually polished.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, performance optimizations, and final validation.

- [X] T009 Refactor legacy inline styles and consolidate unused CSS-in-JS style object properties in [page.tsx](file:///home/ascii_heart/Documents/spur-agent/apps/web/app/chat/page.tsx)
- [X] T010 [P] Test and refine layout responsiveness for mobile (320px+), tablet, and desktop viewports
- [X] T011 Run quickstart.md validation by running `pnpm --filter web dev` and testing end-to-end functionality

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001).
- **User Story 1 (Phase 3)**: Depends on Phase 2.
- **User Story 2 (Phase 4)**: Depends on User Story 1 completion.
- **Polish (Phase 5)**: Depends on all prior phases.

### Parallel Opportunities

- Scrollbars style task T005 in Phase 4 is marked [P] and can be done in parallel with other Phase 4 tasks since it's restricted to `globals.css` instead of `chat/page.tsx`.

---

## Parallel Example: User Story 2

```bash
# Launch global scrollbar styling task:
Task: "Update global scrollbar thumb/track and text selection styles in apps/web/app/globals.css"

# In parallel, developers can work on chat-specific styling in chat/page.tsx:
Task: "Revamp the suggestion chips, empty state styling, and typing indicator animation in apps/web/app/chat/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Verify page layouts.

### Incremental Delivery

1. Setup + Foundation ready.
2. Add Landing Page + Chat Container (US1) -> Visual Demo.
3. Add Chat Detail Components & Micro-animations (US2) -> Full Interactions Demo.
4. Polish and Final E2E checks.

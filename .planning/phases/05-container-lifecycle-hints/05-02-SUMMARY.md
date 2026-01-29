---
phase: 05-container-lifecycle-hints
plan: 02
subsystem: user-assistance
tags: ["progressive-disclosure", "hint-system", "tanstack-query", "api-integration", "react-hooks"]
completed: 2026-01-29
duration: "6 minutes"

requires: ["01-01", "02-01", "03-01", "challenge-definitions", "session-management"]
provides: ["progressive-hint-system", "hint-api", "hint-ui", "hint-state-management"]
affects: ["challenge-experience", "learning-curve", "user-engagement"]

tech-stack:
  added: []
  patterns: ["progressive-disclosure", "api-service-integration", "optimistic-updates", "real-time-refresh"]

decisions:
  - decision: "5-minute hint unlock interval with request-based early access"
    rationale: "Balanced learning assistance without eliminating challenge difficulty"
  - decision: "30-second automatic refresh with optimistic mutations"
    rationale: "Real-time timer updates with responsive user interactions"
  - decision: "Session-based hint state with in-memory storage"
    rationale: "Simple persistence for local-only architecture"

key-files:
  created:
    - "engine/hint_service.py"
    - "api/hints/route.js"
    - "frontend/components/challenge/hint-panel.tsx"
    - "frontend/hooks/useHints.ts"
  modified: []
---

# Phase 5 Plan 2: Progressive Hint System Summary

**One-liner:** Progressive hint disclosure with time-based and request-based unlocking using TanStack Query for real-time state management

## What Was Built

Implemented a complete progressive hint system enabling users to get contextual help for challenges with adaptive disclosure timing:

### Core Components

1. **HintService (Python)** - Progressive hint disclosure logic
   - Time-based hint unlocking (5-minute intervals)
   - Request-based early access with validation
   - Session-specific hint state tracking
   - Challenge metadata integration with caching

2. **Hint API Endpoints** - Express routes for hint management
   - `GET /api/hints` - Retrieve available hints with status
   - `POST /api/hints` - Request early hint access with rate limiting
   - `GET /api/hints/status` - Timing and availability information
   - Python service integration with comprehensive error handling

3. **HintPanel Component** - React UI for progressive hint disclosure
   - Card-based hint display with shadcn/ui components
   - Real-time countdown timer for next unlock
   - Request hint button with loading states
   - Progress indicators and responsive design

4. **Hint Hooks** - TanStack Query state management
   - `useHints()` - Fetch hints with 30-second auto-refresh
   - `useRequestHint()` - Mutation with optimistic updates
   - Comprehensive error handling and retry logic
   - Type-safe API integration with exponential backoff

## Technical Implementation

### Progressive Disclosure Logic
- **Time-based unlocking**: One hint every 5 minutes automatically
- **Request-based access**: Early access with 60-second rate limiting
- **Session isolation**: Hint state tracked per challenge session
- **Configuration-driven**: Hints loaded from challenge metadata

### Real-time Updates
- **30-second refresh interval** for timer updates
- **Background refresh** when tab not focused
- **Optimistic mutations** with rollback on failure
- **Automatic cache invalidation** on successful requests

### Integration Architecture
- **Python service layer** for hint logic and session management
- **Express API middleware** with error handling and validation
- **React Query hooks** for client-side state management
- **shadcn/ui components** for consistent design system

## User Experience

Users can now:
1. **View progressive hints** that unlock over time during challenge sessions
2. **See countdown timers** showing when next hint becomes available
3. **Request early access** to hints when needed for learning assistance
4. **Track hint progress** with visual indicators showing X of Y unlocked
5. **Experience real-time updates** without page refreshes

## System Benefits

### For Learners
- **Adaptive assistance** that doesn't eliminate challenge difficulty
- **Time-based guidance** encouraging problem-solving before hints
- **Early access option** for when genuinely stuck
- **Progressive learning** with structured hint disclosure

### For Platform
- **Engagement tracking** with hint request analytics
- **Performance optimization** with efficient caching and refresh patterns
- **Extensible design** supporting future hint enhancements
- **Reliable state management** with error recovery and retry logic

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

None encountered during execution.

## Next Phase Readiness

### Completed Deliverables
- ✅ Progressive hint service with time and request-based unlocking
- ✅ Hint API endpoints with comprehensive error handling
- ✅ React UI component with countdown timers and progress indicators
- ✅ TanStack Query hooks with real-time updates and optimistic mutations

### System Integration
- ✅ Hint system integrates with existing challenge definitions
- ✅ Session management supports hint state tracking
- ✅ UI components follow established shadcn/ui patterns
- ✅ API follows existing Express route structure

### Future Enhancements
- **Hint scoring system**: Configurable point penalties for hint usage
- **Hint analytics**: Dashboard showing hint effectiveness and usage patterns
- **Custom hint types**: Support for image, video, or interactive hints
- **Hint difficulty progression**: Adaptive timing based on user skill level

## Files Changed

### New Files
- `engine/hint_service.py` (405 lines) - Progressive hint disclosure service
- `api/hints/route.js` (410 lines) - Hint API endpoints with Python integration
- `frontend/components/challenge/hint-panel.tsx` (409 lines) - Progressive hint UI component
- `frontend/hooks/useHints.ts` (331 lines) - TanStack Query hooks for hint management

### Architecture Impact
- **Backend**: Added hint service layer with session integration
- **API**: New hint endpoints with rate limiting and validation
- **Frontend**: New challenge UI component with real-time state management
- **State Management**: TanStack Query patterns for hint operations

## Verification Results

- ✅ Hints unlock progressively based on time and requests
- ✅ UI shows countdown timers and hint availability
- ✅ Hint state persists across page refreshes via API
- ✅ API endpoints handle hint requests with proper validation

The progressive hint system is complete and ready for integration into the challenge discovery interface.
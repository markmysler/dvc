# Phase 5: Container Lifecycle & Hints - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend reliability and learning experience enhancement through three key improvements: automated container health monitoring for reliable challenge operations, progressive hint disclosure for improved learning experience, and unified configuration management to eliminate duplicate config files. These enhancements provide a more robust and maintainable platform while improving user experience through better reliability and adaptive learning support.

</domain>

<decisions>
## Implementation Decisions

### Health monitoring behavior
- Grace period: 30 seconds after valid flag submission before container stops
- User notification: Single warning "Container will stop in 30 seconds"
- Failure handling: Stop immediately if container fails during grace period (don't wait)
- Container lifecycle: Stop → cleanup → remove after grace period or failure

### Hint disclosure strategy
- Unlock mechanism: User-requested only - hints unlock when user clicks "I need help"
- Request limits: No limits - user can request all hints immediately if desired
- Scoring impact: Point deduction - each hint reduces total possible score by 10%
- Penalty calculation: Percentage-based reduction (not fixed points)

### Configuration migration approach
- Migration strategy: Validate then migrate - test unified config loads correctly before removing originals
- Error handling: Report validation errors and prompt user how to proceed
- Post-migration loading: Unified only - load all configs from challenges.json, no fallback
- Individual config cleanup: Delete immediately after successful migration and validation

### User experience integration
- Health status visibility: Status indicator showing "healthy", "unhealthy", "stopping"
- Status placement: Multiple locations - both on challenge card and in challenge details
- Hint presentation: Expandable section - collapsible area below challenge description
- Hint button style: Progressive reveal - button text changes based on available hints ("Get First Hint" → "Get Next Hint")

### Claude's Discretion
- Exact health check intervals and retry logic
- Specific UI styling for status indicators and hint buttons
- Migration script output format and logging details
- Grace period countdown display implementation

</decisions>

<specifics>
## Specific Ideas

- Grace period allows users to explore successful exploitation before automatic cleanup
- Point deduction system uses percentage rather than fixed penalties to scale with challenge difficulty
- Progressive button labels help users understand hint availability and progression
- Status indicators provide real-time feedback on container health across multiple UI locations

</specifics>

<deferred>
## Deferred Ideas

- Reference-based configuration architecture (keep individual configs, reference from main file) — potential future phase for modular config management

</deferred>

---

*Phase: 05-container-lifecycle-hints*
*Context gathered: 2026-01-29*
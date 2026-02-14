# PRD: Beat-Reactive Flight System

## Introduction

Enhance the first-person flying experience with music-synchronized sharp turns, dramatic banking animations, and varied building aesthetics. The flight path responds to heavy beat shifts in the music, executing precise 90-degree turns timed to avoid collisions with buildings. Buildings should have more visual variety to reduce repetitive patterns.

## Goals

- Execute sharp 90-degree turns synchronized to heavy beat shifts in music
- Time turns to safely navigate around buildings without collisions
- Add dramatic banking animation (45+ degrees) during turns
- Increase building visual variety across all aspects (patterns, heights, colors, materials)
- Maintain smooth, immersive first-person flight experience

## User Stories

### US-001: Detect Heavy Beat Shifts
**Description:** As a system, I need to identify heavy beat shifts in the music so that turns can be triggered at musically appropriate moments.

**Acceptance Criteria:**
- [ ] Analyze audio for significant beat/rhythm changes
- [ ] Distinguish heavy beat shifts from regular beats
- [ ] Provide beat shift events with timing information
- [ ] Events fire with enough lead time to prepare turn animation
- [ ] Typecheck/lint passes

### US-002: Sharp 90-Degree Turns
**Description:** As a viewer, I want the camera to make sharp 90-degree turns so the flight feels dynamic and responsive to the music.

**Acceptance Criteria:**
- [ ] Turns are exactly 90 degrees (left or right)
- [ ] Turn animation is sharp/snappy, not gradual
- [ ] Turn direction chosen based on available safe path
- [ ] Turns feel connected to the beat shift moment
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Collision-Safe Turn Timing
**Description:** As a viewer, I want turns to be timed so the flight path never collides with buildings, maintaining immersion.

**Acceptance Criteria:**
- [ ] System looks ahead to detect upcoming buildings/obstacles
- [ ] Turn is only executed when path is clear
- [ ] If beat shift occurs but turn is unsafe, delay or skip turn
- [ ] Flight path maintains safe distance from building walls
- [ ] No visible clipping through geometry
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Banking Animation During Turns
**Description:** As a viewer, I want the camera to bank dramatically during turns so it feels like realistic flight.

**Acceptance Criteria:**
- [ ] Camera rolls 45+ degrees in turn direction
- [ ] Banking begins slightly before turn starts
- [ ] Banking returns to level after turn completes
- [ ] Animation is smooth with proper easing
- [ ] Banking intensity matches turn sharpness
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Varied Building Window Patterns
**Description:** As a viewer, I want buildings to have different window patterns so the environment feels less repetitive.

**Acceptance Criteria:**
- [ ] Multiple window pattern variations (grid, staggered, random, vertical strips, etc.)
- [ ] Window patterns randomly assigned to buildings
- [ ] No two adjacent buildings have identical patterns
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-006: Varied Building Dimensions
**Description:** As a viewer, I want buildings to have different heights and widths so the skyline looks natural.

**Acceptance Criteria:**
- [ ] Building heights vary significantly (not just small variations)
- [ ] Building widths/footprints vary
- [ ] Taller buildings are less common than medium ones
- [ ] Variety is visible within any single view
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-007: Varied Building Colors and Materials
**Description:** As a viewer, I want buildings to have different colors and material appearances so the city feels diverse.

**Acceptance Criteria:**
- [ ] Multiple color palettes for building facades
- [ ] Different material appearances (glass, concrete, brick, metal, etc.)
- [ ] Colors and materials distributed to avoid obvious repetition
- [ ] Overall aesthetic remains cohesive
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Audio analyzer must detect heavy beat shifts and emit events with timing data
- FR-2: Turn system must execute 90-degree turns (not gradual curves)
- FR-3: Turn direction must be determined by obstacle detection (choose safe direction)
- FR-4: If both directions are blocked, maintain straight flight until safe
- FR-5: Camera must bank 45+ degrees during turns with smooth easing
- FR-6: Banking must lead the turn slightly (anticipation) and trail after (follow-through)
- FR-7: Building generator must use randomized window pattern selection from 4+ variations
- FR-8: Building heights must follow a distribution (e.g., normal distribution with outliers)
- FR-9: Building widths must vary by at least 50% from base size
- FR-10: Building colors must be selected from multiple distinct palettes
- FR-11: Adjacent buildings must not share identical visual properties

## Non-Goals

- No player control over turn direction or timing
- No manual flight controls
- No collision damage or game-over states
- No procedural music generation (music is input, not generated)
- No building interiors or detail at close range

## Technical Considerations

- Beat detection may need configurable sensitivity threshold
- Look-ahead distance for obstacle detection depends on flight speed
- Banking animation should use quaternion slerp for smooth rotation
- Building variety can use weighted random selection or noise functions
- Consider pooling building materials/textures for performance

## Success Metrics

- Turns occur on musically significant moments (subjectively satisfying sync)
- Zero building collisions during normal playback
- Banking animation visible and dramatic but not disorienting
- No two screenshots of buildings look identical
- Maintains target frame rate with added variety

## Open Questions

- Should turn direction have any musical meaning (e.g., pitch = direction)?
- How far ahead should obstacle detection look (time-based or distance-based)?
- Should banking intensity vary based on music intensity?
- What's the minimum safe distance from building walls?

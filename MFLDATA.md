# MFL Data Management Strategy

## Centralized Service Pattern

**IMPORTANT**: For all future data calculations and processing, use centralized service functions that can be called with minimal parameters (typically just an ID) to ensure consistency across the entire application.

### Market Value Calculation Example

Instead of duplicating complex calculation logic across multiple components, use the centralized service:

```typescript
// ✅ DO: Use centralized service
import { getPlayerMarketValue } from '../services/marketValueService';

const result = await getPlayerMarketValue(playerId, walletAddress, forceRecalculate);
```

```typescript
// ❌ DON'T: Duplicate calculation logic in components
// Don't repeat the same complex calculation in PlayerResultsPage, AgencyPage, etc.
```

### Benefits

1. **Consistency**: Same calculation logic everywhere
2. **Maintainability**: Update logic in one place
3. **Caching**: Built-in caching and expiration handling
4. **Error Handling**: Centralized error handling
5. **Testing**: Easier to test and debug

### Implementation Pattern

1. Create a service file in `src/services/`
2. Export functions that take minimal parameters (usually just IDs)
3. Handle all data fetching, processing, and caching internally
4. Return consistent result objects with `success`, `data`, and `error` fields
5. Use these services in both API routes and React components

### Future Services to Implement

- `playerStatsService.ts` - Calculate player statistics
- `teamAnalysisService.ts` - Team performance analysis
- `matchPredictionService.ts` - Match outcome predictions
- `playerComparisonService.ts` - Compare multiple players

### Database Schema Updates

When adding new calculation services, ensure proper database schema updates are provided in SQL files for:
- New tables
- New columns
- Indexes for performance
- RLS policies for security
- Once database .SQL files have been run by user, delete the file in local filesystem

## Squad Builder – Current Feature Status (2025-09-17)

- Views: Table and Field. Default is Table. Selection persists in `localStorage` (`sb:viewMode`).
- Table View: Reuses club table styling. Hides formation/validation panels. Shows overall squad stats header.
- Filters: Sidebar sliders for PAC, PHY, DRI, SHO, PAS, DEF (min thresholds, 0–99), plus Overall min and Position Rating min (best-fit among player positions). Debounced ~200ms.
- Playable Positions: A position is playable if position rating is within ±6 of the player’s overall; GK exceptions enforced.
- Saved Squads: Header “Load squad” dropdown to directly load a saved squad; Save/Delete actions remain.
- Removed: Recommendations, Chemistry, and all Validation logic/UI. No max players constraint.
- Popups: No initial toasts on first visit to `/squad-builder`.

Known follow-ups
- Add tests for: view toggle persistence, slider/rating filters, load dropdown, playable tolerance.

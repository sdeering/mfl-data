# Development Rules

## Mock Data Policy

**CRITICAL RULE: Only use mock data in tests unless specifically requested otherwise by the user.**

- ✅ **Tests**: Mock data is allowed and encouraged for testing purposes
- ❌ **Live Application**: Never display mock data in the live application
- ✅ **Real Data Only**: The live application should only display data from:
  - Flow blockchain (primary source)
  - External APIs (MFL API, Flowscan API)
  - Real user interactions

## Data Source Priority

1. **Flow Blockchain** - Primary source for NFT metadata
2. **External APIs** - Secondary source for additional player data
3. **No Mock Data** - Never fall back to mock data in production

## Testing Guidelines

- Use comprehensive mock data in test files
- Mock external API calls in tests
- Test both success and failure scenarios
- Ensure tests don't depend on external services

## Error Handling

- When no real data is available, show appropriate error messages
- Don't silently fall back to mock data
- Log all data source attempts for debugging
- Provide clear feedback to users about data availability

## Code Review Checklist

- [ ] No mock data in live application code
- [ ] All external API calls are properly handled
- [ ] Error states are gracefully handled
- [ ] Tests use appropriate mock data
- [ ] Data source indicators are accurate

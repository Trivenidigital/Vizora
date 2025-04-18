# Active Context

## Current Work Focus

We're implementing real-time diagnostic capabilities across the Vizora ecosystem to improve stability, error handling, and developer experience. The current focus is on strengthening socket connection management, device pairing, and providing diagnostic tools for developers and QA testers.

### Recent Major Changes

1. **SocketDebug Component Implementation**:
   - Created comprehensive socket diagnostic visualization component in VizoraTV app
   - Component displays real-time socket state, connection history, and error information
   - Only shown when `?qa=true` query parameter is present in URL
   - Uses the ConnectionManager's getDiagnostics() method for live data updates

2. **Socket Connection Reliability Improvements**:
   - Enhanced socket ID retrieval with retry mechanisms
   - Added fallback paths and safety checks for critical socket operations
   - Implemented circuit breaker pattern to prevent cascading failures
   - Added debounce and throttling to prevent excessive reconnection attempts

3. **Pairing Code Flow Enhancement**:
   - Improved device registration verification
   - Enhanced error handling for missing device IDs
   - Added exponential backoff for registration retries
   - Fixed race conditions between registration and pairing code generation

4. **Device Registration Robustness**:
   - Implemented verification step before pairing attempts
   - Added more descriptive error messages for registration failures
   - Fixed issues with premature socket ID access
   - Enhanced logging to trace registration flow

## Active Decisions and Considerations

1. **Diagnostic Data Structure**:
   - Using a comprehensive diagnostic object that includes:
     - Connection state and history
     - Socket ID and transport information
     - Error tracking and circuit breaker state
     - Timestamps for significant events
     - Performance metrics

2. **Error Recovery Strategy**:
   - Circuit breaker implementation to prevent repeated failures
   - Exponential backoff for reconnection attempts
   - Categorization of errors by severity and recoverability
   - Graceful degradation for non-critical features

3. **UI/UX for Diagnostics**:
   - Debug components only visible with query parameters
   - Color-coded status indicators for connection states
   - Collapsible sections for detailed information
   - Copy functionality for sharing diagnostic data

## Next Steps

### Short-term Priorities

1. **Extend SocketDebug to VizoraWeb**:
   - Implement equivalent diagnostic visualization in admin interface
   - Add remote diagnostics collection for deployed displays

2. **Documentation Updates**:
   - Document diagnostic data structure and access patterns
   - Create troubleshooting guide based on common diagnostic scenarios
   - Update API documentation with error codes and recovery strategies

3. **Testing Enhancement**:
   - Create automated tests for connection recovery scenarios
   - Implement stress tests for socket connection reliability
   - Add validation for diagnostic data accuracy

4. **(Deferred) Debug VizoraTV Auto-Start Pairing**:
   - Revisit the automatic pairing initiation on the TV app load.

### Medium-term Goals

1. **Offline Mode Implementation**:
   - Design content caching strategy for offline operation
   - Create reconnection and sync mechanism for offline-to-online transitions
   - Implement local storage for critical configuration

2. **Enhanced Diagnostic Analytics**:
   - Create visualization for connection quality trends
   - Implement predictive analytics for potential connection issues
   - Add automated recommendations for connection optimization

## Important Patterns and Preferences

1. **Socket Connection Management**:
   - Use the ConnectionManager from @vizora/common for all socket operations
   - Never access socket.id directly without checks for availability
   - Always implement timeout mechanisms for async socket operations
   - Use event listeners to respond to connection state changes

2. **Error Handling**:
   - Categorize errors into user-actionable vs. system errors
   - Provide clear, non-technical messages for end-users
   - Maintain detailed logs for development and support
   - Implement retry mechanisms with progressive backoff

3. **Diagnostic Implementation**:
   - Collect diagnostic data at regular intervals (2 seconds for UI updates)
   - Use standardized timestamp format for correlation
   - Limit log entry count to prevent memory issues
   - Include context with each diagnostic entry

4. **UI Components**:
   - Use Card components for diagnostic displays
   - Follow color conventions: green=connected, yellow=connecting, red=error
   - Provide copy functionality for sharing diagnostic data
   - Keep debug UI visually separate from main application UI

## Recent Learnings

1. **Socket.IO Behavior**:
   - Socket ID may not be immediately available after connection
   - Handshake completion can be delayed in certain network conditions
   - Transport upgrades can cause temporary disconnections
   - Circuit breaker pattern is essential for unstable connections

2. **React Performance**:
   - Interval-based diagnostic updates need cleanup to prevent memory leaks
   - Large diagnostic objects should be memoized to prevent unnecessary renders
   - Debug components should implement virtualization for large log displays

3. **Device Registration**:
   - Registration must be verified before pairing attempts
   - Device ID persistence improves user experience across sessions
   - Clear error messages significantly improve troubleshooting experience

## Project Insights

- Diagnostic visualization has proven valuable for identifying intermittent issues
- Connection robustness is more important than reconnection speed
- Comprehensive error classification improves recovery strategies
- Exponential backoff with jitter provides the best reconnection experience

## Current Challenges
- Ensuring reliable socket connections across different network conditions
- Managing authentication state consistently between REST and Socket.IO
- Optimizing content delivery for various display types and resolutions
- Handling reconnection scenarios without disrupting user experience
- Scaling socket connections for large numbers of concurrent displays
- **VizoraTV auto-start pairing on load not consistently working (debugging deferred, possibly related to Strict Mode or initialization timing).**

## Technical Decisions
- Using centralized ConnectionManager for all Socket.IO interactions
- Implementing JWT-based authentication for both REST and Socket.IO
- Storing content metadata in MongoDB with file storage on the filesystem
- Using React Query for data fetching and caching
- Employing TypeScript strict mode for enhanced type safety 
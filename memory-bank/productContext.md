# Product Context

## Problem Statement
Traditional digital signage solutions often lack real-time management capabilities, are difficult to set up, and have complex pairing mechanisms. Many systems require specialized hardware and proprietary software that is costly and inflexible. Content updates typically have significant delays, and real-time status monitoring is limited or non-existent.

## Solution
Vizora addresses these challenges by providing:
1. Web-based administration with real-time updates
2. Simple QR code-based device pairing
3. Socket.IO-based communication for instant updates
4. Flexible content scheduling and prioritization
5. Cross-platform compatibility (web, mobile, TV)
6. Detailed system health monitoring

## Target Users
### Admin Users
- Digital signage administrators who need to manage multiple displays
- Marketing teams updating content across locations
- IT professionals monitoring system health

### End Users
- Restaurant customers viewing menus or promotions
- Retail shoppers seeing product information
- Visitors in lobbies or waiting areas consuming information

## User Experience Goals
### For Administrators
- Fast, intuitive interface for content management
- Clear visual indicators of display status
- Simple device pairing with QR codes
- Flexible scheduling with drag-and-drop interfaces
- Quick access to diagnostics and troubleshooting

### For Content Viewers
- Smooth content transitions
- High-quality visual presentation
- Appropriate content sizing for different display types
- Consistent experience across different locations

## Key Workflows
1. **Device Registration and Pairing**
   - Admin registers a display in VizoraWeb
   - Display shows QR code via VizoraTV app
   - Admin scans QR with VizoraWeb to complete pairing

2. **Content Management**
   - Admin uploads content through VizoraWeb
   - Content is processed and stored
   - Content metadata is recorded (dimensions, duration, etc.)

3. **Content Scheduling**
   - Admin creates schedules for specific displays
   - Schedule defines when content should display
   - Priority levels determine content precedence

4. **Real-time Monitoring**
   - Admins view display status in real-time
   - System metrics are collected and displayed
   - Disconnection alerts are generated

## Success Criteria
- Reduced setup time (under 5 minutes per display)
- Near-instant content updates (under 2 seconds)
- 99.9% display connection reliability
- Support for at least 100 concurrent displays
- Content scheduling accuracy within 1 second 
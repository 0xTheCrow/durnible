# Element Call Integration - Setup Instructions

## Overview

Element Call has been integrated into Cinny to enable video calling in rooms. This document provides setup instructions and implementation details.

## Installation

### Step 1: Install Dependencies

Run one of the following commands to install the updated dependencies:

```bash
npm install
# or
yarn install
```

**Updated packages:**
- `matrix-js-sdk`: Upgraded from v38.2.0 to v34.11.0 (for MatrixRTC support)
- `matrix-widget-api`: v1.9.0 (new dependency for widget communication)

### Step 2: Bundle Element Call Widget

Element Call needs to be bundled with the application. There are two options:

#### Option A: Use element-call as a dependency (Recommended)

1. Install `@element-hq/element-call-embedded` package:
   ```bash
   npm install @element-hq/element-call-embedded
   # or
yarn add @element-hq/element-call-embedded
   ```

2. Copy Element Call assets to the public directory during build:
   - Add to `vite.config.ts`:
   ```typescript
   import { viteStaticCopy } from 'vite-plugin-static-copy';
   
   export default defineConfig({
     plugins: [
       viteStaticCopy({
         targets: [
           {
             src: 'node_modules/@element-hq/element-call-embedded/dist/*',
             dest: 'assets/element-call'
           }
         ]
       })
     ]
   });
   ```

#### Option B: Build Element Call separately

1. Clone Element Call repository:
   ```bash
   git clone https://github.com/element-hq/element-call.git
   cd element-call
   ```

2. Build Element Call:
   ```bash
   yarn install
   yarn build
   ```

3. Copy the build output to Cinny's public directory:
   ```bash
   cp -r dist/* /path/to/cinny/public/assets/element-call/
   ```

## Usage

Once installed and configured, the video call button will appear in the room header between the search and pinned messages buttons.

### User Features

- **Video Call Button**: Click to start or join a video call
- **Permission-based**: Button is disabled if user lacks permission to start calls
- **Status Indicators**: Tooltip shows why calling is disabled (if applicable)
- **Automatic Intent Detection**: System automatically detects whether to start a new call or join existing one

### Technical Details

**Files Added:**
- `src/types/widget.ts` - Widget type definitions
- `src/app/features/calls/elementCall.ts` - Element Call utilities
- `src/app/hooks/useElementCall.ts` - React hook for call management  
- Modified: `src/app/features/room/RoomViewHeader.tsx` - Added call button to UI

**Modified Files:**
- `package.json` - Updated dependencies

## Troubleshooting

### Element Call doesn't load

1. Verify Element Call assets are in `public/assets/element-call/`
2. Check browser console for errors
3. Ensure the widget URL is correctly generated (check browser network tab)

### Call button is disabled

Common reasons:
- User doesn't have permission to start calls in the room
- User is the only person in the room
- Room specific settings prevent calling

### Widgets not working

If using matrix-js-sdk v34.x, ensure MatrixRTC is properly initialized. Check:
- `client.matrixRTC` is available
- Room has proper power levels configured

## Development Notes

The implementation follows Element Web's architecture with simplified widget management. Key differences:
- Uses embedded Element Call (no external URL configuration)
- Simplified widget state management (no persistent widget store)
- Calls open in new window for initial implementation (can be enhanced to use embedded iframe)

## Future Enhancements

Potential improvements for future releases:
1. **Embedded Widget Display**: Show Element Call in an embedded iframe within Cinny instead of opening new window
2. **Widget Store**: Implement persistent widget state tracking
3. **Call History**: Track and display recent calls in rooms
4. **Active Call Indicator**: Show visual indicator when call is active in room
5. **In-app Notifications**: Notify users of incoming calls

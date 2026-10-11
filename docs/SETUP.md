# Setup Guide

## Requirements
- Node.js >= 22
- Android Studio / Android SDK (Min API 23, Target API 34).
- A real Android Device for native permission tests.

## Initial Setup
1. Run `npm install` inside the project root to install the React Native, Navigation, and SQLite packages.
2. Compile and launch the app using:
   ```bash
   npm run android
   ```

## Missing Configuration
**Google Calendar OAuth / Firebase**
Because this app runs offline caching and fetches from Google Calendar, it requires an Android Google OAuth client identifier.
To set this up (Once the credentials are known):
- Copy your `google-services.json` file into `android/app/`.
- Open `Src/Services/Google/GoogleAuthService.js` and input the web client ID into the `GoogleSignin.configure` block.

# For Us

Realtime partner location sharing app built as a static web client with Firebase.

## Features

- Email/password sign-up and sign-in
- Private room codes for pairing two partners
- Realtime text chat
- Shared saved places
- Live location publishing through the browser geolocation API
- Presence status using Firebase Realtime Database

## Files

- `index.html`: app shell
- `styles.css`: UI styling
- `app.firebase.js`: Firebase auth, room, chat, places, and location logic
- `firebase-config.js`: fill in your Firebase project values here
- `firebase-rules-example.txt`: starter Realtime Database rules

## Setup

1. Create a Firebase project.
2. In Firebase Authentication, enable Email/Password.
3. In Realtime Database, create a database and paste the rules from `firebase-rules-example.txt`.
4. In Project Settings, create a Web App and copy its config into `firebase-config.js`.
5. Serve this folder from `localhost` with any simple static server, then open the site in two browsers or on two devices.

## Notes

- Browser-based location sharing only updates while the page is open and the browser allows geolocation.
- True background 24/7 tracking on phones usually needs a native mobile app, not just a web page.
- Firebase config values are public client config, but your security rules still matter.

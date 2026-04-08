# iOS Cloud Build

This project is prepared for a macOS runner build service such as GitHub Actions, Bitrise, Codemagic, or Appflow.

## What the repo now supports

- Capacitor iOS project in `ios/`
- Cloud macOS workflow in `.github/workflows/ios-build.yml`
- Simulator build artifact for quick validation
- Optional signed release build when Apple signing secrets are provided

## To build on GitHub Actions

1. Push this repo to GitHub.
2. Run the `iOS Build` workflow.
3. For a simulator artifact, no extra secrets are needed.
4. For a signed IPA, add these secrets in GitHub:
   - `IOS_SIGNING_CERT_BASE64`
   - `IOS_SIGNING_PASSWORD`
   - `IOS_PROFILE_BASE64`
   - `IOS_TEAM_ID`

## Notes

- The signed release path assumes ad-hoc distribution.
- If you want App Store/TestFlight delivery, the export settings can be adjusted later.
- The bundle ID is currently `com.tether.partnerlocation`.

# AMPcap

Android app that forecasts your electricity units for the current bill cycle and warns you before you cross 200.
ISE project, Deliverable 3. See `BUILD_SPEC.md` for the decisions behind the rules.

## Run it on your phone (for testers)
1. Install [Node.js LTS](https://nodejs.org) and [Git](https://git-scm.com).
2. Install **Expo Go** from the Play Store on your Android phone.
3. In a terminal:
   ```
   git clone <REPO_URL>
   cd AMPcap
   npm install
   npx expo start
   ```
4. Scan the QR code with Expo Go. Phone and laptop must be on the same Wi-Fi. If that fails, run `npx expo start --tunnel`.

## Checks
`npm test` runs the forecast tests. `npm run typecheck` checks the types.

## Team workflow
- Never commit straight to `main`. Make a branch: `git checkout -b feature/short-name`.
- Commit small, push the branch, open a Pull Request, and ask one teammate to review it.
- Tests must pass (green tick on the PR) before merging.

## Where things are
- `src/forecast.ts`: all forecast and validation rules (no screens, easy to test)
- `src/store.ts`: saving data on the phone
- `App.tsx`: screens

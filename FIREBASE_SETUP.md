# Firebase setup

Day Zero uses Firebase Authentication and Cloud Firestore for cross-device sync. The Firebase web configuration in `src/firebase.ts` is public client configuration; Firestore Rules protect the data.

## One-time project setup

1. In Firebase Console, open **Authentication → Sign-in method** and enable **Anonymous** sign-in.
2. In **Authentication → Settings → Authorized domains**, add `starforge369.github.io`.
3. In **Firestore Database → Rules**, replace the rules with the contents of [`firestore.rules`](./firestore.rules), then publish them.
4. Keep the project on the Spark plan unless you deliberately choose to enable billing. The app does not need a `VITE_SYNC_API_BASE_URL` environment variable on GitHub Pages.

## Verify sync after deployment

1. Open the GitHub Pages site and wait for the cloud status to show online.
2. Make a small change, such as adding a test countdown, and wait for the sync status to settle.
3. Open the site in a second browser or device, connect using the same sync code, and verify the change appears there.
4. Remove the test countdown and verify that removal also reaches the other device.

Sync codes grant access to the corresponding synced data. Use the generated high-entropy code and share it only with devices that should share the data.

## Legacy sync migration

When a sync code is first opened in Firestore, the app checks the previous AI Studio sync API and copies any existing data into Firestore. The old copy is left in place. If the old API cannot be reached, the app keeps local changes queued instead of assuming the old data is empty and overwriting it.

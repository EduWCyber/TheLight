# Safe Vault Firebase Setup

The Safe Vault is built as a section inside `tools.html`, directly under the text analyzer. The rest of the website stays public. Only the Tools page loads Firebase login and Firestore database code.

## 1. Create the Firebase project

1. Open the Firebase console.
2. Create a project or use an existing project.
3. Add a Web app.
4. Copy the Firebase config object into `safe-vault.config.js`.

The config values identify your Firebase project. They are not the same as a private admin key, but you should still use Firebase Security Rules to protect the data.

## 2. Enable email link login

1. Go to Authentication.
2. Open Sign-in method.
3. Enable Email/Password.
4. Enable Email link/passwordless sign-in.
5. Add your deployed website domain to Authorized domains.
6. In `safe-vault.config.js`, set `window.theLightVaultActionUrl` to the final URL of the Tools page vault section.

Example:

```js
window.theLightVaultActionUrl = "https://your-site.com/tools.html#vault";
```

For local testing, run a local server and add `localhost` in Firebase Authorized domains.

## 3. Create Firestore

1. Go to Firestore Database.
2. Create a database.
3. Start in production mode.
4. Publish these rules:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/vaultItems/{itemId} {
      allow read, delete: if request.auth != null
        && request.auth.uid == userId;

      allow create: if request.auth != null
        && request.auth.uid == userId
        && request.resource.data.ownerUid == request.auth.uid
        && request.resource.data.title is string
        && request.resource.data.notes is string;

      allow update: if request.auth != null
        && request.auth.uid == userId
        && resource.data.ownerUid == request.auth.uid
        && request.resource.data.ownerUid == request.auth.uid;
    }
  }
}
```

## 4. Enable attachment storage

The vault can save one optional image or PDF attachment with each evidence note. Enable Firebase Storage, then publish rules like these:

```js
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/vaultAttachments/{itemId}/{fileName} {
      allow read, delete: if request.auth != null
        && request.auth.uid == userId;

      allow create, update: if request.auth != null
        && request.auth.uid == userId
        && request.resource.size < 8 * 1024 * 1024
        && (request.resource.contentType.matches('image/.*')
          || request.resource.contentType == 'application/pdf');
    }
  }
}
```

## 5. Deploy

Upload these files with the website:

- `safe-vault.js`
- `safe-vault.config.js`
- updated `style.css`
- updated `tools.html`
- updated `index.html`

## 6. Important safety note

Attachments are private to the signed-in user through Firebase Storage rules. Keep the file limit small and avoid uploading sensitive files from shared devices.

const FIREBASE_VERSION = "10.12.5";
const EMAIL_STORAGE_KEY = "theLightVaultEmailForSignIn";
const AUTH_LINK_LIMIT = {
  maxActions: 3,
  windowMs: 10 * 60 * 1000,
  cooldownMs: 60 * 1000
};
const EVIDENCE_SAVE_LIMIT = {
  maxActions: 10,
  windowMs: 60 * 1000,
  cooldownMs: 3500
};

function formatVaultWaitTime(milliseconds) {
  const seconds = Math.ceil(milliseconds / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  return `${Math.ceil(seconds / 60)} min`;
}

function checkVaultRateLimit(key, { maxActions, windowMs, cooldownMs = 0 }) {
  const now = Date.now();
  const fallbackState = { timestamps: [], lastActionAt: 0 };
  let state = fallbackState;

  try {
    state = JSON.parse(window.localStorage.getItem(key)) || fallbackState;
  } catch (error) {
    state = fallbackState;
  }

  const timestamps = Array.isArray(state.timestamps)
    ? state.timestamps.filter(timestamp => now - timestamp < windowMs)
    : [];
  const lastActionAt = Number(state.lastActionAt || 0);
  const cooldownRemaining = cooldownMs - (now - lastActionAt);

  if (cooldownRemaining > 0) {
    return {
      allowed: false,
      retryAfter: cooldownRemaining
    };
  }

  if (timestamps.length >= maxActions) {
    return {
      allowed: false,
      retryAfter: windowMs - (now - timestamps[0])
    };
  }

  timestamps.push(now);

  try {
    window.localStorage.setItem(key, JSON.stringify({
      timestamps,
      lastActionAt: now
    }));
  } catch (error) {
    // Storage can fail in strict private browsing. Firebase still handles real limits.
  }

  return {
    allowed: true,
    retryAfter: 0
  };
}

function setVaultMessage(message, type = "info") {
  const messageEl = document.getElementById("vaultMessage");

  if (!messageEl) {
    return;
  }

  messageEl.textContent = message;
  messageEl.dataset.type = type;
  messageEl.classList.remove("is-updating");
  void messageEl.offsetWidth;
  messageEl.classList.add("is-updating");
}

function isFirebaseConfigReady(config) {
  return Boolean(
    config &&
    config.apiKey &&
    config.projectId &&
    config.appId &&
    !config.apiKey.includes("PASTE_") &&
    !config.projectId.includes("PASTE_") &&
    !config.appId.includes("PASTE_")
  );
}

function formatVaultDate(value) {
  if (!value) {
    return "Date not added";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function renderVaultItems(items) {
  const listEl = document.getElementById("vaultList");
  const emptyEl = document.getElementById("vaultEmpty");

  if (!listEl || !emptyEl) {
    return;
  }

  listEl.innerHTML = "";
  emptyEl.hidden = items.length > 0;

  items.forEach((item, index) => {
    const data = item.data;
    const card = document.createElement("article");
    const head = document.createElement("div");
    const titleWrap = document.createElement("div");
    const dateEl = document.createElement("span");
    const titleEl = document.createElement("h3");
    const deleteButton = document.createElement("button");
    const meta = document.createElement("dl");
    const platformMeta = document.createElement("div");
    const platformLabel = document.createElement("dt");
    const platformValue = document.createElement("dd");
    const accountMeta = document.createElement("div");
    const accountLabel = document.createElement("dt");
    const accountValue = document.createElement("dd");
    const notesEl = document.createElement("p");

    card.className = "safe-vault-item";
    card.style.setProperty("--vault-item-index", String(index));
    head.className = "safe-vault-item-head";
    meta.className = "safe-vault-meta";
    deleteButton.className = "safe-vault-delete";
    deleteButton.type = "button";
    deleteButton.dataset.id = item.id;
    deleteButton.setAttribute("aria-label", "Delete vault note");

    dateEl.textContent = formatVaultDate(data.incidentDate);
    titleEl.textContent = data.title;
    deleteButton.textContent = "Delete";
    platformLabel.textContent = "Platform";
    platformValue.textContent = data.platform || "Not added";
    accountLabel.textContent = "Account";
    accountValue.textContent = data.account || "Not added";
    notesEl.textContent = data.notes;

    titleWrap.append(dateEl, titleEl);
    head.append(titleWrap, deleteButton);
    platformMeta.append(platformLabel, platformValue);
    accountMeta.append(accountLabel, accountValue);
    meta.append(platformMeta, accountMeta);
    card.append(head, meta, notesEl);
    listEl.appendChild(card);
  });
}

async function loadFirebaseModules() {
  const [appModule, authModule, firestoreModule] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
  ]);

  return { ...appModule, ...authModule, ...firestoreModule };
}

async function initSafeVault() {
  const authPanel = document.getElementById("vaultAuthPanel");
  const appPanel = document.getElementById("vaultAppPanel");
  const authForm = document.getElementById("vaultAuthForm");
  const evidenceForm = document.getElementById("vaultEvidenceForm");
  const signOutButton = document.getElementById("vaultSignOut");
  const userEmailEl = document.getElementById("vaultUserEmail");
  const submitButton = document.getElementById("vaultSubmitEvidence");
  const sendLinkButton = document.getElementById("vaultSendLink");
  const helpButton = document.getElementById("vaultHelpButton");
  const helpPanel = document.getElementById("vaultHelpPanel");
  const config = window.theLightVaultFirebaseConfig;
  const vaultSection = document.getElementById("vault");

  if (!authPanel || !appPanel || !authForm || !evidenceForm || !signOutButton || !userEmailEl) {
    return;
  }

  authPanel.hidden = false;
  appPanel.hidden = true;

  if (helpButton && helpPanel) {
    helpButton.addEventListener("click", () => {
      const isOpening = helpPanel.hidden;
      helpPanel.hidden = !isOpening;
      helpButton.setAttribute("aria-expanded", String(isOpening));
    });
  }

  if (!isFirebaseConfigReady(config)) {
    setVaultMessage("Firebase is not connected yet. Add your project values in safe-vault.config.js first.", "warning");
    sendLinkButton.disabled = true;
    submitButton.disabled = true;
    return;
  }

  let firebase;

  try {
    firebase = await loadFirebaseModules();
  } catch (error) {
    setVaultMessage("Firebase could not load. Check your internet connection and Firebase script access.", "error");
    console.error("Firebase load error:", error);
    return;
  }

  const app = firebase.initializeApp(config);
  const auth = firebase.getAuth(app);
  const db = firebase.getFirestore(app);
  let currentUser = null;
  let unsubscribeVault = null;

  if (firebase.isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem(EMAIL_STORAGE_KEY);

    if (!email) {
      email = window.prompt("Please enter the same email used to request this sign-in link.");
    }

    if (email) {
      try {
        await firebase.signInWithEmailLink(auth, email, window.location.href);
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
        window.history.replaceState({}, document.title, window.location.pathname);
        setVaultMessage("You are signed in. Your private vault is ready.", "success");
      } catch (error) {
        setVaultMessage("This sign-in link is invalid or expired. Request a new secure link.", "error");
        console.error("Email link sign-in error:", error);
      }
    }
  }

  authForm.addEventListener("submit", async event => {
    event.preventDefault();

    const emailInput = document.getElementById("vaultEmail");
    const email = emailInput.value.trim();

    if (!email) {
      setVaultMessage("Enter your email address first.", "warning");
      return;
    }

    const authLimit = checkVaultRateLimit("theLightVaultAuthLinkRateLimit", AUTH_LINK_LIMIT);

    if (!authLimit.allowed) {
      setVaultMessage(`Please wait ${formatVaultWaitTime(authLimit.retryAfter)} before requesting another sign-in link. Check spam or junk while you wait.`, "warning");
      return;
    }

    sendLinkButton.disabled = true;
    sendLinkButton.textContent = "Sending link...";

    try {
      await firebase.sendSignInLinkToEmail(auth, email, {
        url: window.theLightVaultActionUrl || window.location.href.split("?")[0],
        handleCodeInApp: true
      });
      window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
      setVaultMessage("Secure sign-in link sent. Open it from your email to unlock the vault.", "success");
    } catch (error) {
      setVaultMessage("Could not send the sign-in link. Check Firebase Auth settings and authorized domains.", "error");
      console.error("Send sign-in link error:", error);
    } finally {
      sendLinkButton.disabled = false;
      sendLinkButton.textContent = "Send Secure Link";
    }
  });

  evidenceForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentUser) {
      setVaultMessage("Sign in before saving evidence.", "warning");
      return;
    }

    const formData = new FormData(evidenceForm);
    const evidence = {
      title: formData.get("title").trim(),
      platform: formData.get("platform").trim(),
      account: formData.get("account").trim(),
      incidentDate: formData.get("incidentDate"),
      notes: formData.get("notes").trim(),
      ownerUid: currentUser.uid,
      createdAt: firebase.serverTimestamp(),
      updatedAt: firebase.serverTimestamp()
    };

    if (!evidence.title || !evidence.notes) {
      setVaultMessage("Add a title and evidence notes before saving.", "warning");
      return;
    }

    if (evidence.title.length > 120 || evidence.notes.length > 2000) {
      setVaultMessage("Keep the title under 120 characters and notes under 2,000 characters.", "warning");
      return;
    }

    const saveLimit = checkVaultRateLimit(`theLightVaultSaveRateLimit:${currentUser.uid}`, EVIDENCE_SAVE_LIMIT);

    if (!saveLimit.allowed) {
      setVaultMessage(`Please wait ${formatVaultWaitTime(saveLimit.retryAfter)} before saving another note.`, "warning");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    try {
      await firebase.addDoc(firebase.collection(db, "users", currentUser.uid, "vaultItems"), evidence);
      evidenceForm.reset();
      setVaultMessage("Evidence note saved to your private vault.", "success");
    } catch (error) {
      setVaultMessage("Could not save this note. Check your Firestore rules and connection.", "error");
      console.error("Vault save error:", error);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Save Evidence";
    }
  });

  document.getElementById("vaultList").addEventListener("click", async event => {
    const deleteButton = event.target.closest("[data-id]");

    if (!deleteButton || !currentUser) {
      return;
    }

    try {
      await firebase.deleteDoc(firebase.doc(db, "users", currentUser.uid, "vaultItems", deleteButton.dataset.id));
      setVaultMessage("Evidence note deleted.", "success");
    } catch (error) {
      setVaultMessage("Could not delete this note.", "error");
      console.error("Vault delete error:", error);
    }
  });

  signOutButton.addEventListener("click", async () => {
    await firebase.signOut(auth);
    setVaultMessage("Signed out of the safe vault.", "info");
  });

  firebase.onAuthStateChanged(auth, user => {
    currentUser = user;
    vaultSection?.classList.toggle("is-unlocked", Boolean(user));
    authPanel.hidden = Boolean(user);
    appPanel.hidden = !user;

    if (unsubscribeVault) {
      unsubscribeVault();
      unsubscribeVault = null;
    }

    if (!user) {
      userEmailEl.textContent = "";
      renderVaultItems([]);
      return;
    }

    userEmailEl.textContent = user.email || "Signed in";

    const vaultQuery = firebase.query(
      firebase.collection(db, "users", user.uid, "vaultItems"),
      firebase.orderBy("createdAt", "desc")
    );

    unsubscribeVault = firebase.onSnapshot(vaultQuery, snapshot => {
      renderVaultItems(snapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
      })));
    }, error => {
      setVaultMessage("Could not read the vault. Check Firestore rules and indexes.", "error");
      console.error("Vault read error:", error);
    });
  });
}

window.addEventListener("DOMContentLoaded", initSafeVault);

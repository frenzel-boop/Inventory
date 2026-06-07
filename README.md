# ⬡ StockPilot — Inventory System

A web-based inventory management system with role-based access, Firebase backend, and CSV import. Designed to be hosted on **GitHub Pages**.

---

## ✨ Features

| Feature | Admin | User |
|---|---|---|
| View inventory dashboard | ✅ | ✅ |
| View all items | ✅ | ✅ |
| Add items | ✅ | ✅ |
| Edit items | ✅ | ❌ |
| Delete items | ✅ | ❌ |
| Manage users (create/edit/delete) | ✅ | ❌ |
| Import via CSV | ✅ | ❌ |
| Real-time updates | ✅ | ✅ |

---

## 🚀 Setup Guide

### Step 1 — Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**, give it a name (e.g. `stockpilot`)
3. Disable Google Analytics (optional), click **Create project**

### Step 2 — Enable Authentication

1. In the Firebase console, go to **Authentication → Get started**
2. Under **Sign-in method**, enable **Email/Password**
3. Click **Save**

### Step 3 — Create Firestore Database

1. Go to **Firestore Database → Create database**
2. Choose **Production mode**, select your region, click **Enable**
3. Go to the **Rules** tab and paste the contents of `firestore.rules`
4. Click **Publish**

### Step 4 — Register a Web App

1. Go to **Project Settings** (gear icon) → **Your apps** → click the `</>` (Web) icon
2. Enter an app nickname (e.g. `StockPilot Web`), click **Register app**
3. Copy the `firebaseConfig` object shown

### Step 5 — Add Your Config

Open `js/firebase-config.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc..."
};
```

### Step 6 — Create Your Admin Account

1. In Firebase Console → **Authentication → Users → Add user**
2. Enter your email and password
3. Open your app (via GitHub Pages or locally), log in with those credentials
4. The system will automatically create your admin profile on first login

### Step 7 — Deploy to GitHub Pages

1. Push this folder to a **public GitHub repository**
2. Go to your repo → **Settings → Pages**
3. Under **Source**, select `main` branch and `/ (root)` folder
4. Click **Save** — your site will be live at `https://yourusername.github.io/your-repo-name`

> **Important:** GitHub Pages requires your `index.html` to be in the root of the repo.

---

## 📁 Project Structure

```
stockpilot/
├── index.html              # Main app (single-page)
├── css/
│   └── style.css           # All styles
├── js/
│   ├── firebase-config.js  # ← PUT YOUR FIREBASE CONFIG HERE
│   └── app.js              # All application logic
├── firestore.rules         # Copy to Firebase Console → Rules
└── README.md
```

---

## 📋 CSV Import Format

When importing items, your CSV must have these column headers (case-insensitive):

| Column | Required | Example |
|---|---|---|
| `name` | ✅ | Wireless Mouse |
| `sku` | No | WM-001 |
| `category` | No | Electronics |
| `quantity` | No | 50 |
| `unit_price` | No | 599.00 |
| `threshold` | No | 10 |
| `description` | No | USB wireless mouse |

Download the sample template from the **Import CSV** page in the app.

---

## ⚠️ Note on Creating Users

When an admin creates a new user account, Firebase Authentication signs in as that new user momentarily, then signs back out. **You (the admin) may be signed out after creating a user.** This is a Firebase limitation when using the client SDK without a server.

**Workaround options:**
- Create users directly in Firebase Console → Authentication → Add user, then their profile will be auto-created on first login.
- Deploy Firebase Functions for a server-side user creation endpoint (advanced).

---

## 🔒 Security Notes

- Your `firebaseConfig` values in `js/firebase-config.js` are **safe to expose** publicly — they're client identifiers, not secrets
- Security is enforced by **Firestore Rules** (see `firestore.rules`)
- Always keep Firestore Rules set to restrict access by role
- Consider enabling **App Check** in Firebase for production use

---

## 🛠 Customization

- **Currency**: Change `₱` to your local currency symbol in `js/app.js`
- **Low stock threshold default**: Change `5` in `save-item-btn` handler
- **Logo/Name**: Change "StockPilot" and `⬡` in `index.html`
- **Colors**: Edit CSS variables in `css/style.css` under `:root`

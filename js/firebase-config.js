// ============================================================
//  STOCKPILOT — Firebase Configuration
//  Replace the values below with YOUR Firebase project config.
//  Get this from: Firebase Console → Project Settings → Your Apps
// ============================================================

const firebaseConfig = {
	apiKey: "AIzaSyA-MPoguxhDN5C2ih2mA6q4BHeX6coUJKI",
    authDomain: "stockpilot-1dafe.firebaseapp.com",
    projectId: "stockpilot-1dafe",
    storageBucket: "stockpilot-1dafe.firebasestorage.app",
    messagingSenderId: "1093603749848",
    appId: "1:1093603749848:web:6805db814af42297868cad",
    measurementId: "G-0JSN13VJRL"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

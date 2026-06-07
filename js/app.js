// ============================================================
//  STOCKPILOT — Main Application Logic=
// ============================================================

import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ——— STATE ———
let currentUser   = null;
let currentRole   = "user";
let allItems      = [];
let allUsers      = [];
let csvRows       = [];
let pendingDelete = { type: null, id: null };
let editingUserId = null;

// ——— DOM SHORTCUTS ———
const $ = id => document.getElementById(id);
const show  = el => el.classList.remove("hidden");
const hide  = el => el.classList.add("hidden");

// ——— TOAST ———
function toast(msg, type = "success") {
  const t = $("toast");
  t.textContent = msg;
  t.className = `toast ${type}`;
  show(t);
  setTimeout(() => hide(t), 3200);
}

// ——— AUTH ———
$("login-btn").addEventListener("click", async () => {
  const email = $("login-email").value.trim();
  const pass  = $("login-password").value;
  const errEl = $("auth-error");
  hide(errEl);
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    show(errEl);
    errEl.textContent = friendlyAuthError(e.code);
  }
});

$("login-password").addEventListener("keydown", e => {
  if (e.key === "Enter") $("login-btn").click();
});

$("logout-btn").addEventListener("click", () => signOut(auth));

function friendlyAuthError(code) {
  const map = {
    "auth/invalid-credential":   "Invalid email or password.",
    "auth/user-not-found":       "No account with that email.",
    "auth/wrong-password":       "Incorrect password.",
    "auth/too-many-requests":    "Too many attempts. Try again later.",
    "auth/invalid-email":        "Enter a valid email address.",
    "auth/email-already-in-use": "That email is already registered.",
    "auth/weak-password":        "Password must be at least 6 characters.",
  };
  return map[code] || "Authentication failed. Please try again.";
}

// ——— AUTH STATE ———
onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;
    await loadUserProfile(user.uid);
    showApp();
  } else {
    currentUser = null;
    currentRole = "user";
    showAuth();
  }
});

async function loadUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (snap.exists()) {
    const data = snap.data();
    currentRole = data.role || "user";
    $("sidebar-name").textContent = data.name || currentUser.email;
    $("sidebar-role").textContent = currentRole.toUpperCase();
    $("sidebar-avatar").textContent = (data.name || currentUser.email)[0].toUpperCase();
  } else {
    // Auto-create profile if missing (first admin bootstrap)
    currentRole = "admin";
    const name = currentUser.email.split("@")[0];
    await setDoc(doc(db, "users", uid), {
      name, email: currentUser.email, role: "admin",
      createdAt: serverTimestamp()
    });
    $("sidebar-name").textContent = name;
    $("sidebar-role").textContent = "ADMIN";
    $("sidebar-avatar").textContent = name[0].toUpperCase();
  }
}

function showAuth() {
  $("auth-screen").classList.add("active");
  $("app-screen").classList.remove("active");
}
function showApp() {
  $("auth-screen").classList.remove("active");
  $("app-screen").classList.add("active");
  applyRoleUI();
  navigateTo("dashboard");
  subscribeInventory();
}

function applyRoleUI() {
  const isAdmin = currentRole === "admin";
  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = isAdmin ? "" : "none";
  });
  $("add-item-btn").style.display = "";
  // Users can add but not edit/delete — handled in table render
}

// ——— NAVIGATION ———
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    navigateTo(item.dataset.page);
    closeSidebar();
  });
});

function navigateTo(page) {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add("active");
  const pageEl = $(`page-${page}`);
  if (pageEl) pageEl.classList.add("active");
  $("topbar-title").textContent = {
    dashboard: "Dashboard",
    inventory: "Inventory",
    users: "Users",
    import: "Import CSV"
  }[page] || page;
  if (page === "users") loadUsers();
  if (page === "inventory") renderInventory();
}

// ——— SIDEBAR MOBILE ———
$("hamburger").addEventListener("click", () => $("sidebar").classList.add("open"));
$("sidebar-close").addEventListener("click", closeSidebar);
function closeSidebar() { $("sidebar").classList.remove("open"); }

// ——— INVENTORY REALTIME ———
function subscribeInventory() {
  const q = query(collection(db, "inventory"), orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDashboard();
    renderInventory();
    populateCategoryFilter();
    populateCatSuggestions();
  });
}

// ——— DASHBOARD ———
function renderDashboard() {
  $("stat-total").textContent = allItems.length;
  const low = allItems.filter(i => i.quantity <= (i.threshold ?? 5) && i.quantity > 0).length;
  const out = allItems.filter(i => i.quantity === 0).length;
  $("stat-low").textContent = low + out;
  const cats = new Set(allItems.map(i => i.category).filter(Boolean));
  $("stat-cats").textContent = cats.size;
  const val = allItems.reduce((sum, i) => sum + ((i.unitPrice || 0) * (i.quantity || 0)), 0);
  $("stat-value").textContent = "₱" + val.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const recent = allItems.slice(0, 8);
  $("recent-body").innerHTML = recent.length
    ? recent.map(item => `<tr>
        <td><strong>${esc(item.name)}</strong></td>
        <td>${esc(item.category || "—")}</td>
        <td>${item.quantity ?? 0}</td>
        <td>₱${(item.unitPrice || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
        <td>${statusBadge(item)}</td>
      </tr>`).join("")
    : `<tr><td colspan="5" class="empty-row">No items yet.</td></tr>`;
}

// ——— INVENTORY TABLE ———
function getStockPriority(item) {
  const qty = item.quantity ?? 0;
  const thr = item.threshold ?? 5;
  if (qty === 0)   return 0; // Out of stock — top
  if (qty <= thr)  return 1; // Low stock
  return 2;                  // In stock
}

function renderInventory(filter = "", cat = "", sort = "") {
  const isAdmin = currentRole === "admin";
  let items = [...allItems];
  if (filter) items = items.filter(i => (i.name + i.sku + i.category).toLowerCase().includes(filter.toLowerCase()));
  if (cat)    items = items.filter(i => i.category === cat);
  if (sort === "low-stock") {
    items.sort((a, b) => getStockPriority(a) - getStockPriority(b));
  } else if (sort === "qty-asc") {
    items.sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0));
  } else if (sort === "qty-desc") {
    items.sort((a, b) => (b.quantity ?? 0) - (a.quantity ?? 0));
  } else if (sort === "name-asc") {
    items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else if (sort === "name-desc") {
    items.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
  }
  $("inventory-body").innerHTML = items.length
    ? items.map(item => `<tr>
        <td><strong>${esc(item.name)}</strong>${item.description ? `<br><small style="color:var(--text-3)">${esc(item.description)}</small>` : ""}</td>
        <td><code style="font-family:var(--font-mono);font-size:0.75rem">${esc(item.sku || "—")}</code></td>
        <td>${esc(item.category || "—")}</td>
        <td>${item.quantity ?? 0}</td>
        <td>₱${(item.unitPrice || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
        <td>${statusBadge(item)}</td>
        ${isAdmin ? `<td class="admin-only"><div class="action-btns">
          <button class="icon-btn" onclick="editItem('${item.id}')">✎ Edit</button>
          <button class="icon-btn del" onclick="confirmDelete('item','${item.id}')">✕ Del</button>
        </div></td>` : `<td class="admin-only"></td>`}
      </tr>`).join("")
    : `<tr><td colspan="7" class="empty-row">No items found.</td></tr>`;
}

function statusBadge(item) {
  const qty = item.quantity ?? 0;
  const thr = item.threshold ?? 5;
  if (qty === 0)    return `<span class="badge badge-out">Out of Stock</span>`;
  if (qty <= thr)   return `<span class="badge badge-low">Low Stock</span>`;
  return `<span class="badge badge-ok">In Stock</span>`;
}

function populateCategoryFilter() {
  const cats = [...new Set(allItems.map(i => i.category).filter(Boolean))].sort();
  const cur = $("cat-filter").value;
  $("cat-filter").innerHTML = `<option value="">All Categories</option>` +
    cats.map(c => `<option value="${esc(c)}" ${c === cur ? "selected" : ""}>${esc(c)}</option>`).join("");
}
function populateCatSuggestions() {
  const cats = [...new Set(allItems.map(i => i.category).filter(Boolean))].sort();
  $("cat-suggestions").innerHTML = cats.map(c => `<option value="${esc(c)}"></option>`).join("");
}

$("low-stock-card").addEventListener("click", () => {
  navigateTo("inventory");
  $("sort-select").value = "low-stock";
  renderInventory($("search-box").value, $("cat-filter").value, "low-stock");
});

  () => renderInventory($("search-box").value, $("cat-filter").value, $("sort-select").value));
$("cat-filter").addEventListener("change", () => renderInventory($("search-box").value, $("cat-filter").value, $("sort-select").value));
$("sort-select").addEventListener("change", () => renderInventory($("search-box").value, $("cat-filter").value, $("sort-select").value));

// ——— ADD / EDIT ITEM ———
$("add-item-btn").addEventListener("click", () => openItemModal());

window.editItem = function(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;
  $("item-id").value = id;
  $("item-name").value      = item.name || "";
  $("item-sku").value       = item.sku || "";
  $("item-category").value  = item.category || "";
  $("item-qty").value       = item.quantity ?? "";
  $("item-price").value     = item.unitPrice ?? "";
  $("item-threshold").value = item.threshold ?? "";
  $("item-desc").value      = item.description || "";
  $("item-modal-title").textContent = "Edit Item";
  openModal("item-modal");
};

function openItemModal() {
  $("item-id").value = "";
  ["item-name","item-sku","item-category","item-qty","item-price","item-threshold","item-desc"]
    .forEach(id => $(`${id}`).value = "");
  $("item-modal-title").textContent = "Add Item";
  openModal("item-modal");
}

$("save-item-btn").addEventListener("click", async () => {
  const name = $("item-name").value.trim();
  const qty  = parseInt($("item-qty").value);
  if (!name) return toast("Item name is required.", "error");
  if (isNaN(qty) || qty < 0) return toast("Enter a valid quantity.", "error");
  const payload = {
    name,
    sku:         $("item-sku").value.trim(),
    category:    $("item-category").value.trim(),
    quantity:    qty,
    unitPrice:   parseFloat($("item-price").value) || 0,
    threshold:   parseInt($("item-threshold").value) || 5,
    description: $("item-desc").value.trim(),
    updatedAt:   serverTimestamp(),
  };
  const editId = $("item-id").value;
  try {
    if (editId) {
      await updateDoc(doc(db, "inventory", editId), payload);
      toast("Item updated.");
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "inventory"), payload);
      toast("Item added.");
    }
    closeModal("item-modal");
  } catch (e) {
    toast("Failed to save item: " + e.message, "error");
  }
});

// ——— DELETE CONFIRM ———
window.confirmDelete = function(type, id) {
  pendingDelete = { type, id };
  const msg = type === "user"
    ? "Delete this user profile? (Firebase Auth account stays active; only the profile record is removed.)"
    : "Delete this inventory item? This cannot be undone.";
  $("confirm-msg").textContent = msg;
  openModal("confirm-modal");
};

$("confirm-delete-btn").addEventListener("click", async () => {
  try {
    if (pendingDelete.type === "item") {
      await deleteDoc(doc(db, "inventory", pendingDelete.id));
      toast("Item deleted.");
    } else if (pendingDelete.type === "user") {
      await deleteDoc(doc(db, "users", pendingDelete.id));
      toast("User profile deleted.");
      loadUsers();
    }
    closeModal("confirm-modal");
  } catch (e) {
    toast("Delete failed: " + e.message, "error");
  }
});

// ——— USERS (Admin) ———
async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));
  allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderUsers();
}

function renderUsers() {
  $("users-body").innerHTML = allUsers.length
    ? allUsers.map(u => `<tr>
        <td><strong>${esc(u.name || "—")}</strong></td>
        <td>${esc(u.email || "—")}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role || "user"}</span></td>
        <td>${u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString("en-PH") : "—"}</td>
        <td><div class="action-btns">
          <button class="icon-btn" onclick="openEditUser('${u.id}')">✎ Edit</button>
          ${u.id !== currentUser.uid ? `<button class="icon-btn del" onclick="confirmDelete('user','${u.id}')">✕ Del</button>` : `<span style="font-size:0.75rem;color:var(--text-3)">You</span>`}
        </div></td>
      </tr>`).join("")
    : `<tr><td colspan="5" class="empty-row">No users found.</td></tr>`;
}

$("create-user-btn").addEventListener("click", () => {
  editingUserId = null;
  $("user-modal-title").textContent = "Create User";
  $("save-user-btn").textContent = "Create User";
  ["new-user-name","new-user-email","new-user-pass"].forEach(id => $(id).value = "");
  $("new-user-role").value = "user";
  $("create-user-fields").style.display = "";
  hide($("user-modal-error"));
  openModal("user-modal");
});

window.openEditUser = function(uid) {
  const u = allUsers.find(x => x.id === uid);
  if (!u) return;
  editingUserId = uid;
  $("user-modal-title").textContent = "Edit User";
  $("save-user-btn").textContent = "Save Changes";
  $("new-user-name").value = u.name || "";
  $("new-user-role").value = u.role || "user";
  $("create-user-fields").style.display = "none"; // can't re-set email/pass of existing
  hide($("user-modal-error"));
  openModal("user-modal");
};

$("save-user-btn").addEventListener("click", async () => {
  const name = $("new-user-name").value.trim();
  const role = $("new-user-role").value;
  const errEl = $("user-modal-error");
  hide(errEl);
  if (!name) { show(errEl); errEl.textContent = "Name is required."; return; }

  if (editingUserId) {
    // Edit existing profile
    try {
      await updateDoc(doc(db, "users", editingUserId), { name, role });
      toast("User updated.");
      closeModal("user-modal");
      loadUsers();
    } catch (e) {
      show(errEl); errEl.textContent = e.message;
    }
    return;
  }

  // Create new user
  const email = $("new-user-email").value.trim();
  const pass  = $("new-user-pass").value;
  if (!email || !pass) { show(errEl); errEl.textContent = "Email and password are required."; return; }
  if (pass.length < 6) { show(errEl); errEl.textContent = "Password must be at least 6 characters."; return; }

  try {
    // Save current admin session ref
    const adminEmail = currentUser.email;
    const adminPass  = ""; // We can't re-auth silently here; inform admin

    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid  = cred.user.uid;
    await setDoc(doc(db, "users", uid), {
      name, email, role, createdAt: serverTimestamp()
    });
    // Sign back in as admin — prompt if needed
    toast(`User ${name} created! You may need to sign back in.`, "success");
    closeModal("user-modal");
    loadUsers();
    // Re-auth guard: if auth state changed, force re-login
    setTimeout(() => {
      if (auth.currentUser?.email !== adminEmail) {
        signOut(auth);
      }
    }, 1000);
  } catch (e) {
    show(errEl);
    errEl.textContent = friendlyAuthError(e.code) || e.message;
  }
});

// ——— CSV IMPORT ———
const importZone = $("import-zone");
const csvInput   = $("csv-input");

importZone.addEventListener("click", () => csvInput.click());
$("csv-browse").addEventListener("click", e => { e.stopPropagation(); csvInput.click(); });

importZone.addEventListener("dragover", e => { e.preventDefault(); importZone.classList.add("dragover"); });
importZone.addEventListener("dragleave", () => importZone.classList.remove("dragover"));
importZone.addEventListener("drop", e => {
  e.preventDefault();
  importZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) processCSV(file);
});
csvInput.addEventListener("change", () => {
  if (csvInput.files[0]) processCSV(csvInput.files[0]);
});

function processCSV(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const rows = parseCSV(text);
    if (!rows.length) return toast("No valid rows found.", "error");
    csvRows = rows;
    renderCSVPreview(rows);
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g,"_"));
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const obj  = {};
    headers.forEach((h, i) => obj[h] = vals[i] || "");
    return obj;
  }).filter(r => r.name);
}

function renderCSVPreview(rows) {
  hide(importZone);
  show($("csv-preview"));
  $("preview-count").textContent = rows.length;
  $("csv-body").innerHTML = rows.slice(0, 20).map(r => `<tr>
    <td>${esc(r.name)}</td>
    <td>${esc(r.sku || "—")}</td>
    <td>${esc(r.category || "—")}</td>
    <td>${r.quantity || 0}</td>
    <td>₱${parseFloat(r.unit_price || 0).toFixed(2)}</td>
  </tr>`).join("") + (rows.length > 20 ? `<tr><td colspan="5" class="empty-row">...and ${rows.length - 20} more rows</td></tr>` : "");
}

$("csv-cancel").addEventListener("click", () => {
  csvRows = [];
  csvInput.value = "";
  show(importZone);
  hide($("csv-preview"));
});

$("csv-import-btn").addEventListener("click", async () => {
  if (!csvRows.length) return;
  $("csv-import-btn").disabled = true;
  $("csv-import-btn").textContent = "Importing...";
  let count = 0;
  try {
    for (const r of csvRows) {
      await addDoc(collection(db, "inventory"), {
        name:        r.name,
        sku:         r.sku || "",
        category:    r.category || "",
        quantity:    parseInt(r.quantity) || 0,
        unitPrice:   parseFloat(r.unit_price) || 0,
        threshold:   parseInt(r.threshold) || 5,
        description: r.description || "",
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });
      count++;
    }
    toast(`${count} items imported successfully!`);
    $("csv-cancel").click();
  } catch (e) {
    toast("Import error: " + e.message, "error");
  } finally {
    $("csv-import-btn").disabled = false;
    $("csv-import-btn").textContent = "Import All";
  }
});

// ——— DOWNLOAD TEMPLATE ———
$("dl-template").addEventListener("click", () => {
  const csv = "name,sku,category,quantity,unit_price,threshold,description\n" +
    "Wireless Mouse,WM-001,Electronics,50,599.00,10,USB wireless mouse\n" +
    "Office Chair,OC-101,Furniture,12,3500.00,3,Ergonomic office chair\n" +
    "Ballpen (box),BP-200,Supplies,100,85.00,20,Black ballpen box of 12";
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "stockpilot-template.csv";
  a.click();
});

// ——— MODALS ———
function openModal(id) {
  show($("modal-overlay"));
  document.querySelectorAll(".modal").forEach(m => hide(m));
  show($(id));
}
function closeModal(id) {
  hide($(id));
  hide($("modal-overlay"));
}

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});
$("modal-overlay").addEventListener("click", e => {
  if (e.target === $("modal-overlay")) {
    document.querySelectorAll(".modal").forEach(m => hide(m));
    hide($("modal-overlay"));
  }
});

// ——— UTILS ———
function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

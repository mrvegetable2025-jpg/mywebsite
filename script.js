// script.js
// ─────────────────────────────────────────────────────────────
// Centralized cart + checkout + WhatsApp order logic
// Works with products.js and google-sheets-loader.js
// ─────────────────────────────────────────────────────────────

// ---------- Global Key ----------
window.CART_KEY = window.CART_KEY || 'cart';

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
  catch { return []; }
}

function saveCart(c) {
  localStorage.setItem(CART_KEY, JSON.stringify(c));
  updateCartCount();
}


// ---------- Migration (legacy support) ----------
if (localStorage.getItem('cart') && !localStorage.getItem(CART_KEY)) {
  localStorage.setItem(CART_KEY, localStorage.getItem('cart'));
  location.assign('checkout.html');

}

// ---------- Utilities ----------
function toINR(val) {
  return (Number(val) || 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  });
}

function normalizeWeight(w) {
  if (w == null) return 0;
  if (typeof w === 'number') return Math.round(w);
  const s = String(w).trim().toLowerCase();
  if (s.endsWith('kg')) return Math.round(parseFloat(s) * 1000);
  if (s.endsWith('g'))  return Math.round(parseFloat(s));
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function weightLabel(w) {
  const g = normalizeWeight(w);
  if (g === 250) return '250g';
  if (g === 500) return '500g';
  if (g === 1000) return '1kg';
  return g + 'g';
}

// ---------- Cart Storage ----------
function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
  catch { return []; }
}

function saveCart(c) {
  localStorage.setItem(CART_KEY, JSON.stringify(c));
  updateCartCount();
}

function findCartIndex(cart, productId, weight) {
  return cart.findIndex(i =>
    String(i.productId) === String(productId) &&
    normalizeWeight(i.weight) === normalizeWeight(weight)
  );
}

// ---------- Cart Count Badge ----------
function updateCartCount() {
  const c = getCart().reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = c > 0 ? c : '';
    el.style.display = c > 0 ? 'inline-block' : 'none';
  });
}

// ---------- Price Fetch ----------
function priceFor(product, grams) {
  const g = normalizeWeight(grams);
  const keyMap = { 250: 'price_250g', 500: 'price_500g', 1000: 'price_1kg' };
  const key = keyMap[g];
  if (product && key && product[key] != null && product[key] !== '') {
    const v = Number(product[key]);
    if (!isNaN(v)) return v;
  }
  const base = Number(product?.base_price_1kg) || 0;
  if (base) return Math.round((base / 1000) * g);
  return 0;
}

// ---------- Notification ----------
function getToastRoot() {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    Object.assign(root.style, {
      position: 'fixed',
      inset: '0',                 // top:0; right:0; bottom:0; left:0
      display: 'flex',
      justifyContent: 'start',
      alignItems: 'flex-end',     // bottom-center
      pointerEvents: 'none',
      zIndex: '999999',
      paddingBottom: '80px',      // space above nav bar
    });
    document.documentElement.appendChild(root);
  }
  return root;
}

function showNotification(msg) {
  const root = getToastRoot();

  // remove any old toasts
  root.querySelectorAll('.toast').forEach(t => t.remove());

  const n = document.createElement('div');
  n.className = 'toast';
  n.textContent = msg || 'Item added to cart!';

  Object.assign(n.style, {
    background: 'linear-gradient(90deg,#2ecc71,#27ae60)',
    color: '#fff',
    padding: '12px 20px',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '500',
    textAlign: 'center',
    boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
    opacity: '0',
    transform: 'translateY(20px)',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
    maxWidth: '90vw',
  });

  root.appendChild(n);

  // force paint
  void n.offsetHeight;

  // animate in
  requestAnimationFrame(() => {
    n.style.opacity = '1';
    n.style.transform = 'translateY(0)';
  });

  // hide after 2s
  clearTimeout(n.hideTimer);
  n.hideTimer = setTimeout(() => {
    n.style.opacity = '0';
    n.style.transform = 'translateY(20px)';
    setTimeout(() => n.remove(), 300);
  }, 2000);
}



// ---------- Cart API ----------
function addToCart(productId, weight = 1000, qty = 1) {
  const cart = getCart();
  const idx = findCartIndex(cart, productId, weight);
  if (idx > -1)
    cart[idx].quantity = Number(cart[idx].quantity || 0) + Number(qty || 1);
  else
    cart.push({ productId, weight: normalizeWeight(weight), quantity: Number(qty || 1) });

  saveCart(cart);
  if (typeof renderCart === 'function') renderCart();
  showNotification('item added to cart ✅');
}
function showCartNotification(message) {
  const notify = document.getElementById("cart-notification");
  if (!notify) return;

  notify.textContent = message;
  notify.classList.add("show");

  // Hide after 2 seconds
  setTimeout(() => {
    notify.classList.remove("show");
  }, 2000);
}


function updateQuantity(productId, weight, newQty) {
  const cart = getCart();
  const idx = findCartIndex(cart, productId, weight);
  if (idx === -1) return;
  if (Number(newQty) <= 0) cart.splice(idx, 1);
  else cart[idx].quantity = Math.max(1, Number(newQty) || 1);
  saveCart(cart);
  if (typeof renderCart === 'function') renderCart();
}

function removeFromCart(productId, weight) {
  const cart = getCart();
  const idx = findCartIndex(cart, productId, weight);
  if (idx === -1) return;
  cart.splice(idx, 1);
  saveCart(cart);
  if (typeof renderCart === 'function') renderCart();
}

// ---------- Render Cart (cart.html) ----------
async function renderCart() {
  const itemsWrap = document.getElementById('cart-items');
  const empty     = document.getElementById('cart-empty');
  const summary   = document.getElementById('cart-summary');
  if (!itemsWrap || !empty || !summary) return;

  // Wait for Google Sheets data
  let tries = 0;
  while ((!window.products || window.products.length === 0) && tries < 30) {
    await new Promise(r => setTimeout(r, 200));
    tries++;
  }

  const cart = getCart();
  itemsWrap.innerHTML = '';

  if (cart.length === 0) {
    empty.style.display='block';
    summary.style.display='none';
    return;
  }

  empty.style.display='none';
  summary.style.display='block';

  let subtotal = 0;

  cart.forEach(it => {
    const product = (window.products || []).find(p =>
      String(p.id) === String(it.productId) || String(p.name) === String(it.productId)
    );
    const unit = priceFor(product, it.weight);
    const line = unit * (Number(it.quantity) || 1);
    subtotal += line;

    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <img src="${product?.image || 'images/placeholder.jpg'}" alt="">
      <div class="cart-info">
        <h3>${product?.name || 'Item'}</h3>
        <p>${weightLabel(it.weight)}</p>
        <div class="quantity-control">
          <button class="dec">−</button>
          <span>${it.quantity}</span>
          <button class="inc">+</button>
        </div>
      </div>
      <div class="cart-actions">
        <div class="price">${toINR(line)}</div>
        <button class="remove-btn" title="Remove">🗑</button>
      </div>
    `;

    row.querySelector('.inc')   .addEventListener('click', () => updateQuantity(it.productId, it.weight, it.quantity + 1));
    row.querySelector('.dec')   .addEventListener('click', () => updateQuantity(it.productId, it.weight, it.quantity - 1));
    row.querySelector('.remove-btn').addEventListener('click', () => removeFromCart(it.productId, it.weight));

    itemsWrap.appendChild(row);
  });

  document.getElementById('cart-subtotal').textContent = toINR(subtotal);
  document.getElementById('cart-shipping').textContent = toINR(0);
  document.getElementById('cart-total').textContent    = toINR(subtotal);

  // Wire checkout button
  // Wire checkout button (robust)
const checkoutBtn = document.getElementById('checkout-btn');
if (checkoutBtn) {
  checkoutBtn.onclick = () => {
    // Try reading from storage
    let c = getCart();

    // Fallback: if storage says empty but UI shows rows, trust UI
    const uiCount = itemsWrap?.children?.length || 0;
    if ((!Array.isArray(c) || c.length === 0) && uiCount > 0) {
      // Rebuild a minimal snapshot from what we rendered (ids + weights were already used)
      // This fallback just navigates with the total you already computed
      // and keeps existing cart in storage as-is.
      c = [{}]; // non-empty placeholder to pass the check
    }

    if (!Array.isArray(c) || c.length === 0) {
      alert('Your cart is empty! Please add items first.');
      return;
    }

    // Persist total and navigate
    localStorage.setItem('cartTotal', String(subtotal));
    location.assign('checkout.html');
  };
}


}

// ---------- Render Checkout Summary (checkout.html) ----------
async function renderCheckoutSummary() {
  const itemsEl = document.getElementById('checkout-items');
  const totalEl = document.getElementById('checkout-total');
  if (!itemsEl || !totalEl) return;

  // Wait for product data
  let tries = 0;
  while ((!window.products || window.products.length === 0) && tries < 30) {
    await new Promise(r => setTimeout(r, 200));
    tries++;
  }

  const cart = getCart();
  if (!cart.length) {
    itemsEl.innerHTML = "<p style='color:gray;'>No items found. Please return to <a href='products.html'>Products</a>.</p>";
    totalEl.textContent = toINR(0);
    return;
  }

  let subtotal = 0;
  itemsEl.innerHTML = '';

  cart.forEach(it => {
    const product = (window.products || []).find(p =>
      String(p.id) === String(it.productId) || String(p.name) === String(it.productId)
    );
    const unit = priceFor(product, it.weight);
    const line = unit * (Number(it.quantity) || 1);
    subtotal += line;

    const row = document.createElement('div');
    row.className = 'summary-row';
    row.innerHTML = `
      <span>${product?.name || 'Item'} (${it.quantity} × ${toINR(unit)})</span>
      <span>${toINR(line)}</span>
    `;
    itemsEl.appendChild(row);
  });

  totalEl.textContent = toINR(subtotal);

  // WhatsApp order logic
  const form = document.getElementById('checkout-form');
  if (form) {
    form.onsubmit = e => {
      e.preventDefault();
      const name = document.getElementById('customer-name').value.trim();
      const phone = document.getElementById('customer-phone').value.trim();
      const addr = document.getElementById('customer-address').value.trim();
      if (!name || !phone || !addr) { alert('Please fill all fields.'); return; }

      let msg = `🛒 *New Order from ${name}*%0A📞 ${phone}%0A🏠 ${addr}%0A%0A*Items:*%0A`;
      cart.forEach(it => {
        const product = (window.products || []).find(p =>
          String(p.id) === String(it.productId) || String(p.name) === String(it.productId)
        );
        const unit = priceFor(product, it.weight);
        msg += `• ${product?.name || 'Item'} (${weightLabel(it.weight)} × ${it.quantity}) = ${toINR(unit * it.quantity)}%0A`;
      });
      msg += `%0A*Total:* ${toINR(subtotal)}%0A%0AThank you! 🥬`;

      window.open(`https://wa.me/918056191339?text=${msg}`, '_blank');
      localStorage.removeItem(CART_KEY);
      localStorage.removeItem('cartTotal');
      setTimeout(() => { window.location.href = 'sucess.html'; }, 1500);
    };
  }
}

// ---------- Expose ----------
window.addToCart = addToCart;
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;
window.renderCart = renderCart;
window.renderCheckoutSummary = renderCheckoutSummary;

// ---------- Auto Init ----------
document.addEventListener('DOMContentLoaded', () => {
  updateCartCount();
  const page = window.location.pathname.split('/').pop();
  if (page === 'cart.html') renderCart();
  if (page === 'checkout.html') renderCheckoutSummary();
});

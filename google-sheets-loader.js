/* Combined script.js
   - Products loader from Google Sheets
   - Product display (products.html)
   - Cart management (cart.html)
   - Checkout via WhatsApp (included)
   - Shipping fixed to ₹0.00
*/

/* =========================
   CONFIG
   ========================= */
const SHEETS_CONFIG = {
  sheetId: '1dOymxxfsgTlg9DlP5xrTbTH1OtIsUtbwaTnLbKsgsak',
  sheetName: 'Products',
  jsonUrl() {
    return `https://docs.google.com/spreadsheets/d/${this.sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(this.sheetName)}`;
  }
};

const CART_KEY = 'cart';
const LOCAL_PLACEHOLDER = 'images/placeholder.jpg';
const PRODUCTS_WAIT_MS = 3000; // how long to wait for window.products if needed

/* =========================
   UTILITIES
   ========================= */
function safeParseGViz(text) {
  // Google returns: google.visualization.Query.setResponse({...});
  try {
    const start = text.indexOf('(');
    const end = text.lastIndexOf(')');
    const body = start > -1 && end > -1 ? text.slice(start + 1, end) : text;
    return JSON.parse(body);
  } catch (err) {
    console.error('GViz parse error', err);
    return null;
  }
}

function normalizeWeightToGrams(w) {
  if (w == null) return 0;
  if (typeof w === 'number') return Math.round(w);
  const s = String(w).trim().toLowerCase();
  if (s.endsWith('kg')) {
    const n = parseFloat(s.replace('kg', '')) || 0;
    return Math.round(n * 1000);
  }
  if (s.endsWith('g')) {
    const n = parseFloat(s.replace('g', '')) || 0;
    return Math.round(n);
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function weightLabel(w) {
  const g = normalizeWeightToGrams(w);
  if (g === 250) return '250g';
  if (g === 500) return '500g';
  if (g === 1000) return '1kg';
  if (g === 2000) return '2kg';
  if (g >= 1000 && g % 1000 === 0) return (g / 1000) + 'kg';
  return g + 'g';
}

function formatPriceINR(n) {
  return (Number(n) || 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  });
}

/* =========================
   PRODUCTS LOADER
   ========================= */
async function loadProductsFromGoogleSheets(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const txt = await res.text();

    // Quick check for HTML (common error when sheet isn't shared publicly)
    if (txt.trim().startsWith('<') || /<!doctype html>/i.test(txt)) {
      throw new Error('Google Sheets returned HTML. Make sure the sheet is public (Anyone with link can view) and the Sheet ID/Name are correct. Open the URL in a browser to verify.');
    }

    const parsed = safeParseGViz(txt);
    if (!parsed || !parsed.table) throw new Error('Unexpected Google Sheets response format.');

    const cols = (parsed.table.cols || []).map(c => (c.label || c.id || '').toString().trim());
    const rows = parsed.table.rows || [];

    const productsArray = rows.map(r => {
      const obj = {};
      (r.c || []).forEach((cell, i) => {
        const keyRaw = cols[i] || `col${i}`;
        const key = keyRaw.toString().toLowerCase().replace(/\s+/g, '_');
        obj[key] = (cell && typeof cell.v !== 'undefined') ? cell.v : '';
      });

      // ensure defaults
      if (!obj.id) {
        const base = (obj.name || 'product').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        obj.id = `${base}-${Math.random().toString(36).slice(2,6)}`;
      }

      // normalize numeric price fields
      ['price_250g','price_500g','price_1kg','price_2kg','base_price_1kg'].forEach(k => {
        if (obj[k] !== '' && obj[k] != null && !isNaN(obj[k])) obj[k] = Number(obj[k]);
      });

      obj.category = (obj.category || 'others').toString().trim().toLowerCase();
      obj.image = obj.image || `images/${obj.id}.jpg`;
      obj.description = obj.description || `Fresh ${obj.name || 'product'} - premium quality.`;
      obj.stock = obj.stock || 'available';

      // keep base price for fallback
      obj.base_price_1kg = obj.base_price_1kg || obj.price_1kg || 0;

      return obj;
    });

    window.products = productsArray;
    document.dispatchEvent(new CustomEvent('productsLoaded', { detail: productsArray }));
    return productsArray;
  } catch (err) {
    console.error('Error loading products from Google Sheets:', err);
    // ensure downstream code sees an array
    window.products = window.products || [];
    document.dispatchEvent(new CustomEvent('productsLoaded', { detail: window.products }));
    return [];
  }
}

async function initializeProducts() {
  const container = document.getElementById('products-container');
  if (container) {
    container.innerHTML = `
      <div class="loading-indicator">
        <div class="loading-spinner"></div>
        <p>Loading products from Google Sheets...</p>
      </div>`;
  }

  const url = SHEETS_CONFIG.jsonUrl();
  const products = await loadProductsFromGoogleSheets(url);

  if (Array.isArray(products) && products.length === 0 && container) {
    container.innerHTML = `
      <div class="error-message">
        <p>⚠️ Unable to load products. Check your Google Sheet sharing settings (should be "Anyone with the link" → Viewer) and that the Sheet ID & tab name are correct.</p>
      </div>`;
  } else {
    // if your page defines displayProducts, call it
    if (typeof displayProducts === 'function') displayProducts();
  }

  return products;
}

// Expose
window.initializeProducts = initializeProducts;

/* =========================
   PRICE RESOLUTION HELPERS
   ========================= */
function getPriceForWeightFromProduct(product, weightGrams) {
  if (!product) return 0;
  const w = normalizeWeightToGrams(weightGrams);

  // common keys to look for (support various naming)
  const keys = [
    w === 250 ? 'price_250g' : null,
    w === 500 ? 'price_500g' : null,
    w === 1000 ? 'price_1kg' : null,
    w === 2000 ? 'price_2kg' : null,
    `price${w}`, `${w}g`, w === 1000 ? '1kg' : null, w === 2000 ? '2kg' : null,
    'price','mrp','rate','sellingPrice','sell_price','base_price_1kg'
  ].filter(Boolean);

  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(product, k) && product[k] !== '' && product[k] != null) {
      const val = Number(product[k]);
      if (!isNaN(val)) return val;
    }
  }

  // fallback to base price per 1kg if available
  if (product.base_price_1kg && !isNaN(Number(product.base_price_1kg))) {
    return (Number(product.base_price_1kg) / 1000) * w;
  }

  // last resort: find any numeric field
  for (const k of Object.keys(product)) {
    const v = product[k];
    if (typeof v === 'number' && v > 0) return v;
    if (typeof v === 'string' && /^[0-9]+(\.[0-9]+)?$/.test(v)) return Number(v);
  }

  return 0;
}

/* =========================
   CART STORAGE & API
   ========================= */
function readCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  } catch (e) {
    console.error('readCart parse error', e);
    return [];
  }
}

function persistCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch (e) {
    console.error('persistCart error', e);
  }
  updateCartCount();
}

function findCartIndex(cart, productId, weight) {
  const w = normalizeWeightToGrams(weight);
  return cart.findIndex(i => String(i.productId) === String(productId) && normalizeWeightToGrams(i.weight) === w);
}

function updateCartCount() {
  const cart = readCart();
  const totalQty = cart.reduce((s, it) => s + (Number(it.quantity) || 0), 0);

  // elements with class cart-count
  document.querySelectorAll('.cart-count').forEach(el => {
    if (totalQty > 0) {
      el.textContent = totalQty;
      el.style.display = 'inline-block';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  });

  // element with id cart-count (if used)
  const elId = document.getElementById('cart-count');
  if (elId) elId.textContent = totalQty;
}

/**
 * Add item to cart
 * productId (string), weight (grams or '1kg' etc), qty (number)
 * This records the unit price at the time of addition (so cart shows same price as product page)
 */
function addToCart(productId, weight = 1000, qty = 1) {
  const cart = readCart();
  const w = normalizeWeightToGrams(weight);
  const idx = findCartIndex(cart, productId, w);
  const prod = (window.products || []).find(p => String(p.id) === String(productId) || String(p.name) === String(productId));

  // resolve unit price now
  const unitPrice = getPriceForWeightFromProduct(prod, w);

  if (idx > -1) {
    cart[idx].quantity = Number(cart[idx].quantity || 0) + Number(qty || 1);
    // keep stored price if already present; otherwise set
    if (cart[idx].price == null) cart[idx].price = unitPrice;
  } else {
    cart.push({
      productId: productId,
      weight: w,
      quantity: Number(qty || 1),
      price: unitPrice // store unit price at add time
    });
  }

  persistCart(cart);
  renderCart(); // refresh cart UI if present
  showNotification((prod?.name || 'Item') + ' added to cart!');
}

/**
 * Update quantity (min 1). If newQty <= 0, remove item.
 */
function updateQuantity(productId, weight, newQty) {
  const cart = readCart();
  const idx = findCartIndex(cart, productId, weight);
  if (idx === -1) return;
  if (Number(newQty) <= 0) {
    // remove
    cart.splice(idx, 1);
  } else {
    cart[idx].quantity = Math.max(1, Number(newQty) || 1);
  }
  persistCart(cart);
  renderCart();
}

/**
 * Remove item
 */
function removeFromCart(productId, weight) {
  const cart = readCart();
  const idx = findCartIndex(cart, productId, weight);
  if (idx === -1) return;
  const removed = cart.splice(idx, 1);
  persistCart(cart);
  renderCart();
  const prod = (window.products || []).find(p => String(p.id) === String(productId));
  showNotification((prod?.name || 'Item') + ' removed from cart');
}

/* expose cart API globally */
window.addToCart = addToCart;
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;
window.getCart = readCart;

/* =========================
   PRODUCT UI: displayProducts() + createProductCard()
   ========================= */
function displayProducts() {
  const searchTerm = document.getElementById('search-input')?.value?.toLowerCase() || '';
  const activeCategory = document.querySelector('.filter-btn.active')?.dataset.category || 'all';
  const productsList = window.products || [];

  let filtered = productsList;

  if (searchTerm) {
    filtered = filtered.filter(p => (p.name || '').toString().toLowerCase().includes(searchTerm));
  }
  if (activeCategory && activeCategory !== 'all') {
    filtered = filtered.filter(p => (p.category || '').toString().toLowerCase() === activeCategory.toLowerCase());
  }

  const container = document.getElementById('products-container');
  if (!container) return;

  container.innerHTML = '';
  if (!filtered.length) {
    container.innerHTML = `<div class="text-center" style="padding:2rem;"><p>No products found.</p></div>`;
    return;
  }

  // Group by category
  const byCat = {};
  filtered.forEach(p => {
    const cat = (p.category || 'others').toString().toLowerCase();
    byCat[cat] = byCat[cat] || [];
    byCat[cat].push(p);
  });

  Object.keys(byCat).sort().forEach(cat => {
    const section = document.createElement('section');
    section.className = 'category-section';
    const title = document.createElement('h2');
    title.className = 'category-title';
    title.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'products-grid';

    byCat[cat].forEach(prod => grid.appendChild(createProductCard(prod)));
    section.appendChild(grid);
    container.appendChild(section);
  });

  updateCategoryFilters(); // dynamic filter buttons
}

function updateCategoryFilters() {
  const allContainer = document.querySelector('.category-filters');
  if (!allContainer) return;

  // collect categories
  const productsList = window.products || [];
  const categories = [...new Set(productsList.map(p => (p.category || '').toString().toLowerCase()).filter(Boolean))].sort();

  // keep the 'All' button
  const allBtn = allContainer.querySelector('[data-category="all"]');
  allContainer.querySelectorAll('.filter-btn:not([data-category="all"])').forEach(b => b.remove());

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.category = cat;
    btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    btn.addEventListener('click', function () {
      allContainer.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
      this.classList.add('active');
      displayProducts();
    });
    allContainer.appendChild(btn);
  });
}

function createProductCard(product) {
  const card = document.createElement('div');
  card.className = product.stock?.toString().toLowerCase() === 'out' ? 'product-card out-of-stock' : 'product-card';

  // prices
  const p250 = getPriceForWeightFromProduct(product, 250);
  const p500 = getPriceForWeightFromProduct(product, 500);
  const p1kg = getPriceForWeightFromProduct(product, 1000);
  const p2kg = getPriceForWeightFromProduct(product, 2000);
  const defaultPrice = p1kg || p250 || p500 || p2kg || 0;

  card.innerHTML = `
    ${product.stock?.toString().toLowerCase() === 'out' ? '<div class="stock-badge">OUT OF STOCK</div>' : ''}
    <img class="product-image" src="${product.image || LOCAL_PLACEHOLDER}" alt="${product.name}" onerror="this.onerror=null;this.src='${LOCAL_PLACEHOLDER}'">
    <div class="product-info">
      <h3 class="product-name">${product.name}</h3>
     

      <div class="weight-selector">
        <div class="weight-options">
          <label><input type="radio" name="weight-${product.id}" value="250"> 250g</label>
          <label><input type="radio" name="weight-${product.id}" value="500"> 500g</label>
          <label><input type="radio" name="weight-${product.id}" value="1000" checked> 1kg</label>
          <label><input type="radio" name="weight-${product.id}" value="2000"> 2kg</label>
        </div>
      </div>

      <div class="price-display" id="price-${product.id}">${formatPriceINR(defaultPrice)}</div>

     

      <div class="product-card-actions">
        <button class="btn btn-primary btn-add-cart"${product.stock?.toString().toLowerCase() === 'out' ? ' disabled' : ''}>
          ${product.stock?.toString().toLowerCase() === 'out' ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    </div>
  `;

  // weight change -> price update
  const weightInputs = card.querySelectorAll(`input[name="weight-${product.id}"]`);
  weightInputs.forEach(inp => inp.addEventListener('change', function () {
    const w = normalizeWeightToGrams(this.value);
    const price = getPriceForWeightFromProduct(product, w);
    const priceEl = card.querySelector(`#price-${product.id}`);
    if (priceEl) priceEl.textContent = formatPriceINR(price);
  }));

  const addBtn = card.querySelector('.btn-add-cart');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      const selected = card.querySelector(`input[name="weight-${product.id}"]:checked`);
      if (!selected) {
        alert('Please select a weight');
        return;
      }
      const w = normalizeWeightToGrams(selected.value);
      addToCart(product.id, w, 1);
    });
  }

  return card;
}

/* =========================
   CART UI: renderCart()
   ========================= */
async function createCartItemElement(item) {
  const prod = (window.products || []).find(p => String(p.id) === String(item.productId)) || null;
  const unitPrice = Number(item.price != null ? item.price : (getPriceForWeightFromProduct(prod, item.weight)));
  const qty = Number(item.quantity) || 1;
  const wLabel = weightLabel(item.weight);
  const imageUrl = prod?.image || LOCAL_PLACEHOLDER;

  const div = document.createElement('div');
  div.className = 'cart-item';
  div.innerHTML = `
    <div class="cart-item-left">
      <img class="cart-item-image" src="${imageUrl}" alt="${prod?.name || 'Product'}" onerror="this.onerror=null;this.src='${LOCAL_PLACEHOLDER}'">
      <div class="cart-item-info">
        <div class="cart-item-name">${prod?.name || item.productId}</div>
        <div class="cart-item-meta">${wLabel} • ${formatPriceINR(unitPrice)} per ${wLabel}</div>
      </div>
    </div>
    <div class="cart-item-right">
      <div class="quantity-box">
        <button class="quantity-btn decrease" data-id="${item.productId}" data-weight="${item.weight}">−</button>
        <span class="quantity-display">${qty}</span>
        <button class="quantity-btn increase" data-id="${item.productId}" data-weight="${item.weight}">+</button>
      </div>
      <div class="cart-line-total">${formatPriceINR(unitPrice * qty)}</div>
      <button class="remove-btn" data-id="${item.productId}" data-weight="${item.weight}">Remove</button>
    </div>
  `;
  return div;
}

async function renderCart() {
  const itemsContainer = document.getElementById('cart-items');
  const emptyEl = document.getElementById('cart-empty') || document.getElementById('cart-empty') ;
  const summaryEl = document.getElementById('cart-summary');
  const subtotalEl = document.getElementById('cart-subtotal');
  const shippingEl = document.getElementById('cart-shipping');
  const totalEl = document.getElementById('cart-total');

  if (!itemsContainer || !emptyEl || !summaryEl) return;

  const cart = readCart();
  if (!cart.length) {
    emptyEl.style.display = 'block';
    summaryEl.style.display = 'none';
    itemsContainer.innerHTML = '';
    updateCartCount();
    return;
  }

  emptyEl.style.display = 'none';
  summaryEl.style.display = 'block';
  itemsContainer.innerHTML = '';

  // ensure products available
  const start = Date.now();
  while ((!window.products || !Array.isArray(window.products)) && Date.now() - start < PRODUCTS_WAIT_MS) {
    // wait up to timeout for initializeProducts
    await new Promise(r => setTimeout(r, 100));
  }

  let subtotal = 0;
  for (const raw of cart) {
    const normalized = { ...raw, weight: normalizeWeightToGrams(raw.weight) };
    const prod = (window.products || []).find(p => String(p.id) === String(normalized.productId)) || null;
    const unitPrice = Number(raw.price != null ? raw.price : getPriceForWeightFromProduct(prod, normalized.weight));
    const qty = Number(normalized.quantity) || 1;
    subtotal += unitPrice * qty;

    const el = await createCartItemElement(normalized);
    itemsContainer.appendChild(el);
  }

  // Shipping always 0 as demanded by user
  const shipping = 0;
  const total = subtotal + shipping;

  if (subtotalEl) subtotalEl.textContent = formatPriceINR(subtotal);
  if (shippingEl) shippingEl.textContent = formatPriceINR(shipping);
  if (totalEl) totalEl.textContent = formatPriceINR(total);

  updateCartCount();
  initCartEvents();
}

/* delegated cart events handler (idempotent) */
function initCartEvents() {
  const container = document.getElementById('cart-items');
  if (!container) return;
  if (container._eventsAttached) return;
  container._eventsAttached = true;

  container.addEventListener('click', function (e) {
    const dec = e.target.closest('.quantity-btn.decrease');
    if (dec) {
      const pid = dec.dataset.id;
      const weight = dec.dataset.weight;
      const cart = readCart();
      const idx = findCartIndex(cart, pid, weight);
      if (idx === -1) return;
      const cur = Number(cart[idx].quantity) || 1;
      updateQuantity(pid, weight, Math.max(1, cur - 1));
      return;
    }

    const inc = e.target.closest('.quantity-btn.increase');
    if (inc) {
      const pid = inc.dataset.id;
      const weight = inc.dataset.weight;
      const cart = readCart();
      const idx = findCartIndex(cart, pid, weight);
      if (idx === -1) return;
      const cur = Number(cart[idx].quantity) || 0;
      updateQuantity(pid, weight, cur + 1);
      return;
    }

    const rem = e.target.closest('.remove-btn');
    if (rem) {
      const pid = rem.dataset.id;
      const weight = rem.dataset.weight;
      if (confirm('Remove this item from the cart?')) removeFromCart(pid, weight);
      return;
    }
  });
}

/* =========================
   CHECKOUT (WhatsApp)
   ========================= */
function calculateCartTotal() {
  const cart = readCart();
  return cart.reduce((sum, item) => {
    const unit = Number(item.price != null ? item.price : getPriceForWeightFromProduct((window.products || []).find(p => String(p.id) === String(item.productId)), item.weight));
    const qty = Number(item.quantity) || 0;
    return sum + unit * qty;
  }, 0);
}

function generateWhatsAppMessage(customerName, phone, address) {
  const cart = readCart();
  const total = calculateCartTotal();
  let msg = `🛒 *New Order*\n\n*Customer:* ${customerName}\n*Phone:* ${phone}\n*Address:* ${address}\n\n*Order Summary:*\n`;
  cart.forEach((item, i) => {
    const prod = (window.products || []).find(p => String(p.id) === String(item.productId)) || {};
    const unit = Number(item.price != null ? item.price : getPriceForWeightFromProduct(prod, item.weight));
    const qty = Number(item.quantity) || 0;
    const weight = weightLabel(item.weight);
    msg += `${i+1}. ${prod.name || item.productId} (${weight}) x ${qty} = ${formatPriceINR(unit * qty)}\n`;
  });
  msg += `\n*Total: ${formatPriceINR(total)}*`;
  return msg;
}

function handleCheckout() {
  const name = document.getElementById('customer-name')?.value?.trim();
  const phone = document.getElementById('customer-phone')?.value?.trim();
  const address = document.getElementById('customer-address')?.value?.trim();
  if (!name || !phone || !address) { alert('Please fill all fields'); return; }
  if (phone.length < 10) { alert('Please enter a valid phone'); return; }
  const cart = readCart();
  if (!cart.length) { alert('Cart is empty'); return; }

  const message = generateWhatsAppMessage(name, phone, address);
  const whatsappNumber = '+918056191339'; // keep your number
  const url = `https://wa.me/${whatsappNumber.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  // optionally clear cart if you want:
  // persistCart([]); renderCart();
}

/* =========================
   SMALL UI Helpers
   ========================= */
function showNotification(msg) {
  const n = document.createElement('div');
  n.className = 'toast-notification';
  n.style.cssText = 'position:fixed;top:80px;right:20px;background:linear-gradient(90deg,#2ecc71,#27ae60);color:#fff;padding:10px 14px;border-radius:8px;z-index:9999;box-shadow:0 6px 18px rgba(0,0,0,0.15);';
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(()=> { n.style.opacity = '0'; setTimeout(()=> n.remove(), 400); }, 3000);
}

/* =========================
   INIT ON DOM READY
   ========================= */
document.addEventListener('DOMContentLoaded', async () => {
  // attempt to initialize products (will show loading state)
  try {
    await initializeProducts();
  } catch (e) {
    console.warn('initializeProducts error', e);
  }

  // wire search input (if present)
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => displayProducts());
  }

  // set up category filter click for the existing "All" button
  document.querySelectorAll('.category-filters .filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
      this.classList.add('active');
      displayProducts();
    });
  });

  // Render products if present
  if (document.getElementById('products-container')) {
    if (typeof displayProducts === 'function') displayProducts();
  }

  // Initial cart render
  await renderCart();

  // checkout form submit
  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', function(e) {
      e.preventDefault();
      handleCheckout();
    });
  }

  // expose renderCart globally
  window.renderCart = renderCart;
});


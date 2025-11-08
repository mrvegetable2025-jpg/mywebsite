// products.js
// UI rendering for product listing. Assumes window.products is loaded by google-sheets-loader.js
// Uses addToCart() from script.js

(function () {
  // ---------- Helper Functions ----------
  function gToLabel(g) {
    if (g === 250) return '250g';
    if (g === 500) return '500g';
    if (g === 1000) return '1kg';
    return g + 'g';
  }

  function priceFor(product, grams) {
    const keys = {
      250: ['price_250g'],
      500: ['price_500g'],
      1000: ['price_1kg']
    };
    const list = keys[grams] || [];
    for (const k of list) {
      if (product[k] != null && product[k] !== '') return Number(product[k]) || 0;
    }
    const base = Number(product.base_price_1kg) || 0;
    if (base) return Math.round((base / 1000) * grams);
    for (const k in product) {
      const v = product[k];
      if (typeof v === 'number' && v > 0) return v;
      if (typeof v === 'string' && /^[0-9]+(\.[0-9]+)?$/.test(v)) return Number(v);
    }
    return 0;
  }

  // ---------- Product Card Builder ----------
  function createCard(product) {
    const gramsList = [250, 500, 1000];
    const container = document.createElement('div');
    container.className = 'product-card';

    // Out-of-stock badge
    if ((product.stock || '').toString().toLowerCase().includes('out')) {
      container.classList.add('out-of-stock');
      const badge = document.createElement('div');
      badge.className = 'stock-badge out-of-stock-badge';
      badge.textContent = 'Out of stock';
      container.appendChild(badge);
    }

    // Image
    const img = document.createElement('img');
    img.className = 'product-image';
    img.alt = product.name || 'Product';
    img.src = product.image || 'images/placeholder.jpg';
    img.onerror = () => { img.src = 'images/placeholder.jpg'; };
    container.appendChild(img);

    // Info
    const info = document.createElement('div');
    info.className = 'product-info';
    container.appendChild(info);

    // Title + description
    const title = document.createElement('div');
    title.className = 'product-name';
    title.textContent = product.name || 'Product';
    info.appendChild(title);

    
    // Weight selector
    const weightWrap = document.createElement('div');
    weightWrap.className = 'weight-selector';
    const weightOpts = document.createElement('div');
    weightOpts.className = 'weight-options';
    weightWrap.appendChild(weightOpts);
    info.appendChild(weightWrap);

    let selected = 1000; // default 1 kg

    gramsList.forEach(g => {
      const opt = document.createElement('label');
      opt.className = 'weight-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `w-${product.id}`;
      input.value = String(g);
      if (g === selected) input.checked = true;
      const span = document.createElement('span');
      span.textContent = gToLabel(g);
      opt.appendChild(input);
      opt.appendChild(span);
      weightOpts.appendChild(opt);

      input.addEventListener('change', () => {
        selected = g;
        priceEl.textContent = priceFor(product, selected).toLocaleString('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 2
        });
      });
    });

    // Price display
    const priceEl = document.createElement('div');
    priceEl.className = 'price-display';
    priceEl.textContent = priceFor(product, selected).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    });
    info.appendChild(priceEl);

    // Add to Cart button
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-add-cart';
    btn.textContent = 'Add to Cart';
    btn.addEventListener('click', () => {
      if (typeof window.addToCart === 'function') {
        window.addToCart(product.id, selected, 1);
      } else {
        alert('Add to Cart function not found.');
      }
    });
    info.appendChild(btn);

    return container;
  }

  // ---------- Display Products ----------
  function displayProducts() {
    const container = document.getElementById('products-container');
    if (!container) return;

    const searchTerm = document.getElementById('search-input')?.value?.toLowerCase() || '';
    const activeCategory = document.querySelector('.filter-btn.active')?.dataset.category || 'all';
    const productsList = (window.products || []).slice();

    let filtered = productsList;
    if (searchTerm) {
      filtered = filtered.filter(p => (p.name || '').toLowerCase().includes(searchTerm));
    }
    if (activeCategory && activeCategory !== 'all') {
      filtered = filtered.filter(p => (p.category || '').toLowerCase() === activeCategory.toLowerCase());
    }

    container.innerHTML = '';
    if (!filtered.length) {
      container.innerHTML = `<div class="text-center" style="padding:2rem;"><p>No products found.</p></div>`;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'products-grid unified-grid';
    container.appendChild(grid);

    filtered.forEach(product => {
      grid.appendChild(createCard(product));
    });
  }

  // ---------- Wire Search + Filters ----------
  function wireSearchAndFilters() {
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    const filterButtons = document.querySelectorAll('.filter-btn');

    if (searchInput) {
      searchInput.addEventListener('input', () => displayProducts());
    }
    if (searchClear && searchInput) {
      searchClear.addEventListener('click', () => {
        searchInput.value = '';
        displayProducts();
        searchInput.focus();
      });
    }

    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        displayProducts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  // ---------- Initialize when products loaded ----------
  document.addEventListener('productsLoaded', () => {
    wireSearchAndFilters();
    displayProducts();
  });

  // Expose
  window.displayProducts = displayProducts;
})();

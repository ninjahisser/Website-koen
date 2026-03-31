// Shopping Cart Management
class ShoppingCart {
  constructor() {
    this.storageKey = 'het-voorlaatste-nieuws-cart';
    this.cart = this.loadFromStorage();
  }

  addItem(product) {
    const existingItem = this.cart.find(item => item.id === product.id);
    
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      this.cart.push({
        id: product.id,
        title: product.title,
        price_cents: product.price_cents,
        image: product.image || '/placeholder.jpg',
        quantity: 1
      });
    }
    
    this.saveToStorage();
    return existingItem ? 'updated' : 'added';
  }

  removeItem(productId) {
    this.cart = this.cart.filter(item => item.id !== productId);
    this.saveToStorage();
  }

  updateQuantity(productId, quantity) {
    const item = this.cart.find(item => item.id === productId);
    if (item) {
      if (quantity <= 0) {
        this.removeItem(productId);
      } else {
        item.quantity = quantity;
        this.saveToStorage();
      }
    }
  }

  getTotal() {
    return this.cart.reduce((sum, item) => sum + (item.price_cents * item.quantity), 0);
  }

  getTotalItems() {
    return this.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  getItems() {
    return [...this.cart];
  }

  isEmpty() {
    return this.cart.length === 0;
  }

  clear() {
    this.cart = [];
    this.saveToStorage();
  }

  saveToStorage() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.cart));
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: this.cart }));
  }

  loadFromStorage() {
    const stored = localStorage.getItem(this.storageKey);
    return stored ? JSON.parse(stored) : [];
  }
}

// Global cart instance
const cart = new ShoppingCart();

// Update cart badge on page load and when cart changes
function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  const count = cart.getTotalItems();
  
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

// Listen for cart updates
window.addEventListener('cartUpdated', updateCartBadge);
document.addEventListener('DOMContentLoaded', updateCartBadge);

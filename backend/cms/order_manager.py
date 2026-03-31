import json
import os
from datetime import datetime
from typing import Dict, List, Optional


class OrderManager:
    """Manages shop orders stored as JSON files."""
    
    def __init__(self, storage_path='backend/orders'):
        self.storage_path = storage_path
        os.makedirs(storage_path, exist_ok=True)
    
    def _get_order_path(self, order_id):
        """Get the file path for an order."""
        return os.path.join(self.storage_path, f"{order_id}.json")
    
    def _sanitize_string(self, value):
        """Sanitize string values."""
        if not isinstance(value, str):
            return str(value) if value is not None else ""
        return value.strip()[:500]
    
    def create_order(self, stripe_session_id, stripe_customer_email, items, total_cents, status='completed', metadata=None, shipping_address=None):
        """Create a new order from Stripe webhook data."""
        order_id = stripe_session_id  # Use Stripe session ID as order ID
        
        # Normalize items
        normalized_items = []
        for item in items:
            normalized_items.append({
                'product_id': self._sanitize_string(item.get('product_id', '')),
                'product_title': self._sanitize_string(item.get('product_title', '')),
                'price_cents': int(item.get('price_cents', 0)),
                'quantity': int(item.get('quantity', 1)),
                'subtotal_cents': int(item.get('subtotal_cents', 0))
            })
        
        order = {
            'id': order_id,
            'stripe_session_id': stripe_session_id,
            'customer_email': self._sanitize_string(stripe_customer_email),
            'items': normalized_items,
            'total_cents': int(total_cents),
            'status': self._sanitize_string(status),
            'created_at': datetime.now().isoformat(),
            'metadata': metadata or {}
        }
        if shipping_address:
            order['shipping_address'] = shipping_address
        order_path = self._get_order_path(order_id)
        with open(order_path, 'w', encoding='utf-8') as f:
            json.dump(order, f, indent=2, ensure_ascii=False)
        
        return order
    
    def get_order(self, order_id):
        """Get an order by ID."""
        order_path = self._get_order_path(order_id)
        if not os.path.exists(order_path):
            return None
        
        with open(order_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def get_all_orders(self, limit=50):
        """Get all orders, sorted by creation date (newest first)."""
        orders = []
        
        if not os.path.exists(self.storage_path):
            return orders
        
        for filename in os.listdir(self.storage_path):
            if filename.endswith('.json'):
                order_path = os.path.join(self.storage_path, filename)
                try:
                    with open(order_path, 'r', encoding='utf-8') as f:
                        order = json.load(f)
                        orders.append(order)
                except (json.JSONDecodeError, IOError):
                    pass
        
        # Sort by created_at (newest first)
        orders.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return orders[:limit]
    
    def get_orders_by_email(self, email, limit=50):
        """Get orders for a specific customer email."""
        all_orders = self.get_all_orders(limit=1000)
        customer_orders = [o for o in all_orders if o.get('customer_email', '').lower() == email.lower()]
        return customer_orders[:limit]
    
    def update_order_status(self, order_id, new_status):
        """Update the status of an order."""
        order = self.get_order(order_id)
        if not order:
            return None
        
        order['status'] = self._sanitize_string(new_status)
        order['updated_at'] = datetime.now().isoformat()
        
        order_path = self._get_order_path(order_id)
        with open(order_path, 'w', encoding='utf-8') as f:
            json.dump(order, f, indent=2, ensure_ascii=False)
        
        return order
    
    def delete_order(self, order_id):
        """Delete an order."""
        order_path = self._get_order_path(order_id)
        if os.path.exists(order_path):
            os.remove(order_path)
            return True
        return False

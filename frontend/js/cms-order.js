function formatPrice(priceCents, currency = 'eur') {
    return new Intl.NumberFormat('nl-BE', {
        style: 'currency',
        currency: (currency || 'eur').toUpperCase()
    }).format((priceCents || 0) / 100);
}

function formatAddress(addr) {
    if (!addr) return '<i>Niet opgegeven</i>';
    if (typeof addr === 'string') return addr;
    // Stripe shipping address structuur
    const address = addr.address || addr;
    const lines = [];
    if (addr.name) lines.push(`<b>${addr.name}</b>`);
    if (address.line1) lines.push(address.line1);
    if (address.line2) lines.push(address.line2);
    let cityLine = '';
    if (address.postal_code) cityLine += address.postal_code + ' ';
    if (address.city) cityLine += address.city;
    if (cityLine) lines.push(cityLine);
    if (address.state) lines.push(address.state);
    if (address.country) lines.push(address.country);
    if (addr.phone) lines.push('Tel: ' + addr.phone);
    return lines.length ? lines.join('<br>') : '<i>Niet opgegeven</i>';
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const res = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) throw new Error('Fout bij opslaan');
        document.getElementById('order-status-msg').textContent = 'Status opgeslagen';
    } catch (e) {
        document.getElementById('order-status-msg').textContent = 'Fout bij opslaan status: ' + e.message;
    }
}

async function loadOrderDetails() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('id');
    const container = document.getElementById('order-details');
    if (!orderId) {
        container.innerHTML = '<p>Geen order ID opgegeven.</p>';
        return;
    }
    try {
        const res = await fetch(`${API_BASE_URL}/orders/${orderId}`);
        if (!res.ok) throw new Error('Order niet gevonden');
        const order = await res.json();
            const statusOptions = [
              {value:'completed', label:'Afgerond'},
              {value:'pending', label:'In afwachting'},
              {value:'processing', label:'In behandeling'},
              {value:'cancelled', label:'Geannuleerd'}
            ];
        const statusBadge = status => {
            if (status === 'completed') return '<span class="order-badge order-badge-completed">✔ Afgerond</span>';
            if (status === 'pending') return '<span class="order-badge order-badge-pending">⏳ In afwachting</span>';
            if (status === 'processing') return '<span class="order-badge order-badge-processing">🔄 In behandeling</span>';
            if (status === 'cancelled') return '<span class="order-badge order-badge-cancelled">✖ Geannuleerd</span>';
            return '';
        };
        const itemsHtml = order.items.map(item => {
            // Zoek product info voor thumbnail
            let thumb = '';
            if (item.product_id && item.product_id !== 'unknown') {
                // Probeer image te vinden in backend/products
                thumb = `/products/${item.product_id}.jpg`;
            }
            return `
                <li class="order-modal-item order-detail-product">
                    ${thumb ? `<img src="${thumb}" class="order-detail-thumb" alt="thumb">` : ''}
                    <span class="order-detail-product-title">${item.product_title}</span>
                    <span class="order-detail-product-qty">&times; ${item.quantity}</span>
                    <span class="order-modal-item-price">${formatPrice(item.price_cents)}</span>
                </li>
            `;
        }).join('');
                container.innerHTML = `
                <a href="/cms" class="order-detail-back">← Terug naar bestellingen</a>
                <div class="order-detail-card order-detail-card-big">
                    <div class="order-detail-header">
                        <h2>Bestelling #<span>${order.id}</span></h2>
                        <div class="order-detail-status">
                            <label for="order-status-select"><b>Status:</b></label>
                            <select id="order-status-select">
                                    ${statusOptions.map(opt => `<option value="${opt.value}"${order.status===opt.value?' selected':''}>${opt.label}</option>`).join('')}
                            </select> ${statusBadge(order.status)} <span id="order-status-msg" style="margin-left:10px;color:#666;font-size:13px;"></span>
                        </div>
                        <div class="order-detail-date"><b>Datum:</b> ${new Date(order.created_at).toLocaleString('nl-BE')}</div>
                    </div>
                    <div class="order-detail-info">
                        <div class="order-detail-block">
                            <b>Klant e-mail:</b><br>${order.customer_email || '<i>Niet opgegeven</i>'}
                        </div>
                        <div class="order-detail-block">
                            <b>Leveradres:</b><br>${formatAddress(order.shipping_address)}
                        </div>
                    </div>
                    <div class="order-detail-items-block">
                        <b>Items:</b>
                        <ul class="order-modal-items-list">${itemsHtml}</ul>
                    </div>
                    <div class="order-detail-total-block">
                        <b>Totaal:</b> <span class="order-modal-total">${formatPrice(order.total_cents)}</span>
                    </div>
                </div>
                <style>
                .order-detail-card-big {
                    max-width: 600px;
                    margin: 30px auto;
                    background: #fff;
                    border-radius: 12px;
                    box-shadow: 0 2px 12px #0001;
                    padding: 32px 32px 24px 32px;
                }
                .order-detail-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
                .order-detail-header h2 { font-size: 1.2em; margin: 0; font-weight: 700; }
                .order-detail-status { flex: 1 1 auto; min-width: 180px; }
                .order-detail-date { color: #666; font-size: 0.98em; }
                .order-detail-info { display: flex; gap: 32px; margin-bottom: 18px; }
                .order-detail-block { flex: 1 1 0; background: #f7f7fa; border-radius: 8px; padding: 12px 16px; font-size: 1em; }
                .order-detail-items-block { margin-bottom: 18px; }
                .order-modal-items-list { list-style: none; padding: 0; margin: 0; }
                .order-detail-product { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
                .order-detail-thumb { width: 38px; height: 38px; object-fit: cover; border-radius: 6px; border: 1px solid #ddd; }
                .order-detail-product-title { font-weight: 500; margin-right: 8px; }
                .order-detail-product-qty { color: #666; margin-right: 8px; }
                .order-modal-item-price { font-weight: 500; color: #222; }
                .order-detail-total-block { text-align: right; font-size: 1.1em; margin-top: 10px; }
                @media (max-width: 700px) {
                    .order-detail-card-big { padding: 12px 4vw; }
                    .order-detail-info { flex-direction: column; gap: 10px; }
                }
                </style>
                `;
        const statusSelect = document.getElementById('order-status-select');
        statusSelect.onchange = async function() {
            await updateOrderStatus(order.id, this.value);
            loadOrderDetails();
        };
    } catch (e) {
        container.innerHTML = `<p class="error">${e.message}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', loadOrderDetails);

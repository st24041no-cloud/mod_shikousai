import { buildTransaction, calculateCart, dailySummary, money } from './core.js';
import { PosStore } from './store.js';

export async function activate(host) {
  const settings = { autoSync: true, syncIntervalSeconds: 20, allowNegativeStock: false, ...(host.settings || {}) };
  const store = await new PosStore().open();
  const deviceId = localStorage.getItem('offlinePosDeviceId') || crypto.randomUUID();
  localStorage.setItem('offlinePosDeviceId', deviceId);

  const sync = async () => {
    if (!navigator.onLine) return { synced: 0 };
    let synced = 0;
    for (const tx of await store.pending()) {
      try {
        await host.api.post('/sales/sync', tx, { headers: { 'Idempotency-Key': tx.idempotencyKey } });
        await store.putTransaction({ ...tx, status: 'synced', syncedAt: new Date().toISOString(), error: null });
        synced += 1;
      } catch (error) {
        await store.putTransaction({ ...tx, status: 'failed', error: String(error.message || error) });
      }
    }
    host.events?.emit('offline-pos:synced', { synced });
    return { synced };
  };

  const refreshCatalog = async () => {
    if (!navigator.onLine) return;
    const products = await host.api.get('/products?include=stock');
    await store.replaceProducts(products);
  };

  const render = async container => {
    let products = await store.products();
    if (!products.length && navigator.onLine) { await refreshCatalog(); products = await store.products(); }
    let cart = [];
    const draw = async () => {
      const totals = calculateCart(cart);
      const transactions = await store.transactions();
      const summary = dailySummary(transactions);
      container.innerHTML = `
        <section class="offline-pos">
          <header><div><h1>オフラインレジ</h1><p class="status ${navigator.onLine ? 'online' : 'offline'}">● ${navigator.onLine ? 'オンライン' : 'オフライン（端末に保存）'}</p></div><button data-sync>今すぐ同期</button></header>
          <div class="notice">未同期 ${summary.unsynced}件 ・ 本日 ${summary.count}会計 / ${money(summary.sales)}</div>
          <div class="layout"><div><h2>商品</h2><div class="products">${products.map(p => `<button data-product="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}><b>${p.name}</b><span>${money(p.price)} / 在庫 ${p.stock}</span></button>`).join('') || '<p>商品データがありません。オンラインで同期してください。</p>'}</div></div>
          <aside><h2>会計</h2><div class="cart">${cart.map((l, i) => `<div><span>${l.name} × ${l.quantity}</span><button data-remove="${i}">−</button></div>`).join('') || '<p>商品を選択してください</p>'}</div><strong class="total">合計 ${money(totals.total)}</strong><label>支払方法<select data-method><option value="cash">現金</option><option value="cashless">キャッシュレス</option><option value="other">その他</option></select></label><label>預かり金<input data-received type="number" min="0" value="${totals.total}"></label><button class="checkout" data-checkout ${cart.length ? '' : 'disabled'}>会計を確定</button></aside></div>
          <footer><button data-export>取引CSVを保存</button><small>端末ID: ${deviceId.slice(0, 8)}</small></footer>
        </section>`;
      container.querySelectorAll('[data-product]').forEach(button => button.onclick = () => {
        const product = products.find(p => p.id === button.dataset.product);
        const line = cart.find(item => item.productId === product.id);
        if (line) line.quantity += 1; else cart.push({ productId: product.id, name: product.name, price: product.price, quantity: 1 });
        draw();
      });
      container.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => { const line = cart[Number(button.dataset.remove)]; line.quantity -= 1; if (!line.quantity) cart.splice(Number(button.dataset.remove), 1); draw(); });
      container.querySelector('[data-sync]').onclick = async () => { await sync(); await refreshCatalog(); products = await store.products(); draw(); };
      container.querySelector('[data-checkout]').onclick = async () => {
        try {
          const payment = { method: container.querySelector('[data-method]').value, received: Number(container.querySelector('[data-received]').value) };
          const tx = buildTransaction({ cart, payment, products, deviceId, operatorId: host.currentUser?.id || 'unknown', allowNegativeStock: settings.allowNegativeStock });
          await store.checkout(tx); cart = []; products = await store.products(); await draw(); if (navigator.onLine) await sync();
        } catch (error) { host.ui?.toast?.(error.message, { type: 'error' }) || alert(error.message); }
      };
      container.querySelector('[data-export]').onclick = async () => {
        const rows = await store.transactions();
        const csv = ['id,createdAt,status,total,method', ...rows.map(x => [x.id, x.createdAt, x.status, x.total, x.payment.method].join(','))].join('\n');
        const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv' })); link.download = `offline-pos-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
      };
    };
    await draw();
    addEventListener('online', async () => { await sync(); await draw(); });
    addEventListener('offline', draw);
  };

  host.routes.register('/extensions/offline-pos', render);
  if (settings.autoSync) setInterval(sync, Math.max(10, settings.syncIntervalSeconds) * 1000);
  await refreshCatalog().catch(() => {});
  return { sync, refreshCatalog };
}

export default { activate };

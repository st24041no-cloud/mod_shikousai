export const money = value => new Intl.NumberFormat('ja-JP', {
  style: 'currency', currency: 'JPY', maximumFractionDigits: 0
}).format(value || 0);

export function makeId(prefix = 'tx') {
  return `${prefix}_${Date.now()}_${crypto.randomUUID()}`;
}

export function calculateCart(lines) {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const discount = lines.reduce((sum, line) => sum + (line.discount || 0), 0);
  return { subtotal, discount, total: Math.max(0, subtotal - discount) };
}

export function validateCheckout(cart, payment, products, allowNegativeStock = false) {
  if (!cart.length) throw new Error('商品が選択されていません');
  if (!['cash', 'cashless', 'other'].includes(payment.method)) throw new Error('支払方法が不正です');
  const { total } = calculateCart(cart);
  if (payment.method === 'cash' && Number(payment.received) < total) throw new Error('預かり金が不足しています');
  for (const line of cart) {
    const product = products.find(item => item.id === line.productId);
    if (!product) throw new Error(`商品 ${line.productId} が見つかりません`);
    if (!allowNegativeStock && product.stock < line.quantity) throw new Error(`${product.name} の在庫が不足しています`);
  }
  return { ...calculateCart(cart), change: payment.method === 'cash' ? Number(payment.received) - total : 0 };
}

export function buildTransaction({ cart, payment, products, deviceId, operatorId, allowNegativeStock }) {
  const totals = validateCheckout(cart, payment, products, allowNegativeStock);
  return {
    id: makeId(), idempotencyKey: makeId('idem'), deviceId, operatorId,
    createdAt: new Date().toISOString(), status: 'pending', kind: 'sale',
    lines: cart.map(line => ({ ...line })), payment: { ...payment }, ...totals
  };
}

export function dailySummary(transactions, date = new Date().toISOString().slice(0, 10)) {
  const rows = transactions.filter(tx => tx.createdAt.slice(0, 10) === date && tx.kind !== 'void');
  return rows.reduce((result, tx) => {
    result.count += 1;
    result.sales += tx.total;
    result.byMethod[tx.payment.method] = (result.byMethod[tx.payment.method] || 0) + tx.total;
    if (tx.status === 'pending' || tx.status === 'failed') result.unsynced += 1;
    return result;
  }, { count: 0, sales: 0, unsynced: 0, byMethod: {} });
}

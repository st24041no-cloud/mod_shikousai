import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCart, validateCheckout, dailySummary } from '../src/core.js';

test('合計と値引きを計算する', () => assert.deepEqual(calculateCart([{ price: 300, quantity: 2, discount: 50 }]), { subtotal: 600, discount: 50, total: 550 }));
test('現金のお釣りを計算する', () => assert.equal(validateCheckout([{ productId: 'a', price: 300, quantity: 2 }], { method: 'cash', received: 1000 }, [{ id: 'a', name: '品', stock: 3 }]).change, 400));
test('在庫不足を拒否する', () => assert.throws(() => validateCheckout([{ productId: 'a', price: 300, quantity: 2 }], { method: 'cash', received: 1000 }, [{ id: 'a', name: '品', stock: 1 }]), /在庫が不足/));
test('日次集計は未同期件数も返す', () => { const d = new Date().toISOString(); assert.deepEqual(dailySummary([{ createdAt: d, kind: 'sale', total: 500, status: 'pending', payment: { method: 'cash' } }]), { count: 1, sales: 500, unsynced: 1, byMethod: { cash: 500 } }); });

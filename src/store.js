const DB_NAME = 'festival-offline-pos';
const DB_VERSION = 1;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class PosStore {
  async open() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('products')) db.createObjectStore('products', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('transactions')) {
        const store = db.createObjectStore('transactions', { keyPath: 'id' });
        store.createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    this.db = await requestResult(request);
    return this;
  }

  transaction(names, mode = 'readonly') { return this.db.transaction(names, mode); }

  async products() { return requestResult(this.transaction(['products']).objectStore('products').getAll()); }

  async replaceProducts(products) {
    const tx = this.transaction(['products', 'meta'], 'readwrite');
    const store = tx.objectStore('products');
    store.clear();
    products.forEach(product => store.put(product));
    tx.objectStore('meta').put({ key: 'catalogUpdatedAt', value: new Date().toISOString() });
    return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  }

  async checkout(transaction) {
    const tx = this.transaction(['products', 'transactions'], 'readwrite');
    const products = tx.objectStore('products');
    for (const line of transaction.lines) {
      const product = await requestResult(products.get(line.productId));
      if (!product) throw new Error(`商品 ${line.productId} が見つかりません`);
      product.stock -= line.quantity;
      products.put(product);
    }
    tx.objectStore('transactions').put(transaction);
    return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(transaction); tx.onerror = () => reject(tx.error); });
  }

  async transactions() { return requestResult(this.transaction(['transactions']).objectStore('transactions').getAll()); }
  async pending() {
    const rows = await this.transactions();
    return rows.filter(row => row.status === 'pending' || row.status === 'failed');
  }
  async putTransaction(value) { return requestResult(this.transaction(['transactions'], 'readwrite').objectStore('transactions').put(value)); }
}

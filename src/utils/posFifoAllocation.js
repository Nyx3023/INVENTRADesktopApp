export function sortBatchesFifo(batches) {
  if (!Array.isArray(batches)) return [];
  return [...batches].sort((a, b) => {
    const exp = (x) => x.expiryDate ?? x.expiry_date ?? '';
    const recv = (x) => x.receivedDate ?? x.received_date ?? '';
    const id = (x) => String(x.id ?? '');
    const aNo = !exp(a) || exp(a) === '';
    const bNo = !exp(b) || exp(b) === '';
    const tA = aNo ? 1 : 0;
    const tB = bNo ? 1 : 0;
    if (tA !== tB) return tA - tB;
    if (!aNo && !bNo) {
      const c0 = String(exp(a)).localeCompare(String(exp(b)));
      if (c0 !== 0) return c0;
    }
    const r = String(recv(a)).localeCompare(String(recv(b)));
    if (r !== 0) return r;
    return id(a).localeCompare(id(b));
  });
}

export function effectiveBatchUnitPrice(batch, productPrice) {
  const raw = batch?.unitPrice ?? batch?.unit_price;
  const p = Number(raw);
  if (Number.isFinite(p) && p >= 0) return p;
  return Number(productPrice) || 0;
}

export function newCartLineId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'cl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

export function getMaxQtyForCartLine(line, cart, product) {
  if (!product || !line) return Number(line?.quantity) || 0;
  const pid = product.id;
  if (line.id !== pid) return Number(line.quantity) || 0;
  if (!line.inventoryBatchId) {
    const others = cart
      .filter((i) => i.id === pid && i.cartLineId !== line.cartLineId)
      .reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    return Math.max(0, (Number(product.quantity) || 0) - others);
  }
  const batches = sortBatchesFifo(product.fifoBatches || []);
  const b = batches.find((x) => x.id === line.inventoryBatchId);
  const batchQty = b ? Math.max(0, Number(b.quantity) || 0) : 0;
  const otherOnBatch = cart
    .filter((i) => i.id === pid && i.inventoryBatchId === line.inventoryBatchId && i.cartLineId !== line.cartLineId)
    .reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  return Math.max(0, batchQty - otherOnBatch);
}

export function addOneUnitFifoToCart(prevCart, product, toastError) {
  if (!product?.id) {
    toastError?.('Product data unavailable');
    return { ok: false, cart: prevCart };
  }
  const pid = product.id;
  const availableQty = Math.max(0, Number(product.quantity) || 0);
  const currentTotal = prevCart
    .filter((i) => i.id === pid)
    .reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  if (currentTotal >= availableQty) {
    toastError?.('Insufficient stock. Only ' + availableQty + ' available.');
    return { ok: false, cart: prevCart };
  }
  const productPrice = Number(product.price) || 0;
  const productCost = Number(product.cost) || 0;
  const rawBatches = product.fifoBatches;
  const batches = sortBatchesFifo(Array.isArray(rawBatches) ? rawBatches : []);
  if (batches.length === 0) {
    const idx = prevCart.findIndex((i) => i.id === pid && !i.inventoryBatchId);
    if (idx >= 0) {
      const next = [...prevCart];
      const cur = next[idx];
      next[idx] = { ...cur, cartLineId: cur.cartLineId || newCartLineId(), quantity: (Number(cur.quantity) || 0) + 1 };
      return { ok: true, cart: next };
    }
    return {
      ok: true,
      cart: [
        ...prevCart,
        {
          ...product,
          cartLineId: newCartLineId(),
          quantity: 1,
          price: productPrice,
          cost: productCost,
          inventoryBatchId: null,
          batchNumber: '',
        },
      ],
    };
  }
  const allocated = new Map();
  for (const line of prevCart) {
    if (line.id !== pid) continue;
    const bid = line.inventoryBatchId || '';
    allocated.set(bid, (allocated.get(bid) || 0) + (Number(line.quantity) || 0));
  }
  for (const b of batches) {
    const bid = b.id;
    const bQty = Math.max(0, Number(b.quantity) || 0);
    const used = allocated.get(bid) || 0;
    if (used >= bQty) continue;
    const price = effectiveBatchUnitPrice(b, productPrice);
    const cost = Number(b.unitCost ?? b.unit_cost ?? productCost) || 0;
    const batchNum = b.batchNumber ?? b.batch_number ?? '';
    const lineIdx = prevCart.findIndex((i) => i.id === pid && i.inventoryBatchId === bid);
    if (lineIdx >= 0) {
      const next = [...prevCart];
      const cur = next[lineIdx];
      next[lineIdx] = { ...cur, cartLineId: cur.cartLineId || newCartLineId(), quantity: (Number(cur.quantity) || 0) + 1, price, cost };
      return { ok: true, cart: next };
    }
    return {
      ok: true,
      cart: [
        ...prevCart,
        {
          ...product,
          cartLineId: newCartLineId(),
          quantity: 1,
          price,
          cost,
          inventoryBatchId: bid,
          batchNumber: batchNum,
        },
      ],
    };
  }
  toastError?.('No sellable batch found for this product.');
  return { ok: false, cart: prevCart };
}
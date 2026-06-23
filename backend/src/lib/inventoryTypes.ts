export interface InventoryLineItem {
  product_id: number;
  quantity: number;
  product_name?: string;
}

export interface StockShortage {
  product_id: number;
  product_name: string;
  requested: number;
  available: number;
}

export class InsufficientStockError extends Error {
  readonly outOfStock: StockShortage[];

  constructor(outOfStock: StockShortage[]) {
    super('Insufficient stock');
    this.name = 'InsufficientStockError';
    this.outOfStock = outOfStock;
  }
}

import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { logError, logDebug } from '../lib/logger';

export type SizeSystem = "UK" | "US" | "EU";

export interface ShoeSize {
  system: SizeSystem;
  value: string;
}

export interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  size?: ShoeSize; // Optional for backward compatibility with old cart data
}

interface CartState {
  items: CartItem[];
  total: number;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: Omit<CartItem, 'quantity'> }
  | { type: 'REMOVE_ITEM'; payload: { id: number; size?: ShoeSize } }
  | { type: 'INCREMENT'; payload: { id: number; size?: ShoeSize } }
  | { type: 'DECREMENT'; payload: { id: number; size?: ShoeSize } }
  | { type: 'CLEAR_CART' }
  | { type: 'UPDATE_QUANTITY'; payload: { id: number; size?: ShoeSize; quantity: number } }
  | { type: 'SYNC_FROM_STORAGE'; payload: CartState };

interface CartContextType {
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (id: number, size?: ShoeSize) => void;
  incrementQuantity: (id: number, size?: ShoeSize) => void;
  decrementQuantity: (id: number, size?: ShoeSize) => void;
  clearCart: () => void;
  getItemQuantity: (id: number) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'labdoor_cart';

// Load cart from localStorage
const loadCartFromStorage = (): CartState => {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure prices are numbers (in case they were stored as strings)
      const items = (parsed.items || []).map((item: CartItem) => ({
        ...item,
        price: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
      }));
      return {
        items,
        total: calculateTotal(items),
      };
    }
  } catch (error) {
    logError('Error loading cart from storage:', error);
  }
  return { items: [], total: 0 };
};

// Calculate total
const calculateTotal = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
};

// Cart reducer
const cartReducer = (state: CartState, action: CartAction): CartState => {
  let newState: CartState;

  switch (action.type) {
    case 'ADD_ITEM': {
      // Check if item with same ID AND same size already exists
      const existingItem = state.items.find(
        item => item.id === action.payload.id && 
        item.size?.system === action.payload.size?.system &&
        item.size?.value === action.payload.size?.value
      );
      
      if (existingItem) {
        const updatedItems = state.items.map(item =>
          item.id === action.payload.id &&
          item.size?.system === action.payload.size?.system &&
          item.size?.value === action.payload.size?.value
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
        newState = {
          items: updatedItems,
          total: calculateTotal(updatedItems),
        };
      } else {
        const updatedItems = [...state.items, { ...action.payload, quantity: 1 }];
        newState = {
          items: updatedItems,
          total: calculateTotal(updatedItems),
        };
      }
      break;
    }

    case 'REMOVE_ITEM': {
      const updatedItems = state.items.filter(item => 
        !(item.id === action.payload.id &&
          item.size?.system === action.payload.size?.system &&
          item.size?.value === action.payload.size?.value)
      );
      newState = {
        items: updatedItems,
        total: calculateTotal(updatedItems),
      };
      break;
    }

    case 'INCREMENT': {
      const updatedItems = state.items.map(item =>
        item.id === action.payload.id &&
        item.size?.system === action.payload.size?.system &&
        item.size?.value === action.payload.size?.value
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
      newState = {
        items: updatedItems,
        total: calculateTotal(updatedItems),
      };
      break;
    }

    case 'DECREMENT': {
      const updatedItems = state.items
        .map(item =>
          item.id === action.payload.id &&
          item.size?.system === action.payload.size?.system &&
          item.size?.value === action.payload.size?.value
            ? { ...item, quantity: Math.max(0, item.quantity - 1) }
            : item
        )
        .filter(item => item.quantity > 0);
      newState = {
        items: updatedItems,
        total: calculateTotal(updatedItems),
      };
      break;
    }

    case 'UPDATE_QUANTITY': {
      if (action.payload.quantity <= 0) {
        const updatedItems = state.items.filter(item => 
          !(item.id === action.payload.id &&
            item.size?.system === action.payload.size?.system &&
            item.size?.value === action.payload.size?.value)
        );
        newState = {
          items: updatedItems,
          total: calculateTotal(updatedItems),
        };
      } else {
        const updatedItems = state.items.map(item =>
          item.id === action.payload.id &&
          item.size?.system === action.payload.size?.system &&
          item.size?.value === action.payload.size?.value
            ? { ...item, quantity: action.payload.quantity }
            : item
        );
        newState = {
          items: updatedItems,
          total: calculateTotal(updatedItems),
        };
      }
      break;
    }

    case 'CLEAR_CART':
      newState = { items: [], total: 0 };
      break;

    case 'SYNC_FROM_STORAGE':
      // Sync cart from another tab/window
      return action.payload;

    default:
      return state;
  }

  // Save to localStorage after each action
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newState));
  } catch (error) {
    logError('Error saving cart to storage:', error);
  }

  return newState;
};

// BroadcastChannel for cross-tab sync
const CART_CHANNEL_NAME = 'labdoor_cart_sync';

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, { items: [], total: 0 }, loadCartFromStorage);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const isLocalUpdate = useRef(false);

  // Set up BroadcastChannel for cross-tab sync
  useEffect(() => {
    // Check if BroadcastChannel is supported
    if (typeof BroadcastChannel === 'undefined') {
      logDebug('BroadcastChannel not supported, falling back to storage events');
      
      // Fallback to storage event for older browsers
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === CART_STORAGE_KEY && e.newValue && !isLocalUpdate.current) {
          try {
            const newCart = JSON.parse(e.newValue);
            dispatch({ type: 'SYNC_FROM_STORAGE', payload: newCart });
          } catch (error) {
            logError('Error parsing cart from storage event:', error);
          }
        }
      };
      
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }

    // Create BroadcastChannel
    channelRef.current = new BroadcastChannel(CART_CHANNEL_NAME);

    // Listen for cart updates from other tabs
    channelRef.current.onmessage = (event) => {
      if (event.data && event.data.type === 'CART_UPDATE' && !isLocalUpdate.current) {
        dispatch({ type: 'SYNC_FROM_STORAGE', payload: event.data.payload });
      }
    };

    return () => {
      channelRef.current?.close();
    };
  }, []);

  // Broadcast cart changes to other tabs
  useEffect(() => {
    if (channelRef.current && state.items !== undefined) {
      isLocalUpdate.current = true;
      channelRef.current.postMessage({
        type: 'CART_UPDATE',
        payload: state,
      });
      // Reset flag after a short delay to allow for message processing
      setTimeout(() => {
        isLocalUpdate.current = false;
      }, 100);
    }
  }, [state]);

  // Helper functions
  const addToCart = (item: Omit<CartItem, 'quantity'>) => {
    // Ensure price is a number
    const itemWithNumberPrice = {
      ...item,
      price: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
    };
    dispatch({ type: 'ADD_ITEM', payload: itemWithNumberPrice });
  };

  const removeFromCart = (id: number, size?: ShoeSize) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id, size } });
  };

  const incrementQuantity = (id: number, size?: ShoeSize) => {
    dispatch({ type: 'INCREMENT', payload: { id, size } });
  };

  const decrementQuantity = (id: number, size?: ShoeSize) => {
    dispatch({ type: 'DECREMENT', payload: { id, size } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const getItemQuantity = (id: number): number => {
    const item = state.items.find(item => item.id === id);
    return item ? item.quantity : 0;
  };

  return (
    <CartContext.Provider
      value={{
        state,
        dispatch,
        addToCart,
        removeFromCart,
        incrementQuantity,
        decrementQuantity,
        clearCart,
        getItemQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
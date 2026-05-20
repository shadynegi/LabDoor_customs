
/*
 * Liquid Web 1.1.1
 * Contemporary style and functionality - an accordion that does more.
 * https://github.com/koirodev/liquid-web
 *
 * Copyright 2025 Vitaly Koiro
 *
 * Released under the MIT License
 *
 * Released on: June 14, 2025
*/
export class LiquidWebError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'LiquidWebError';
    this.originalError = originalError;
  }
}

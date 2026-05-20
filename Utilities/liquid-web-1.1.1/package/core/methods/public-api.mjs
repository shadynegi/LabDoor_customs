
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
export const publicMethods = {
  getInstance(el) {
    const instance = new this(undefined, { init: false });
    return instance.getInstance(el);
  },

  init(el) {
    const instance = new this(undefined, { init: false });
    return instance.init(el);
  },
};


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
/**
 * Check if value is an object
 */
function isObject(obj) {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'constructor' in obj &&
    obj.constructor === Object
  );
}

/**
 * Check if value is a DOM node
 */
function isNode(node) {
  return typeof window !== 'undefined' &&
    typeof window.HTMLElement !== 'undefined'
    ? node instanceof window.HTMLElement
    : node &&
        typeof node === 'object' &&
        node.nodeType === 1 &&
        typeof node.nodeName === 'string';
}

export { isNode, isObject };

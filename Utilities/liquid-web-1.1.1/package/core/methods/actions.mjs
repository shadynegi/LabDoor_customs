
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
export default {
  handleMouseEnter() {
    this.state.isHovered = true;
    this.update();
    this.emit('mouseEnter', this);
  },

  handleMouseLeave() {
    this.state.isHovered = false;
    this.update();
    this.emit('mouseLeave', this);
  },

  handleMouseDown() {
    this.state.isActive = true;
    this.update();
    this.emit('mouseDown', this);
  },

  handleMouseUp() {
    this.state.isActive = false;
    this.update();
    this.emit('mouseUp', this);
  },

  handleMouseMove(e) {
    this.state.globalMousePos = {
      x: e.clientX,
      y: e.clientY,
    };
    this.state.mouseOffset = {
      x: e.offsetX || e.layerX,
      y: e.offsetY || e.layerY,
    };
    this.update();
    this.emit('mouseMove', this);
  },

  handleClick() {
    this.emit('click', this);
  },

  handleResize() {
    this.update();
  },
};

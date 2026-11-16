// Starshard Arena — input.js
// Keyboard and mouse state for one frame at a time. `pressed` holds the
// codes that went down since the last endFrame(), so menus can react to a
// tap while movement reads the held set.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedSet = new Set();
    this.mouse = { x: 480, y: 360, down: false, rightDown: false };
    this.clicked = false; // left button tapped since last endFrame()
    this.rightClicked = false;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressedSet.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
      this.mouse.rightDown = false;
    });

    canvas.addEventListener('mousemove', (e) => this.updateMouse(e));
    canvas.addEventListener('mousedown', (e) => {
      this.updateMouse(e);
      if (e.button === 0) {
        this.mouse.down = true;
        this.clicked = true;
      } else if (e.button === 2) {
        this.mouse.rightDown = true;
        this.rightClicked = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Pointer position in canvas pixels, undoing the CSS scaling.
  updateMouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
    this.mouse.y = ((e.clientY - rect.top) / rect.height) * this.canvas.height;
  }

  isDown(code) {
    return this.keys.has(code);
  }

  pressed(code) {
    return this.pressedSet.has(code);
  }

  // -1..1 movement axis from either WASD or the arrow keys.
  moveAxis() {
    const x =
      (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0) -
      (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
    const y =
      (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0) -
      (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0);
    return { x, y };
  }

  endFrame() {
    this.pressedSet.clear();
    this.clicked = false;
    this.rightClicked = false;
  }
}

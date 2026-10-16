export class Input {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.fire = false;
    this.aim = false;
    this.sprint = false;
    this.keys = new Set();
    this.joyPointer = null;
    this.lookPointer = null;
    this.bind();
  }
  clear() {
    this.x = this.y = this.lookX = this.lookY = 0;
    this.fire = false;
    this.keys.clear();
    this.joyPointer = this.lookPointer = null;
    document.getElementById("stick").style.transform = "";
  }
  movement() {
    let x =
        this.x +
        (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
        (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0),
      y =
        this.y +
        (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) -
        (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);
    const n = Math.hypot(x, y);
    return {
      x: n > 1 ? x / n : x,
      y: n > 1 ? y / n : y,
      sprint: this.sprint || this.keys.has("ShiftLeft"),
    };
  }
  bind() {
    const joy = document.getElementById("joystick"),
      look = document.getElementById("lookpad");
    const move = (e) => {
      const r = joy.getBoundingClientRect(),
        radius = r.width * 0.34;
      let x = e.clientX - r.left - r.width / 2,
        y = e.clientY - r.top - r.height / 2;
      const n = Math.hypot(x, y);
      if (n > radius) {
        x *= radius / n;
        y *= radius / n;
      }
      this.x = x / radius;
      this.y = -y / radius;
      if (Math.hypot(this.x, this.y) < 0.1) this.x = this.y = 0;
      document.getElementById("stick").style.transform =
        `translate(${x}px,${y}px)`;
    };
    joy.addEventListener("pointerdown", (e) => {
      if (this.joyPointer !== null) return;
      this.joyPointer = e.pointerId;
      joy.setPointerCapture(e.pointerId);
      move(e);
    });
    joy.addEventListener("pointermove", (e) => {
      if (e.pointerId === this.joyPointer) move(e);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      joy.addEventListener(type, (e) => {
        if (e.pointerId === this.joyPointer) {
          this.joyPointer = null;
          this.x = this.y = 0;
          document.getElementById("stick").style.transform = "";
        }
      });
    let last;
    look.addEventListener("pointerdown", (e) => {
      if (this.lookPointer !== null) return;
      this.lookPointer = e.pointerId;
      last = [e.clientX, e.clientY];
      look.setPointerCapture(e.pointerId);
    });
    look.addEventListener("pointermove", (e) => {
      if (e.pointerId === this.lookPointer) {
        this.lookX += e.clientX - last[0];
        this.lookY += e.clientY - last[1];
        last = [e.clientX, e.clientY];
      }
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      look.addEventListener(type, (e) => {
        if (e.pointerId === this.lookPointer) this.lookPointer = null;
      });
    const fire = document.getElementById("fire");
    fire.addEventListener("pointerdown", (e) => {
      this.fire = true;
      fire.setPointerCapture(e.pointerId);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      fire.addEventListener(type, () => (this.fire = false));
    const aim = document.getElementById("aim");
    aim.onclick = () => {
      this.aim = !this.aim;
      aim.classList.toggle("selected", this.aim);
    };
    const sprint = document.getElementById("sprint");
    sprint.onclick = () => {
      this.sprint = !this.sprint;
      sprint.classList.toggle("selected", this.sprint);
    };
    addEventListener("keydown", (e) => {
      if (e.target instanceof HTMLInputElement) return;
      this.keys.add(e.code);
      if (e.code === "Space") this.fire = true;
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (!e.repeat && e.code === "KeyQ") {
        this.aim = !this.aim;
        aim.classList.toggle("selected", this.aim);
      }
    });
    addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "Space") this.fire = false;
    });
    addEventListener("blur", () => this.clear());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.clear();
    });
  }
}

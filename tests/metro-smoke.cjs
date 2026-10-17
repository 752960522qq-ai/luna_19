const { chromium } = require("playwright");
const fs = require("fs"),
  path = require("path"),
  http = require("http"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../web"),
  out = path.resolve(__dirname, "../build/qa");
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.resolve(
    root,
    "." + new URL(req.url, "http://local").pathname,
  );
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
    res.writeHead(404);
    return res.end();
  }
  res.setHeader(
    "Content-Type",
    file.endsWith(".js")
      ? "text/javascript"
      : file.endsWith(".html")
        ? "text/html"
        : "application/octet-stream",
  );
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: process.env.LUNA_CHROMIUM,
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-webgl"],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1100, height: 650 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      "http://127.0.0.1:" + server.address().port + "/index.html",
    );
    await page.waitForFunction(() => window.lunaGame?.ready, null, {
      timeout: 240000,
    });
    const result = await page.evaluate(async () => {
      const g = lunaGame,
        T = await import("./vendor/three.module.js"),
        { freshState, sanitizeSave } = await import("./game/state.js"),
        { Actor } = await import("./game/actors.js"),
        { CITIZENS } = await import("./game/metro-state.js");
      const draw = g.renderer.render.bind(g.renderer);
      g.renderer.render = () => {};
      g.renderer.setPixelRatio(1);
      g.renderer.setSize(1100, 650);
      const check = (ok, msg) => {
        if (!ok) throw Error(msg);
      };
      for (const id of [...CITIZENS, "guard"])
        g.assets[id].scene.traverse((o) => {
          if (o.isMesh)
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material])
              for (const k of [
                "map",
                "normalMap",
                "roughnessMap",
                "metalnessMap",
              ])
                if (m[k]) check(m[k].image?.width > 0, id + " missing " + k);
        });
      g.metro.start(freshState(123));
      check(g.state.chapter === 2 && g.live().length === 48, "metro entry");
      check(g.dialogue.active, "intro dialogue");
      check(g.state.metro.remaining === 300, "full timer");
      while (g.dialogue.active) g.dialogue.next();
      g.mode = "inspection";
      g.update(0.05);
      check(g.state.metro.remaining < 300, "timer ticks");
      const choices = g.enemies.map((e) => JSON.stringify(e.choices));
      const oldTime = g.state.metro.remaining;
      g.mode = "playing";
      g.pause();
      await new Promise((r) => setTimeout(r, 100));
      check(g.state.metro.remaining === oldTime, "pause clock");
      g.resume();
      g.mode = "inspection";
      g.update(0.01, 2);
      check(
        Math.abs(g.state.metro.remaining - (oldTime - 2)) < 0.001,
        "timer uses elapsed time on slow frames",
      );
      const data = g.snapshot();
      g.start(sanitizeSave(data));
      g.mode = "inspection";
      check(
        g.enemies.every((e, i) => JSON.stringify(e.choices) === choices[i]),
        "stable pool after load",
      );
      const guard = g.enemies.find((e) => e.choices.role === "guard"),
        citizen = g.enemies.find((e) => e.choices.role === "citizen");
      check(
        guard.actor.gun && guard.actor.rig.arms.right,
        "guard equipped and rigged",
      );
      g.may.position.set(-10, 0, 11);
      citizen.actor.position.set(-10, 0, 9.5);
      g.input.fire = false;
      g.cooldown = 0;
      g.metro.crowd(0.1);
      check(citizen.mode !== "guard", "citizen never attacks");
      g.input.fire = true;
      g.metro.crowd(0.1);
      check(
        citizen.panic > 0 && citizen.actor.current === "Run",
        "panic uses shared source run",
      );
      g.input.fire = false;
      const p = citizen.actor.position.clone();
      g.may.position.copy(p).add(new T.Vector3(0, 0, 1));
      g.world.move(g.may.position, 0, -1);
      check(g.may.position.distanceTo(p) > 0.5, "entity collision");
      g.mode = "playing";
      g.damageEnemy(citizen, 100, true);
      check(
        g.state.metro.drops.length === 1 && g.world.cashMeshes.size === 1,
        "money model drop",
      );
      const killedId = citizen.id,
        cash = citizen.choices.cash;
      g.start(sanitizeSave(g.snapshot()));
      g.mode = "inspection";
      check(
        !g.enemies.some((e) => e.id === killedId),
        "killed citizen never respawns",
      );
      check(g.world.cashMeshes.size === 1, "drop restored");
      g.may.position.fromArray(g.state.metro.drops[0].position);
      g.metro.update(0.01);
      check(
        g.state.metro.cash === cash && g.state.metro.drops.length === 0,
        "cash pickup",
      );
      g.metro.update(0.01);
      check(g.state.metro.cash === cash, "pickup idempotent");
      g.may.position.copy(g.world.boarding);
      g.metro.interact();
      check(!g.state.metro.complete, "cannot board unpaid");
      g.state.metro.cash = 100000;
      g.cody.position.set(-8, 0, 10);
      g.may.position.set(-8, 0, 11);
      g.metro.interact();
      check(g.state.metro.paid && g.state.metro.cash === 0, "paid once");
      g.metro.interact();
      check(g.state.metro.cash === 0, "no second debit");
      g.may.position.copy(g.world.boarding);
      g.metro.interact();
      check(g.mode === "metro-complete", "board finishes chapter");
      g.metro.start(freshState(22));
      while (g.dialogue.active) g.dialogue.next();
      g.state.metro.remaining = 0.01;
      g.metro.update(0.02);
      check(g.mode === "metro-failed", "timeout");
      // All split variants are rendered from real textures, one isolated actor each.
      const scene = new T.Scene();
      scene.background = new T.Color(0x6c7e80);
      scene.add(new T.HemisphereLight(0xffe8ce, 0x627b8f, 2.5));
      const sun = new T.DirectionalLight(0xffffff, 2);
      sun.position.set(4, 6, 3);
      scene.add(sun);
      const camera = new T.PerspectiveCamera(40, 1100 / 650, 0.05, 100),
        actors = [];
      for (let i = 0; i < CITIZENS.length; i++) {
        const id = CITIZENS[i],
          a = new Actor(g.assets[id], "zombie", scene);
        a.position.set(((i % 9) - 4) * 1.65, 0, Math.floor(i / 9) * -2.4);
        a.play(i % 3 === 0 ? "Run" : i % 3 === 1 ? "Walk" : "Idle", true);
        a.mixer.update(0.35);
        a.correctGround();
        actors.push(a);
      }
      const a = new Actor(g.assets.guard, "guard", scene, g.assets);
      a.position.set(4.8, 0, -2.4);
      a.animate(0.4, { aim: true });
      a.updateGun(new T.Vector3(4, 1.4, 10));
      actors.push(a);
      camera.position.set(0, 6, 18);
      camera.lookAt(0, 1, -1);
      draw(scene, camera);
      const pool = g.renderer.domElement.toDataURL().split(",")[1];
      for (const a of actors) a.remove();
      g.metro.start(freshState(8));
      while (g.dialogue.active) g.dialogue.next();
      g.mode = "inspection";
      g.camera.position.set(-12, 3.1, 13);
      g.camera.lookAt(0, 1, 9);
      draw(g.scene, g.camera);
      const station = g.renderer.domElement.toDataURL().split(",")[1];
      g.camera.position.set(20, 18, 26);
      g.camera.lookAt(0, 0, 6);
      draw(g.scene, g.camera);
      const overview = g.renderer.domElement.toDataURL().split(",")[1];
      // Both protagonists visibly animate a support hand through the same reload timing.
      const reload = [];
      for (const actor of [g.may, g.cody]) {
        actor.setWeapon("colt723");
        actor.armed = true;
        const poses = [];
        for (const progress of [0.1, 0.45, 0.85]) {
          actor.animate(0.1, {});
          actor.updateGun();
          actor.applyReload(progress);
          poses.push(
            actor.rig.arms.left.hand
              .getWorldPosition(new T.Vector3())
              .toArray(),
          );
        }
        check(
          new T.Vector3(...poses[0]).distanceTo(new T.Vector3(...poses[1])) >
            0.08,
          "reload hand moves " + actor.kind,
        );
        reload.push({ kind: actor.kind, poses });
      }
      return { pool, station, overview, count: g.live().length, reload };
    });
    for (const key of ["pool", "station", "overview"]) {
      fs.writeFileSync(
        path.join(out, "metro-" + key + ".png"),
        Buffer.from(result[key], "base64"),
      );
      delete result[key];
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, "metro-results.json"),
      JSON.stringify(result, null, 2),
    );
    console.log("Metro browser checks passed", JSON.stringify(result));
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});

const { chromium } = require("playwright");
const fs = require("fs"),
  path = require("path"),
  http = require("http"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "build/qa");
fs.mkdirSync(out, { recursive: true });
const java = fs.readFileSync(
  path.join(root, "android/src/com/luna/movement/MainActivity.java"),
  "utf8",
);
const policy = java.match(
  /headers\.put\("Content-Security-Policy","([^"]+)"\)/,
)[1];
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://local"),
    file = path.resolve(
      root,
      "web",
      "." + (u.pathname === "/" ? "/index.html" : u.pathname),
    );
  if (
    !file.startsWith(path.join(root, "web") + path.sep) ||
    !fs.existsSync(file)
  ) {
    res.writeHead(404);
    return res.end();
  }
  const mime = {
    ".js": "application/javascript",
    ".html": "text/html",
    ".css": "text/css",
    ".mp3": "audio/mpeg",
    ".png": "image/png",
    ".json": "application/json",
    ".glb": "model/gltf-binary",
  };
  res.setHeader("Content-Security-Policy", policy);
  res.setHeader(
    "Content-Type",
    mime[path.extname(file)] || "application/octet-stream",
  );
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: process.env.LUNA_CHROMIUM,
    headless: true,
    args: [
      "--no-sandbox",
      "--use-angle=swiftshader",
      "--enable-webgl",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const page = await browser.newPage({
    viewport: {
      width: Number(process.env.LUNA_QA_WIDTH) || 1100,
      height: Number(process.env.LUNA_QA_HEIGHT) || 650,
    },
    hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("PAGEERROR", e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error") {
      errors.push(m.text());
      console.log("CONSOLE", m.text());
    }
  });
  const shot = async (name) => {
    await page.evaluate(() => {
      const g = window.lunaGame;
      if (g?.qaRender) g.qaRender(g.scene, g.camera);
    });
    await page.screenshot({
      path: path.join(out, "prologue-" + name + ".png"),
      timeout: 120000,
    });
  };
  const skip = async () => {
    for (let i = 0; i < 20; i++) {
      if (!(await page.evaluate(() => lunaGame.dialogue.active))) break;
      await page.click("#dialogue-next");
    }
  };
  try {
    await page.goto("http://127.0.0.1:" + server.address().port);
    await page.waitForFunction(() => window.lunaGame?.ready, null, {
      timeout: 180000,
    });
    await page.evaluate(() => {
      const g = lunaGame;
      g.renderer.setPixelRatio(0.65);
      g.resize();
      g.qaRender = g.renderer.render.bind(g.renderer);
      g.renderer.render = () => {};
    });
    // Capture actual character renders as persistent portrait assets.
    if (process.env.LUNA_PORTRAITS) {
      const portraits = await page.evaluate(async () => {
        const T = await import("./vendor/three.module.js"),
          { Actor } = await import("./game/actors.js");
        const result = {};
        for (const kind of ["cody", "may"]) {
          const scene = new T.Scene(),
            light = new T.HemisphereLight(0xffefda, 0x6f7e7e, 3);
          scene.add(light);
          const sun = new T.DirectionalLight(0xffe4ba, 3);
          sun.position.set(2, 4, 3);
          scene.add(sun);
          const a = new Actor(
            lunaGame.assets[kind],
            kind,
            scene,
            lunaGame.assets,
          );
          a.animate(0.2, { talk: false });
          a.updateGun();
          a.gun.visible = false;
          a.shadow.visible = false;
          const cam = new T.OrthographicCamera(
            -0.72,
            0.72,
            2.05,
            -0.05,
            0.1,
            15,
          );
          cam.position.set(0, 0, 5);
          cam.lookAt(0, 0, 0);
          const renderer = new T.WebGLRenderer({
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true,
          });
          renderer.setSize(440, 650);
          renderer.outputColorSpace = T.SRGBColorSpace;
          renderer.toneMapping = T.ACESFilmicToneMapping;
          renderer.render(scene, cam);
          result[kind] = renderer.domElement
            .toDataURL("image/png")
            .split(",")[1];
          renderer.dispose();
          a.remove();
        }
        return result;
      });
      fs.mkdirSync(path.join(root, "web/assets/portraits"), {
        recursive: true,
      });
      for (const [k, v] of Object.entries(portraits))
        fs.writeFileSync(
          path.join(root, "web/assets/portraits", k + ".png"),
          Buffer.from(v, "base64"),
        );
    }
    await shot("menu");
    await page.click("#new-game");
    await page.evaluate(() => lunaGame.prologue.update(3.6));
    await page.waitForFunction(() => lunaGame.dialogue.active, null, {
      timeout: 90000,
    });
    await shot("birthday");
    const cancelled = await page.evaluate(() => {
      const old = lunaGame.audio.voice;
      lunaGame.dialogue.next();
      return (
        old.paused &&
        old.getAttribute("src") === null &&
        lunaGame.audio.voice !== old
      );
    });
    assert(cancelled, "next cancels previous voice");
    await skip();
    await page.evaluate(() => (lunaGame.prologue.doorTime = 0.01));
    await page.waitForFunction(() => lunaGame.dialogue.active, null, {
      timeout: 60000,
    });
    assert.equal(
      await page.evaluate(() => lunaGame.dialogue.lines[0][1]),
      "敌人来了！",
    );
    await shot("door");
    await skip(); // enemy -> pistol dialogue is replaced synchronously
    await skip();
    await page.waitForFunction(
      () => lunaGame.state.prologue.phase === "combat",
    );
    assert.deepEqual(
      await page.evaluate(() => [
        lunaGame.state.player.ammo,
        lunaGame.state.player.reserve,
      ]),
      [15, 45],
    );
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(450);
    await page.keyboard.up("KeyW");
    await page.click("#aim");
    await page.waitForTimeout(250);
    await shot("pistol-aim");
    await page.evaluate(() => {
      lunaGame.cooldown = 0;
      lunaGame.fire();
    });
    await page.click("#reload");
    await page.waitForFunction(
      () => lunaGame.state.prologue.tutorial.reload,
      null,
      { timeout: 60000 },
    );
    assert(
      await page.evaluate(() =>
        Object.values(lunaGame.state.prologue.tutorial).every(Boolean),
      ),
    );
    console.log("TUTORIAL / VOICE / M92 PASS");
    // Save/reload and actual offer threshold. Accelerate spawn clock without changing counters or choices.
    await page.evaluate(() => {
      lunaGame.damageCooldown = 999;
      lunaGame.state.prologue.elapsed = 60;
      for (let i = 0; i < 20 && lunaGame.live().length < 10; i++) {
        lunaGame.state.prologue.spawnLeft = 0;
        lunaGame.prologue.update(0.05);
      }
    });
    await page.waitForFunction(() => lunaGame.state.prologue.phase === "offer");
    await skip();
    await shot("choice");
    await page.click("#reject-gift");
    assert.equal(
      await page.evaluate(() => lunaGame.state.prologue.offer),
      "rejected",
    );
    assert.equal(
      await page.evaluate(() => !!lunaGame.state.inventory.colt723),
      false,
    );
    await page.evaluate(() => {
      lunaGame.save();
      lunaGame.loadGame();
      lunaGame.damageCooldown = 999;
    });
    assert.equal(
      await page.evaluate(() => lunaGame.state.prologue.offer),
      "rejected",
    );
    assert.equal(
      await page.evaluate(() => lunaGame.state.prologue.phase),
      "combat",
    );
    console.log("REJECT / SAVE ROUNDTRIP PASS");
    // Independent accept branch from an explicitly restored pending choice.
    await page.evaluate(() => {
      lunaGame.state.prologue.offer = "unseen";
      lunaGame.prologue.offer();
    });
    await skip();
    await page.click("#accept-gift");
    assert.deepEqual(
      await page.evaluate(() => [
        lunaGame.state.weapon,
        lunaGame.state.player.ammo,
        lunaGame.state.player.reserve,
      ]),
      ["colt723", 30, 270],
    );
    await page.evaluate(() => {
      lunaGame.save();
      lunaGame.loadGame();
      lunaGame.damageCooldown = 999;
      lunaGame.input.aim = true;
    });
    assert.equal(await page.evaluate(() => lunaGame.state.weapon), "colt723");
    await page.waitForTimeout(300);
    await shot("rifle");
    // Cover finite spawn/death accounting through the actual controller / damage methods.
    await page.evaluate(() => {
      const g = lunaGame;
      for (let i = 0; i < 100 && g.state.prologue.phase === "combat"; i++) {
        for (const e of g.live()) g.damageEnemy(e, 1000, true);
        g.updateEnemies(2);
        g.state.prologue.spawnLeft = 0;
        g.prologue.update(0.05);
      }
    });
    await page.waitForFunction(
      () => lunaGame.state.prologue.phase === "ending",
    );
    assert.deepEqual(
      await page.evaluate(() => [
        lunaGame.state.prologue.spawned,
        lunaGame.state.prologue.defeated,
        lunaGame.live().length,
      ]),
      [60, 60, 0],
    );
    await skip();
    await page.waitForFunction(() => lunaGame.mode === "prologue-complete");
    await shot("ending");
    await page.click("#prologue-save");
    await page.evaluate(() => lunaGame.loadGame());
    assert.equal(await page.evaluate(() => lunaGame.mode), "prologue-complete");
    await page.click("#next-chapter");
    assert.equal(await page.evaluate(() => lunaGame.state.chapter), 1);
    await skip();
    assert.equal(await page.evaluate(() => lunaGame.live().length), 2);
    await shot("chapter1");
    assert.equal(await page.evaluate(() => lunaGame.audio.failures.length), 0);
    assert.equal(errors.length, 0, errors.join("\n"));
    const cover = await page.evaluate(() => {
      const g = lunaGame;
      for (const e of g.enemies) e.actor.remove();
      g.enemies = [];
      g.may.position.set(0, 0, 4);
      g.cody.position.set(1, 0, 4);
      const e = g.spawnEnemy(1, 0);
      e.hp = 100000;
      g.state.seed = 123;
      let hits = 0;
      const amounts = [];
      const damage = g.damageEnemy.bind(g),
        tracer = g.world.tracer,
        play = g.audio.play;
      g.damageEnemy = (enemy, amount) => {
        hits++;
        amounts.push(amount);
        damage(enemy, amount);
      };
      g.world.tracer = () => {};
      g.audio.play = () => {};
      for (let i = 0; i < 200; i++) {
        g.codyCooldown = 0;
        g.updateCody(0);
      }
      g.damageEnemy = damage;
      g.world.tracer = tracer;
      g.audio.play = play;
      return { hits, amounts: [...new Set(amounts)] };
    });
    assert(cover.hits > 45 && cover.hits < 95, JSON.stringify(cover));
    assert.equal(cover.amounts.length, 1);
    assert(Math.abs(cover.amounts[0] - 16.8) < 1e-9);
    console.log("CODY COVER", cover.hits + "/200, damage " + cover.amounts[0]);
    console.log("ACCEPT / FINITE 60 / ENDING / NEXT CHAPTER PASS");
  } catch (e) {
    console.error(e);
    try {
      console.log(
        "DEBUG",
        await page.evaluate(() => window.lunaGame?.debugState),
      );
      await shot("failure");
    } catch {}
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
})();

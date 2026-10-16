const { chromium } = require("playwright");
const fs = require("fs"),
  path = require("path"),
  http = require("http"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."),
  java = fs.readFileSync(
    path.join(root, "android/src/com/luna/movement/MainActivity.java"),
    "utf8",
  ),
  policy = java.match(/headers\.put\("Content-Security-Policy","([^"]+)"\)/)[1];
const output = process.env.LUNA_TEST_OUTPUT || path.join(root, "build", "qa");
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://local");
  const file = path.resolve(
    root,
    "web",
    "." + (url.pathname === "/" ? "/index.html" : url.pathname),
  );
  if (
    !file.startsWith(path.join(root, "web") + path.sep) ||
    !fs.existsSync(file)
  ) {
    res.writeHead(404);
    return res.end();
  }
  res.setHeader("Content-Security-Policy", policy);
  res.setHeader(
    "Content-Type",
    file.endsWith(".js")
      ? "application/javascript"
      : file.endsWith(".html")
        ? "text/html"
        : file.endsWith(".css")
          ? "text/css"
          : file.endsWith(".mp3")
            ? "audio/mpeg"
            : file.endsWith(".json")
              ? "application/json"
              : file.endsWith(".png")
                ? "image/png"
                : "model/gltf-binary",
  );
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.LUNA_CHROMIUM,
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-webgl"],
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
  try {
    await page.goto("http://127.0.0.1:" + server.address().port);
    await page.waitForFunction(() => window.lunaGame?.ready, {
      timeout: 120000,
    });
    await page.evaluate(() => {
      const g = lunaGame;
      g.renderer.setPixelRatio(0.65);
      g.resize();
      g.qaRender = g.renderer.render.bind(g.renderer);
      g.renderer.render = () => {};
    });
    console.log("MENU", await page.evaluate(() => lunaGame.debugState));
    await page.evaluate(() =>
      lunaGame.qaRender(lunaGame.scene, lunaGame.camera),
    );
    await page.screenshot({
      timeout: 120000,
      path: path.join(output, "story-menu.png"),
    });
    // Chapter one regression starts directly; the new-game prologue has its own suite.
    await page.evaluate(async () => {
      const { freshState } = await import("./game/state.js");
      const g = lunaGame;
      const s = freshState();
      s.flags.intro = true;
      g.start(s);
      g.spawnEnemy(-5, -8);
      g.spawnEnemy(6, -10);
      const { DIALOGUES } = await import("./game/dialogue.js");
      g.dialogue.start(DIALOGUES.intro);
    });
    await page.waitForFunction(() => lunaGame.dialogue.active);
    await page.evaluate(() =>
      lunaGame.qaRender(lunaGame.scene, lunaGame.camera),
    );
    await page.screenshot({
      timeout: 120000,
      path: path.join(output, "story-dialogue.png"),
    });
    for (let i = 0; i < 4; i++) await page.click("#dialogue-next");
    await page.waitForFunction(() => !lunaGame.dialogue.active);
    assert.equal(
      (await page.evaluate(() => lunaGame.debugState)).mode,
      "playing",
    );
    await page.locator("#joystick").waitFor({ state: "visible" });
    const joystick = await page.locator("#joystick").boundingBox();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        {
          x: joystick.x + joystick.width / 2,
          y: joystick.y + joystick.height / 2,
          id: 11,
        },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: joystick.x + joystick.width / 2, y: joystick.y + 5, id: 11 },
      ],
    });
    await page.waitForTimeout(350);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    assert.deepEqual(
      await page.evaluate(() => [lunaGame.input.x, lunaGame.input.y]),
      [0, 0],
    );
    console.log("TOUCH CANCEL PASS");
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(600);
    await page.keyboard.up("KeyW");
    await page.evaluate(() =>
      lunaGame.qaRender(lunaGame.scene, lunaGame.camera),
    );
    await page.screenshot({
      timeout: 120000,
      path: path.join(output, "story-playing.png"),
    });
    console.log("PLAYING", await page.evaluate(() => lunaGame.debugState));
    await page.click("#aim");
    await page.waitForTimeout(500);
    await page.evaluate(() =>
      lunaGame.qaRender(lunaGame.scene, lunaGame.camera),
    );
    await page.screenshot({
      timeout: 120000,
      path: path.join(output, "story-aim.png"),
    });
    await page.evaluate(() => {
      lunaGame.input.aim = false;
      lunaGame.may.position.set(0, 0, -3.5);
      lunaGame.interact();
    });
    await page.waitForFunction(() => lunaGame.dialogue.active);
    for (let i = 0; i < 4; i++) await page.click("#dialogue-next");
    await page.waitForTimeout(500);
    await page.evaluate(() =>
      lunaGame.qaRender(lunaGame.scene, lunaGame.camera),
    );
    await page.screenshot({
      timeout: 120000,
      path: path.join(output, "story-zombies.png"),
    });
    const choices = await page.evaluate(() =>
      lunaGame.enemies.map((e) => [e.id, { ...e.choices }]),
    );
    assert.equal(choices.length, 5);
    await page.evaluate(() => lunaGame.save());
    await page.click("#pause");
    await page.click("#return-menu");
    assert.equal((await page.evaluate(() => lunaGame.debugState)).mode, "menu");
    await page.click("#load-game");
    await page.waitForFunction(() => lunaGame.mode === "playing");
    const restored = await page.evaluate(() =>
      lunaGame.enemies.map((e) => [e.id, { ...e.choices }]),
    );
    assert.deepEqual(restored, choices);
    console.log("RESTORE stable actions PASS");
    await page.evaluate(() =>
      lunaGame.qaRender(lunaGame.scene, lunaGame.camera),
    );
    await page.screenshot({
      timeout: 120000,
      path: path.join(output, "story-loaded.png"),
    }); // Aimed shots use the same camera ray and enemy hit tests as the fire button.
    const shot = await page.evaluate(() => {
      const g = lunaGame;
      g.input.clear();
      g.may.position.set(-5, 0, 0);
      const e = g.live()[0];
      e.actor.position.set(-5, 0, -4);
      e.actor.root.updateMatrixWorld(true);
      e.actor.correctGround();
      g.yaw = 0;
      g.pitch = 0;
      g.updateCamera(1, true);
      const target = e.actor.head
        .getWorldPosition(new g.may.position.constructor())
        .add(new g.may.position.constructor(0, 0.12, 0));
      g.camera.lookAt(target);
      g.camera.updateMatrixWorld(true);
      const before = e.hp,
        ammo = g.state.player.ammo;
      g.cooldown = 0;
      g.fire();
      return {
        before,
        after: e.hp,
        ammoBefore: ammo,
        ammoAfter: g.state.player.ammo,
      };
    });
    assert(
      shot.after < shot.before,
      "camera-ray shot must damage visible enemy",
    );
    assert.equal(shot.ammoAfter, shot.ammoBefore - 1);
    console.log("SHOOT PASS", shot);
    await page.evaluate(() => {
      const g = lunaGame;
      g.state.player.ammo = 2;
      g.state.player.reserve = 10;
      g.reload();
      g.reloadLeft = 0.01;
      g.update(0.02);
    });
    let ammo = await page.evaluate(() => ({
      ammo: lunaGame.state.player.ammo,
      reserve: lunaGame.state.player.reserve,
    }));
    assert.deepEqual(ammo, { ammo: 12, reserve: 0 });
    await page.evaluate(() => {
      const g = lunaGame;
      for (const e of g.live()) g.damageEnemy(e, 200, true);
      g.updateEnemies(0.01);
    });
    await page.waitForFunction(
      () => lunaGame.state.stage === 2 && lunaGame.dialogue.active,
    );
    while (await page.evaluate(() => lunaGame.dialogue.active))
      await page.click("#dialogue-next");
    await page.evaluate(() => {
      const g = lunaGame;
      g.may.position.copy(g.world.battery.position);
      g.interact();
    });
    await page.waitForFunction(
      () => lunaGame.state.stage === 3 && lunaGame.dialogue.active,
    );
    while (await page.evaluate(() => lunaGame.dialogue.active))
      await page.click("#dialogue-next");
    assert.equal(await page.evaluate(() => lunaGame.live().length), 2);
    assert(await page.evaluate(() => lunaGame.blackoutLeft > 0));
    await page.evaluate(() => {
      const g = lunaGame;
      g.may.position.set(2.3, 0, -25.7);
      g.interact();
    });
    assert.equal(
      await page.evaluate(() => lunaGame.state.stage),
      3,
      "exit stays locked during the wave",
    );
    await page.evaluate(() => {
      const g = lunaGame;
      for (const e of g.live()) g.damageEnemy(e, 200, true);
      g.interact();
    });
    await page.waitForFunction(() => lunaGame.state.stage === 4);
    while (await page.evaluate(() => lunaGame.dialogue.active))
      await page.click("#dialogue-next");
    await page.evaluate(() => {
      lunaGame.may.position.set(0, 0, -29);
      lunaGame.finish();
    });
    while (await page.evaluate(() => lunaGame.dialogue.active))
      await page.click("#dialogue-next");
    assert.equal(await page.evaluate(() => lunaGame.mode), "complete");
    await page.evaluate(() =>
      lunaGame.qaRender(lunaGame.scene, lunaGame.camera),
    );
    await page.screenshot({
      timeout: 120000,
      path: path.join(output, "story-complete.png"),
    });
    console.log("CHAPTER COMPLETE PASS");
    await page.evaluate(async () => {
      const { freshState } = await import("./game/state.js");
      const s = freshState();
      s.flags.intro = true;
      lunaGame.start(s);
      lunaGame.save();
    });
    while (await page.evaluate(() => lunaGame.dialogue.active))
      await page.click("#dialogue-next");
    await page.evaluate(() => lunaGame.damagePlayer(200));
    assert.equal(await page.evaluate(() => lunaGame.mode), "dead");
    await page.click("#death-load");
    assert.equal(await page.evaluate(() => lunaGame.mode), "playing");
    assert(await page.evaluate(() => lunaGame.state.player.hp > 0));
    console.log("DEATH / LOAD PASS");
    assert.deepEqual(errors, []);
    console.log("STORY SMOKE PASS");
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

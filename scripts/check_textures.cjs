/** Run with Playwright installed. Reuses the APK's actual response policy. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const java = fs.readFileSync(
  path.join(root, "android/src/com/luna/movement/MainActivity.java"),
  "utf8",
);
const policy = java.match(
  /headers\.put\("Content-Security-Policy","([^"]+)"\)/,
)?.[1];
assert(policy, "APK security policy not found");
const probe = `import {GLTFLoader} from '/vendor/GLTFLoader.js';
window.textureProbe=async name=>{const gltf=await new GLTFLoader().loadAsync('/assets/'+({cody:'cody_story',character2:'character2_story',zombie:'zombie_pool',zombieShirt:'zombie_shirt',m92:'m92',colt723:'colt723',cabin:'cabin'}[name]||name)+'.glb');let materials=0,textured=0,broken=0;gltf.scene.traverse(o=>{if(o.isMesh)for(const m of (Array.isArray(o.material)?o.material:[o.material])){materials++;for(const k of ["map","normalMap","roughnessMap","metalnessMap","aoMap","emissiveMap"])if(m[k]&&!(m[k].image?.width>0))broken++;if(m.map&&m.map.image&&m.map.image.width>0)textured++;}});return {materials,textured,broken};};`;
(async () => {
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Security-Policy", policy);
    if (req.url === "/_probe.html") {
      res.setHeader("Content-Type", "text/html");
      return res.end('<script type="module" src="/_probe.js"></script>');
    }
    if (req.url === "/_probe.js") {
      res.setHeader("Content-Type", "application/javascript");
      return res.end(probe);
    }
    const file = path.resolve(root, "web", "." + decodeURIComponent(req.url));
    if (
      !file.startsWith(path.join(root, "web") + path.sep) ||
      !fs.existsSync(file)
    ) {
      res.writeHead(404);
      return res.end();
    }
    res.setHeader(
      "Content-Type",
      file.endsWith(".js")
        ? "application/javascript"
        : file.endsWith(".glb")
          ? "model/gltf-binary"
          : "application/octet-stream",
    );
    fs.createReadStream(file).pipe(res);
  });
  let browser;
  try {
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      headless: true,
      ...(process.env.LUNA_CHROMIUM
        ? { executablePath: process.env.LUNA_CHROMIUM }
        : {}),
      args: ["--no-sandbox"],
    });
    for (const name of [
      "cody",
      "character2",
      "zombie",
      "zombieShirt",
      "m92",
      "colt723",
      "cabin",
      "metro_station",
      "money",
      ...fs
        .readdirSync(path.join(root, "web/assets"))
        .filter((n) => /^npc_.*\.glb$/.test(n))
        .map((n) => n.slice(0, -4)),
    ]) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto(
        "http://127.0.0.1:" + server.address().port + "/_probe.html",
      );
      await page.waitForFunction(() => window.textureProbe);
      const result = await page.evaluate((n) => window.textureProbe(n), name);
      assert(result.materials > 0);
      assert.equal(result.broken, 0, name + ": unreadable texture");
      assert(result.textured > 0);
      if (["cody", "character2", "zombie", "zombieShirt"].includes(name))
        assert.equal(
          result.textured,
          result.materials,
          name + ": missing color textures",
        );
      assert.deepEqual(errors, [], name + ": browser errors");
      console.log(
        name +
          ": PASS " +
          result.textured +
          "/" +
          result.materials +
          " textured materials",
      );
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

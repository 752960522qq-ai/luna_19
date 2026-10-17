import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { GLTFLoader } from "../../web/vendor/GLTFLoader.js";
// Texture IO is covered by the browser suite; these tests exercise real geometry,
// skin weights, skeletons and animation tracks without requiring a GPU.
globalThis.ProgressEvent ||= class {
  constructor(type, fields) {
    Object.assign(this, fields);
  }
};
globalThis.document ||= {
  createElement: () => ({
    width: 64,
    height: 64,
    getContext: () => ({
      createRadialGradient: () => ({ addColorStop() {} }),
      fillRect() {},
    }),
  }),
};
export async function modelFixture(file) {
  const b = await fs.readFile(
      fileURLToPath(
        new URL("../../web/assets/" + file + ".glb", import.meta.url),
      ),
    ),
    n = b.readUInt32LE(12),
    json = JSON.parse(b.subarray(20, 20 + n));
  json.buffers[0].uri =
    "data:application/octet-stream;base64," +
    b.subarray(28 + n).toString("base64");
  delete json.images;
  delete json.textures;
  delete json.samplers;
  json.materials = json.materials.map((m) => ({
    name: m.name,
    pbrMetallicRoughness: { baseColorFactor: [0.7, 0.7, 0.7, 1] },
  }));
  return new GLTFLoader().parseAsync(JSON.stringify(json), "");
}
export async function characterFixtures() {
  const result = {};
  for (const [k, f] of Object.entries({
    may: "character2_story",
    cody: "cody_story",
    zombie: "zombie_pool",
    zombieShirt: "zombie_shirt",
    m92: "m92",
    colt723: "colt723",
  }))
    result[k] = await modelFixture(f);
  return result;
}

import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const uiRoot = resolve("dist", "electron", "carvisui");
const html = await readFile(join(uiRoot, "index.html"), "utf8");
const assetNames = await readdir(join(uiRoot, "assets"));
const jsAsset = assetNames.find((name) => name.endsWith(".js") && name.startsWith("index-"));
const cssAsset = assetNames.find((name) => name.endsWith(".css") && name.startsWith("index-"));

assert(jsAsset !== undefined, "built carvisui should include JS bundle");
assert(cssAsset !== undefined, "built carvisui should include CSS bundle");
assert(html.includes("<title>Carvis</title>"), "HTML title should be Carvis");
assert(html.includes('id="root"'), "HTML should include React root");

const js = await readFile(join(uiRoot, "assets", jsAsset), "utf8");
const css = await readFile(join(uiRoot, "assets", cssAsset), "utf8");

for (const label of ["主管 Manager", "文员", "设计师", "调查员", "技术员"]) {
  assert(js.includes(label), `UI bundle should include role label ${label}`);
}

for (const text of ["输入任务", "输出结果", "历史任务", "打开位置", "开始协同"]) {
  assert(js.includes(text), `UI bundle should include panel text ${text}`);
}

for (const api of ["submitCommand", "openOutput", "onState", "getState"]) {
  assert(js.includes(api), `UI bundle should use preload API ${api}`);
}

assert(!js.includes("仿真世界"), "UI bundle should not keep old app title");
assert(css.includes("office-bg-no-desks-1465x903.png"), "CSS should reference pixel office background");
assert(await assetExists("assets/generated-ui/office-bg-no-desks-1465x903.png"), "office background asset should exist");
assert(await assetExists("assets/generated-motion/manager-sending.webp"), "manager sending motion should exist");
assert(await assetExists("assets/generated-motion/tech-sending.webp"), "tech output motion should exist");

console.log("[electron:ui-smoke] ok");

async function assetExists(relativePath: string): Promise<boolean> {
  try {
    await readFile(join(uiRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

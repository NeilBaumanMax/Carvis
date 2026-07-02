import { callArtistImageMcp, createAssetRenderingRules } from "./artistImageMcp.js";

await assertRejects(
  () =>
    callArtistImageMcp({
      role: "writer",
      commandText: "writer must not call image mcp",
      artistOutput: "visual brief",
      outputRootPath: "output/smoke",
    }),
  "artist-image-mcp should reject non-artist roles",
);

const characterRules = createAssetRenderingRules({
  label: "artist-main-character",
  purpose: "主要角色立绘",
  prompt: "生成主角人物",
});
const backgroundRules = createAssetRenderingRules({
  label: "artist-background",
  purpose: "主要场景背景",
  prompt: "生成场景",
});
const uiRules = createAssetRenderingRules({
  label: "artist-flow-diagram",
  purpose: "架构流程图",
  prompt: "生成流程图",
});

assert(
  characterRules.join("\n").includes("透明背景 PNG") && characterRules.join("\n").includes("不要画场景背景"),
  "character assets should request transparent-background cutouts",
);
assert(backgroundRules.join("\n").includes("横向 16:9"), "background assets should request wide composition");
assert(uiRules.join("\n").includes("不要默认正方形"), "UI assets should avoid default square composition");

console.log("[artist-image-mcp:smoke] ok");

async function assertRejects(action: () => Promise<unknown>, message: string): Promise<void> {
  try {
    await action();
  } catch {
    return;
  }

  throw new Error(message);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

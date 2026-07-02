import { callArtistImageMcp } from "./artistImageMcp.js";

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

console.log("[artist-image-mcp:smoke] ok");

async function assertRejects(action: () => Promise<unknown>, message: string): Promise<void> {
  try {
    await action();
  } catch {
    return;
  }

  throw new Error(message);
}

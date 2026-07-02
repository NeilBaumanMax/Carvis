import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AgentRole } from "../shared/types/agent.js";
import type { OutputReadyPayload } from "../shared/types/events.js";

export interface OutputManifest {
  generatedAt: string;
  finalReportPath: string;
  gamePreviewPath: string;
  entries: OutputManifestEntry[];
}

export interface OutputManifestEntry {
  role: AgentRole;
  sourcePath: string;
}

export interface WriteOutputOptions {
  outputRootPath: string;
  title: string;
  workplaceResults: OutputManifestEntryWithContent[];
}

export interface OutputManifestEntryWithContent extends OutputManifestEntry {
  content: string;
}

export async function writeOutput(options: WriteOutputOptions): Promise<OutputReadyPayload> {
  await mkdir(options.outputRootPath, { recursive: true });

  const finalReportPath = join(options.outputRootPath, "final-report.md");
  const gamePreviewPath = join(options.outputRootPath, "game-preview.html");
  const manifestPath = join(options.outputRootPath, "manifest.json");
  const finalReport = renderFinalReport(options.title, options.workplaceResults);
  const gamePreview = renderGamePreviewHtml(options.title, finalReport);
  const manifest: OutputManifest = {
    generatedAt: new Date().toISOString(),
    finalReportPath,
    gamePreviewPath,
    entries: options.workplaceResults.map((entry) => ({
      role: entry.role,
      sourcePath: entry.sourcePath,
    })),
  };

  await writeFile(finalReportPath, finalReport, "utf8");
  await writeFile(gamePreviewPath, gamePreview, "utf8");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    outputPath: finalReportPath,
    manifestPath,
    gamePreviewPath,
  };
}

export async function readOutputManifest(manifestPath: string): Promise<OutputManifest> {
  return JSON.parse(await readFile(manifestPath, "utf8")) as OutputManifest;
}

function renderFinalReport(title: string, entries: OutputManifestEntryWithContent[]): string {
  const sections = entries.map((entry) => `## ${entry.role}\n\n${entry.content.trim()}`).join("\n\n");

  return `# ${title}\n\n${sections}\n`;
}

function renderGamePreviewHtml(title: string, finalReport: string): string {
  const preview = createGamePreviewContent(finalReport);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} Game Preview</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #10140f; color: #f4f0dc; }
    .game { min-height: 100vh; display: grid; grid-template-columns: minmax(260px, 360px) 1fr; }
    aside { padding: 22px; background: #191f17; border-right: 1px solid #384531; }
    main { padding: 22px; display: grid; gap: 16px; align-content: start; }
    h1 { margin: 0 0 12px; font-size: 26px; line-height: 1.1; }
    h2 { margin: 0; font-size: 18px; }
    .stat { display: grid; gap: 5px; margin: 12px 0; }
    .bar { height: 10px; border-radius: 999px; background: #303827; overflow: hidden; }
    .bar span { display: block; height: 100%; background: #e5b85c; }
    .scene, .report, button { border: 1px solid #46543c; border-radius: 8px; background: #151a13; }
    .scene, .report { padding: 16px; }
    .choices { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    button { color: #f4f0dc; padding: 12px; cursor: pointer; font-weight: 700; }
    button:hover { background: #25301f; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 360px; overflow: auto; margin: 0; font-size: 12px; line-height: 1.45; }
    @media (max-width: 760px) { .game { grid-template-columns: 1fr; } .choices { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="game">
    <aside>
      <h1>${escapeHtml(preview.heading)}</h1>
      <div class="stat">${escapeHtml(preview.primaryStat)}<div class="bar"><span id="chivalry" style="width: 62%"></span></div></div>
      <div class="stat">Reality<div class="bar"><span id="reality" style="width: 48%"></span></div></div>
      <div class="stat">Reputation<div class="bar"><span id="reputation" style="width: 55%"></span></div></div>
    </aside>
    <main>
      <section class="scene">
        <h2 id="scene-title">${escapeHtml(preview.sceneTitle)}</h2>
        <p id="scene-text">${escapeHtml(preview.sceneText)}</p>
      </section>
      <section class="choices">
        <button type="button" data-choice="charge">${escapeHtml(preview.buttons[0] ?? "Choose power")}</button>
        <button type="button" data-choice="inspect">${escapeHtml(preview.buttons[1] ?? "Read reality")}</button>
        <button type="button" data-choice="appeal">${escapeHtml(preview.buttons[2] ?? "Seek mercy")}</button>
      </section>
      <section class="report">
        <h2>Generated Design Report</h2>
        <pre>${escapeHtml(finalReport)}</pre>
      </section>
    </main>
  </div>
  <script>
    const state = { chivalry: 62, reality: 48, reputation: 55 };
    const scenes = {
      charge: ${JSON.stringify(preview.scenes.charge)},
      inspect: ${JSON.stringify(preview.scenes.inspect)},
      appeal: ${JSON.stringify(preview.scenes.appeal)}
    };
    function clamp(value) { return Math.max(0, Math.min(100, value)); }
    function render() {
      for (const key of Object.keys(state)) {
        document.getElementById(key).style.width = state[key] + "%";
      }
    }
    for (const button of document.querySelectorAll("button[data-choice]")) {
      button.addEventListener("click", () => {
        const scene = scenes[button.dataset.choice];
        document.getElementById("scene-title").textContent = scene[0];
        document.getElementById("scene-text").textContent = scene[1];
        for (const [key, delta] of Object.entries(scene[2])) state[key] = clamp(state[key] + delta);
        render();
      });
    }
  </script>
</body>
</html>`;
}

function createGamePreviewContent(finalReport: string): {
  heading: string;
  primaryStat: string;
  sceneTitle: string;
  sceneText: string;
  buttons: string[];
  scenes: Record<string, [string, string, Record<string, number>]>;
} {
  if (finalReport.includes("Crown of Cinders") || finalReport.includes("麦克白") || finalReport.includes("Macbeth")) {
    return {
      heading: "麦克白 RPG Preview",
      primaryStat: "Ambition",
      sceneTitle: "The Heath of Three Ashes",
      sceneText: "雨水压低荒原。三位灰烬先知递来王冠的影子。你可以逼近预言、审视现实，或向同伴承认恐惧。",
      buttons: ["Seize the prophecy", "Question the omen", "Confess the fear"],
      scenes: {
        charge: ["Crown Taken Early", "你把预言当成命令。军心上涨，宫廷开始害怕你。野心上升，名声受损。", { chivalry: 13, reality: -5, reputation: -8 }],
        inspect: ["Rain on the Vellum", "你拆解先知的话，发现每个词都可以被政敌利用。现实上升，野心暂缓。", { chivalry: -4, reality: 15, reputation: 6 }],
        appeal: ["A Private Tremor", "你向Lysa承认恐惧。她给出计划，也要求你保留最后一条退路。", { chivalry: 5, reality: 7, reputation: 10 }],
      },
    };
  }

  if (finalReport.includes("雾下余烬") || finalReport.includes("被掩埋") || finalReport.includes("Buried Giant")) {
    return {
      heading: "雾下余烬 RPG Preview",
      primaryStat: "记忆",
      sceneTitle: "空桌宴",
      sceneText: "长屋里多摆了一只碗，却没人承认它属于谁。雾让村庄安静，也让名字从舌尖滑走。",
      buttons: ["公开空座名单", "暂时保留证词", "交给织悼人"],
      scenes: {
        charge: ["诸名归来", "你公开空座名单。村民终于想起失踪者，也想起谁曾沉默。记忆上升，名声震荡。", { chivalry: 14, reality: 8, reputation: -6 }],
        inspect: ["雾中缓行", "你把证词暂时封存，只与当事家庭核对。冲突被推迟，但信任开始积累。", { chivalry: 3, reality: 10, reputation: 7 }],
        appeal: ["共守长夜", "织悼人把名字织进守夜仪式。真相没有变成复仇名单，而成为共同哀悼。", { chivalry: 8, reality: 6, reputation: 12 }],
      },
    };
  }

  if (finalReport.includes("绿潮来信") || finalReport.includes("绿毛水怪") || finalReport.includes("水怪社")) {
    return {
      heading: "绿潮来信 Galgame Preview",
      primaryStat: "理解度",
      sceneTitle: "借书卡里的绿信",
      sceneText: "旧图书馆的风扇吱呀作响。你在借书卡背面发现一封潮湿的信：排水渠里住着一只专吃真心话的绿色水怪。",
      buttons: ["认真回信", "开玩笑回避", "写进怪物志"],
      scenes: {
        charge: ["认真回信", "你没有把它当成恶作剧。信纸上的水渍慢慢扩散，像有人终于被认真听见。理解度上升。", { chivalry: 12, reality: 6, reputation: 3 }],
        inspect: ["玩笑防身", "你写了三行冷笑话。对方回得更快了，但信末多了一句：你是不是害怕认真？", { chivalry: 4, reality: 8, reputation: -2 }],
        appeal: ["怪物志第一页", "你把没敢说出口的话写成一种水怪习性。第二天，广播站有人念出了相似的句子。", { chivalry: 8, reality: 5, reputation: 10 }],
      },
    };
  }

  if (finalReport.includes("星炉远征") || finalReport.includes("爬塔卡牌") || finalReport.includes("炉心骑士")) {
    return {
      heading: "星炉远征 Card Roguelike Preview",
      primaryStat: "热量",
      sceneTitle: "锈环外带",
      sceneText: "移动星炉驶入破碎轨道。敌方巡逻艇锁定你的炉心，手牌里同时出现过热攻击、冷却阀和星图折返。",
      buttons: ["打出炉刃斩", "启动冷却阀", "生成素材预览"],
      scenes: {
        charge: ["炉刃斩", "你消耗 1 点能量斩开巡逻艇外壳。热量超过阈值，追加伤害触发。", { chivalry: 14, reality: -3, reputation: 4 }],
        inspect: ["冷却阀", "你压低炉心温度并展开护盾。过载风险下降，下一回合可以安全蓄热。", { chivalry: -5, reality: 12, reputation: 6 }],
        appeal: ["素材生成", "系统根据几何参数生成卡牌图标、敌人剪影和遗物徽章，没有调用任何既有游戏素材。", { chivalry: 6, reality: 8, reputation: 10 }],
      },
    };
  }

  return {
    heading: "堂吉诃德 RPG Preview",
    primaryStat: "Chivalry",
    sceneTitle: "The Giants of Turning Arms",
    sceneText: "风车在热风里转动。骑士看见巨人，村民看见失控的磨坊。你的选择会改变荣耀、现实和名声。",
    buttons: ["Charge with the lance", "Inspect in reality", "Appeal to the crowd"],
    scenes: {
      charge: ["A glorious mistake", "你冲向巨人。长矛断裂，孩子们欢呼，磨坊主愤怒。荣耀上升，名声下降。", { chivalry: 12, reality: -6, reputation: -8 }],
      inspect: ["The wooden truth", "你绕到背风处，发现齿轮被人动过手脚。幻想退去，但真正的阴谋露出来。", { chivalry: -5, reality: 14, reputation: 8 }],
      appeal: ["A better story", "你把事故讲成全村共同击败巨人的戏剧。没人完全相信，但大家愿意一起修磨坊。", { chivalry: 7, reality: 5, reputation: 12 }],
    },
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

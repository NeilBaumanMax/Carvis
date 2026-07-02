import { join } from "node:path";

import { createRemoteMessageBus } from "../messagebus/index.js";
import { writeOutput } from "../output/index.js";
import { runComponentMain } from "../shared/componentMain.js";
import type { AgentOutputPayload } from "../shared/types/events.js";
import { createAgentRuntime } from "./index.js";
import {
  initializeWorkplaces,
  readWorkplaceResults,
  writeWorkplaceResult,
} from "./workplaces/index.js";

const bus = createRemoteMessageBus({
  port: readPort(process.env.CARVIS_MESSAGEBUS_PORT),
});
const workplacesRoot = process.env.CARVIS_WORKPLACES_ROOT ?? join(process.cwd(), "workplaces", "live");
const outputRoot = process.env.CARVIS_OUTPUT_ROOT ?? "output";
const progressDelayMs = readNonNegativeInteger(process.env.CARVIS_AGENTRUNTIME_STREAM_DELAY_MS, 260);
const previewDelayMs = readNonNegativeInteger(process.env.CARVIS_AGENTRUNTIME_PREVIEW_DELAY_MS, 140);
const initializedRuns = new Set<string>();
const runtime = createAgentRuntime(bus, {
  roleRunner: async ({ run, agent, commandText }) => {
    if (!initializedRuns.has(run.runId)) {
      await initializeWorkplaces(workplacesRoot, commandText);
      initializedRuns.add(run.runId);
    }

    const roleResult = renderRoleResult(agent.role, commandText);

    await streamRoleProgress(run.requestId, run.runId, agent.agentId, agent.role, commandText);
    await writeWorkplaceResult(workplacesRoot, agent.role, roleResult);
    await streamRoleResultPreview(run.requestId, run.runId, agent.agentId, agent.role, roleResult);
    await publishRoleOutput(
      run.requestId,
      run.runId,
      agent.agentId,
      `Claude Code CLI public output: ${agent.role} result written to ${join(workplacesRoot, agent.role, "result.md")}`,
    );
  },
  outputWriter: async () => {
    const results = await readWorkplaceResults(workplacesRoot);

    return writeOutput({
      outputRootPath: outputRoot,
      title: "Carvis Live Task Output",
      workplaceResults: results.map((result) => ({
        role: result.role,
        sourcePath: result.resultPath,
        content: result.result,
      })),
    });
  },
});

await runComponentMain({
  name: "agentruntime",
  onStart: () => {
    runtime.start();
    console.log("[agentruntime] connected to messagebus");
  },
  onShutdown: async () => {
    await runtime.shutdown();
    bus.close();
  },
});

function readPort(value: string | undefined): number {
  if (value === undefined) {
    return 45931;
  }

  const port = Number.parseInt(value, 10);

  if (!Number.isFinite(port) || port <= 0) {
    return 45931;
  }

  return port;
}

function readNonNegativeInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function streamRoleProgress(
  requestId: string,
  runId: string,
  agentId: string,
  role: string,
  commandText: string,
): Promise<void> {
  for (const line of createPublicProgressLines(role, commandText)) {
    await publishRoleOutput(requestId, runId, agentId, line);
    await sleep(progressDelayMs);
  }
}

async function streamRoleResultPreview(
  requestId: string,
  runId: string,
  agentId: string,
  role: string,
  result: string,
): Promise<void> {
  const prefix = `>>> RESULT PREVIEW [${role.toUpperCase()}]`;
  const lines = result
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(0, 18);

  await publishRoleOutput(requestId, runId, agentId, `${prefix} generated ${lines.length} visible design lines`);
  for (const line of lines) {
    await publishRoleOutput(requestId, runId, agentId, `${prefix} ${line}`);
    await sleep(previewDelayMs);
  }
}

async function publishRoleOutput(
  requestId: string,
  runId: string,
  agentId: string,
  text: string,
): Promise<void> {
  await bus.publish<AgentOutputPayload>({
    type: "agent.output",
    source: "agentruntime",
    target: "electron",
    requestId,
    runId,
    agentId,
    payload: {
      stream: "stdout",
      text,
    },
  });
}

function createPublicProgressLines(role: string, commandText: string): string[] {
  const prefix = `>>> LIVE CLI STREAM [${role.toUpperCase()}]`;
  const profile = roleProfile(role);
  const adaptationMode = isDonQuixoteTask(commandText)
    ? "public-domain Don Quixote adaptation"
    : "literary RPG adaptation with safety checks";

  return [
    `${prefix} 人设=${profile.name}`,
    `${prefix} 分工=${profile.specialty}`,
    `${prefix} 口吻约束=${profile.voice}`,
    `${prefix} 输出语言=中文；除必要文件名/技术名词外不要输出英文说明`,
    `${prefix} 已收到 Electron 输入框任务`,
    `${prefix} 改编模式=${adaptationMode}`,
    `${prefix} 正在阅读任务：${commandText.slice(0, 96)}`,
    `${prefix} 正在建立本角色检查清单`,
    `${prefix} 需要输出具体游戏设计，不只输出状态`,
    `${prefix} 正在为 ${role} 生成中文 RPG 内容`,
    `${prefix} 正在补充章节、机制、循环和 MVP 任务`,
    `${prefix} 正在写入 workplace/result.md`,
    `${prefix} 正在把生成结果预览流式写回本面板`,
  ];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function renderRoleResult(role: string, commandText: string): string {
  if (isDonQuixoteTask(commandText)) {
    return renderDonQuixoteRoleResult(role, commandText);
  }
  if (isMacbethTask(commandText)) {
    return renderMacbethRoleResult(role, commandText);
  }

  switch (role) {
    case "manager":
      return [
        "## Manager Plan",
        "",
        `Task: ${commandText}`,
        "",
        "- Scope the game as an original literary dark-fantasy RPG about memory, aging, buried history, and reconciliation.",
        "- Avoid using protected plot, characters, locations, or unique expressions from the source novel.",
        "- Deliver a playable MVP around one village hub, one misted road, one ruin, and a final memory trial.",
      ].join("\n");
    case "writer":
      return [
        "## Writer Narrative",
        "",
        "Working title: Veil of Ash and Heather.",
        "",
        "The player guides two aging wanderers through a valley where a pale mist softens personal memory and public guilt. Villagers prefer peace bought by forgetting, while old songs, scars, and ruined stones insist that something terrible was buried rather than healed.",
        "",
        "The story should center on choices: recover memories and risk renewed hatred, or preserve forgetting and lose identity. The final act asks whether truth must be carried as judgment, mourning, or a promise to rebuild.",
      ].join("\n");
    case "artist":
      return [
        "## Artist Direction",
        "",
        "- Visual tone: muted greens, wet stone, ash-gray skies, warm lantern interiors.",
        "- Characters: weathered travelers, guarded villagers, silent memorial keepers, masked oath-breakers.",
        "- UI motif: a fraying tapestry map where restored memories stitch new threads into old blank spaces.",
        "- Key scenes: fog road, abandoned causeway, giant barrow-like hill, ruined watchtower, twilight river crossing.",
      ].join("\n");
    case "researcher":
      return [
        "## Researcher Systems",
        "",
        "- Memory meter: remembering unlocks truth, dialogue, and hidden paths; forgetting lowers conflict and avoids some fights.",
        "- Bond meter: companions can disagree about whether a memory should be restored.",
        "- Exploration loop: talk, inspect relics, solve memory echoes, choose what to record in the party journal.",
        "- Combat loop: low-frequency tactical encounters against grief-forms, oath-shades, and fear-born guardians.",
      ].join("\n");
    case "engineer":
      return [
        "## Engineer MVP Build List",
        "",
        "1. Hub village with 6 NPCs, dialogue flags, and one memory choice.",
        "2. Misted road exploration map with three relic interactions.",
        "3. Turn-based combat prototype: two party members, three enemy types, guard/appeal/strike actions.",
        "4. Memory journal UI that stores recovered, refused, and distorted memories.",
        "5. Three chapter quests:",
        "   - The Empty Feast: restore or suppress a village betrayal memory.",
        "   - Stones Under Moss: uncover why a road was abandoned.",
        "   - The Hill That Breathes: decide what truth reaches the valley.",
        "6. Endings:",
        "   - Mercy of Mist: peace remains, identity fades.",
        "   - Burden of Names: truth returns, conflict resumes, repair begins.",
        "   - Shared Vigil: partial truth becomes ritual mourning instead of revenge.",
      ].join("\n");
    default:
      return `Completed ${role}: ${commandText}`;
  }
}

function isDonQuixoteTask(commandText: string): boolean {
  const normalized = commandText.toLowerCase();

  return normalized.includes("堂吉") || normalized.includes("quixote");
}

function isMacbethTask(commandText: string): boolean {
  const normalized = commandText.toLowerCase();

  return normalized.includes("麦克白") || normalized.includes("macbeth");
}

function roleProfile(role: string): { name: string; specialty: string; voice: string } {
  switch (role) {
    case "manager":
      return {
        name: "制作人林",
        specialty: "控制范围、里程碑、功能优先级和交付风险",
        voice: "像项目负责人一样直接、可执行、少空话",
      };
    case "writer":
      return {
        name: "叙事设计乔",
        specialty: "主线、角色、主题、任务和章节结构",
        voice: "文学感要服务玩法，每段都能落到任务或选择",
      };
    case "artist":
      return {
        name: "美术指导维加",
        specialty: "视觉识别、UI 母题、场景、角色和动画提示",
        voice: "像给概念美术下 brief，具体到颜色、形状和镜头",
      };
    case "researcher":
      return {
        name: "系统研究员沈",
        specialty: "机制、玩家心理、循环、数值钩子和平衡风险",
        voice: "分析玩法因果，不写泛泛设定",
      };
    case "engineer":
      return {
        name: "玩法工程师任",
        specialty: "MVP 架构、数据结构、实现切片和验收项",
        voice: "每条都要能拆成工程任务",
      };
    default:
      return {
        name: `${role} agent`,
        specialty: "本角色生产任务",
        voice: "简洁中文",
      };
  }
}

function renderDonQuixoteRoleResult(role: string, commandText: string): string {
  switch (role) {
    case "manager":
      return [
        "## Manager Plan",
        "",
        `Task: ${commandText}`,
        "",
        "Producer persona: Producer Lin, responsible for turning a public-domain literary premise into a playable RPG scope.",
        "",
        "Working title: The Knight of Impossible Roads.",
        "",
        "Product promise: a comic-tragic RPG where a self-declared knight reads the ordinary world as epic adventure, and the player decides when illusion protects dignity and when it harms others.",
        "",
        "Target experience:",
        "- 12-15 hour narrative RPG with tactical encounters, travel events, reputation pressure, and companion disagreement.",
        "- Tone alternates between broad comedy, bruised idealism, and quiet social satire.",
        "- The adaptation can use the public-domain premise, but the game should build its own quest structure, NPC arcs, and mechanics.",
        "",
        "Core pillars:",
        "- Delusion as interface: the same object can be shown as mundane reality or chivalric fantasy.",
        "- Honor versus consequence: noble intent can create real damage.",
        "- Companion truth-telling: the squire-like partner grounds the party and challenges dangerous choices.",
        "- Road anthology: each region is a playable novella with recurring systems.",
        "",
        "Scope split:",
        "- Vertical slice: inn hub, windmill field, roadside court, one dream duel, one public consequence scene.",
        "- MVP systems: overworld travel, dialogue choices, fantasy/reality toggle, turn-based combat, reputation ledger, quest journal.",
        "- Defer: mounted traversal physics, full Spain map, romance systems, procedural quests.",
      ].join("\n");
    case "writer":
      return [
        "## Writer Narrative",
        "",
        "Writer persona: Narrative Designer Qiao, focused on playable satire and emotional character arcs.",
        "",
        "Premise:",
        "An aging country gentleman renames himself Sir Alonso of the Impossible Roads after reading too many knightly romances. With a pragmatic neighbor, Sando, he leaves home to restore justice. The world refuses to become a romance, but his belief keeps revealing hidden cruelty that respectable people ignore.",
        "",
        "Main cast:",
        "- Sir Alonso: fragile, brave, absurd, and sometimes dangerous. His class is Errant Knight.",
        "- Sando: farmer, negotiator, cook, and reluctant chronicler. His class is Grounded Squire.",
        "- Alda: a village laborer idealized by Alonso as a distant lady; later she becomes a party adviser who rejects being reduced to a symbol.",
        "- The Barber-Judge: comic antagonist who wants to cure Alonso by staging fake adventures.",
        "- The Mirror Knight: a rival who weaponizes Alonso's fantasies to control him.",
        "",
        "Chapter quests:",
        "1. The Giants of Turning Arms: windmills become giants in Alonso's view. The player can charge, investigate sabotage at the mill, or negotiate with terrified workers.",
        "2. The Castle That Charges Rent: an inn becomes a castle. The quest turns into a dispute about debt, hospitality, and who gets to name reality.",
        "3. The Procession of Enchanters: prisoners, monks, actors, and guards appear as a cursed procession. The player decides whether justice means freeing, judging, or listening.",
        "",
        "Ending branches:",
        "- The Laughing Road: Alonso remains a fool, but villages learn to laugh upward at power instead of downward at weakness.",
        "- The Broken Lance: Alonso accepts reality, loses the fantasy interface, and makes one sober act of repair.",
        "- The New Chivalry: the party rewrites knightly ideals into mutual aid, turning errantry into community defense.",
      ].join("\n");
    case "artist":
      return [
        "## Artist Direction",
        "",
        "Artist persona: Art Director Vega, focused on readable contrast between dust-road realism and painted romance.",
        "",
        "Visual thesis:",
        "Every scene has two art passes: sun-baked rural reality and Alonso's illuminated manuscript fantasy. The game should snap between them with page-turn effects, ink blooms, and trumpet stings.",
        "",
        "Palette:",
        "- Reality: ochre roads, lime-washed walls, faded cloth, hard blue sky, dusty greens.",
        "- Fantasy: gold leaf, lapis, crimson banners, exaggerated shadows, heraldic silhouettes.",
        "- Consequence scenes: desaturated colors, broken props, visible bruises, quiet candlelight.",
        "",
        "Character language:",
        "- Alonso: patched armor, too-thin frame, oversized lance, proud but trembling idle animation.",
        "- Sando: round shapes, practical bags, food props, expressive shoulders.",
        "- Alda: grounded work clothes, strong stance, no saintly glow unless the fantasy overlay is active.",
        "- Mirror Knight: polished armor that reflects the player's current delusion meter.",
        "",
        "UI:",
        "- Reality/Fantasy toggle as a visor icon, not a text button.",
        "- Reputation ledger styled as a travel notebook with stains and marginal jokes.",
        "- Quest map as a stitched road ribbon, with chapter icons for mill, inn, procession, and mirror.",
        "",
        "Animation beats:",
        "- Failed heroic charge should be funny for one second, then show real cost.",
        "- Dialogue portraits subtly shift when fantasy overlay changes NPC identity.",
      ].join("\n");
    case "researcher":
      return [
        "## Researcher Systems",
        "",
        "Researcher persona: Systems Researcher Shen, focused on mechanics that make satire playable.",
        "",
        "Primary mechanic: Chivalric Lens",
        "- The player can view a scene through Reality or Romance.",
        "- Romance reveals courage options, symbolic enemies, and morale buffs.",
        "- Reality reveals practical solutions, social costs, traps, and NPC needs.",
        "- Staying too long in either view creates penalties: Cynicism in Reality, Folly in Romance.",
        "",
        "Combat loop:",
        "- Turn-based party combat with Intent, Guard, Appeal, Improvise, and Charge.",
        "- Enemies often have two identities: Windmill/Giant, Innkeeper/Castellan, Guard/Enchanter.",
        "- Winning by force is possible but often worsens reputation.",
        "- Social victory can end fights by exposing exploitation, apologizing, or staging a better story.",
        "",
        "Exploration loop:",
        "- Travel node -> rumor choice -> lens inspection -> encounter -> consequence ledger.",
        "- Party banter changes based on how often the player indulges Alonso.",
        "- Side quests reward repaired relationships more than loot.",
        "",
        "Progression:",
        "- Alonso gains Virtues: Courage, Mercy, Persistence, Humility.",
        "- Sando gains Practical Arts: Bargain, Cook, Patch, Read the Room.",
        "- Party synergy skills require disagreement first, then reconciliation.",
        "",
        "Balancing target:",
        "- Romance should feel powerful and tempting, not merely wrong.",
        "- Reality should solve problems, but overuse can flatten wonder and lower Alonso's resolve.",
      ].join("\n");
    case "engineer":
      return [
        "## Engineer MVP Build List",
        "",
        "Engineer persona: Gameplay Engineer Ren, focused on shippable implementation slices.",
        "",
        "MVP architecture:",
        "- Data-driven quests in JSON: nodes, lens variants, NPC state, consequence tags.",
        "- Turn-based combat state machine: party, enemies, intents, actions, status effects.",
        "- Chivalric Lens renderer flag: swaps labels, sprites, dialogue lines, and available actions.",
        "- Reputation ledger persisted per settlement.",
        "- Final report exporter for designer-readable quest state.",
        "",
        "First playable slice:",
        "1. One road map with four nodes: Village, Windmill Field, Inn, Procession Road.",
        "2. Two playable characters: Alonso and Sando.",
        "3. Three enemy templates with dual identities.",
        "4. Six actions: Charge, Guard, Appeal, Bargain, Improvise, Retreat.",
        "5. One lens toggle with cooldown and Folly/Cynicism meters.",
        "6. Three quests matching the writer plan.",
        "",
        "Data schema sketch:",
        "- Quest: id, title, nodes, lensText, objectives, consequences.",
        "- Actor: id, displayNameReality, displayNameRomance, stats, actions.",
        "- Encounter: id, actors, winRules, loseRules, socialExitRules.",
        "- LedgerEntry: settlement, tag, severity, text.",
        "",
        "Build checklist:",
        "- Week 1: quest data loader, static UI, lens toggle prototype.",
        "- Week 2: combat state machine and dual-identity enemy display.",
        "- Week 3: dialogue/choice consequences and reputation ledger.",
        "- Week 4: art pass, sound cues, save/load, vertical slice polish.",
      ].join("\n");
    default:
      return `Completed ${role}: ${commandText}`;
  }
}

function renderMacbethRoleResult(role: string, commandText: string): string {
  switch (role) {
    case "manager":
      return [
        "## 制作人方案",
        "",
        `Task: ${commandText}`,
        "",
        "人设：制作人林，负责把公版悲剧改造成可落地的 RPG 项目范围。",
        "",
        "工作标题：灰烬王冠（Crown of Cinders）。",
        "",
        "产品承诺：一款关于野心、预言、罪疚和政治崩塌的黑暗战棋 RPG。每一次胜利都会让王国更难被拯救。",
        "",
        "目标体验：",
        "- 10 到 12 小时叙事战棋 RPG，包含宫廷阴谋、战场选择、超自然压力和道德滑坡分支。",
        "- 玩家从受人敬仰的战功英雄开始，逐步选择抵抗、利用或改写预言。",
        "- 可以使用公版原作前提，但系统、支线阵营和互动结局要做成游戏原创表达。",
        "",
        "核心支柱：",
        "- 预言即任务压力：预言不是命令，但 NPC 和派系会把它当成命令来行动。",
        "- 野心经济：权力解锁强力指令，同时提高疑心、敌对联盟和幻觉事件。",
        "- 血债账本：暴力捷径会留下政治和超自然后果。",
        "- 城堡经营：任命廷臣、布置密探、安排巡逻、处理宴会事故和忠诚危机。",
        "",
        "MVP 切片：",
        "- 一个战场教程、一个荒原预言场景、一个城堡 hub、一个宴会危机、一个围城终局。",
        "- 系统：预言卡、罪疚值、忠诚地图、回合战棋、分支对话、结局结算器。",
      ].join("\n");
    case "writer":
      return [
        "## 叙事设计",
        "",
        "人设：叙事设计乔，负责把悲剧结构改成可玩选择和派系压力。",
        "",
        "故事前提：",
        "将军梅尔从战场归来，进入一个分裂的北境王国。三位披灰先知许诺他终将戴上王冠，但他越想保障未来，就越制造毁掉未来的恐惧。他的伴侣莉莎会随玩家选择成为战略家、良知，或共犯。",
        "",
        "主要角色：",
        "- 梅尔：老练统帅，可操作君主，职业为血冠领主。",
        "- 莉莎：政治伴侣，职业为银舌摄政。",
        "- 班里克：忠诚战友，其后代会成为预言目标。",
        "- 凯尔：流亡王子，正在集结外援和本地反对派。",
        "- 灰烬三姊妹：她们不只说谜语，还直接改变机制规则。",
        "",
        "三章任务：",
        "1. 三灰荒原：战胜归来后，选择隐藏、公开或武器化预言。",
        "2. 空椅宴会：幻觉与宫廷猜疑在公开宴会上爆发，玩家必须压住恐慌却不能坐实罪名。",
        "3. 行军之林：森林变成战棋地图，叛军利用伪装、谣言和移动掩体逼近城堡。",
        "",
        "结局分支：",
        "- 铁之冠：梅尔靠恐惧维持权力，王国活下来，但变成牢笼。",
        "- 灰之冠：预言完成，建立在谋杀上的一切被烧尽。",
        "- 拒冠：玩家通过自白、退位，或把终战变成公开审判来打断循环。",
      ].join("\n");
    case "artist":
      return [
        "## 美术指导",
        "",
        "人设：美术指导维加，负责舞台悲剧感、战场泥泞感和超自然侵入感。",
        "",
        "视觉命题：",
        "游戏像一座被湿冷战场吞没的烛光舞台。现实是铁、泥、羊毛和烟；预言是白灰、不可能的月光和红线。",
        "",
        "色彩：",
        "- 战争：黑铁、泥炭褐、雨蓝、火把橙。",
        "- 宫廷：暗金、深绒、血红、骨白。",
        "- 超自然：灰白、病绿、月银、红线色。",
        "",
        "关键场景：",
        "- 被雷雨打穿的荒原，浅水里倒映三轮月亮。",
        "- 城堡 hub：作战室、礼拜堂、宴会厅、城垛和私人寝室。",
        "- 移动森林战场，树枝在雾中变成敌军轮廓。",
        "- 宴会场景里，空椅子的光比活人更强。",
        "",
        "UI 母题：",
        "- 预言卡是被雨水泡烂的羊皮纸。",
        "- 血债账本是王室账簿，墨迹会逐渐变红。",
        "- 罪疚值用角色头像周围忽明忽暗的烛火表现。",
        "",
        "动画：",
        "- 疑心上升时，梅尔待机姿势越来越僵硬。",
        "- 共犯路线加深后，莉莎头像从温和建议转为冷静命令。",
        "- 幻觉先闪现几帧，然后变成可交互威胁。",
      ].join("\n");
    case "researcher":
      return [
        "## 系统研究",
        "",
        "人设：系统研究员沈，负责让悲剧主题变成可读、可平衡的玩法机制。",
        "",
        "主机制：预言压力",
        "- 每条预言是一张卡，包含触发条件、诱惑奖励和公开流言等级。",
        "- 主动推动预言会获得权力，但提高罪疚和疑心。",
        "- 无视预言能保持稳定，但敌对派系会替玩家解释它。",
        "- 打破预言需要付出真相、牺牲或联盟代价。",
        "",
        "战斗循环：",
        "- 格子战棋，包含统帅光环、士气、天气和恐惧状态。",
        "- 梅尔可使用王令强化友军，但消耗忠诚。",
        "- 罪疚会在战斗中召出幻觉敌人；击败它们不一定解决政治问题。",
        "- 非致命胜利能保留合法性，并解锁自白路线。",
        "",
        "宫廷循环：",
        "- 任命议会职位、举办宴会、审问密探、赦免对手、管理流言。",
        "- 每次谋杀都会生成血债账本条目，记录目击者、受益者和闹鬼风险。",
        "- 莉莎的建议会随玩家奖励实用主义、仁慈或保密而变化。",
        "",
        "成长：",
        "- 梅尔路线：统帅、篡位者、忏悔者。",
        "- 莉莎路线：外交家、设计者、破谶者。",
        "- 王国轨道：忠诚、恐惧、饥荒、叛军势头。",
      ].join("\n");
    case "engineer":
      return [
        "## 玩法工程清单",
        "",
        "人设：玩法工程师任，负责把设计拆成可实现的垂直切片。",
        "",
        "MVP 架构：",
        "- 任务数据：预言卡、场景节点、派系反应、结局标记。",
        "- 战棋状态机：格子、单位、先攻、天气、士气、幻觉刷怪。",
        "- 宫廷经营状态：顾问、忠诚值、流言队列、血债账本。",
        "- 存档数据：章节、预言状态、罪疚/疑心、派系忠诚、杀死/放过的角色。",
        "- 最终输出后生成 game-preview.html，并由 Chromium/Chrome 打开。",
        "",
        "第一可玩切片：",
        "1. 战斗教程：梅尔击败叛军并获得第一条预言。",
        "2. 城堡 hub：三个议会决策和一段莉莎私人场景。",
        "3. 宴会危机：对话和战棋混合，加入幻觉压力。",
        "4. 森林行军终局：移动掩体战棋地图和结局结算。",
        "",
        "数据结构草案：",
        "- ProphecyCard：id、文本、触发条件、推动奖励、抵抗代价、流言影响。",
        "- Unit：id、职业、属性、士气、忠诚、状态、技能。",
        "- CourtEvent：id、出席者、选项、派系影响、血债账本条目。",
        "- EndingState：王冠状态、罪疚等级、叛乱等级、自白标记。",
        "",
        "实现清单：",
        "- 第 1 周：数据加载器、场景渲染器、预言卡 UI。",
        "- 第 2 周：格子战棋原型和士气/恐惧效果。",
        "- 第 3 周：宫廷循环、血债账本、幻觉事件。",
        "- 第 4 周：Chromium 游戏预览、存读档、垂直切片打磨。",
      ].join("\n");
    default:
      return `Completed ${role}: ${commandText}`;
  }
}

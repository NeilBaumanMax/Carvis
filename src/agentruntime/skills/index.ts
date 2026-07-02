import type { AgentRole } from "../../shared/types/agent.js";

export interface AgentSkill {
  name: string;
  purpose: string;
  playbook: string[];
  handoff: string;
  qualityGate: string;
}

export interface AgentSkillProfile {
  role: AgentRole;
  title: string;
  skills: AgentSkill[];
  consumes: string[];
  produces: string[];
  collaborationRule: string;
}

export type TaskSkillId =
  | "galgame"
  | "platformer"
  | "shop-autobattler"
  | "repo-doc"
  | "generic-game";

export const AGENT_SKILL_PROFILES: Record<AgentRole, AgentSkillProfile> = {
  manager: {
    role: "manager",
    title: "运行监控技能包",
    consumes: ["用户任务原文", "各角色运行状态", "provider/PID 异常", "输出路径"],
    produces: ["短任务边界", "异常监控摘要", "恢复建议", "交给 engineer 的风险清单"],
    collaborationRule: "manager 只做短任务边界和运行监控，不做长篇复审；发现异常时标记问题和恢复建议，正常差异交给 engineer 合并。",
    skills: [
      {
        name: "Monitor Scope Card",
        purpose: "把开放任务压缩成一张短任务卡，方便其他角色立刻并行启动。",
        playbook: [
          "列出必须出现的玩家动作、产物文件和可验收画面。",
          "把文学/玩法灵感拆成 3 个以内核心支柱。",
          "用极短字段写出 writer/artist/researcher/engineer 的执行边界。",
          "明确哪些内容延期，避免团队扩散到只写设定。",
        ],
        handoff: "给 engineer 提供任务边界、硬性验收和异常风险，不阻塞其他角色并行工作。",
        qualityGate: "输出控制在短结构化合同内，不能写长篇复审。",
      },
      {
        name: "Runtime Watcher",
        purpose: "监控角色是否空输出、超时、provider 失败或资产缺失。",
        playbook: [
          "只把 PROVIDER_ERROR、空文件、伪工具调用、明显偷懒列为异常。",
          "命名、数值、路径建议等可整合差异不打回，由 engineer 统一。",
          "如果 PID 超时或 provider 失败，记录需要 runtime 重试/复活 worker。",
          "如果 artist 资产缺失，提醒 engineer 使用可见 fallback，但不伪造路径。",
        ],
        handoff: "输出异常摘要和恢复建议，供 engineer 决定是否继续集成。",
        qualityGate: "必须区分阻塞异常和可整合差异。",
      },
      {
        name: "Recovery Reporter",
        purpose: "把坏掉的角色或 PID 恢复要求写清楚。",
        playbook: [
          "记录哪个角色坏了、坏在哪里、engineer 是否还能继续。",
          "写清楚复活/重试后的最小补救要求。",
          "不重复 writer/artist/researcher 的完整正文。",
        ],
        handoff: "给 engineer 一份短恢复摘要；最终审核和生产由 engineer 合并执行。",
        qualityGate: "不得输出第二份长审核报告。",
      },
    ],
  },
  writer: {
    role: "writer",
    title: "叙事落地技能包",
    consumes: ["manager 的范围和版权边界", "researcher 的核心机制", "artist 的视觉母题"],
    produces: ["故事前提", "角色弧线", "场景数据", "对白/选择样例", "结局文本"],
    collaborationRule: "叙事必须能驱动玩法选择，不能只写背景介绍；每个场景都要有冲突、选择、后果和可直接放进 UI 的中文文本。",
    skills: [
      {
        name: "Playable Narrative Bible",
        purpose: "把题材转成可执行的叙事圣经。",
        playbook: [
          "定义主角欲望、阻力、代价和可互动目标。",
          "每个章节都写玩家要做什么，而不是只写发生了什么。",
          "每个章节必须有一个具体角色或事件推动矛盾，避免抽象主题独白。",
          "保留主题气质，避开受保护角色、情节和独特表达。",
        ],
        handoff: "给 artist 场景/角色关键词，给 engineer 任务节点。",
        qualityGate: "至少 3 个章节任务，每个任务都有玩家选择和后果。",
      },
      {
        name: "Choice Writer",
        purpose: "设计会改变状态的选择和对白。",
        playbook: [
          "每个关键选择绑定一个数值、关系或地图状态变化。",
          "对白要短，能直接放入游戏 UI。",
          "每个场景至少写 2 句角色对白、1 句旁白和 2 个选择后果。",
          "避免只给道德说教，必须给玩家可执行选项。",
        ],
        handoff: "把选择标签交给 researcher 平衡，把文本交给 engineer 数据化。",
        qualityGate: "至少 4 个选择节点包含条件、选项、后果，并提供可直接嵌入 HTML 的文本。",
      },
      {
        name: "Route Stitcher",
        purpose: "把分支线缝回同一个可交付 MVP。",
        playbook: [
          "限制分支爆炸，每个分支回到共享地点或共享结算。",
          "为不同路线保留独特反馈，而不是复制同一段文本。",
          "至少写 2 个风格明显不同的结局，不允许只改标题。",
          "把结局条件写成可检测状态。",
        ],
        handoff: "给 engineer 提供结局判定字段和回收节点。",
        qualityGate: "结局条件必须能由游戏状态字段判断。",
      },
    ],
  },
  artist: {
    role: "artist",
    title: "视觉与素材技能包",
    consumes: ["writer 的角色和场景", "researcher 的机制反馈", "engineer 的 UI 尺寸限制"],
    produces: ["视觉风格", "资产清单", "生成提示词", "UI/动画规范"],
    collaborationRule: "美术输出以图片资产为主，文字只保留工程需要的信息；不要写长篇剧情和设定。",
    skills: [
      {
        name: "Art Bible Synthesizer",
        purpose: "建立统一视觉语言，避免每个场景风格断裂。",
        playbook: [
          "定义主色、辅助色、形状语言和镜头距离。",
          "给角色、场景、UI 分别写可复用规则。",
          "总文字保持精简，优先服务后续生图工具。",
          "说明哪些元素不能照搬已有作品。",
        ],
        handoff: "给 engineer 提供 CSS/Canvas 可执行的色彩和布局约束。",
        qualityGate: "必须包含 palette、角色轮廓、场景构图、UI 母题。",
      },
      {
        name: "Asset Generation Brief",
        purpose: "把美术方向拆成可生成或手工实现的资产列表。",
        playbook: [
          "列出背景、角色、道具、卡牌/按钮、图标和动效需求。",
          "每个资产写尺寸、用途、透明背景需求和生成提示。",
          "角色、敌人、伙伴、单位、头像、立绘、sprite、道具等可叠加资产必须标注：透明背景 PNG、无场景背景、抠图边缘干净、主体完整。",
          "背景、标题页、地图和场景资产必须标注横向 16:9 或宽屏构图，并留出 UI 安全区。",
          "流程图、徽章、卡牌、按钮、图标等 UI 资产按用途选择横向、竖向或细长比例，不要默认正方形。",
          "优先规划 2-4 张会被最终 HTML 真实引用的关键图，除非主管明确要求更多。",
          "优先支持 MVP 中会真实显示的资产。",
        ],
        handoff: "给 engineer manifest 和预览页使用的素材规格。",
        qualityGate: "资产清单必须标注用途、文件名建议和优先级。",
      },
      {
        name: "Readable Screen Director",
        purpose: "保证 1000x640 和 1280x720 屏幕上界面可读。",
        playbook: [
          "控制文本密度，避免卡片互相遮挡。",
          "定义关键 UI 区域的最小尺寸和滚动策略。",
          "给输出面板、预览页和游戏 HUD 留出清晰层级。",
        ],
        handoff: "给 engineer 具体布局约束和断点要求。",
        qualityGate: "预览页必须在 1000x640 内展示核心画面和交互。",
      },
    ],
  },
  researcher: {
    role: "researcher",
    title: "系统与验证技能包",
    consumes: ["manager 的产品支柱", "writer 的选择节点", "engineer 的实现成本"],
    produces: ["核心循环", "数值/状态字段", "风险清单", "平衡规则"],
    collaborationRule: "研究输出必须把主题翻译成玩家行为和可检测状态。",
    skills: [
      {
        name: "Mechanic Translator",
        purpose: "把题材主题翻译成可玩的规则。",
        playbook: [
          "为每个主题找一个玩家动作、一个奖励和一个代价。",
          "明确核心循环的进入、决策、反馈和升级。",
          "避免只写灵感分析，必须写规则字段。",
        ],
        handoff: "给 writer 选择后果，给 engineer 状态机字段。",
        qualityGate: "至少定义 1 个主循环、3 个状态字段和 3 个反馈事件。",
      },
      {
        name: "Balance Table Maker",
        purpose: "为卡牌、RPG、galgame 或探索系统建立基础数值表。",
        playbook: [
          "定义资源、行动成本、成长节奏和失败恢复。",
          "给出小规模 MVP 数值，不追求完整商业平衡。",
          "指出最可能破坏体验的数值风险。",
        ],
        handoff: "给 engineer 提供可直接编码的数据表。",
        qualityGate: "必须包含初始值、变化范围、失败条件和调参建议。",
      },
      {
        name: "Playtest Heuristic",
        purpose: "提前指出原型最容易失败的地方。",
        playbook: [
          "检查玩家是否 30 秒内知道目标。",
          "检查选择是否有明显反馈。",
          "检查内容是否真的会生成文件和预览，而不是停留在报告。",
        ],
        handoff: "给 manager 验收风险，给 engineer smoke 用例。",
        qualityGate: "必须给出 3 条可执行 playtest 检查。",
      },
    ],
  },
  engineer: {
    role: "engineer",
    title: "审核集成与实现技能包",
    consumes: ["manager 的监控摘要", "writer 的任务数据", "artist 的真实资产", "researcher 的状态机"],
    produces: ["数据结构", "实现切片", "预览文件", "测试命令"],
    collaborationRule: "engineer 同时负责审核、冲突合并和最终生产；只在上游为空、provider 失败或缺少关键产物时拒绝集成。",
    skills: [
      {
        name: "Vertical Slice Builder",
        purpose: "把方案切成一个最小可运行版本。",
        playbook: [
          "选一个地点、一个循环、一个胜负/结局作为第一切片。",
          "明确哪些数据硬编码，哪些进入 JSON/manifest。",
          "保证浏览器能打开预览并看到主要交互。",
        ],
        handoff: "把实现切片反馈给 manager 决策是否过大。",
        qualityGate: "必须包含文件结构、运行入口和首个可玩循环。",
      },
      {
        name: "Integration Contract",
        purpose: "把叙事、美术、系统合并成统一数据契约。",
        playbook: [
          "定义 scene、actor、choice、asset、state 字段。",
          "说明每个字段来自哪个角色输出。",
          "让 preview/report/manifest 使用同一组名字。",
        ],
        handoff: "给所有角色一份共同命名表，减少结果漂移。",
        qualityGate: "必须列出数据字段、来源角色和消费位置。",
      },
      {
        name: "Smoke Harness",
        purpose: "给最终产物留下可重复验证方法。",
        playbook: [
          "列出构建命令、workspace 检查、输出文件检查和浏览器预览检查。",
          "写明 NixOS systemd 重启后的验证顺序。",
          "记录失败时看哪个日志或文件。",
        ],
        handoff: "给 manager 和下一轮 Codex 接力使用。",
        qualityGate: "必须包含本地和 NixOS 两套验证命令。",
      },
    ],
  },
};

export function getAgentSkillProfile(role: AgentRole): AgentSkillProfile {
  return AGENT_SKILL_PROFILES[role];
}

export function renderAgentSkillMarkdown(role: AgentRole): string {
  const profile = getAgentSkillProfile(role);

  return [
    `# ${profile.title}`,
    "",
    `Role: ${profile.role}`,
    "",
    "## Collaboration Rule",
    "",
    profile.collaborationRule,
    "",
    "## Consumes",
    "",
    ...profile.consumes.map((item) => `- ${item}`),
    "",
    "## Produces",
    "",
    ...profile.produces.map((item) => `- ${item}`),
    "",
    "## Installed Skills",
    "",
    ...profile.skills.flatMap((skill, index) => [
      `### ${index + 1}. ${skill.name}`,
      "",
      `Purpose: ${skill.purpose}`,
      "",
      "Playbook:",
      ...skill.playbook.map((item) => `- ${item}`),
      "",
      `Handoff: ${skill.handoff}`,
      "",
      `Quality gate: ${skill.qualityGate}`,
      "",
    ]),
  ].join("\n");
}

export function renderAgentCommonMarkdown(role: AgentRole): string {
  const profile = getAgentSkillProfile(role);

  return [
    `# ${profile.title} Common`,
    "",
    "## 通用强制约束",
    "",
    "- 输出语言必须是中文，技术文件名和必要 API 名可以保留英文。",
    "- 不输出隐藏思考过程，只输出可公开的工作结果、检查清单、文件方案和必要代码。",
    "- 不要求用户替你执行命令；本角色必须直接给出可交付正文。",
    "- 必须紧贴用户任务，不得套用与任务无关的固定模板。",
    "- 必须显式引用本轮任务的题材、产物类型、素材要求和验收标准。",
    "",
    "## 角色设定",
    "",
    `Role: ${profile.role}`,
    `Title: ${profile.title}`,
    `Collaboration Rule: ${profile.collaborationRule}`,
    "",
    "## 消费输入",
    "",
    ...profile.consumes.map((item) => `- ${item}`),
    "",
    "## 必须产出",
    "",
    ...profile.produces.map((item) => `- ${item}`),
    "",
    "## Skills 使用规则",
    "",
    "- `skills/` 中每个 md 是一个特定任务类型的思维文件。",
    "- 先根据用户任务选择最贴近的 task skill，再结合 common 约束输出。",
    "- 如果任务类型不匹配，使用 `generic-game.md` 或 manager 给出的 task_type，不要强行套模板。",
    "- 输出必须包含给下游角色使用的 `handoff_to_next` 或等价结构化小节。",
    "",
  ].join("\n");
}

export function renderTaskSkillMarkdown(role: AgentRole, skillId: TaskSkillId): string {
  const heading = taskSkillTitle(skillId);
  const roleLine = roleTaskGuidance(role, skillId);

  return [
    `# ${heading}`,
    "",
    `Role: ${role}`,
    "",
    "## 任务识别",
    "",
    taskSkillDetection(skillId),
    "",
    "## 本角色工作重点",
    "",
    ...roleLine.map((line) => `- ${line}`),
    "",
    "## 结构化交付字段",
    "",
    ...taskSkillFields(role, skillId).map((line) => `- ${line}`),
    "",
    "## 质量门禁",
    "",
    ...taskSkillGates(role, skillId).map((line) => `- ${line}`),
    "",
  ].join("\n");
}

export function renderSelectedTaskSkillMarkdown(role: AgentRole, commandText: string): string {
  return renderTaskSkillMarkdown(role, classifyTaskSkill(commandText));
}

export function classifyTaskSkill(commandText: string): TaskSkillId {
  if (/galgame|视觉小说|分支|选择|结局/i.test(commandText)) {
    return "galgame";
  }
  if (/闯关|平台|platform|跳跃|碰撞|wasd|方向键/i.test(commandText)) {
    return "platformer";
  }
  if (/bazaar|商店|自动战斗|物品组合|roguelike|构筑/i.test(commandText)) {
    return "shop-autobattler";
  }
  if (/github|仓库|脚手架|目录|文件用途|repo|README/i.test(commandText)) {
    return "repo-doc";
  }
  if (/游戏|game|rpg|卡牌/i.test(commandText)) {
    return "generic-game";
  }

  return "repo-doc";
}

function taskSkillTitle(skillId: TaskSkillId): string {
  const titles: Record<TaskSkillId, string> = {
    galgame: "Galgame / 视觉小说任务 skill",
    platformer: "冒险闯关 / 平台动作任务 skill",
    "shop-autobattler": "商店构筑 / 自动战斗任务 skill",
    "repo-doc": "仓库分析 / HTML 文档展示任务 skill",
    "generic-game": "通用游戏原型任务 skill",
  };

  return titles[skillId];
}

function taskSkillDetection(skillId: TaskSkillId): string {
  const detections: Record<TaskSkillId, string> = {
    galgame: "用户要求 galgame、视觉小说、选择分支、结局、文学作品改编或强剧情互动。",
    platformer: "用户要求冒险闯关、平台跳跃、键盘移动、碰撞、收集、敌人巡逻或关卡。",
    "shop-autobattler": "用户要求商店经营、物品组合、自动战斗、经济抉择、roguelike 成长或 The Bazaar 类玩法。",
    "repo-doc": "用户要求整理 GitHub 仓库、脚手架、目录结构、文件用途、安装命令并用 HTML 展示。",
    "generic-game": "用户要求游戏但没有明确子类型，优先做一个最小可玩的浏览器原型。",
  };

  return detections[skillId];
}

function roleTaskGuidance(role: AgentRole, skillId: TaskSkillId): string[] {
  const shared: Record<TaskSkillId, string[]> = {
    galgame: [
      "保留原题材核心意象，换成原创人物、地点和表达，禁止只换成无关科幻/赛博外壳。",
      "必须服务选择、状态和结局，而不是只写设定。",
    ],
    platformer: [
      "优先定义玩家能执行的移动、跳跃、收集、躲避、重试和通关反馈。",
      "关卡必须短小可玩，避免只写故事报告。",
    ],
    "shop-autobattler": [
      "优先形成商店购买、物品槽位、经济刷新、自动战斗、胜负结算的闭环。",
      "不得复制 The Bazaar 的角色、物品名、图标风格、UI 布局或数值表。",
    ],
    "repo-doc": [
      "只做准确文档展示，不得套用游戏剧情、关卡、结局模板。",
      "必须说明数据来源、目录职责、脚手架流程和关键文件用途。",
    ],
    "generic-game": [
      "先做最小可玩循环，再扩展故事和美术。",
      "必须有清晰开始、交互、反馈、结束或重开。",
    ],
  };
  const byRole: Record<AgentRole, string> = {
    manager: "输出短任务边界、异常监控点和恢复建议，不做长篇复审。",
    writer: "输出能直接进 UI 的中文文本、角色动机、事件、选择后果和失败/胜利反馈。",
    artist: "少写长文，优先规划并生成会被最终 HTML 真实引用的图片资产。",
    researcher: "把任务翻译成状态字段、数据表、循环、平衡和可测试规则。",
    engineer: "合并审核、冲突统一和最终生产，输出可打开的单文件 HTML，避免黑屏。",
  };

  return [byRole[role], ...shared[skillId]];
}

function taskSkillFields(role: AgentRole, skillId: TaskSkillId): string[] {
  if (role === "engineer") {
    return [
      "`implementation_plan`: 最小可运行切片",
      "`asset_refs`: 实际使用的 assets 相对路径",
      "`state_model`: JS 状态字段",
      "`acceptance_notes`: 如何验证 HTML 可玩/可读",
    ];
  }
  if (role === "artist") {
    return ["`asset_plan`", "`generated_or_expected_assets`", "`style_rules`", "`self_review`"];
  }
  if (role === "researcher") {
    return ["`state_schema`", "`core_loop`", "`data_tables`", "`playtest_checks`"];
  }
  if (role === "writer") {
    return skillId === "repo-doc"
      ? ["`page_sections`", "`explanatory_copy`", "`terminology`", "`handoff_to_engineer`"]
      : ["`characters`", "`scenes_or_levels`", "`choices_or_events`", "`endings_or_feedback`", "`handoff_to_engineer`"];
  }

  return ["`task_type`", "`monitoring_points`", "`blocking_risks`", "`handoff_to_engineer`"];
}

function taskSkillGates(role: AgentRole, skillId: TaskSkillId): string[] {
  const gates = [
    "必须输出足够下游角色执行的具体字段，不得只有泛泛建议。",
    "必须保留用户任务的题材和交付格式。",
  ];

  if (skillId === "shop-autobattler") {
    gates.push("必须包含商店、物品、敌人、经济、自动战斗和结算闭环。");
  }
  if (skillId === "platformer") {
    gates.push("必须包含键盘控制、碰撞/收集、关卡目标、失败和重试。");
  }
  if (skillId === "galgame") {
    gates.push("必须包含选择节点、状态变化、结局条件和足够中文对白。");
  }
  if (skillId === "repo-doc") {
    gates.push("必须包含目录结构、文件用途、脚手架命令、风险和数据来源。");
  }
  if (role === "engineer") {
    gates.push("最终必须输出 fenced HTML，且 JS 语法可检查。");
  }

  return gates;
}

export function renderAgentPlanMarkdown(role: AgentRole): string {
  const profile = getAgentSkillProfile(role);

  return [
    "# Plan",
    "",
    `角色技能包：${profile.title}`,
    "",
    "## 本轮执行顺序",
    "",
    "1. 读取 `input.md`、`common/*.md` 和匹配任务类型的 `skills/*.md`。",
    "2. 先引用上游角色输入，再写本角色产物。",
    "3. 使用 common 约束和 task skill 逐项检查结果。",
    "4. 把可交付内容写入 `result.md`，不要只写状态。",
    "5. 产物末尾写 `handoff_to_next`，方便分层压缩和下游集成。",
    "",
    "## 已安装 Skills",
    "",
    ...profile.skills.map((skill, index) => `${index + 1}. ${skill.name}：${skill.purpose}`),
    "",
    "## 协作输入",
    "",
    ...profile.consumes.map((item) => `- ${item}`),
    "",
    "## 必须产出",
    "",
    ...profile.produces.map((item) => `- ${item}`),
    "",
    "## 质量门槛",
    "",
    ...profile.skills.map((skill) => `- ${skill.name}: ${skill.qualityGate}`),
    "",
  ].join("\n");
}

export function renderAgentSkillProgressLines(role: AgentRole): string[] {
  const profile = getAgentSkillProfile(role);

  return [
    `已安装技能包=${profile.title}`,
    ...profile.skills.map((skill, index) => `加载 skill ${index + 1}/3：${skill.name} -> ${skill.purpose}`),
    `协作规则=${profile.collaborationRule}`,
    `需要消费=${profile.consumes.join(" / ")}`,
    `必须产出=${profile.produces.join(" / ")}`,
    ...profile.skills.map((skill) => `验收门槛[${skill.name}]=${skill.qualityGate}`),
  ];
}

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

export const AGENT_SKILL_PROFILES: Record<AgentRole, AgentSkillProfile> = {
  manager: {
    role: "manager",
    title: "制作统筹技能包",
    consumes: ["用户任务原文", "各角色的风险和资源请求", "工程验收状态"],
    produces: ["范围切分", "优先级", "验收清单", "跨角色依赖表"],
    collaborationRule: "先定义共同目标和不可做边界，再把每个角色的产物连成同一个可玩版本。",
    skills: [
      {
        name: "Scope Producer",
        purpose: "把开放任务压缩成能在本轮交付的可玩 MVP。",
        playbook: [
          "列出必须出现的玩家动作、产物文件和可验收画面。",
          "把文学/玩法灵感拆成 3 个以内核心支柱。",
          "明确哪些内容延期，避免团队扩散到只写设定。",
        ],
        handoff: "给 writer/researcher/engineer 提供同一份 MVP 目标和裁剪边界。",
        qualityGate: "最终报告必须包含可玩循环、产物位置和验收步骤。",
      },
      {
        name: "Dependency Mapper",
        purpose: "让五个角色形成上下游关系，而不是并排独白。",
        playbook: [
          "声明 writer 需要 researcher 的系统钩子。",
          "声明 artist 需要 writer 的场景和 engineer 的实现限制。",
          "声明 engineer 必须整合所有角色输出成一个文件夹产物。",
        ],
        handoff: "输出跨角色依赖表，要求后续角色引用上游决定。",
        qualityGate: "每个角色结果至少引用一个其他角色的输入。",
      },
      {
        name: "Acceptance Director",
        purpose: "把任务完成标准转成测试和交付清单。",
        playbook: [
          "定义浏览器可打开的预览、报告内容和资产清单。",
          "检查版权安全、中文输出、屏幕可读性和文件完整性。",
          "把失败条件写清楚，方便返工。",
        ],
        handoff: "把验收清单交给 engineer 作为最后集成标准。",
        qualityGate: "没有预览 HTML、manifest、角色结果或测试记录时不得标记完成。",
      },
    ],
  },
  writer: {
    role: "writer",
    title: "叙事落地技能包",
    consumes: ["manager 的范围和版权边界", "researcher 的核心机制", "artist 的视觉母题"],
    produces: ["故事前提", "角色弧线", "任务节点", "对白/选择样例"],
    collaborationRule: "叙事必须能驱动玩法选择，不能只写背景介绍。",
    skills: [
      {
        name: "Playable Narrative Bible",
        purpose: "把题材转成可执行的叙事圣经。",
        playbook: [
          "定义主角欲望、阻力、代价和可互动目标。",
          "每个章节都写玩家要做什么，而不是只写发生了什么。",
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
          "避免只给道德说教，必须给玩家可执行选项。",
        ],
        handoff: "把选择标签交给 researcher 平衡，把文本交给 engineer 数据化。",
        qualityGate: "至少 4 个选择节点包含条件、选项、后果。",
      },
      {
        name: "Route Stitcher",
        purpose: "把分支线缝回同一个可交付 MVP。",
        playbook: [
          "限制分支爆炸，每个分支回到共享地点或共享结算。",
          "为不同路线保留独特反馈，而不是复制同一段文本。",
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
    collaborationRule: "美术输出必须能变成资产和界面，不只写氛围词。",
    skills: [
      {
        name: "Art Bible Synthesizer",
        purpose: "建立统一视觉语言，避免每个场景风格断裂。",
        playbook: [
          "定义主色、辅助色、形状语言和镜头距离。",
          "给角色、场景、UI 分别写可复用规则。",
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
    title: "实现与集成技能包",
    consumes: ["manager 的验收清单", "writer 的任务数据", "artist 的资产规格", "researcher 的状态机"],
    produces: ["数据结构", "实现切片", "预览文件", "测试命令"],
    collaborationRule: "工程输出要把其他角色成果集成成可打开的产物，而不是另写一份设定。",
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

export function renderAgentPlanMarkdown(role: AgentRole): string {
  const profile = getAgentSkillProfile(role);

  return [
    "# Plan",
    "",
    `角色技能包：${profile.title}`,
    "",
    "## 本轮执行顺序",
    "",
    "1. 读取 `input.md` 和本文件同目录的 `skill.md`。",
    "2. 先引用上游角色输入，再写本角色产物。",
    "3. 使用 3 个已安装 skill 逐项检查结果。",
    "4. 把可交付内容写入 `result.md`，不要只写状态。",
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

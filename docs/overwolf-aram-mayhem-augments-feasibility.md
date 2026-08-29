# 参考 Overwolf 实时获取海克斯大乱斗强化符文的可行性与改造方案

> 评估日期：2026-08-29
>
> 评估范围：LeaguePilot 在 Windows 上实时获取海克斯大乱斗（ARAM: Mayhem，项目内模式标识为 `KIWI`）当前三选一强化符文与已选结果。
>
> 本文是改造参考，不包含业务代码实现，也不把未经证实的 Overwolf 内部实现当作事实。
>
> **2026-08-29 产品决策：** Overwolf / OW-Electron 方案暂时搁置。普通 Electron 构建不再展示 Overwolf 不可用提示。历史海克斯统计改走 [arammeta](https://arammeta.com/) 公开聚合数据；实时三选一走 Live Client 等级门控 + 主屏截图 + kiwi 图标 dHash（参考 [mayhem-overlay](https://github.com/zp96-cmd/mayhem-overlay) 与 [Mayhempedia BRAINSTORM](https://github.com/boxsbraindump/Mayhempedia/blob/main/BRAINSTORM.md)），不走 GEP。

## 1. 结论

### 1.1 总体判断

方案**有条件可行，建议先做受控 POC，不建议立即合入正式版**。

可行的方案是：保留 LeaguePilot 现有普通 Electron 构建，同时增加一个基于 **Overwolf Electron（OW-Electron）** 的 Windows 构建变体，在 OW-Electron 运行时订阅 GEP 的 `augments` feature，再把事件转换成 LeaguePilot 自己的稳定领域模型。

不成立或不建议的方案是：

- 普通 Electron 运行时直接安装一个 npm 包就调用 GEP。GEP API 挂载在 OW-Electron fork 提供的 `app.overwolf.packages.gep` 上，不是独立于运行时的普通 SDK。
- 根据 Overwolf 输出反推出某个 Riot HTTP 接口。官方 Live Client Data API 当前文档没有三选一强化符文 offer；Overwolf 只公开消费 API，没有公开 LoL GEP 采集核心。
- 读取游戏进程内存、注入自研 DLL 或复刻 Overwolf 的闭源 provider。Riot 明确表示 Vanguard 环境下不允许外部工具读取内存，这条路线同时带来封号、兼容性和持续维护风险。
- 未经合规确认直接上线“根据实时三个选项给出最佳选择”。Riot 当前 League of Legends 产品政策明确列出：不能展示 Augment 胜率，不能提供玩家原本不知道的局内信息，也不能替玩家做决定。

因此应把目标拆成两个独立能力：

1. **实时识别与展示**：读取玩家屏幕上已经可见的三个选项和刚刚选择的结果。技术上可做 POC。
2. **实时推荐**：根据胜率、英雄、阵容和已选强化符文给出选择建议。产品合规性尚未成立，必须先获得 Riot Developer Relations 与 Overwolf 的书面确认。

### 1.2 可行性矩阵

| 方案                                     | 技术可行性   | 合规/发布风险                    | 结论                                      |
| ---------------------------------------- | ------------ | -------------------------------- | ----------------------------------------- |
| OW-Electron + 官方 GEP `augments`        | 高           | 中到高，取决于产品表现形式和审核 | 推荐做 POC                                |
| 普通 Electron 直接消费 GEP               | 低           | 高                               | 不采用                                    |
| Riot Live Client Data API（2999）        | 当前不足     | 低                               | 保留为未来候选，不作为当前主方案          |
| LCU/SGP 推测或枚举未知 endpoint          | 未证实且脆弱 | 高                               | 不作为交付方案                            |
| OCR 识别屏幕                             | 中           | 中                               | 仅可作为独立实验，不作为第一阶段 fallback |
| 自研注入、读内存、逆向 Overwolf provider | 技术代价极高 | 极高                             | 禁止进入实现范围                          |

## 2. 已确认事实与尚未确认事项

### 2.1 已确认事实

1. Overwolf 的 LoL GEP 文档列出了 `augments` feature，从 GEP 299.0 开始提供两个 info update：
   - `augments`：ARAM Mayhem 当前可选强化符文列表；
   - `picked_augment`：玩家最后选择的强化符文。
2. 官方样例值只给出英文名称，没有给出稳定数值 ID：

   ```json
   {
     "gameId": 5426,
     "feature": "augments",
     "category": "me",
     "key": "augments",
     "value": "{\"augment_1\":{\"name\":\"Scopier Weapons\"},\"augment_2\":{\"name\":\"Rabble Rousing\"},\"augment_3\":{\"name\":\"Soul Eater\"}}"
   }
   ```

3. 2026-08-29 查询 Overwolf 官方事件健康接口时，LoL 游戏 ID `5426` 的 `augments` feature、`augments` key 和 `picked_augment` key 均为已发布且状态正常（`state: 1`）。事件状态会随游戏补丁变化，不能把这次检查当成永久保证。
4. GEP 的 info update 是可查询的持续状态；应用既应监听 `new-info-update`，也应在启动、中途接入或重连时调用 `getInfo(gameId)` 恢复当前状态。
5. GEP 默认不监听任何 feature。应用必须尽早调用 `setRequiredFeatures(['augments'])`；注册太晚可能丢失事件或得到不可靠数据。
6. Overwolf 官方说明 OW-Electron 是 Electron fork，普通 Electron 与 OW-Electron 可以在同一代码库中并存并形成不同构建。
7. OW-Electron 的 GEP、Overlay 等 gaming package 需要开发者申请、应用登记、开发凭据和发布签名；没有有效凭据时开发构建可以启动，但 gaming package 不工作。
8. Riot 官方 Live Client Data API 是本机 `https://127.0.0.1:2999` 的局内数据接口。当前公开 endpoint/schema 未列出 ARAM Mayhem 当前 offer。
9. RiotGames/developer-relations 的 issue #1109 记录了 ARAM Mayhem 的 Match-V5 请求返回 403，且问题以 `closed: is working` 关闭。这说明 Public Match-V5 不能作为该功能的实时或训练数据基础。

### 2.2 尚未确认事项

以下内容必须通过真实游戏 POC 验证，不能由文档推断：

- 国服客户端是否同样触发 OW-Electron GEP 299+ 的 `augments` feature；
- 中文客户端收到的 value 是否仍为英文名称；
- 刷新、重随、断线重连、应用中途启动时的事件顺序和覆盖语义；
- `picked_augment` 与下一轮 `augments` 的先后顺序；
- GEP 事件相对游戏 UI 的延迟和漏报率；
- OW-Electron 与当前 `electron-vite`、`better-sqlite3`、`league-pilot-native-win32` 的 ABI/打包兼容性；
- Riot/Overwolf 是否批准 LeaguePilot 的具体展示和推荐交互。

## 3. 当前项目已经具备的基础

LeaguePilot 不需要从零搭建整个功能，现有代码已经覆盖了大部分非采集能力：

- `src/main/shards/game-client/` 已封装 Riot Game Client API，base URL 指向 2999，并提供 `allgamedata`、`activeplayer`、`eventdata` 等读取能力。
- `src/main/shards/league-client/lc-state/game-data.ts` 已加载 LCU 的 `cherry-augments.json`，renderer store 中已有 `Record<number, Augment>` 静态资源。
- `src/shared/data-sources/gtimg/index.ts` 已定义并加载 `kiwi_augments.json`，同时包含 `augmentID`、`name_en`、`name_cn`、描述和图标。
- `src/renderer-shared/providers/akari-resource/akari.ts` 与 `AugmentDisplay.vue` 已能根据强化符文 ID 展示本地化名称、图标、稀有度和 tooltip。
- `src/renderer/src-opgg-window/opgg/widgets/ResgChampionGuide.vue` 已具备强化符文列表、组合和数据展示 UI。
- `src/main/shards/window-manager/ongoing-game-window/` 已有透明、非抢焦点的局内窗口，可优先复用其窗口生命周期，不必为了获取 GEP 数据同时引入 Overwolf Overlay package。
- LCU/SGP 历史记录类型已经包含 `playerAugment1` 到 `playerAugment6`，可用于赛后核验用户最终选择，但不能替代实时 offer。

真正缺失的是：**受支持的实时 offer 数据源、名称到内部 ID 的可靠映射、生命周期状态机，以及合规后的展示交互。**

## 4. 推荐架构

### 4.1 构建策略：保留 vanilla，新增 OW-Electron 变体

不要把整个项目一次性切换到 OW-Electron。建议保留两条构建线：

- `vanilla`：现有 Electron 43 构建，所有现有能力保持不变，实时 offer 显示为“不支持此数据源”；
- `overwolf`：使用与 OW-Electron 对齐的运行时和 builder，只启用 `gep` package。

评估时 OW-Electron 最新公开版本为 42.7.1，而项目当前 Electron 为 43.2.0。即使两者 API 大体兼容，也不能假设原生模块 ABI 相同。POC 必须单独验证或重建：

- `better-sqlite3`；
- `league-pilot-native-win32` 及其 `.node` addons；
- `electron-vite` 生成物在 OW-Electron runtime 下的启动行为；
- 现有 electron-builder 配置迁移到 `@overwolf/ow-electron-builder` 后的安装、更新和签名行为。

OW-Electron 依赖和脚本应作为构建变体存在，不应删除现有 `electron` / `electron-builder` 依赖。`package.json` 的目标形态类似：

```jsonc
{
  "overwolf": {
    "packages": ["gep"]
  },
  "scripts": {
    "dev:overwolf": "...",
    "build:overwolf": "..."
  }
}
```

具体版本和命令必须以实施时的 OW-Electron 官方 sample 与当前类型定义为准。

### 4.2 领域边界：不要让业务代码依赖 Overwolf 事件结构

建议新增独立的 main shard，而不是把 GEP 逻辑塞进 `game-client-main`、`league-client-main` 或 `ongoing-game-main`：

```text
src/shared/types/augment-offer.ts
src/main/shards/augment-offer/
  index.ts
  context.ts
  state.ts
  augment-offer-controller.ts
  overwolf-gep-provider.ts
  augment-name-mapper.ts
src/renderer-shared/shards/augment-offer/
  index.ts
  store.ts
```

建议 shard id：

- main：`augment-offer-main`
- renderer：`augment-offer-renderer`

职责划分：

- `index.ts`：依赖注入、生命周期、state sync、provider/controller 构造；
- `overwolf-gep-provider.ts`：只处理 `app.overwolf.packages.gep` 的 feature 注册、监听、`getInfo` 和运行时可用性；
- `augment-offer-controller.ts`：处理游戏模式、对局边界、事件去重、过期与清理；
- `augment-name-mapper.ts`：把 GEP 名称映射到 LeaguePilot 的数值 ID；
- renderer shard/store：只接收稳定状态，不解析 GEP 原始 JSON。

建议的稳定领域模型：

```ts
type AugmentOfferSource = 'overwolf-gep' | 'unsupported'

interface AugmentOfferItem {
  id: number | null
  sourceName: string
}

interface AugmentOfferState {
  availability: 'unsupported' | 'unavailable' | 'waiting' | 'ready' | 'degraded' | 'error'
  source: AugmentOfferSource
  gameId: number | null
  offers: AugmentOfferItem[]
  picked: AugmentOfferItem | null
  updatedAt: number | null
  reason: string | null
}
```

`id` 必须允许为 `null`。名称映射失败时保留原始名称并进入 `degraded`，不得猜测 ID 或把未知名称映射到相似项。

### 4.3 数据流

```text
League of Legends
  -> Overwolf GEP closed-source provider
  -> app.overwolf.packages.gep
  -> overwolf-gep-provider
  -> augment-offer-controller
  -> name_en / LCU augment resources -> internal augment id
  -> MobX state + propSync
  -> renderer Pinia store
  -> existing AugmentDisplay + in-game window
```

LCU 与 Game Client API 在这条链路中仍有作用，但不是 offer 的来源：

- LCU gameflow 用于确认当前是否为 `KIWI`、对局是否开始/结束；
- LCU/GTIMG 静态资源用于名称、ID、图标、描述映射；
- 2999 Live Client Data 可用于对照实验、英雄和基础局内状态；
- LCU/SGP match history 只用于赛后核验，不参与实时 offer 决策。

### 4.4 名称到 ID 的映射

Overwolf 样例只返回英文名称，而 LeaguePilot 的展示和历史数据围绕数值 ID。建议映射优先级：

1. `GtimgKiwiAugments.name_en -> augmentID`；
2. 对名称做保守规范化后再次匹配：trim、Unicode normalization、大小写折叠、连续空白折叠；
3. 若当前 LCU 静态资源能提供稳定英文别名，再作为补充映射；
4. 仍未匹配则返回 `id: null`，保留 `sourceName` 并记录不含个人信息的结构化告警。

必须检测同名冲突。构建映射时若一个规范化名称对应多个 ID，应使该名称不可映射并暴露诊断，而不是选择第一个。

### 4.5 生命周期与错误语义

建议状态机遵守以下规则：

1. 非 Windows、vanilla Electron、GEP package 未加载：`unsupported`。
2. GEP 健康状态异常、feature 注册失败：`unavailable` 或 `error`，向用户显示原因。
3. OW-Electron provider 初始化或检测到 LoL 游戏进程启动后立即注册 `augments`，不要等三选一 UI 出现；应用中途启动或重连时调用 `getInfo(5426)` 恢复状态。LCU 的 `KIWI` gameflow 只用于限定消费范围和清理对局状态。
4. 收到 `key=augments` 时，严格解析外层事件和字符串化的 `value`，只接受 1 到 3 个结构正确的选项。
5. 收到 `key=picked_augment` 时更新本轮选择，不立刻清空 offers；等待下一轮 offers 或明确的对局边界。
6. 收到新一轮 offers 时替换上一轮数据并清空上一轮 picked。
7. 离开 `KIWI`、游戏结束、进程退出或 gameflow 变为 unavailable 时清空对局状态。
8. 重复事件按标准化 payload 去重；乱序事件通过本地 sequence/receivedAt 管理，不能依赖网络时间戳。
9. 不吞掉解析错误。日志中记录 feature、key、错误类别和 provider 版本，但不记录 token、账号标识或完整敏感 payload。

Overwolf 文档强调 feature 可能因游戏补丁、游戏厂商要求或数据可靠性问题临时关闭，因此状态异常是正常运行分支，不应伪装成“暂无选择”。

## 5. UI 与产品边界

### 5.1 POC 允许的最小 UI

第一阶段只验证数据链路：

- 在开发诊断页显示 provider 状态、三个原始名称、映射 ID、picked 和更新时间；
- 可在现有 ongoing-game window 增加一个仅开发模式可见的只读卡片；
- 不显示胜率、pick rate、综合评分、“推荐”标签或自动高亮最佳项；
- 不自动点击、不模拟输入、不改变游戏客户端状态。

### 5.2 正式 UI 的前置条件

在获得 Riot/Overwolf 对具体 use case 的确认前，正式版本最多考虑展示玩家屏幕上已经可见的信息与静态说明。以下内容默认不进入正式实现：

- 单个或组合 Augment 胜率；
- 基于当前局阵容、英雄、已有强化符文生成“选这个”的结论；
- 只对工具用户可见、且玩家原本不可见的局内信息；
- 自动选择、自动点击或键鼠注入。

当前 `ResgChampionGuide.vue` 已展示强化符文的 `winRate` / `pickRate`。这与 Riot 当前“Products cannot display win rates for Augments”的政策存在直接冲突，建议另开合规审计任务；不要在本次 GEP 改造中继续扩散该展示。

## 6. 分阶段实施计划

### 阶段 0：合规与账号前置

交付物：

- 向 Overwolf 提交应用构想，确认 League of Legends `augments` 对该 app UID 开放；
- 向 Riot Developer Relations 提交真实 UI mockup 和数据流说明；
- 分别确认“只显示当前三个选项”和“给出推荐”是否允许；
- 获得 OW-Electron Dev Mode 所需凭据，只存于本机/CI secret。

未完成上述前置时，只允许内部 POC，不发布给普通用户。

### 阶段 1：最小运行时 POC

在独立分支中：

- 增加 OW-Electron 与 OW builder，不移除 vanilla Electron；
- `overwolf.packages` 仅启用 `gep`；
- 只订阅 `augments`，把原始事件写入开发日志；
- 验证普通构建和 Overwolf 构建可并存；
- 验证所有原生模块加载。

此阶段不要接入 renderer，不要修改推荐算法。

### 阶段 2：稳定数据源 shard

- 新增 `augment-offer-main` 和 renderer mirror shard；
- 增加平台/运行时 guard；
- 实现严格 schema、名称映射、状态机、清理和错误暴露；
- 使用 fixtures 覆盖正常 offer、picked、未知名称、重复、乱序和 malformed JSON。

### 阶段 3：只读 UI

- 先接开发诊断页；
- 再评估复用 ongoing-game window；
- 明确展示 provider 不可用、映射不完整和数据过期状态；
- 不把 GEP 不可用静默回退成空列表。

### 阶段 4：发布准备

- 完成 Overwolf app signing、应用审核和 installer/update 验证；
- 每次启动或定期查询 GEP event health；
- 建立 feature kill switch；
- 在真实 LoL 补丁更新后执行冒烟验证；
- 只有取得明确批准后，才单独设计推荐能力。

## 7. POC 验收清单

### 7.1 构建与运行

- vanilla Electron 构建行为不变；
- OW-Electron 构建能加载 `gep`，无凭据/未获授权时明确失败；
- `better-sqlite3` 和 `league-pilot-native-win32` 在两个 runtime 下均有实际加载证据；
- 未在日志、配置或构建产物中写入 Overwolf API key、dev token 或 Riot token。

### 7.2 真实游戏矩阵

至少覆盖：

- 国服 `KIWI` 正常开局；
- 中文客户端与英文客户端（若可用）；
- 每轮三选一与 picked；
- 重随/刷新选项；
- 应用在游戏开始前启动与中途启动；
- League Client/Game 断线重连；
- 游戏结束后状态清空；
- GEP feature health 异常或 package 不可用；
- LeaguePilot 与游戏进程权限级别不一致。

每个用例记录：游戏 UI 出现时间、GEP 到达时间、映射结果、picked 到达时间、是否漏报/重复/乱序。验收标准应基于实测分布设定，不在编码前拍脑袋指定固定延迟。

### 7.3 回归验证

实现阶段至少运行：

```powershell
yarn prettier --write <changed-files>
yarn typecheck:node
yarn typecheck:web
yarn test
git diff --check
```

此外必须分别启动 vanilla 与 OW-Electron 构建，并在真实 Windows + LoL 环境验证；只通过 TypeScript、Vitest 或启动主窗口不能证明 GEP 功能可用。

## 8. 决策建议

**当前决策（2026-08-29）：Overwolf 暂停；历史统计先落地；实时识别若做则走 WGC，且不要上实时推荐。**

- Overwolf / OW-Electron 不再作为当前迭代目标。vanilla Electron UI 不得再提示用户去换 Overwolf 构建。
- 历史海克斯并入 extra-assets，数据源为 arammeta 公开 `tier-list.json`，只保留英雄 × 海克斯 `top` 统计，与 RESG / OP.GG 分开展示并标明来源。
- 实时三选一若继续，优先 WGC + 裁剪后的 Template Matching，而不是 GEP、读内存或大模型 embedding。
- “根据当前三个选项给出最佳选择”仍然 No-Go，直到 Riot Developer Relations 书面确认。现有攻略页展示的是历史统计，不是局内动态推荐。

下文第 1–7 节仍是 Overwolf POC 的原始评估，暂停期间不要按其阶段合入正式版。

## 9. WGC 局部截图 + 图标识别（相对 Overwolf）

### 9.1 会不会比 Overwolf 更好？

对 **vanilla Electron** 来说，WGC 更合适：不需要 OW-Electron fork、Overwolf 凭据和 GEP 健康状态。它读取的是玩家屏幕上已经可见的图标，不读游戏内存，也不依赖尚未公开的 Riot 实时 offer API。

它不会“更好”到可以替代数据源：

| 能力              | Overwolf GEP             | WGC + 图标识别                  | 公开 HTTP               |
| ----------------- | ------------------------ | ------------------------------- | ----------------------- |
| 当前三选一名称/ID | 高（事件，需 OW 运行时） | 中（视觉，受分辨率/HUD 影响）   | 无                      |
| 已选结果          | 有 `picked_augment`      | 需额外检测已选槽或 HUD          | 无实时                  |
| 重随（Reroll）    | 事件刷新 offer           | 按钮/图标变化较好判断           | 无                      |
| 历史胜率          | 不提供                   | 不提供                          | arammeta / RESG / OP.GG |
| 独占全屏          | 通常仍可用               | 不可靠，无边框窗口更稳          | 无关                    |
| 合规              | 实时推荐仍受限           | 同样受限；截图黄框/权限也要处理 | 历史聚合相对清晰        |

[Riot Live Client Data](https://developer.riotgames.com/docs/lol) 的 2999 接口仍然没有三选一 offer。[Match-V5 对 Mayhem 仍不开放](https://github.com/RiotGames/developer-relations/issues/1154)。[LCU 赛后记录](https://github.com/Yhprum/mayhem-tracker) 只能做自己的历史，不能读局内三选一。当前仓库的 native addon 也还没有截图 API。

### 9.2 3 / 7 / 11 / 15 是不是固定 UI？

这四个数字是 **游戏规则节点**（到达 3 / 7 / 11 / 15 级时出现一轮三选一），不是固定像素坐标。[Wiki：ARAM Mayhem](https://wiki.leagueoflegends.com/en-us/ARAM:_Mayhem) 也按等级描述选屏，而不是按分辨率描述 layout。

实际 HUD 会随分辨率、HUD 缩放、小地图左右、商店是否打开、隐藏按钮、英雄特殊 HUD 变化。不能把某一套 1080p 坐标写死成生产逻辑。正确做法是：用规则节点 + Live Client Data 的等级做 **采样门控**，再用 Reroll 按钮/三图标布局做 **UI 存在门控**，最后只对裁剪后的图标区域做匹配。

### 9.3 CommunityDragon 是不是固定 UI 数据？

[CommunityDragon `v1/cherry-augments.json`](https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/) 是 **Arena + 共享海克斯 ID 目录**（id、名称、稀有度、图标路径），不是 HUD layout。LeaguePilot 已经通过 LCU `getAugments()` 加载同一份文件。

Mayhem 大图标在游戏资源 `kiwi.bin.json` 的 `AugmentLargeIconPath`，对应 `game/assets/ux/kiwi/augments/icons/`。这些图标适合做模板库；它们 **不能** 给出屏幕上三个选项的像素位置。

### 9.4 识别流水线建议

用户提出的 pHash → Template Matching → embedding 可以作为实验顺序，但生产主力应倒过来：

1. **门控：** 游戏进程窗口存在、无边框/窗口模式、等级接近 3/7/11/15、商店未挡住选屏、检测到 Reroll 或三图标槽。
2. **裁剪：** 只截三个图标矩形，不要对整屏做 hash。
3. **Template Matching（主力）：** 与 CommunityDragon / kiwi 图标模板比。图标是合成 UI、边缘清晰、调色盘稳定，比照片更适合模板。
4. **pHash / dHash：** 只做廉价预过滤或快速拒绝，不要用 `> 0.98` 当唯一真相。压缩、描边、选中高亮都会打穿绝对阈值。
5. **embedding（最后才考虑）：** MobileNetV3 / EfficientNet-B0 可以做离线小型分类器；CLIP / DINOv2 对 Electron 主进程过重，也不比模板更能解决“三个固定槽位里的已知图标”这个问题。
6. **Reroll：** 单独做按钮模板，用来确认“当前确实在选海克斯”，并在 reroll 后重新采样。这一步比识别具体 ID 更稳，也是动态推荐之前必须先成立的状态机。

未实现完整 WGC/CV 管线前，不要把识别结果接到推荐排序上。

### 9.5 WGC 已知限制

- [独占全屏不保证可捕获](https://learn.microsoft.com/en-gb/answers/questions/5791521/wgc-capturing-exclusive-fullscreen-games-apps)；无边框窗口走 DWM，最稳。
- Win32 可用 `IGraphicsCaptureItemInterop::CreateForWindow(HWND)` 对准游戏窗口，见 [Win32CaptureSample](https://github.com/robmikh/Win32CaptureSample)。
- 捕获黄框默认存在；关掉需要 `IsBorderRequired = false`，且通常还要用户同意 [`graphicsCaptureWithoutBorder`](https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.graphicscapturesession.isborderrequired)。
- 受保护 swap chain、`WDA_EXCLUDEFROMCAPTURE`、HDR 都会得到黑帧或错色。
- 识别成功也只证明“屏幕上有这个图标”，不能证明 GEP 式的权威 offer 列表。

## 10. 参考资料

- [Overwolf：League of Legends Game Events（含 augments）](https://dev.overwolf.com/ow-electron/live-game-data-gep/supported-games/league-of-legends/)
- [Overwolf：Game Events Provider 工作方式](https://dev.overwolf.com/ow-electron/live-game-data-gep/live-game-data-gep-intro/)
- [Overwolf：验证事件健康状态](https://dev.overwolf.com/ow-electron/live-game-data-gep/verifying-events-for-your-app/)
- [Overwolf：OW-Electron FAQ](https://dev.overwolf.com/ow-electron/getting-started/onboarding-resources/ow-electron-faq/)
- [Overwolf：OW-Electron packages sample](https://github.com/overwolf/ow-electron-packages-sample)
- [Riot：League of Legends Developer Relations / Game Policy](https://support-developer.riotgames.com/hc/en-us/articles/22698698001939-League-of-Legends)
- [Riot：League Client、Game Client 与 Live Client Data API](https://developer.riotgames.com/docs/lol)
- [Riot：Vanguard Updates（禁止外部工具读取内存）](https://www.riotgames.com/en/DevRel/vanguard)
- [RiotGames/developer-relations #1109：ARAM Mayhem Match-V5 返回 403](https://github.com/RiotGames/developer-relations/issues/1109)
- [RiotGames/developer-relations #1154：Mayhem match data 仍不走官方 API](https://github.com/RiotGames/developer-relations/issues/1154)
- [arammeta / ARAM-Mayhem-Database](https://github.com/Lanternko/ARAM-Mayhem-Database)
- [CommunityDragon game-data v1](https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/)
- [Wiki：ARAM Mayhem](https://wiki.leagueoflegends.com/en-us/ARAM:_Mayhem)
- [Microsoft：WGC 与独占全屏](https://learn.microsoft.com/en-gb/answers/questions/5791521/wgc-capturing-exclusive-fullscreen-games-apps)
- [Microsoft：GraphicsCaptureSession.IsBorderRequired](https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.graphicscapturesession.isborderrequired)
- [Win32CaptureSample](https://github.com/robmikh/Win32CaptureSample)

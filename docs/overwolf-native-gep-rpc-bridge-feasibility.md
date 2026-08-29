# 独立 Overwolf Native 小助手 + 本机 RPC 可行性

> 评估日期：2026-08-29
>
> 评估范围：不把 OW-Electron 嵌进 LeaguePilot，而是另做一只 **Overwolf Native** 小应用订阅 LoL GEP `augments`，再通过本机 **JSON-RPC 2.0** 把原始游戏事件交给现有 `augment-offer` 链路。
>
> 本文是改造参考。不包含业务代码，也不把未经实测的 GEP 样例值当成国服事实。
>
> 相关文档：[OW-Electron 嵌入方案](./overwolf-aram-mayhem-augments-feasibility.md)。两条路线共享同一领域模型，采集宿主不同。

## 1. 结论

### 1.1 总体判断

方案**有条件可行，适合作为「保住 Electron 43、暂不买 Authenticode」的内部 POC**。它不能替代 Overwolf 开发者白名单，也不能让普通朋友在未上架的情况下双击即用。

成立的前提：

- Native LoL GEP 文档已列出与 OW-Electron 相同的 feature：`augments` / `picked_augment`，自 GEP 299.0。游戏 ID 仍为 `5426`。
- Native 官方提供本机 HTTP 服务 [`overwolf.web.createServer`](https://overwolf.github.io/api/web)，且只能服务 `localhost` / `127.0.0.1`。
- LeaguePilot 已有 `augment-offer` 的解析、映射、状态机和 OP.GG 只读条。小助手不应再实现一遍业务，只做 GEP 采集 + RPC 传输。

不成立或明显更差的预期：

- **不能**靠开发态 key 给已打包的 Akari 安装包供 GEP。开发态 key 属于 OW-Electron Dev Mode，Native 小助手走的是 Overwolf 客户端 + 开发者白名单。
- **不能**把未上架 OPK 发给几个朋友安装。官方明确：未从商店下载的 OPK、Load unpacked，都只允许**已白名单的 Overwolf 开发者账号**。朋友若不是开发者，装不上私有小助手。
- **不要**再开一只独立 OW-Electron 进程当桥。签名、证书、双进程成本都不比嵌进主程序低。
- **不要**让小助手做名称→ID 映射、胜率或「推荐」。映射留在 Akari；产品合规边界与嵌入方案相同。

因此目标拆成两件事：

1. **技术 POC**：本机 JSON-RPC 能否稳定把 `augments` info update 送进现有 `OverwolfGepProvider` 的同类 listener。
2. **分发现实**：自用（你自己是白名单开发者）可行；几个非开发者朋友要用，仍然得走 Overwolf 商店上架，或改回已签名的 OW-Electron 单包。

### 1.2 可行性矩阵

| 方案                         | 技术可行性                         | 使用者负担                     | 证书 / 审核                                                    | 结论                   |
| ---------------------------- | ---------------------------------- | ------------------------------ | -------------------------------------------------------------- | ---------------------- |
| 本仓库 OW-Electron 嵌入      | 高（ABI 已对齐 42.7.1 的旁路脚本） | 单安装包，不用 Overwolf 客户端 | Overwolf 包签名 + **自备 Authenticode**                        | 面向普通用户发版时更优 |
| **Native 小助手 + JSON-RPC** | 高                                 | 必须安装 Overwolf 客户端       | 开发者白名单；上架才给非开发者；**通常不要求**自备代码签名证书 | 适合自用 / 内部 POC    |
| 独立 OW-Electron 侧车进程    | 中                                 | 两个 exe                       | 与嵌入方案同等签名                                             | 不采用                 |
| 普通 Electron 直接调 GEP     | 低                                 | —                              | —                                                              | 不采用                 |
| 读内存 / 自研注入            | 禁止                               | —                              | 极高封号风险                                                   | 禁止                   |

### 1.3 对「自用 / 几个朋友」的直接答案

| 使用者                                     | Native 小助手        | 说明                                                                              |
| ------------------------------------------ | -------------------- | --------------------------------------------------------------------------------- |
| 你自己（已过 Overwolf 提案、账号已白名单） | 可行                 | 客户端 Load unpacked + Akari `yarn dev`，RPC 连本机                               |
| 朋友也是白名单开发者                       | 勉强可行             | 每人装 Overwolf、用自己的开发者账号 Load unpacked                                 |
| 朋友只是玩家                               | **当前官方路径不通** | 不能装私有 OPK，也不能 Load unpacked；只能等商店上架或使用已签名的 OW-Electron 包 |

## 2. 已确认事实与尚未确认事项

### 2.1 已确认事实

1. [Native LoL GEP](https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/league-of-legends/) 的 Available Features 含 `augments`。info update：
   - `augments`（category `me`）：ARAM Mayhem 当前可选强化符文；
   - `picked_augment`（category `me`）：玩家最近一次选择。
2. Native 与 OW-Electron 使用同一套 GEP 后端语义：默认不监听任何 feature，必须 `setRequiredFeatures`；info update 可 `getInfo` 恢复；feature 会随补丁暂时关闭。
3. Native API 为 `overwolf.games.events.setRequiredFeatures` / `onInfoUpdates2` / `getInfo` / `onNewEvents`，不是 OW-Electron 的 `app.overwolf.packages.gep`。
4. [Frameworks overview](https://dev.overwolf.com/ow-native/getting-started/onboarding-resources/framework-overview/)：Native 应用**始终依赖 Overwolf 客户端**；Native 相对 OW-Electron 的优点包括「一般不需要应用自己的代码签名证书」。
5. [Load unpacked](https://dev.overwolf.com/ow-native/getting-started/onboarding-resources/basic-sample-app) 与 [SDK 介绍](https://overwolf.github.io/docs/start/sdk-introduction)：未上架应用只能由白名单开发者加载/安装。
6. [`overwolf.web.createServer`](https://overwolf.github.io/api/web) 是 **HTTP 服务器**（`onRequest`）。[`createWebSocket`](https://overwolf.github.io/api/web) 是连向 localhost 的 **WebSocket 客户端**，Native 不能当 WebSocket 服务端。
7. LeaguePilot 的稳定快照仍是 `AugmentOfferSnapshot`；GEP 原始结构解析已在 `gep-payload.ts`。RPC 应传输接近 `GepInfoUpdateLike` 的信封，而不是让小助手产出最终 UI 状态。
8. 官方 Native `augments` 样例值出现了 `TFT8_Augment_*` 形式的内部名，OW-Electron 文档样例则是英文展示名（如 `Scopier Weapons`）。**不能假设国服实战一定是哪一种**；映射层必须两种都测。

### 2.2 尚未确认事项

必须通过真实 Windows + Overwolf 客户端 + LoL 对局验证：

- 国服是否触发 Native GEP 299+ 的 `augments`；
- 实战 `value` 是展示名、内部 API 名，还是中文名；
- `picked_augment` 样例里的 `slot_1..3` 与当前三选一 `augment_1..3` 如何对应；
- `createServer` 在游戏全屏/管理员权限下是否仍可被 Electron 访问；
- `sendHttpRequest` 从 Native 推送到 Akari 监听端口的延迟与失败重试；
- Overwolf 是否批准「无 UI / 仅本机 RPC 桥」这种应用形态（无窗口、无广告、不进商店的私有工具）；
- 提案审核是否把「把 GEP 转给另一个桌面程序」视为可接受的数据出口。

## 3. 与现有代码的衔接

不要新建第二套海克斯状态机。Akari 侧只加一种 **transport provider**，仍进入现有 controller：

```text
Overwolf Native 小助手
  -> overwolf.games.events (augments)
  -> JSON-RPC 2.0（本机 HTTP）
  -> Akari main: native-rpc-gep-provider
  -> 现有 gep-payload / augment-offer-controller / augment-name-mapper
  -> 现有 renderer store / LiveAugmentOffer
```

现有 `OverwolfGepProvider` 继续服务 OW-Electron 构建。vanilla Electron 在未连接小助手时应保持 `unsupported` / `gep-runtime-missing`；仅当用户显式启用「Native RPC」且本机发现桥接文件后，才走 `unavailable`（助手未启动）或后续 `waiting` / `ready`。

建议的文件边界（实施时再创建，本文不落代码）：

```text
tools/overwolf-native-gep-bridge/     # 独立 Native 小应用，不进 Electron asar
  manifest.json
  background.js（或等价 TS 构建产物）
src/main/shards/augment-offer/
  native-rpc-gep-provider.ts          # 与 OverwolfGepProvider 实现同一 listener 契约
  native-rpc-client.ts                # JSON-RPC 客户端 + 本机通知服务端
docs/overwolf-native-gep-rpc-bridge-feasibility.md
```

小助手禁止依赖 LeaguePilot 的 Node 原生模块、SQLite 或 LCU。它只认识 GEP 和 RPC。

## 4. RPC 契约

### 4.1 为什么用 JSON-RPC 2.0，而不是「推一段 JSON」

需要同时具备：

- 请求/响应：握手、健康检查、`getInfo` 补洞；
- 服务端推送：info update、对局开始/结束；
- 版本字段：小助手和 Akari 独立发版；
- 便于用 curl / 假服务器单测 Akari provider，而不启动 Overwolf。

约定：

- 协议名：`akari-gep-rpc`
- 协议版本：`1`
- 报文：JSON-RPC 2.0（`jsonrpc: "2.0"`）
- 编码：UTF-8，`Content-Type: application/json`
- 只绑定 `127.0.0.1`，禁止 `0.0.0.0`
- 每个请求带 `Authorization: Bearer <token>`；无 token 或 token 错误一律 `-32600` / 应用层 `auth-failed`，不进入 GEP 逻辑

因 Native **不能**做 WebSocket 服务端，传输采用**双向 HTTP JSON-RPC**，而不是单条 WebSocket：

```text
Akari  --POST /rpc-->  小助手 :41777   # 请求：hello / getHealth / getInfo
小助手 --POST /rpc-->  Akari  :41776   # 通知：infoUpdate / session / healthChanged
```

POC 允许先只实现 Akari 轮询 `gep.getInfo`（例如 250–500ms），确认 GEP 内容后再加推送。轮询不是正式默认，只为减少第一周对 `sendHttpRequest` 的依赖。

### 4.2 发现与配对

小助手在 `listen` 成功后写入（路径可实施时再定，需可被当前 Windows 用户读取、且不进 git）：

```text
%LOCALAPPDATA%\LeaguePilot\gep-rpc-discovery.json
```

```json
{
  "protocol": "akari-gep-rpc",
  "protocolVersion": 1,
  "helper": {
    "url": "http://127.0.0.1:41777/rpc",
    "startedAt": 1730000000000
  },
  "token": "<随机高熵 token，仅本机>"
}
```

Akari 启动 Native RPC provider 时读取该文件。文件不存在 → `unavailable`（助手未运行），不是 `unsupported`。

`hello` 时 Akari 告诉助手自己的回调地址：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "gep.hello",
  "params": {
    "protocol": "akari-gep-rpc",
    "protocolVersion": 1,
    "client": "league-pilot",
    "callbackUrl": "http://127.0.0.1:41776/rpc"
  }
}
```

成功结果：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocol": "akari-gep-rpc",
    "protocolVersion": 1,
    "server": "overwolf-native-gep-bridge",
    "gameId": 5426,
    "features": ["augments"]
  }
}
```

`protocolVersion` 不兼容则 Akari 进入 `error`，reason 使用显式值（例如 `rpc-protocol-mismatch`），禁止静默降级乱解析。

默认端口：助手 `41777`，Akari `41776`。占用时在 `41777–41780` / `41776–41779` 内递增，并以发现文件与 `hello.callbackUrl` 为准，不要写死在两处源码里各维护一份。

### 4.3 方法（Akari → 助手）

| method          | 用途                                                        | 结果                                                                             |
| --------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `gep.hello`     | 握手、登记 callbackUrl、校验协议版本                        | 见上                                                                             |
| `gep.getHealth` | GEP 是否已 `setRequiredFeatures`、最近错误                  | `{ ready, gameDetected, lastError, requiredFeatures }`                           |
| `gep.getInfo`   | 对应 Native `overwolf.games.events.getInfo()`，用于中途接入 | 原始 info 对象，或规范化后的 `infoUpdates[]`（实施时二选一并写死，禁止两种混用） |

建议正式 POC 把 `getInfo` 的结果**规范化成与推送相同的 `infoUpdate` 数组**，这样 Akari 只有一条解析路径。

错误使用 JSON-RPC `error`：

| code     | 含义                             |
| -------- | -------------------------------- |
| `-32600` | 鉴权失败、非 loopback、缺 token  |
| `-32601` | 未知 method                      |
| `-32001` | GEP `setRequiredFeatures` 仍失败 |
| `-32002` | 当前未检测到游戏 5426            |
| `-32003` | 协议版本不匹配                   |

### 4.4 通知（助手 → Akari）

JSON-RPC 2.0 通知（无 `id`）。Akari 的 `/rpc` 对通知返回 HTTP 204 或 `{"jsonrpc":"2.0","result":null}`（无 id 时不要编造响应 id）。

```json
{
  "jsonrpc": "2.0",
  "method": "gep.infoUpdate",
  "params": {
    "gameId": 5426,
    "feature": "augments",
    "category": "me",
    "key": "augments",
    "value": "{\"augment_1\":{\"name\":\"Scopier Weapons\"},\"augment_2\":{\"name\":\"Rabble Rousing\"},\"augment_3\":{\"name\":\"Soul Eater\"}}"
  }
}
```

| method                   | 对应现有 provider                                         |
| ------------------------ | --------------------------------------------------------- |
| `gep.infoUpdate`         | `onInfoUpdate`（字段对齐 `GepInfoUpdateLike` + `gameId`） |
| `gep.gameSessionStarted` | `onGameSessionStarted`                                    |
| `gep.gameSessionEnded`   | `onGameSessionEnded`                                      |
| `gep.healthChanged`      | `onReady` / `onUnavailable` / `onError` 的降级输入        |

`gep.healthChanged` 的 `params.availability` 只允许助手能诚实知道的值：`unavailable` | `error`，以及「GEP 已就绪」用 `{ "ready": true }`。**不要**由助手计算 `degraded` / 映射失败；那是 Akari mapper 的职责。

助手在 `game-detected` 且 `setRequiredFeatures` 成功后发 `gameSessionStarted`，并立刻 `getInfo` 把当前 `augments` / `picked_augment` 打成 `infoUpdate`，避免 Akari 中途启动丢状态。这与现有 OW-Electron provider 的补洞策略一致。

### 4.5 小助手内部职责（保持极薄）

只做：

1. `setRequiredFeatures(['augments'])`，失败重试（次数与现有 main provider 同一量级即可）；
2. 监听 `onInfoUpdates2`，过滤 `feature === 'augments'`；
3. 监听游戏开始/退出（Native 的 `overwolf.games` 事件，以实施时官方 API 为准）；
4. HTTP JSON-RPC 服务与向 Akari 推送；
5. 把 token 写入发现文件。

不做：

- 名称映射、GTIMG、LCU；
- Overlay、广告、`<owadview>`、CMP 弹窗；
- 代表用户点击游戏 UI；
- 把完整 GEP dump 打进 Overwolf 日志（官方要求避免记录 GEP 数据）。

### 4.6 安全

- 双端只绑 `127.0.0.1`。
- token 至少 128 bit 随机，存在发现文件；文件 ACL 保持用户私有。
- 校验 `hello.callbackUrl` 主机必须是 `127.0.0.1` 或 `localhost`，拒绝其它 host。
- 不把 token、召唤师名、完整 GEP value 写入 Akari 普通日志。
- RPC 不是信任边界的放松：它只是把已经允许给本机 Overwolf 应用的数据，交给同一用户会话里的 Akari。

## 5. Native 小应用形态

最小 `manifest.json` 能力（字段名以实施时 Native 文档为准）：

- 后台窗口 / 无游戏内 overlay；
- 权限：Game events、Web；
- `data.game_targeting` / 启动器：LoL 游戏 ID `5426` 启动时拉起后台（若审核允许无 UI 应用）；
- **不要**申请 Overlay 注入，除非以后单独评审。

开发加载：Overwolf 客户端 → Development options → Load unpacked。账号必须已登录且已白名单。

## 6. 合规与产品边界

与嵌入方案第 5 节相同，这里只强调 RPC 多出来的一点：

- 本机 RPC 输出的仍是玩家屏幕上已有的三选一信息，不是新的「隐藏数据通道」去拿别人看不到的东西。
- 但 Overwolf 是否允许把 GEP **转给非 Overwolf 进程**，必须在提案里写明，不能默认「本机所以一定可以」。
- 正式 UI 仍禁止 augment 胜率推荐标签、自动选择、读内存。

## 7. 分阶段实施计划

### 阶段 0：账号与提案

- 提交 Overwolf Native 应用构想：无商店 UI、仅本机 RPC 桥、只订 `augments`；
- 写明数据留在本机、接收方为 LeaguePilot；
- 未白名单前不要写业务代码依赖「朋友也能装」。

### 阶段 1：假 RPC 服务器

- 在 Akari 用 Node 假服务实现第 4 节方法/通知；
- 单测 `native-rpc-gep-provider` 把 `gep.infoUpdate` 转成现有 listener；
- **不**启动 Overwolf。此阶段证明契约，不证明 GEP。

### 阶段 2：Native 小助手 POC

- 独立目录实现最小 background + `createServer`；
- 只订 `augments`；
- 真实 KIWI 对局对照游戏 UI；
- 记录名称形态（展示名 / 内部名 / 中文）。

### 阶段 3：接入 vanilla Akari

- 设置项或自动发现启用 RPC transport；
- 未发现助手时 UI 文案与「普通 Electron 无 GEP」区分：提示安装/启动 Overwolf 小助手，而不是提示 OW-Electron 构建；
- 不把 RPC 失败伪装成「本轮没有海克斯」。

### 阶段 4：分发（仅当需要非开发者使用）

- 走 Overwolf 商店审核；或
- 放弃 Native 桥，改用已签名 OW-Electron 单包。

不要假设阶段 2 成功后朋友就能用。

## 8. POC 验收清单

### 8.1 契约

- 假服务器可将三选一推到 OP.GG 实时条；
- token 错误时助手不返回 GEP 数据；
- 非 `127.0.0.1` 的 callbackUrl 被拒绝；
- `protocolVersion` 不匹配时 Akari 为 `error`。

### 8.2 真实环境

- Overwolf 客户端 Load unpacked 后，vanilla `yarn dev` 能显示本轮三个名称；
- 中途启动 Akari 能通过 `getInfo` 补到当前 offer；
- 结束对局后快照清空；
- 助手未启动时 Akari 其它功能不受影响。

### 8.3 回归

```powershell
yarn typecheck
yarn vitest run src/main/shards/augment-offer
```

假 RPC 单测不能代替真实 GEP。国服对局仍是唯一有效证据。

## 9. 决策建议

当前建议：

> **Go for 自用 / 内部 RPC POC；No-Go for 把 Native 小助手当成给几个普通朋友的分发方案。**

若目标是「我不想降 Electron、不想买证书、自己打 KIWI 能看三选一」：Native + JSON-RPC 是合理下一刀，而且应先把第 4 节契约用假服务器钉死。

若目标是「朋友装上就能用、不要 Overwolf 客户端」：继续 OW-Electron 嵌入 + 生产签名，不要在 Native 桥上投入分发工作。

两条采集宿主可以并存：同一 `augment-offer-controller`，两个 provider（进程内 GEP / 本机 RPC），同一份快照。不要维护两套 UI 状态。

## 10. 参考资料

- [Overwolf Native：League of Legends Game Events（含 augments）](https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/league-of-legends/)
- [Overwolf Native：GEP 工作方式](https://dev.overwolf.com/ow-native/live-game-data-gep/live-game-data-gep-intro/)
- [overwolf.web（createServer / sendHttpRequest / createWebSocket）](https://overwolf.github.io/api/web)
- [Frameworks overview：Native 需要客户端；OW-Electron 不需要](https://dev.overwolf.com/ow-native/getting-started/onboarding-resources/framework-overview/)
- [Load unpacked 与开发者白名单](https://dev.overwolf.com/ow-native/getting-started/onboarding-resources/basic-sample-app)
- [SDK 介绍：未上架 OPK 仅白名单开发者可装](https://overwolf.github.io/docs/start/sdk-introduction)
- [JSON-RPC 2.0](https://www.jsonrpc.org/specification)
- [本仓库：OW-Electron 嵌入可行性](./overwolf-aram-mayhem-augments-feasibility.md)

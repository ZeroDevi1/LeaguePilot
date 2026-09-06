import { AkariProtocolMain } from '@main/shards/akari-protocol'
import { Dep, Shard } from '@shared/akari-shard'

import { handleResgProtocolRequest } from './protocol-handler'

/** RESG renderer 代理协议域。 */
const RESG_PROTOCOL_DOMAIN = 'resg'

/**
 * 为 renderer 提供受限的 RESG 只读代理。
 *
 * main 进程从 B 站入口解析 RESG 发布目录，固定代理版本索引、英雄列表和单英雄详情，避免 renderer 跨域请求；不接受任意主机或任意路径。
 */
@Shard(ResgMain.id)
export class ResgMain {
  /** shard 注册标识。 */
  static readonly id = 'resg-main'

  /**
   * 创建 RESG main shard。
   *
   * @param protocol Akari 自定义协议路由器，用于注册 `akari://resg`。
   */
  constructor(@Dep(AkariProtocolMain) private readonly _protocol: AkariProtocolMain) {}

  /**
   * 注册 RESG 只读代理。
   *
   * @returns 注册完成后无返回值；同名域已存在时由协议路由器抛错。
   */
  onInit() {
    this._protocol.registerDomain(RESG_PROTOCOL_DOMAIN, (_uri, request, context) =>
      handleResgProtocolRequest(request, context.signal)
    )
  }

  /**
   * 注销 RESG 协议域。
   *
   * @returns 注销完成后无返回值。
   */
  onDispose() {
    this._protocol.unregisterDomain(RESG_PROTOCOL_DOMAIN)
  }
}

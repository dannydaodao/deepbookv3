// scripts/transactions/predict/findOracles.ts
import { getClient } from '../../utils/utils.js'; // 统一使用项目内置的 getClient
import { predictPackageID } from '../../config/constants.js';

const network = 'testnet' as const;

type OracleData = {
    oracleId: string;
    expiryTimestamp: number;
    expiryDate: Date;
    activatedTimestamp: number;
    isActive: boolean;
}

(async () => {
    console.log(`连接到 ${network}...`);
    // 使用项目标准的 getClient
    const client = getClient(network);

    const ORACLE_EVENT_TYPE = `${predictPackageID[network]}::oracle::OracleActivated`;
    console.log(`正在查找事件类型: [${ORACLE_EVENT_TYPE}]...`);

    try {
        // SuiJsonRpcClient 也支持 queryEvents
        const events = await client.queryEvents({
            query: {
                MoveEventType: ORACLE_EVENT_TYPE
            },
            limit: 50,
            order: "descending" // 获取最新的
        });

        if (events.data.length === 0) {
            console.log('未找到 OracleActivated 事件。预言机可能还未激活。');
            return;
        }

        console.log(`\n找到 ${events.data.length} 个预言机激活事件 (按时间倒序):`);
        
        // 1. 提取并整理数据
        const oracles: OracleData[] = events.data.map(event => {
            const parsedJson = event.parsedJson as any;
            const expiryTs = Number(parsedJson.expiry);
            const activatedTs = Number(parsedJson.timestamp);
            
            return {
                oracleId: parsedJson.oracle_id,
                expiryTimestamp: expiryTs,
                expiryDate: new Date(expiryTs),
                activatedTimestamp: activatedTs,
                isActive: expiryTs > Date.now()
            };
        });

        // 2. 自定义排序逻辑
        // 规则 1: 活跃的在前 (isActive: true 排前面)
        // 规则 2: 如果活跃状态相同，按到期时间 (Expiry) 升序排列 (即将到期的排前面)
        oracles.sort((a, b) => {
            if (a.isActive && !b.isActive) {
                return -1; // a 活跃 b 不活跃，a 排前面
            } else if (!a.isActive && b.isActive) {
                return 1;  // a 不活跃 b 活跃，b 排前面
            } else {
                // 状态相同，比较 expiryTimestamp 升序
                return a.expiryTimestamp - b.expiryTimestamp;
            }
        });

        // 3. 打印排序后的结果
        console.log(`\n找到 ${oracles.length} 个预言机激活事件 (已排序: 活跃优先 -> 到期时间早优先):`);
        
        oracles.forEach((oracle, index) => {
            console.log(`\n--- Oracle #${index + 1} ---`);
            console.log(`Oracle ID: \x1b[32m${oracle.oracleId}\x1b[0m`);
            console.log(`Expiry:    ${oracle.expiryDate.toLocaleString()} ${oracle.isActive ? '\x1b[32m(活跃)\x1b[0m' : '\x1b[90m(已过期)\x1b[0m'}`);
            console.log(`Activated: ${new Date(oracle.activatedTimestamp).toLocaleString()}`);
        });

    } catch (e) {
        console.error("查询失败:", e);
    }
})();
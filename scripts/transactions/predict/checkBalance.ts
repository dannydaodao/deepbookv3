// scripts/transactions/predict/check_balance.ts
import { Transaction } from '@mysten/sui/transactions';
import { getClient } from '../../utils/utils.js';
import {
    predictPackageID,
    dusdcPackageID,
} from '../../config/constants.js';

const network = 'testnet' as const;
const DUSDC_TYPE = `${dusdcPackageID[network]}::dusdc::DUSDC`;

// 替换为你的顶级 PredictManager ID
const MY_PREDICT_MANAGER_ID = '0x926cbf800a051d8d93ac4d1ff9a049116ffd7c3705fe33baf5b45ac981f8b082'; 

(async () => {
    const client = getClient(network);
    const tx = new Transaction();

    // 1. 构造一个无副作用的 Dev Inspect (干跑) 交易
    // 去调用 predict_manager::balance<DUSDC>(PredictManager)
    tx.moveCall({
        target: `${predictPackageID[network]}::predict_manager::balance`,
        typeArguments: [DUSDC_TYPE],
        arguments: [tx.object(MY_PREDICT_MANAGER_ID)],
    });

    try {
        // 2. 使用 devInspectTransactionBlock 进行只读查询
        // 这里甚至不需要你提供 signer 和私钥，因为它只是在链上模拟执行读操作
        const result = await client.devInspectTransactionBlock({
            transactionBlock: tx,
            sender: '0x0000000000000000000000000000000000000000000000000000000000000000', // 随便填个格式合法的空地址
        });

        if (result.effects.status.status === 'success') {
            // 3. 解析返回值。
            // Sui 的 devInspect 结果藏得比较深，通常在 results[0].returnValues[0][0] 里，且是序列化的字节(Uint8Array)。
            // 对于 u64，我们可以手动解码。
            const returnValues = result.results?.[0]?.returnValues;
            if (returnValues && returnValues.length > 0) {
                const bcsBytes = Uint8Array.from(returnValues[0][0]);
                // u64 是 8 字节的小端序整数，简单转码：
                const dataview = new DataView(bcsBytes.buffer);
                // BigInt 转换以防溢出
                const balanceRaw = dataview.getBigUint64(0, true); 
                
                console.log(`✅ 查询成功！`);
                console.log(`你的 PredictManager 中 DUSDC 的原始余额为: ${balanceRaw.toString()}`);
                console.log(`换算为美元金额: $ ${Number(balanceRaw) / 1e6}`);
            } else {
                console.log("未解析到返回值，可能余额不存在或为 0。");
            }
        } else {
            console.error('查询失败:', result.effects.status.error);
        }
    } catch (e) {
        console.error('执行报错:', e);
    }
})();
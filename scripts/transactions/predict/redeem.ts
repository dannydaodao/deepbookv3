import { Transaction } from '@mysten/sui/transactions';
import { getActiveAddress, getClient, getSigner } from '../../utils/utils.js';
import {
    predictPackageID,
    predictObjectID,
    dusdcPackageID,
} from '../../config/constants.js';

const network = 'testnet' as const;
const DUSDC_TYPE = `${dusdcPackageID[network]}::dusdc::DUSDC`;
const CLOCK_ID = '0x6';

// ------------------------------------------------------------
// 必填：替换为你的实际 ID
// ------------------------------------------------------------
const MY_PREDICT_MANAGER_ID = '0x926cbf800a051d8d93ac4d1ff9a049116ffd7c3705fe33baf5b45ac981f8b082';
// 找一个活跃的预言机 ID，如果是 BTC 价格，可能在 60000 左右
const ORACLE_SVI_ID = '0x5540ce1276d6f97573df145faee78dbbdb3e0029f7ca9666473c42b063822746'; 

// 设定你的投注参数
const STRIKE_PRICE = 69600n * 1_000_000_000n; // 假设行权价 65000，注意是否需要乘以 1e9 scaling
const IS_UP = true; // 预测价格会涨过 STRIKE_PRICE
const QUANTITY = 10n * 1_000_000n; // 买 10 份合约 (最大可能赚 10 DUSDC)

(async () => {
    const client = getClient(network);
    const signer = getSigner();

    const tx = new Transaction();

    // 构造 MarketKey
    // 根据 packages/predict/sources/market_key/market_key.move 的定义
    // 通常包含: oracle_id, expiry, strike, is_up
    // 注意：你需要知道这个预言机的精确 expiry 时间戳才能构造合法的 Key
    // 为了省去你找 expiry 的麻烦，更简单的体验方法是调用不需要显式构造 Key 的函数，
    // 但如果必须传 MarketKey，你得先查询那个 Oracle 对象读取它的 expiry。

    // 假设我们通过某种方式查到了这个预言机的 expiry
    const ORACLE_EXPIRY = 1780390800000n; // 替换为真实的预言机到期时间
    
    const marketKey = tx.moveCall({
        target: `${predictPackageID[network]}::market_key::new`,
        arguments: [
            tx.pure.id(ORACLE_SVI_ID),  // 注意：ID 类型要用 tx.pure.id() 或者 tx.pure.address()
            tx.pure.u64(ORACLE_EXPIRY),
            tx.pure.u64(STRIKE_PRICE),
            tx.pure.bool(IS_UP),
        ],
    });

    // 调用 predict::redeem
    tx.moveCall({
        target: `${predictPackageID[network]}::predict::redeem`,
        typeArguments: [DUSDC_TYPE],
        arguments: [
            tx.object(predictObjectID[network]),
            tx.object(MY_PREDICT_MANAGER_ID),
            tx.object(ORACLE_SVI_ID),
            marketKey,
            tx.pure.u64(QUANTITY),
            tx.object(CLOCK_ID),
        ],
    });

    try {
        const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer,
            options: { showEffects: true, showEvents: true },
        });

        if (result.effects?.status.status === 'success') {
            console.log('✅ redeem成功！');
            console.log(`Digest: ${result.digest}`);
        } else {
            console.error('❌ 下单失败:', result.effects?.status.error);
        }
    } catch (e) {
        console.error('交易异常:', e);
    }
})();
// scripts/transactions/predict/deposit_to_manager.ts
import { Transaction } from '@mysten/sui/transactions';
import { getActiveAddress, getClient, getSigner } from '../../utils/utils.js';
import {
    predictPackageID,
    dusdcPackageID,
} from '../../config/constants.js';

const network = 'testnet' as const;
const DUSDC_TYPE = `${dusdcPackageID[network]}::dusdc::DUSDC`;

// ------------------------------------------------------------
// 请替换为你实际的 PredictManager 对象 ID 和你想充值的金额
// ------------------------------------------------------------
const MY_PREDICT_MANAGER_ID = '0x926cbf800a051d8d93ac4d1ff9a049116ffd7c3705fe33baf5b45ac981f8b082'; 
const DEPOSIT_AMOUNT_DUSDC = 10n; // 举例：充值 50 DUSDC
const DEPOSIT_AMOUNT_RAW = DEPOSIT_AMOUNT_DUSDC * 1_000_000n; // 换算为精度单位 (DUSDC 是 6 位精度)

(async () => {
    const client = getClient(network);
    const signer = getSigner();
    const address = getActiveAddress();

    console.log(`Address: ${address}`);
    console.log(`PredictManager ID: ${MY_PREDICT_MANAGER_ID}`);
    console.log(`Amount: ${DEPOSIT_AMOUNT_DUSDC} DUSDC`);

    // 1. 获取钱包内所有的 DUSDC Coin 对象
    const { data: coins } = await client.getCoins({
        owner: address,
        coinType: DUSDC_TYPE,
    });

    if (coins.length === 0) {
        console.error('Error: Your wallet has 0 DUSDC coins.');
        process.exit(1);
    }

    const tx = new Transaction();
    let primaryCoinInput;

    // 2. 处理钱包里的 DUSDC 余额
    if (coins.length > 1) {
        // 如果有多个 DUSDC Coin，把它们全部合并到第一个 Coin 中
        const [firstCoin, ...otherCoins] = coins;
        tx.mergeCoins(
            tx.object(firstCoin.coinObjectId),
            otherCoins.map(c => tx.object(c.coinObjectId))
        );
        primaryCoinInput = tx.object(firstCoin.coinObjectId);
    } else {
        primaryCoinInput = tx.object(coins[0].coinObjectId);
    }

    // 3. 从主 DUSDC Coin 中 Split 出你想要充值的精确金额
    const [depositCoin] = tx.splitCoins(primaryCoinInput, [
        tx.pure.u64(DEPOSIT_AMOUNT_RAW),
    ]);

    // 4. 调用 predict_manager::deposit 将拆出的 Coin 充值进去
    // signature: deposit<T>(self: &mut PredictManager, coin: Coin<T>, ctx: &TxContext)
    tx.moveCall({
        target: `${predictPackageID[network]}::predict_manager::deposit`,
        typeArguments: [DUSDC_TYPE],
        arguments: [
            tx.object(MY_PREDICT_MANAGER_ID),
            depositCoin,
        ],
    });

    // 5. 签署并发送交易
    const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer,
        options: { showEffects: true },
    });

    if (result.effects?.status.status !== 'success') {
        console.error('Deposit failed:', result.effects?.status);
        process.exit(1);
    }

    console.log(`Successfully deposited ${DEPOSIT_AMOUNT_DUSDC} DUSDC into PredictManager!`);
    console.log(`Tx Digest: ${result.digest}`);
})();
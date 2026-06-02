import { Transaction } from '@mysten/sui/transactions';
import { getActiveAddress, getClient, getSigner } from '../../utils/utils.js';
import { predictPackageID } from '../../config/constants.js';

const network = 'testnet' as const;

(async () => {
    const client = getClient(network);
    const signer = getSigner();
    const address = getActiveAddress();

    console.log(`Creating PredictManager for address: ${address}`);

    const tx = new Transaction();

    // 调用 predict::create_manager(ctx)
    tx.moveCall({
        target: `${predictPackageID[network]}::predict::create_manager`,
        arguments: [], // 只有 ctx，运行时会自动传入
    });

    // 签署并提交交易
    const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer,
        options: { 
            showEffects: true,
            showEvents: true, // 显示事件以便我们捕获 Manager ID
            showObjectChanges: true, // 同样可以通过显示对象变化来捕获新创建的共享对象 ID
        },
    });

    if (result.effects?.status.status !== 'success') {
        console.error('Create PredictManager failed:', result.effects?.status);
        process.exit(1);
    }

    console.log('Successfully created PredictManager!');
    console.log(`Tx Digest: ${result.digest}`);

    // 1. 从 objectChanges 中提取创建的 PredictManager 共享对象的 ID
    const managerChange = result.objectChanges?.find(
        (change) =>
            change.type === 'created' &&
            change.objectType.includes('predict_manager::PredictManager')
    );

    //0x926cbf800a051d8d93ac4d1ff9a049116ffd7c3705fe33baf5b45ac981f8b082

    if (managerChange && 'objectId' in managerChange) {
        console.log(`\nYour PredictManager Object ID is: \x1b[32m${managerChange.objectId}\x1b[0m`);
        console.log('Save this ID! You will need it to deposit and mint positions.');
    } else {
        console.log('\nCould not automatically find the PredictManager ID in transaction effects.');
        console.log('Please check the Transaction Digest on explorer to find your new PredictManager object.');
    }
})();
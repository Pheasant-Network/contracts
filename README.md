# PheasantNetworkBridgeChild

This repository contains the core smart contracts for pheasant network v1. These smart contracts manage all the records user's and relayer's activity.
Please refer bridge-dispute-manager for inter-chain communication and tx verification.

## Testnet Deployment

1. Deploy Diamond
```bash
npx hardhat run scripts/deployDiamond.js --network [target L1 Network]
```
2. Deploy ChildCheckpointManager (You can skip this step for some networks)
```bash
npx hardhat run scripts/deployCheckpointManager.js --network [target L2 Network]
```
3. Deploy RootCheckpointManager (You can skip this step for some networks)
```bash
npx hardhat run scripts/deployCheckpointManager.js --network [target L1 Network]
```
4. Deploy BridgeDisputeManager
```bash
npx hardhat run scripts/deployDisputeManager.js --network [target L2 Network]
```
5. Deploy PheasantNetworkParameters
```bash
npx hardhat run scripts/deployParameters.js --network [target L2 Network]
``` 
6. Deploy PheasantNetworkBridgeChild
```bash
npx hardhat run scripts/deploy.js --network [target L2 Network]
```
7. Deploy BondManager
```bash
npx hardhat run scripts/deployBondManager.js --network [target L2 Network]
```
8. For zkSync (Because of the different logic to calculate contract address, we need to use managerSetting.js to change BondManager address)
```bash
npx hardhat run scripts/managerSetting.js --network zkSyncTestnet
```

## Which contract should be deployed when you add change on each contract
- BondManager
  - (PheasantNetworkBridgeChild)

    There is updator function in PheasantNetworkBridgeChild, but you need to wait for 3 hours.
- BridgeDisputeManager
  - PheasantNetworkBridgeChild
  - BondManager
- Diamond
  - RootCheckpointManager
  - ChildCheckpointManager
  - BridgeDisputeManager
  - PheasantNetworkBridgeChild
  - BondManager
- ChildCheckpointManager
  - RootCheckpointManager
  - BridgeDisputeManager
  - PheasantNetworkBridgeChild
  - BondManager
- RootCheckpointManager
  - no need to deploy, but need to call diamond cut function
- PheasantNetworkBridgeChild
  - BondManager

Don't forget to withdraw asset from BondManager contract before you deploy a new contract.
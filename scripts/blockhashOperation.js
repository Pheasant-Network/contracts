require('dotenv').config({ path: '../.env' });
const readlineSync = require('readline-sync');
const utils = require('../utils/index')

let contractAddressObj = utils.getContractAddresses()

const main = async () => {

  const accounts = await ethers.getSigners();

  let response
  let pheasantNetworkBridgeChild;
  let rootCheckpointManager;
  let childCheckpointManager;
  let diamondLoupeFacet;

  // const currentBlockNumber = await web3_goerli.eth.getBlockNumber();

  const address = contractAddressObj[hre.network.name].PheasantNetworkBridgeChild;

  if (hre.network.name == "goerli" || hre.network.name == "mainnet") {
    const diamondAddress = contractAddressObj[hre.network.name].Diamond;
    console.log("diamond Address", diamondAddress);
    const targetNetwork = readlineSync.question("Which L2 do you want to send blockhash?[p/o/a]");
    if (targetNetwork == "p") {
      rootCheckpointManager = await hre.ethers.getContractAt('PolygonRootCheckpointManager', diamondAddress);
      const tx = await rootCheckpointManager.getPolygonState();
      console.log("getPolygonState", tx);
    } else if (targetNetwork == "o") {
      rootCheckpointManager = await hre.ethers.getContractAt('OptimismRootCheckpointManager', diamondAddress);
      diamondLoupeFacet = await hre.ethers.getContractAt('DiamondLoupeFacet', diamondAddress);
      // const tx = await diamondLoupeFacet.facets();
      // console.log("tx", tx);
      // const tx = await rootCheckpointManager.getOptimismState();
      // console.log("getOptimismState", tx);
      // const childCheckpointManager = contractAddressObj["optimismGoerli"].OptimismChildCheckpointManager;
      // console.log(childCheckpointManager);
      // const l1CrossDomainMessenger = "0x5086d1eEF304eb5284A0f6720f79403b4e9bE294";
      // const tx = await rootCheckpointManager.optimismInit(
      //   childCheckpointManager,
      //   l1CrossDomainMessenger,
      //   { gasLimit: 800000 }
      // );
      // console.log(tx);

      const tx = await rootCheckpointManager.optimismSendBlockInfo(
        1001, 
        8933301, 
        "5000000", 
        { gasLimit: 800000 }
      );
      console.log(tx);

    } else if (targetNetwork == "a") {
      rootCheckpointManager = await hre.ethers.getContractAt('ArbitrumRootCheckpointManager', diamondAddress);
      const tx = await rootCheckpointManager.getArbitrumState();
      console.log("getArbitrumState", tx);
    } else {
      console.log("Pls select right network.")
    }
  } else if (hre.network.name == "optimismGoerli"){
    const childCheckpointManagerAddress = contractAddressObj[hre.network.name].OptimismChildCheckpointManager;
    console.log(childCheckpointManagerAddress);
    childCheckpointManager = await hre.ethers.getContractAt('OptimismChildCheckpointManager', childCheckpointManagerAddress);
    const tx = await childCheckpointManager.getBlockHash(1003, 8987417);
    console.log(tx);
  } else if (hre.network.name == "mumbai") {
    const childCheckpointManagerAddress = contractAddressObj[hre.network.name].PolygonChildCheckpointManager;
    console.log(childCheckpointManagerAddress);
    childCheckpointManager = await hre.ethers.getContractAt('PolygonChildCheckpointManager', childCheckpointManagerAddress);
    const tx =await childCheckpointManager.fxRootTunnel();
    console.log(tx);
  } else if (hre.network.name == "arbitrumGoerli") {
    const childCheckpointManagerAddress = contractAddressObj[hre.network.name].ArbitrumChildCheckpointManager;
    console.log(childCheckpointManagerAddress);
    const childCheckpointManager = await hre.ethers.getContractAt('ArbitrumChildCheckpointManager', childCheckpointManagerAddress);
    const tx = await childCheckpointManager.getBlockHash(1004, 8987931);
    console.log(tx);
  }

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


const hre = require("hardhat");
const utils = require('../utils/index')
const zksyncWeb3 = require("zksync-web3");
const zksyncDeploy = require("@matterlabs/hardhat-zksync-deploy");

async function main() {
  let contractAddressObj = utils.getContractAddresses()
  const accounts = await ethers.getSigners();
  console.log("Network name =", hre.network.name);

  let childCheckpointManagerAddress = "";
  let rootCheckpointManagerAddress = "";
  let deployedAddress = "";

  if (hre.network.name == "localhost") {
    const TestCheckpointManager = await hre.ethers.getContractFactory("TestCheckpointManager");
    const testCheckpointManager = await TestCheckpointManager.deploy();
    polygonChildCheckpointManagerAddress = testCheckpointManager.address;

  } else if (hre.network.name == "mumbai" || hre.network.name == "polygon") {

    // get childCheckpointManager address
    childCheckpointManagerAddress = contractAddressObj[hre.network.name].PolygonChildCheckpointManager;

    // create checkpointManager contract instance
    const polygonChildCheckpointManager = await hre.ethers.getContractAt(
      "contracts/polygon/checkpoint-manager/PolygonChildCheckpointManager.sol:PolygonChildCheckpointManager",
      childCheckpointManagerAddress
    );

    // get rootCheckpointManager address
    rootCheckpointManagerAddress = await polygonChildCheckpointManager.fxRootTunnel();

  } else if (hre.network.name == "optimismGoerli" || hre.network.name == "optimism") {

    // get childCheckpointManager address
    childCheckpointManagerAddress = contractAddressObj[hre.network.name].OptimismChildCheckpointManager;

    // create checkpointManager contract instance
    const optimismChildCheckpointManager = await hre.ethers.getContractAt(
      "contracts/L2/checkpoint-manager/OptimismChildCheckpointManager.sol:OptimismChildCheckpointManager",
      childCheckpointManagerAddress
    );

    // get rootCheckpointManager address
    rootCheckpointManagerAddress = await optimismChildCheckpointManager.rootCheckpointManager();
  } else if (hre.network.name == "arbitrumGoerli" || hre.network.name == "arbitrum") {

    // get childCheckpointManager address
    childCheckpointManagerAddress = contractAddressObj[hre.network.name].ArbitrumChildCheckpointManager;

    // create checkpointManager contract instance
    const arbitrumChildCheckpointManager = await hre.ethers.getContractAt(
      "contracts/L2/checkpoint-manager/ArbitrumChildCheckpointManager.sol:ArbitrumChildCheckpointManager",
      childCheckpointManagerAddress
    );

    // get rootCheckpointManager address
    rootCheckpointManagerAddress = await arbitrumChildCheckpointManager.rootCheckpointManager();
  }
  // === Comment ===
  // Pls return, once you check zkSync's l1ToL2Communication
  // ================
  // } else if (hre.network.name == "zkSyncTestnet") {

  //   // get childCheckpointManager address
  //   childCheckpointManagerAddress = contractAddressObj[hre.network.name].ZkSyncChildCheckpointManager;

  //   // create checkpointManager contract instance
  //   const zkSyncChildCheckpointManager = await hre.ethers.getContractAt(
  //     "contracts/L2/checkpoint-manager/ZkSyncChildCheckpointManager.sol:ZkSyncChildCheckpointManager",
  //     childCheckpointManagerAddress
  //   );

  //   // get rootCheckpointManager address
  //   rootCheckpointManagerAddress = await zkSyncChildCheckpointManager.rootCheckpointManager();
  // }

  // check rootCheckpointManager has been set
  if (rootCheckpointManagerAddress == "0x0000000000000000000000000000000000000000") {
    console.log("CheckpointManager doesn't inilialize!! Set tunnels first!");
    return;
  }
  if (hre.network.name == "zkSyncTestnet" || hre.network.name == "zkSync") {
    // === Comment ===
    // This is temporary dummy code.
    // Delete when you check zkSync's l1ToL2Communication is working.
    // ===============
    const mnemonic = process.env.MNEMONIC;
    const wallet = zksyncWeb3.Wallet.fromMnemonic(mnemonic);
    const deployer = new zksyncDeploy.Deployer(hre, wallet);
    const bridgeDisputeManagerArtifact = await deployer.loadArtifact("TemporaryDisputeManager");
    const bridgeDisputeManager = await deployer.deploy(bridgeDisputeManagerArtifact, []);
    console.log("bridgeDisputeManager TxHash: ", bridgeDisputeManager.deployTransaction.hash);
    deployedAddress = bridgeDisputeManager.address;
    console.log("BridgeDisputeManager address:", deployedAddress);
    // === Comment ===
    // This is true one.
    // Once you check zkSync's l1ToL2Communication is working, use this code to deploy real smart contract.
    // ================
    // const mnemonic = process.env.MNEMONIC;
    // const wallet = zksyncWeb3.Wallet.fromMnemonic(mnemonic);
    // const deployer = new zksyncDeploy.Deployer(hre, wallet);
    // const bridgeDisputeManagerArtifact = await deployer.loadArtifact("BridgeDisputeManager");
    // const bridgeDisputeManager = await deployer.deploy(bridgeDisputeManagerArtifact, [childCheckpointManagerAddress]);
    // console.log("BridgeDisputeManager TxHash:", bridgeDisputeManager.deployTransaction.hash);
    // deployedAddress = bridgeDisputeManager.address;
    // console.log("BridgeDisputeManager address:", deployedAddress);
  } else if (hre.network.name == "scrollTestnet" || hre.network.name == "baseGoerli" || hre.network.name == "polygonZkEvmGoerli" || hre.network.name == "lineaGoerli" || hre.network.name == "taikoTestnet" || hre.network.name == "polygonZkEvm" || hre.network.name == "linea" || hre.network.name == "mantleTestnet" || hre.network.name == "mantle" || hre.network.name == "base" || hre.network.name == "scroll") {
    // deploy RLPDecoder
    const RLPDecoder = await hre.ethers.getContractFactory("SolRLPDecoder");
    const rlpDecoder = await RLPDecoder.deploy();
    const BridgeDisputeManager = await hre.ethers.getContractFactory("TemporaryDisputeManager", {
      libraries: {
        SolRLPDecoder: rlpDecoder.address,
      },
    });
    const bridgeDisputeManager = await BridgeDisputeManager.connect(accounts[0]).deploy();
    console.log("BridgeDisputeManager TxHash:", bridgeDisputeManager.deployTransaction.hash);
    deployedAddress = bridgeDisputeManager.address;
    console.log("BridgeDisputeManager address:", deployedAddress);
  } else {
    // deploy RLPDecoder
    const RLPDecoder = await hre.ethers.getContractFactory("SolRLPDecoder");
    const rlpDecoder = await RLPDecoder.deploy();

    // deploy BridgeDisputeanager
    const BridgeDisputeManager = await hre.ethers.getContractFactory("BridgeDisputeManager", {
      libraries: {
        SolRLPDecoder: rlpDecoder.address,
      },
    });
    const bridgeDisputeManager = await BridgeDisputeManager.connect(accounts[0]).deploy(childCheckpointManagerAddress);

    console.log("BridgeDisputeManager TxHash:", bridgeDisputeManager.deployTransaction.hash);
    await bridgeDisputeManager.deployed();

    deployedAddress = bridgeDisputeManager.address;
    console.log("BridgeDisputeManager address:", deployedAddress);
  }

  contractAddressObj[hre.network.name].BridgeDisputeManager = deployedAddress;
  utils.writeContractAddresses(contractAddressObj);

  // save contract address on lig file
  utils.saveContractAddress(
    network,
    "BridgeDisputeManager.sol",
    deployedAddress,
    accounts[0].address
  )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

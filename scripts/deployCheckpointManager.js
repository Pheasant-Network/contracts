// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const utils = require('../utils/index');
const readlineSync = require('readline-sync');
const zksyncWeb3 = require("zksync-web3");
const zksyncDeploy = require("@matterlabs/hardhat-zksync-deploy");
const { getSelectors, FacetCutAction } = require("./libraries/diamond");
require('dotenv').config();

// Polygon
const fxChildMumbai = "0xCf73231F28B7331BBe3124B907840A94851f9f11";
const fxChildPolygon = "0x8397259c983751DAf40400790063935a11afa28a";
const checkpointGoerli = "0x2890bA17EfE978480615e330ecB65333b880928e";
const fxRootGoerli = "0x3d1d3E34f7fB6D26245E6640E1c50710eFFf15bA";
const checkpointEthereumMainnet = "0x86E4Dc95c7FBdBf52e33D563BbDB00823894C287";
const fxRootEthereumMainnet = "0xfe5e5D361b2ad62c541bAb87C45a0B9B018389a2";

// Optimism
const l2CrossDomainMessager = "0x4200000000000000000000000000000000000007";
const optimismGoerliL1CrossDomainMessage = "0x5086d1eEF304eb5284A0f6720f79403b4e9bE294";
const optimismL1CrossDomainMessage = "0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1";

// Arbitrum
const arbitrumInboxContract = "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f";
const arbitrumGoerliInboxContract = "0x6BEbC4925716945D46F0Ec336D5C2564F419682C";

async function main() {
  let contractAddressObj = utils.getContractAddresses()
  const accounts = await ethers.getSigners();
  console.log("Network name =", hre.network.name);
  const newOwner = process.env.NEW_OWNER;
  console.log("Owner =", newOwner);

  let fxChild = "";
  let fxRoot = "";
  let checkpoint = "";
  let diamond = "";

  let contractPrefixForlog = "";
  let deployedAddress = "";

  // Polygon
  const PolygonChildCheckpointManager = await hre.ethers.getContractFactory("PolygonChildCheckpointManager");
  const PolygonRootCheckpointManager = await hre.ethers.getContractFactory("PolygonRootCheckpointManager");

  // Optimism
  const OptimismChildCheckpointManager = await hre.ethers.getContractFactory("OptimismChildCheckpointManager");
  const OptimismRootCheckpointManager = await hre.ethers.getContractFactory("OptimismRootCheckpointManager");

  // Arbitrum
  const ArbitrumChildCheckpointManager = await hre.ethers.getContractFactory("ArbitrumChildCheckpointManager");
  const ArbitrumRootCheckpointManager = await hre.ethers.getContractFactory("ArbitrumRootCheckpointManager");

  // zkSync
  // const ZkSyncRootCheckpointManager = await hre.ethers.getContractFactory("ZkSyncRootCheckpointManager");

  if (hre.network.name == "mumbai") {
    fxChild = fxChildMumbai;
  } else if (hre.network.name == "polygon") {
    fxChild = fxChildPolygon;
  } else if (hre.network.name == "goerli") {
    fxRoot = fxRootGoerli;
    checkpoint = checkpointGoerli;
  } else if (hre.network.name == "mainnet") {
    fxRoot = fxRootEthereumMainnet;
    checkpoint = checkpointEthereumMainnet;
  }

  // Child Checkpoint Manager -------------------------

  if (hre.network.name == "mumbai" || hre.network.name == "polygon") {
    let diamond = "";
    if (hre.network.name == "mumbai") {
      diamond = contractAddressObj["goerli"].Diamond;
    } else {
      diamond = contractAddressObj["mainnet"].Diamond;
    }

    const polygonChildCheckpointManager = await PolygonChildCheckpointManager
      .connect(accounts[0])
      .deploy(
        diamond,
        newOwner,
        fxChild
      );
    console.log("PolygonChildCheckpointManager TxHash:", polygonChildCheckpointManager.deployTransaction.hash);
    await polygonChildCheckpointManager.deployed();

    deployedAddress = polygonChildCheckpointManager.address;
    console.log("PolygonChildCheckpointManager address:", deployedAddress);

    contractAddressObj[hre.network.name].PolygonChildCheckpointManager = deployedAddress;
    contractPrefixForlog = "PolygonChild";

  } else if (hre.network.name == "optimismGoerli" || hre.network.name == "optimism") {
    let diamond = "";
    if (hre.network.name == "optimismGoerli") {
      diamond = contractAddressObj["goerli"].Diamond;
    } else {
      diamond = contractAddressObj["mainnet"].Diamond;
    }
    const optimismChildCheckpointManager = await OptimismChildCheckpointManager
      .connect(accounts[0])
      .deploy(
        diamond,
        newOwner,
        l2CrossDomainMessager
      );
    console.log("OptimismChildCheckpointManager TxHash:", optimismChildCheckpointManager.deployTransaction.hash);
    await optimismChildCheckpointManager.deployed();

    deployedAddress = optimismChildCheckpointManager.address
    console.log("OptimismChildCheckpointManager address:", deployedAddress);

    contractAddressObj[hre.network.name].OptimismChildCheckpointManager = deployedAddress;
    contractPrefixForlog = "OptimismChild";

  } else if (hre.network.name == "arbitrumGoerli" || hre.network.name == "arbitrum") {
    if (hre.network.name == "arbitrumGoerli") {
      diamond = contractAddressObj["goerli"].Diamond;
    } else {
      diamond = contractAddressObj["mainnet"].Diamond;
    }
    // deploy script for arbitrum
    const arbitrumChildCheckpointManager = await ArbitrumChildCheckpointManager
      .connect(accounts[0])
      .deploy(
        diamond,
        newOwner
      );
    console.log("ArbitrumChildCheckpointManager TxHash:", arbitrumChildCheckpointManager.deployTransaction.hash);
    await arbitrumChildCheckpointManager.deployed();

    deployedAddress = arbitrumChildCheckpointManager.address
    console.log("ArbitrumChildCheckpointManager address:", deployedAddress);

    contractAddressObj[hre.network.name].ArbitrumChildCheckpointManager = deployedAddress;
    contractPrefixForlog = "ArbitrumChild";
  }
  // } else if (hre.network.name == "zkSyncTestnet") {
  //   const mnemonic = process.env.MNEMONIC;
  //   const wallet = zksyncWeb3.Wallet.fromMnemonic(mnemonic);
  //   const deployer = new zksyncDeploy.Deployer(hre, wallet);
  //   const artifact = await deployer.loadArtifact("ZkSyncChildCheckpointManager");
  //   const zkSyncChildCheckpointManager = await deployer.deploy(artifact, []);
  //   console.log("ZkSyncChildCheckpointManager TxHash: ", zkSyncChildCheckpointManager.deployTransaction.hash);
  //   const deployedAddress = zkSyncChildCheckpointManager.address;
  //   console.log("ZkSyncChildCheckpointManager address:", deployedAddress);

  //   contractAddressObj[hre.network.name].ZkSyncChildCheckpointManager = deployedAddress;
  //   contractPrefixForlog = "ZkSyncChild";
  // }

  // Root Checkpoint Manager ------------

  if (hre.network.name == "goerli" || hre.network.name == "mainnet") {
    let diamondAddress = "";
    if (hre.network.name == "goerli") {
      diamondAddress = contractAddressObj["goerli"].Diamond;
    } else if (hre.network.name == "mainnet") {
      diamondAddress = contractAddressObj["mainnet"].Diamond;
    }
    console.log("Diamond address =", diamondAddress);
    const diamondCutFacet = await hre.ethers.getContractAt('DiamondCutFacet', diamondAddress);

    console.log("Deploying Root Checkpoint Manager");

    const childNetwork = readlineSync.question(
      "Which child network?: [polygon(p) / optimism(o) / arbitrum(a)]"
    );

    if (childNetwork == "polygon" || childNetwork == "p") {
      let childCheckpointManager = "";
      if (hre.network.name == "mainnet") {
        childCheckpointManager = contractAddressObj["polygon"].PolygonChildCheckpointManager;
      } else if (hre.network.name == "goerli") {
        childCheckpointManager = contractAddressObj["mumbai"].PolygonChildCheckpointManager;
      }

      const polygonRootCheckpointManager = await PolygonRootCheckpointManager
        .connect(accounts[0])
        .deploy();
      console.log("PolygonRootCheckpointManager TxHash:", polygonRootCheckpointManager.deployTransaction.hash);
      await polygonRootCheckpointManager.deployed();

      deployedAddress = polygonRootCheckpointManager.address;
      console.log("PolygonRootCheckpointManager address:", deployedAddress);

      contractAddressObj[hre.network.name].PolygonRootCheckpointManager = deployedAddress;
      contractPrefixForlog = "PolygonRoot";

      let initCall = polygonRootCheckpointManager.interface.encodeFunctionData(
        "polygonInit",
        [childCheckpointManager, fxRoot]
      );

      const selectors = getSelectors(polygonRootCheckpointManager);

      const tx = await diamondCutFacet.diamondCut(
        [{
          facetAddress: polygonRootCheckpointManager.address,
          action: FacetCutAction.Add,
          functionSelectors: selectors
        }],
        polygonRootCheckpointManager.address,
        initCall,
        { gasLimit: 800000 }
      );

      console.log("diamond cut txHash: ", tx.hash);

    } else if (childNetwork == "optimism" || childNetwork == "o") {
      let l1CrossDomainMessage = "";
      let childCheckpointManager = "";
      if (hre.network.name == "mainnet") {
        childCheckpointManager = contractAddressObj["optimism"].OptimismChildCheckpointManager;
        l1CrossDomainMessage = optimismL1CrossDomainMessage;
      } else if (hre.network.name == "goerli") {
        childCheckpointManager = contractAddressObj["optimismGoerli"].OptimismChildCheckpointManager;
        l1CrossDomainMessage = optimismGoerliL1CrossDomainMessage;
      }
      const optimismRootCheckpointManager = await OptimismRootCheckpointManager
        .connect(accounts[0])
        .deploy();
      await optimismRootCheckpointManager.deployed();
      console.log("OptimismRootCheckpointManager TxHash:", optimismRootCheckpointManager.deployTransaction.hash);

      deployedAddress = optimismRootCheckpointManager.address;
      console.log("OptimismRootCheckpointManager address:", deployedAddress);

      contractAddressObj[hre.network.name].OptimismRootCheckpointManager = deployedAddress;
      contractPrefixForlog = "OptimismRoot";

      let initCall = optimismRootCheckpointManager.interface.encodeFunctionData(
        "optimismInit",
        [childCheckpointManager, l1CrossDomainMessage]
      );

      const selectors = getSelectors(optimismRootCheckpointManager);

      const tx = await diamondCutFacet.diamondCut(
        [{
          facetAddress: optimismRootCheckpointManager.address,
          action: FacetCutAction.Add,
          functionSelectors: selectors
        }],
        optimismRootCheckpointManager.address,
        initCall,
        { gasLimit: 800000 }
      );

      console.log("diamond cut txHash: ", tx.hash);

    } else if (childNetwork == "arbitrum" || childNetwork == "a") {
      let inbox = "";
      let childCheckpointManager = "";
      if (hre.network.name == "mainnet") {
        childCheckpointManager = contractAddressObj["arbitrum"].ArbitrumChildCheckpointManager;
        inbox = arbitrumInboxContract;
      } else if (hre.network.name == "goerli") {
        childCheckpointManager = contractAddressObj["arbitrumGoerli"].ArbitrumChildCheckpointManager;
        inbox = arbitrumGoerliInboxContract;
      }
      const arbitrumRootCheckpointManager = await ArbitrumRootCheckpointManager
        .connect(accounts[0])
        .deploy();
      await arbitrumRootCheckpointManager.deployed();
      console.log("ArbitrumRootCheckpointManager TxHash:", arbitrumRootCheckpointManager.deployTransaction.hash);

      deployedAddress = arbitrumRootCheckpointManager.address;
      console.log("ArbitrumRootCheckpointManager address:", deployedAddress);

      contractAddressObj[hre.network.name].ArbitrumRootCheckpointManager = deployedAddress;
      contractPrefixForlog = "ArbitrumRoot";

      let initCall = arbitrumRootCheckpointManager.interface.encodeFunctionData(
        "arbitrumInit",
        [childCheckpointManager, inbox]
      );

      const selectors = getSelectors(arbitrumRootCheckpointManager);

      const tx = await diamondCutFacet.diamondCut(
        [{
          facetAddress: arbitrumRootCheckpointManager.address,
          action: FacetCutAction.Add,
          functionSelectors: selectors
        }],
        arbitrumRootCheckpointManager.address,
        initCall,
        { gasLimit: 800000 }
      );

      console.log("diamond cut txHash: ", tx.hash);
    }
    // } else if (childNetwork == "zkSync" || childNetwork == "z") {
    //   const zkSyncRootCheckpointManager = await ZkSyncRootCheckpointManager
    //     .connect(accounts[0])
    //     .deploy();
    //   await zkSyncRootCheckpointManager.deployed();
    //   console.log("zkSyncRootCheckpointManager TxHash:", zkSyncRootCheckpointManager.deployTransaction.hash);

    //   deployedAddress = zkSyncRootCheckpointManager.address;
    //   console.log("zkSyncRootCheckpointManager address:", deployedAddress);

    //   contractAddressObj[hre.network.name].ZkSyncRootCheckpointManager = deployedAddress;
    //   contractPrefixForlog = "ZkSync";
    // }
  }

  utils.writeContractAddresses(contractAddressObj);

  // save contract address on lig file
  utils.saveContractAddress(
    network,
    contractPrefixForlog + "CheckpointManager.sol",
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

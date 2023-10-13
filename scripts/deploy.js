// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const BN = require('bn.js');
const zksyncWeb3 = require("zksync-web3");
const zksyncDeploy = require("@matterlabs/hardhat-zksync-deploy");
const utils = require('../utils/index')
require('dotenv').config({ path: '../.env' });

async function main() {
  console.log('New owner? : ' + process.env.NEW_OWNER);
  let contractAddressObj = utils.getContractAddresses()
  const accounts = await ethers.getSigners();
  console.log("Network name =", hre.network.name);
  let parametersAddress = "";
  let disputeManagerAddress = "";
  let bondManagerAddress = "";
  let newOwner = "";
  let PheasantNetworkBridgeChild;

  let networkCode;

  if (hre.network.name == "localhost") {
    const TestToken = await hre.ethers.getContractFactory("TestToken");
    const testToken = await TestToken.deploy(accounts[0].address);
    console.log("TestToken address:", testToken.address);
    contractAddressObj[hre.network.name].TestToken = testToken.address;
    utils.writeContractAddresses(contractAddressObj)

    const TestDisputeManager = await hre.ethers.getContractFactory("TestDisputeManager");
    const testDisputeManager = await TestDisputeManager.deploy();
    disputeManagerAddress = testDisputeManager.address;
    newOwner = accounts[0].address;

  } else {
    newOwner = process.env.NEW_OWNER;
    parametersAddress = contractAddressObj[hre.network.name].PheasantNetworkParameters;
    disputeManagerAddress = contractAddressObj[hre.network.name].BridgeDisputeManager;
    console.log("BridgeDisputeManager address: ", disputeManagerAddress);
    const accountNonce = await accounts[0].getTransactionCount();
    bondManagerAddress = hre.ethers.utils.getContractAddress({
      from: accounts[0].address,
      nonce: accountNonce + 1
    })
    console.log("BondManager address: ", bondManagerAddress);

    if (hre.network.name == "mumbai" || hre.network.name == "polygon" || hre.network.name == "mantle" || hre.network.name == "mantleTestnet") {
      // Polygon bridge child contract
      PheasantNetworkBridgeChild = await hre.ethers.getContractFactory(
        "contracts/polygon/PolygonPheasantNetworkBridgeChild.sol:PolygonPheasantNetworkBridgeChild"
      );
    } else {
      // L2 bridge child contract
      PheasantNetworkBridgeChild = await hre.ethers.getContractFactory(
        "contracts/L2/PheasantNetworkBridgeChild.sol:PheasantNetworkBridgeChild"
      );
    } 

  }

  let pheasantNetworkBridgeChild;
  if (hre.network.name == "zkSyncTestnet" || hre.network.name == "zkSync") {
    const mnemonic = process.env.MNEMONIC;
    const wallet = zksyncWeb3.Wallet.fromMnemonic(mnemonic);
    const deployer = new zksyncDeploy.Deployer(hre, wallet);
    const artifact = await deployer.loadArtifact("contracts/L2/PheasantNetworkBridgeChild.sol:PheasantNetworkBridgeChild");
    pheasantNetworkBridgeChild = await deployer.deploy(artifact, [
        parametersAddress, 
        disputeManagerAddress,
        bondManagerAddress,
        newOwner
      ]);
    console.log("PheasantNetworkBridgeChild TxHash: ", pheasantNetworkBridgeChild.deployTransaction.hash);
  } else {
    pheasantNetworkBridgeChild = await PheasantNetworkBridgeChild
      .connect(accounts[0])
      .deploy(
        parametersAddress, 
        disputeManagerAddress,
        bondManagerAddress,
        newOwner
      );

    console.log("PheasantNetworkBridgeChild TxHash:", pheasantNetworkBridgeChild.deployTransaction.hash);
    await pheasantNetworkBridgeChild.deployed();
  }

  console.log("PheasantNetworkBridgeChild address:", pheasantNetworkBridgeChild.address);
  contractAddressObj[hre.network.name].PheasantNetworkBridgeChild = pheasantNetworkBridgeChild.address;
  utils.writeContractAddresses(contractAddressObj)

  //
  utils.saveContractAddress(
    network,
    "PheasantNetworkBridgeChild.sol",
    pheasantNetworkBridgeChild.address,
    accounts[0].address,
    newOwner
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

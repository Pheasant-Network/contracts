const hre = require("hardhat");
const utils = require("../utils/index");
const { network } = require("hardhat");
const zksyncWeb3 = require("zksync-web3");
const zksyncDeploy = require("@matterlabs/hardhat-zksync-deploy");
require('dotenv').config();

async function main() {
  let contractAddressObj = utils.getContractAddresses()
  const accounts = await ethers.getSigners();
  console.log("Network name =", hre.network.name);
  const newOwner = process.env.NEW_OWNER;

  let parametersAddress = contractAddressObj[hre.network.name].PheasantNetworkParameters;
  let bridgeAddress = "";
  let deployedAddress = "";

  if (hre.network.name == "mumbai" || hre.network.name == "polygon" || hre.network.name == "mantle" || hre.network.name == "mantleTestnet") {
    bridgeAddress = contractAddressObj[hre.network.name].PheasantNetworkBridgeChild;
    const BondManager = await hre.ethers.getContractFactory("BondManager");
    const bondManager = await BondManager
      .connect(accounts[0])
      .deploy(
        newOwner, 
        bridgeAddress, 
        parametersAddress,
        false)
      ;
    console.log("BondManager TxHash:", bondManager.deployTransaction.hash);
    await bondManager.deployed();
    deployedAddress = bondManager.address;
    console.log("BondManager address:", deployedAddress);
  } else if (hre.network.name == "zkSyncTestnet" || hre.network.name == "zkSync") {
    bridgeAddress = contractAddressObj[hre.network.name].PheasantNetworkBridgeChild;
    const mnemonic = process.env.MNEMONIC;
    const wallet = zksyncWeb3.Wallet.fromMnemonic(mnemonic);
    const deployer = new zksyncDeploy.Deployer(hre, wallet);
    const bondManagerArtifact = await deployer.loadArtifact("BondManager");
    const bondManager = await deployer.deploy(bondManagerArtifact, [
        newOwner, 
        bridgeAddress, 
        parametersAddress,
        true
    ]);
    console.log("bondManager TxHash: ", bondManager.deployTransaction.hash);
    deployedAddress = bondManager.address;
    console.log("BondManager address:", deployedAddress);
  } else {
    bridgeAddress = contractAddressObj[hre.network.name].PheasantNetworkBridgeChild;
    const BondManager = await hre.ethers.getContractFactory("BondManager");
    const bondManager = await BondManager
      .connect(accounts[0])
      .deploy(
        newOwner, 
        bridgeAddress, 
        parametersAddress,
        true
      );
    console.log("BondManager TxHash:", bondManager.deployTransaction.hash);
    await bondManager.deployed();
    deployedAddress = bondManager.address;
    console.log("BondManager address:", deployedAddress);
  }

  contractAddressObj[hre.network.name].BondManager = deployedAddress;
  utils.writeContractAddresses(contractAddressObj);

  utils.saveContractAddress(
    network,
    "BondManager.sol",
    deployedAddress,
    accounts[0].address
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

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
require('dotenv').config();

async function main() {
  let contractAddressObj = utils.getContractAddresses()
  const accounts = await ethers.getSigners();
  console.log("Network name =", hre.network.name);

  let deployedAddress = "";
  // Child Checkpoint Manager -------------------------

  if (hre.network.name == "zkSyncTestnet" || hre.network.name == "zkSync") {
    const mnemonic = process.env.MNEMONIC;
    const wallet = zksyncWeb3.Wallet.fromMnemonic(mnemonic);
    const deployer = new zksyncDeploy.Deployer(hre, wallet);
    const artifact = await deployer.loadArtifact("SolRLPDecoder");
    const solRLPDecoder = await deployer.deploy(artifact, []);
    console.log("SolRLPDecoder TxHash: ", solRLPDecoder.deployTransaction.hash);
    const deployedAddress = solRLPDecoder.address;
    console.log("SolRLPDecoder address:", deployedAddress);

    contractAddressObj[hre.network.name].SolRLPDecoder = deployedAddress;
  } else {
    console.log("This is only for zkSync!");
  }

  utils.writeContractAddresses(contractAddressObj);

  // save contract address on lig file
  utils.saveContractAddress(
    network,
    "SolRLPDecoder.sol",
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

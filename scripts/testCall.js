// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const BN = require('bn.js');
const tradeThreshold = "100000000000000000";
const tradeMinimumAmount = "5000000000000000";
const utils = require('../utils/index');
const { ethers } = require("ethers");
require('dotenv').config({ path: '../.env' });

async function main() {
  let contractAddressObj = utils.getContractAddresses()
  // const accounts = await ethers.getSigners();
  console.log("Network name =", hre.network.name);
  const tokenAddressList = [];
  let disputeManagerAddress = "";
  let newOwner = "";
  let provider = "";
  let PheasantNetworkBridgeChild;

  if (hre.network.name == "localhost" || hre.network.name == "hardhat") {
    const TestToken = await hre.ethers.getContractFactory("TestToken");
    const testToken = await TestToken.deploy(accounts[0].address);
    console.log("TestToken address:", testToken.address);
    tokenAddressList.push(testToken.address);

    const TestDisputeManager = await hre.ethers.getContractFactory("TestDisputeManager");
    const testDisputeManager = await TestDisputeManager.deploy();
    disputeManagerAddress = testDisputeManager.address;
    newOwner = accounts[0].address;

    PheasantNetworkBridgeChild = await hre.ethers.getContractFactory(
      "contracts/L2/PheasantNetworkBridgeChild.sol:PheasantNetworkBridgeChild"
    );

  } else {
    newOwner = process.env.NEW_OWNER;
    disputeManagerAddress = contractAddressObj[hre.network.name].BridgeDisputeManager;
    console.log("BridgeDisputeManager address: ", disputeManagerAddress);

    if (hre.network.name == "mumbai" || hre.network.name == "polygon") {
      // Polygon bridge child contract
      PheasantNetworkBridgeChild = await hre.ethers.getContractFactory(
        "contracts/polygon/PheasantNetworkBridgeChild.sol:PheasantNetworkBridgeChild"
      );
      tokenAddressList.push(contractAddressObj[hre.network.name].WETH);
    } else if (hre.network.name == "optimismGoerli" || hre.network.name == "optimism") {
      // L2 bridge child contract
      PheasantNetworkBridgeChild = await hre.ethers.getContractFactory(
        "contracts/L2/PheasantNetworkBridgeChild.sol:PheasantNetworkBridgeChild"
      );
      tokenAddressList.push("0x0000000000000000000000000000000000000000")
    }
  }

  const pheasantNetworkBridgeChild = await PheasantNetworkBridgeChild.connect(accounts[0]).deploy(tokenAddressList, tradeThreshold, disputeManagerAddress, accounts[0].address, tradeMinimumAmount);

  await pheasantNetworkBridgeChild.deployed();
  console.log("PheasantNetworkBridgeChild address:", pheasantNetworkBridgeChild.address);

  console.log(await pheasantNetworkBridgeChild.relayers(accounts[0].address))

  await pheasantNetworkBridgeChild.depositBond("1000", 370000, {value: "1000"})

  console.log(await pheasantNetworkBridgeChild.relayers(accounts[0].address))
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
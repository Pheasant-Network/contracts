const hre = require("hardhat");
const BN = require('bn.js');
const tradeThreshold = "100000000000000000";
const tradeMinimumAmount = "5000000000000000";
const utils = require('../utils/index');
const { ethers } = require("ethers");
require('dotenv').config({ path: '../.env' });

async function main() {
  let contractAddressObj = utils.getContractAddresses()
  const accounts = await hre.ethers.getSigners();
  console.log("Network name =", hre.network.name);
  const tokenAddressList = [];

  const balance = await hre.ethers.provider.getBalance(accounts[0].address)
  console.log(balance)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

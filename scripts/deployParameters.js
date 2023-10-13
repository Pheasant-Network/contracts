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
  const tokenAddressList = [];
  let newOwner = "";

  let tradeParam = {
    tradeThreshold: hre.ethers.BigNumber.from("100000000010000000"),
    tradeMinimumAmount: hre.ethers.BigNumber.from("5000000000000000"),
    networkCode: 0,
    tradableBondRatio: 220,
    disputeDepositAmount: hre.ethers.BigNumber.from("5000000000000000"),
  }

  let feeList = {
    high: hre.ethers.BigNumber.from("10000000000000"),
    medium: hre.ethers.BigNumber.from("10000000000000"),
    low: hre.ethers.BigNumber.from("10000000000000"),
    gasPriceThresholdHigh: 0,
    gasPriceThresholdLow: 0
  }

  let availableNetwork = [1001];
  let slashableNetwork = [];
  let nativeIsNotETHNetworkCode = [0];

  newOwner = process.env.NEW_OWNER;
  const PheasantNetworkParameters = await hre.ethers.getContractFactory(
    "contracts/L2/PheasantNetworkParameters.sol:PheasantNetworkParameters"
  );

  if (hre.network.name == "mumbai" || hre.network.name == "polygon") {
    tradeParam.networkCode = 1002;
    tokenAddressList.push(contractAddressObj[hre.network.name].WETH);
  } else if (hre.network.name == "optimismGoerli" || hre.network.name == "optimism") {
    tradeParam.networkCode = 1003;
    tokenAddressList.push("0x0000000000000000000000000000000000000000")
  } else if (hre.network.name == "arbitrumGoerli" || hre.network.name == "arbitrum") {
    tradeParam.networkCode = 1004;
    tokenAddressList.push("0x0000000000000000000000000000000000000000")
  } else if (hre.network.name == "scrollTestnet" || hre.network.name == "scroll") {
    tradeParam.networkCode = 1005;
    tokenAddressList.push("0x0000000000000000000000000000000000000000")
  } else if (hre.network.name == "zkSyncTestnet"|| hre.network.name == "zkSync") {
    tradeParam.networkCode = 1006;
    tokenAddressList.push("0x0000000000000000000000000000000000000000")
  } else if (hre.network.name == "baseGoerli" || hre.network.name == "base") {
    tradeParam.networkCode = 1007;
    tokenAddressList.push("0x0000000000000000000000000000000000000000")
  } else if (hre.network.name == "polygonZkEvmGoerli" || hre.network.name == "polygonZkEvm") {
    tradeParam.networkCode = 1008;
    tokenAddressList.push("0x0000000000000000000000000000000000000000")
  } else if (hre.network.name == "lineaGoerli"|| hre.network.name == "linea") {
    tradeParam.networkCode = 1009;
    tokenAddressList.push("0x0000000000000000000000000000000000000000")
  } else if (hre.network.name == "taikoTestnet") {
    tradeParam.networkCode = 1010;
    tokenAddressList.push("0x0000000000000000000000000000000000000000")
  } else if (hre.network.name == "mantleTestnet"|| hre.network.name == "mantle") {
    tradeParam.networkCode = 1011;
    tokenAddressList.push(contractAddressObj[hre.network.name].WETH);
  }


  let pheasantNetworkParameters;
  if (hre.network.name == "zkSyncTestnet" || hre.network.name == "zkSync") {
    const mnemonic = process.env.MNEMONIC;
    const wallet = zksyncWeb3.Wallet.fromMnemonic(mnemonic);
    const deployer = new zksyncDeploy.Deployer(hre, wallet);
    const artifact = await deployer.loadArtifact("contracts/L2/PheasantNetworkParameters.sol:PheasantNetworkParameters");
    pheasantNetworkParameters = await deployer.deploy(artifact, [
        tokenAddressList,
        newOwner,
        tradeParam,
        availableNetwork,
        slashableNetwork,
        nativeIsNotETHNetworkCode,
        feeList
    ]);
    console.log("PheasantNetworkParameters TxHash: ", pheasantNetworkParameters.deployTransaction.hash);
  } else {
    pheasantNetworkParameters = await PheasantNetworkParameters
      .connect(accounts[0])
      .deploy(
        tokenAddressList,
        newOwner,
        tradeParam,
        availableNetwork,
        slashableNetwork,
        nativeIsNotETHNetworkCode,
        feeList,
      );

    console.log("PheasantNetworkParameters TxHash:", pheasantNetworkParameters.deployTransaction.hash);
    await pheasantNetworkParameters.deployed();
  }

  console.log("PheasantNetworkParameters address:", pheasantNetworkParameters.address);
  contractAddressObj[hre.network.name].PheasantNetworkParameters = pheasantNetworkParameters.address;
  utils.writeContractAddresses(contractAddressObj)

  //
  utils.saveContractAddress(
    network,
    "PheasantNetworkParameters.sol",
    pheasantNetworkParameters.address,
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

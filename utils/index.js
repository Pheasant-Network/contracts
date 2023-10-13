const fs = require('fs');
require('dotenv').config();
const Web3 = require('web3');
const HDWalletProvider = require("@truffle/hdwallet-provider");

// get contract address list fron json file
module.exports.getContractAddresses = function(path) {
  let cd = path;
  if(typeof path === "undefined") {
    cd = `${process.cwd()}/contractAddresses.json`
  }

  console.log(fs.existsSync(cd))
  if (!fs.existsSync(cd)) {
    const contractAddresses = require("./contractAddresses.sample.json");
    fs.writeFileSync(cd, JSON.stringify(contractAddresses));
    console.log(">Contract Addresses file has been created");
  };

  return JSON.parse(fs.readFileSync(cd).toString())
}

// update contract address
module.exports.writeContractAddresses = function(contractAddresses) {
  fs.writeFileSync(
    `${process.cwd()}/contractAddresses.json`,
    JSON.stringify(contractAddresses, null, 2) // Indent 2 spaces
  )
}

// save contract deployment log
module.exports.saveContractAddress = function(
  network,
  contractName,
  contractAddress,
  deployer,
  owner,
) {
  const logFilePath = `${process.cwd()}/log.json`;
  const currentDate = new Date();

  if (!fs.existsSync(logFilePath)) {
    const tempFile = [{ "log" : "file" }];
    fs.writeFileSync(logFilePath, JSON.stringify(tempFile));
    console.log("> Log file has been created");
  };

  const log = JSON.parse(fs.readFileSync(logFilePath));
  log.unshift(
    {
      network,
      contractName,
      contractAddress,
      deployer,
      owner,
      "deployedAt": currentDate.toLocaleString()
    }
  );

  fs.writeFileSync(
    logFilePath,
    JSON.stringify(log, null, 2)
  )
  console.log(">Contract address has been saved on log file.")
}

module.exports.getNetwork = (chainName) => {
  let chainId
  let provider
  switch (chainName) {
    case "goerli":
      chainId = 5;
      provider = process.env.GOERLI_PROVIDER1;
      break;
    case "mainnet":
      chainId = 1;
      provider = process.env.ETHEREUM_PROVIDER1;
      break;
    case "mumbai":
      chainId = 80001;
      provider = process.env.MUMBAI_PROVIDER1;
      break;
    case "polygon":
      chainId = 137;
      provider = process.env.POLYGON_PROVIDER1;
      break;
    case "optimismGoerli":
      chainId = 420;
      provider = process.env.OPTIMISM_GOERLI_PROVIDER1;
      break;
    case "optimism":
      chainId = 10;
      provider = process.env.OPTIMISM_PROVIDER1;
      break;
    case "arbitrumGoerli":
      chainId = 421613;
      provider = process.env.ARBITRUM_GOERLI_PROVIDER1;
      break;
    case "arbitrum":
      chainId = 42161;
      provider = process.env.ARBITRUM_PROVIDER1;
      break;
    case "scrollTestnet":
      chainId = 534351;
      provider = process.env.SCROLL_TESTNET_PROVIDER1;
      break;
    case "zkSyncTestnet":
      chainId = 280;
      provider = process.env.ZK_SYNC_TESTNET_PROVIDER1;
      break;
    case "baseGoerli":
      chainId = 84531;
      provider = process.env.BASE_GOERLI_PROVIDER1;
      break;
    case "polygonZkEvm":
      chainId = 1101;
      provider = process.env.POLYGON_ZK_EVM_PROVIDER1;
      break;
    case "polygonZkEvmGoerli":
      chainId = 1442;
      provider = process.env.POLYGON_ZK_EVM_GOERLI_PROVIDER1;
      break;
    case "linea":
      chainId = 59144;
      provider = process.env.LINEA_PROVIDER1;
      break;
    case "lineaGoerli":
      chainId = 59140;
      provider = process.env.LINEA_GOERLI_PROVIDER1;
      break; 
    case "taikoTestnet":
      chainId = 167007;
      provider = process.env.TAIKO_TESTNET_PROVIDER1;
      break;
    case "sepolia":
      chainId = 11155111;
      provider = process.env.SEPOLIA_PROVIDER1;
      break;
    case "mantleTestnet":
      chainId = 5001;
      provider = process.env.MANTLE_TESTNET_PROVIDER1;
      break;
    case "zkSync":
      chainId = 324;
      provider = process.env.ZK_SYNC_PROVIDER1;
      break;
    case "base":
      chainId = 8453;
      provider = process.env.BASE_PROVIDER1;
      break;
    case "mantle":
      chainId = 5000;
      provider = process.env.MANTLE_PROVIDER1;
      break;
    case "scroll":
      chainId = 534352;
      provider = process.env.SCROLL_PROVIDER1;
      break;
    default:
      console.log("no network");
      break;
  }

  return {
    chainId,
    provider
  }
};

module.exports.getWeb3 = (chainName) => {
  const network = this.getNetwork(chainName);
  return new Web3(new HDWalletProvider({
    mnemonic: process.env.MNEMONIC,
    providerOrUrl: network.provider,
    chainId: network.chainId
  }));
}

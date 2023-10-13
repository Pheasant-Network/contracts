const hre = require("hardhat");
const HDWalletProvider = require("@truffle/hdwallet-provider");
require('dotenv').config();
const Web3 = require('web3');
const zkSyncWeb3 = require('zksync-web3');
const readlineSync = require('readline-sync')
const utils = require('../utils/index')

// // Polygon
const childAbi = require("../artifacts/contracts/polygon/checkpoint-manager/PolygonChildCheckpointManager.sol/PolygonChildCheckpointManager.json").abi;
const rootAbi = require("../artifacts/contracts/polygon/checkpoint-manager/PolygonRootCheckpointManager.sol/PolygonRootCheckpointManager.json").abi;

// Optimism
const optimismChildAbi = require("../artifacts/contracts/L2/checkpoint-manager/OptimismChildCheckpointManager.sol/OptimismChildCheckpointManager.json").abi;
const optimismRootAbi = require("../artifacts/contracts/L2/checkpoint-manager/OptimismRootCheckpointManager.sol/OptimismRootCheckpointManager.json").abi;

// Arbitrum
const arbitrumChildAbi = require("../artifacts/contracts/L2/checkpoint-manager/ArbitrumChildCheckpointManager.sol/ArbitrumChildCheckpointManager.json").abi;
const arbitrumRootAbi = require("../artifacts/contracts/L2/checkpoint-manager/ArbitrumRootCheckpointManager.sol/ArbitrumRootCheckpointManager.json").abi;

// zkSync
// const zkSyncChildAbi = require("../artifacts-zk/contracts/L2/checkpoint-manager/zkSyncChildCheckpointManager.sol/ZkSyncChildCheckpointManager.json").abi;
// const zkSyncRootAbi = require("../artifacts/contracts/L2/checkpoint-manager/zkSyncRootCheckpointManager.sol/ZkSyncRootCheckpointManager.json").abi;

let contractAddressObj = utils.getContractAddresses();

const main = async () => {
  // const accounts = await ethers.getSigners();
  const web3_temp = utils.getWeb3("goerli");
  const accounts = await web3_temp.eth.getAccounts();

  const env = readlineSync.question("Which network? Polygon Optimism Arbitrum zkSync : [p/o/a/z]");
  if (env == "polygon" || env == "p") {
    const env = readlineSync.question("Testnet or Mainnet?: [t/m]");
    if (env == "t") {
      const env = readlineSync.question("Setting for L1, L2, or both?: [1/2/b]")
      const web3_goerli = utils.getWeb3("goerli");
      const web3_mumbai = utils.getWeb3("mumbai");
      const rootAddress = contractAddressObj["goerli"].PolygonRootCheckpointManager;
      const childAddress = contractAddressObj["mumbai"].PolygonChildCheckpointManager;
      const rootContract = new web3_goerli.eth.Contract(rootAbi, rootAddress);
      const childContract = new web3_mumbai.eth.Contract(childAbi, childAddress);
      if (env == "1") {
        console.log("Setting for L1...");
        accountNonce = await web3_goerli.eth.getTransactionCount(accounts[0]);
        response = await rootContract.methods.setFxChildTunnel(childAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else if (env == "2") {
        console.log("Setting for L2...");
        accountNonce = await web3_mumbai.eth.getTransactionCount(accounts[0]);
        response = await childContract.methods.setFxRootTunnel(rootAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else if (env == "b") {
        console.log("Setting for both...");
        accountNonce = await web3_mumbai.eth.getTransactionCount(accounts[0]);
        response = await childContract.methods.setFxRootTunnel(rootAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
        accountNonce = await web3_goerli.eth.getTransactionCount(accounts[0]);
        response = await rootContract.methods.setFxChildTunnel(childAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else {
        console.log("invalid input")
      }
    }
    else if (env == "m") {
      const env = readlineSync.question("Setting for L1, L2, or both?: [1/2/b]")
      const web3_mainnet = utils.getWeb3("mainnet");
      const web3_polygon = utils.getWeb3("polygon");
      const rootAddress = contractAddressObj["mainnet"].PolygonRootCheckpointManager;
      const childAddress = contractAddressObj["polygon"].PolygonChildCheckpointManager;
      const rootContract = new web3_mainnet.eth.Contract(rootAbi, rootAddress);
      const childContract = new web3_polygon.eth.Contract(childAbi, childAddress);
      if (env == "1") {
        console.log("Setting for L1...");
        accountNonce = await web3_mainnet.eth.getTransactionCount(accounts[0]);
        const mainnetGasPrice = await web3_mainnet.eth.getGasPrice();
        response = await rootContract.methods.setFxChildTunnel(childAddress).send({ from: accounts[0], nonce: accountNonce, gasPrice: mainnetGasPrice });
        console.log(response);
      } else if (env == "2") {
        console.log("Setting for L2...");
        const polygonGasPrice = await web3_polygon.eth.getGasPrice();
        accountNonce = await web3_polygon.eth.getTransactionCount(accounts[0]);
        response = await childContract.methods.setFxRootTunnel(rootAddress).send({ from: accounts[0], nonce: accountNonce, gasPrice: polygonGasPrice });
        console.log(response);
      } else if (env == "b") {
        console.log("Setting for both...");
        const mainnetGasPrice = await web3_mainnet.eth.getGasPrice();
        const polygonGasPrice = await web3_polygon.eth.getGasPrice();
        accountNonce = await web3_polygon.eth.getTransactionCount(accounts[0]);
        response = await childContract.methods.setFxRootTunnel(rootAddress).send({ from: accounts[0], nonce: accountNonce, gasPrice: polygonGasPrice });
        console.log(response);
        accountNonce = await web3_mainnet.eth.getTransactionCount(accounts[0]);
        response = await rootContract.methods.setFxChildTunnel(childAddress).send({ from: accounts[0], nonce: accountNonce, gasPrice: mainnetGasPrice });
        console.log(response);
      } else {
        console.log("invalid input")
      }
    } else {
      console.log("invalid input")
    }
  }
  else if (env == "optimism" || env == "o") {
    const env = readlineSync.question("Testnet or Mainnet?: [t/m]");
    if (env == "t") { //Optimism Testnet
      const env = readlineSync.question("Setting for L1, L2, or both?: [1/2/b]")
      const web3_goerli = utils.getWeb3("goerli");
      const web3_optimismGoerli = utils.getWeb3("optimismGoerli");
      const rootAddress = contractAddressObj["goerli"].OptimismRootCheckpointManager;
      const childAddress = contractAddressObj["optimismGoerli"].OptimismChildCheckpointManager;
      const rootContract = new web3_goerli.eth.Contract(optimismRootAbi, rootAddress);
      const childContract = new web3_optimismGoerli.eth.Contract(optimismChildAbi, childAddress);
      console.log("Setting for L1...");
      accountNonce = await web3_goerli.eth.getTransactionCount(accounts[0]);
      response = await rootContract.methods.optimismInit(childAddress, )
      if (env == "1") {
        console.log("Setting for L1...");
        accountNonce = await web3_goerli.eth.getTransactionCount(accounts[0]);
        response = await rootContract.methods.setChildCheckpointManager(childAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else if (env == "2") {
        console.log("Setting for L2...");
        accountNonce = await web3_optimismGoerli.eth.getTransactionCount(accounts[0]);
        response = await childContract.methods.setRootCheckpointManager(rootAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else if (env == "b") {
        console.log("Setting for both...");
        accountNonce = await web3_optimismGoerli.eth.getTransactionCount(accounts[0]);
        response = await childContract.methods.setRootCheckpointManager(rootAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
        accountNonce = await web3_goerli.eth.getTransactionCount(accounts[0]);
        response = await rootContract.methods.setChildCheckpointManager(childAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else {
        console.log("invalid input")
      }
    } else if (env == "m") { //Optimism Mainnet
      const env = readlineSync.question("Setting for L1, L2, or both?: [1/2/b]")
      const web3_mainnet = utils.getWeb3("mainnet");
      const web3_optimism = utils.getWeb3("optimism");
      const rootAddress = contractAddressObj["mainnet"].OptimismRootCheckpointManager;
      const childAddress = contractAddressObj["optimism"].OptimismChildCheckpointManager;
      const rootContract = new web3_mainnet.eth.Contract(optimismRootAbi, rootAddress);
      const childContract = new web3_optimism.eth.Contract(optimismChildAbi, childAddress);
      if (env == "1") {
        console.log("Setting for L1...");
        accountNonce = await web3_mainnet.eth.getTransactionCount(accounts[0]);
        response = await rootContract.methods.setChildCheckpointManager(childAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else if (env == "2") {
        console.log("Setting for L2...");
        accountNonce = await web3_optimism.eth.getTransactionCount(accounts[0]);
        response = await childContract.methods.setRootCheckpointManager(rootAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else if (env == "b") {
        console.log("Setting for both...");
        accountNonce = await web3_optimism.eth.getTransactionCount(accounts[0]);
        response = await childContract.methods.setRootCheckpointManager(rootAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
        accountNonce = await web3_goerli.eth.getTransactionCount(accounts[0]);
        response = await rootContract.methods.setChildCheckpointManager(childAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else {
        console.log("invalid input")
      }
    } else {
      console.log("invalid input")
    }
  } else if (env == "arbitrum" || env == "a") {
    const env = readlineSync.question("Testnet or Mainnet?: [t/m]");
    if (env == "t") { //Arbitrum Testnet
      const env = readlineSync.question("Setting for L1, L2, or both?: [1/2/b]")
      const web3_goerli = utils.getWeb3("goerli");
      const web3_arbitrumGoerli = utils.getWeb3("arbitrumGoerli");
      const rootAddress = contractAddressObj["goerli"].ArbitrumRootCheckpointManager;
      const childAddress = contractAddressObj["arbitrumGoerli"].ArbitrumChildCheckpointManager;
      const rootContract = new web3_goerli.eth.Contract(arbitrumRootAbi, rootAddress);
      const childContract = new web3_arbitrumGoerli.eth.Contract(arbitrumChildAbi, childAddress);
      if (env == "1") {
        console.log("Setting for L1...");
        accountNonce = await web3_goerli.eth.getTransactionCount(accounts[0]);
        response = await rootContract.methods.setChildCheckpointManager(childAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else if (env == "2") {
        console.log("Setting for L2...");
        accountNonce = await web3_arbitrumGoerli.eth.getTransactionCount(accounts[0]);
        console.log({web3_arbitrumGoerli, accountNonce})
        response = await childContract.methods.setRootCheckpointManager(rootAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else if (env == "b") {
        console.log("Setting for both...");
        accountNonce = await web3_arbitrumGoerli.eth.getTransactionCount(accounts[0]);
        response = await childContract.methods.setRootCheckpointManager(rootAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
        accountNonce = await web3_goerli.eth.getTransactionCount(accounts[0]);
        response = await rootContract.methods.setChildCheckpointManager(childAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else {
        console.log("invalid input")
      }
    } else if (env == "m") { //arbitrum Mainnet
      const env = readlineSync.question("Setting for L1, L2, or both?: [1/2/b]")
      const web3_mainnet = utils.getWeb3("mainnet");
      const web3_arbitrum = utils.getWeb3("arbitrum");
      const rootAddress = contractAddressObj["mainnet"].ArbitrumRootCheckpointManager;
      const childAddress = contractAddressObj["arbitrum"].ArbitrumChildCheckpointManager;
      console.log(rootAddress);
      console.log(childAddress);
      const rootContract = new web3_mainnet.eth.Contract(arbitrumRootAbi, rootAddress);
      const childContract = new web3_arbitrum.eth.Contract(arbitrumChildAbi, childAddress);
      if (env == "1") {
        console.log("Setting for L1...");
        accountNonce = await web3_mainnet.eth.getTransactionCount(accounts[0]);
        response = await rootContract.methods.setChildCheckpointManager(childAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else if (env == "2") {
        console.log("Setting for L2...");
        accountNonce = await web3_arbitrum.eth.getTransactionCount(accounts[0]);
        response = await childContract.methods.setRootCheckpointManager(rootAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else if (env == "b") {
        console.log("Setting for both...");
        accountNonce = await web3_arbitrum.eth.getTransactionCount(accounts[0]);
        response = await childContract.methods.setRootCheckpointManager(rootAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
        accountNonce = await web3_goerli.eth.getTransactionCount(accounts[0]);
        response = await rootContract.methods.setChildCheckpointManager(childAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else {
        console.log("invalid input")
      }
    } else {
      console.log("invalid input")
    }
  } else if (env == "zkSync" || env == "z") {
    const env = readlineSync.question("Testnet or Mainnet?: [t/m]");
    if (env == "t") {// zkSync Testnet
      const env = readlineSync.question("Setting for L1, L2, or both?: [1/2/b]")
      const web3_goerli = utils.getWeb3("goerli");
      const web3_zkSyncTestnet = utils.getWeb3("zkSyncTestnet");
      const rootAddress = contractAddressObj["goerli"].ZkSyncRootCheckpointManager;
      console.log("rootAddress: ", rootAddress);
      const childAddress = contractAddressObj["zkSyncTestnet"].ZkSyncChildCheckpointManager;
      console.log("childAddress: ", childAddress);
      const rootContract = new web3_goerli.eth.Contract(zkSyncRootAbi, rootAddress);
      const childContract = new web3_zkSyncTestnet.eth.Contract(zkSyncChildAbi, childAddress);
      if (env == "1") {
        console.log("Setting for L1...");
        accountNonce = await web3_goerli.eth.getTransactionCount(accounts[0]);
        response = await rootContract.methods.setChildCheckpointManager(childAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else if (env == "2") {
        console.log("Setting for L2...");
        accountNonce = await web3_zkSyncTestnet.eth.getTransactionCount(accounts[0]);
        console.log({web3_zkSyncTestnet, accountNonce})
        response = await childContract.methods.setRootCheckpointManager(rootAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else if (env == "b") {
        console.log("Setting for both...");
        accountNonce = await web3_zkSyncTestnet.eth.getTransactionCount(accounts[0]);
        response = await childContract.methods.setRootCheckpointManager(rootAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
        accountNonce = await web3_goerli.eth.getTransactionCount(accounts[0]);
        response = await rootContract.methods.setChildCheckpointManager(childAddress).send({ from: accounts[0], nonce: accountNonce });
        console.log(response);
      } else {
        console.log("invalid input")
      }
    } else if (env == "m") { //zkSync Mainnet
      console.log("not yet supported");
      // const env = readlineSync.question("Setting for L1, L2, or both?: [1/2/b]")
      // const web3_mainnet = utils.getWeb3("mainnet");
      // const web3_zkSync = utils.getWeb3("zkSync");
      // const rootAddress = contractAddressObj["mainnet"].ArbitrumRootCheckpointManager;
      // const childAddress = contractAddressObj["zkSync"].ArbitrumChildCheckpointManager;
      // console.log(rootAddress);
      // console.log(childAddress);
      // const rootContract = new web3_mainnet.eth.Contract(zkSyncRootAbi, rootAddress);
      // const childContract = new web3_zkSync.eth.Contract(zkSyncChildAbi, childAddress);
      // if (env == "1") {
      //   console.log("Setting for L1...");
      //   accountNonce = await web3_mainnet.eth.getTransactionCount(accounts[0]);
      //   response = await rootContract.methods.setChildCheckpointManager(childAddress).send({ from: accounts[0], nonce: accountNonce });
      //   console.log(response);
      // } else if (env == "2") {
      //   console.log("Setting for L2...");
      //   accountNonce = await web3_zkSync.eth.getTransactionCount(accounts[0]);
      //   response = await childContract.methods.setRootCheckpointManager(rootAddress).send({ from: accounts[0], nonce: accountNonce });
      //   console.log(response);
      // } else if (env == "b") {
      //   console.log("Setting for both...");
      //   accountNonce = await web3_zkSync.eth.getTransactionCount(accounts[0]);
      //   response = await childContract.methods.setRootCheckpointManager(rootAddress).send({ from: accounts[0], nonce: accountNonce });
      //   console.log(response);
      //   accountNonce = await web3_goerli.eth.getTransactionCount(accounts[0]);
      //   response = await rootContract.methods.setChildCheckpointManager(childAddress).send({ from: accounts[0], nonce: accountNonce });
      //   console.log(response);
      // } else {
      //   console.log("invalid input")
      // }
    } else {
      console.log("invalid input")
    }
  } else {
    console.log("invalid input")
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
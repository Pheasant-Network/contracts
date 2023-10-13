// require("@nomiclabs/hardhat-waffle");
require('dotenv').config();
require("hardhat-gas-reporter");
require('solidity-coverage');
require('hardhat-contract-sizer');
require("@nomicfoundation/hardhat-chai-matchers");
require("@matterlabs/hardhat-zksync-deploy");
require("@matterlabs/hardhat-zksync-solc");
require("@matterlabs/hardhat-zksync-verify");

const utils = require('./utils/index')
const mnemonic = process.env.MNEMONIC;
const contractAddresses = require("./contractAddresses.json");

module.exports = {
  zksolc: {
    version: "latest",
    compilerSource: "binary",
    settings: {
      libraries: {
        "contracts/bridge-dispute-manager/utils/SolRLPDecoder.sol": {
          //SolRLPDecoder: contractAddresses.zkSyncTestnet.SolRLPDecoder,
          SolRLPDecoder: contractAddresses.zkSync.SolRLPDecoder,
        },
      },
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      allowUnlimitedContractSize: true
    },
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    mainnet: {
      url: utils.getNetwork("mainnet").provider,
      chainId: utils.getNetwork("mainnet").chainId,
      //gasPrice: 12000000000,
      accounts: { mnemonic },
    },
    goerli: {
      url: utils.getNetwork("goerli").provider,
      chainId: utils.getNetwork("goerli").chainId,
      //gasPrice: 10000000000,
      accounts: { mnemonic }
    },
    polygon: {
      url: utils.getNetwork("polygon").provider,
      chainId: utils.getNetwork("polygon").chainId,
      //gasPrice: 800000000000,
      accounts: { mnemonic },
    },
    mumbai: {
      url: utils.getNetwork("mumbai").provider,
      chainId: utils.getNetwork("mumbai").chainId,
      //gasPrice: 30000000000,
      accounts: { mnemonic }
    },
    optimism: {
      url: utils.getNetwork("optimism").provider,
      chainId: utils.getNetwork("optimism").chainId,
      //gasPrice: 30000000000,
      accounts: { mnemonic }
    },
    optimismGoerli: {
      url: utils.getNetwork("optimismGoerli").provider,
      chainId: utils.getNetwork("optimismGoerli").chainId,
      gasPrice: 4000000000,
      accounts: { mnemonic }
    },
    arbitrum: {
      url: utils.getNetwork("arbitrum").provider,
      chainId: utils.getNetwork("arbitrum").chainId,
      //gasPrice: 30000000000,
      accounts: { mnemonic }
    },
    arbitrumGoerli: {
      url: utils.getNetwork("arbitrumGoerli").provider,
      chainId: utils.getNetwork("arbitrumGoerli").chainId,
      //gasPrice: 30000000000,
      accounts: { mnemonic }
    },
    scrollTestnet: {
      url: utils.getNetwork("scrollTestnet").provider,
      chainId: utils.getNetwork("scrollTestnet").chainId,
      //gasPrice: 30000000000,
      accounts: { mnemonic }
    },
    zkSyncTestnet: {
      url: utils.getNetwork("zkSyncTestnet").provider,
      chainId: utils.getNetwork("zkSyncTestnet").chainId,
      ethNetwork: utils.getNetwork("goerli").provider, // Can also be the RPC URL of the network (e.g. `https://goerli.infura.io/v3/<API_KEY>`)
      //zksync: true,
      accounts: { mnemonic }
    },
    baseGoerli: {
      url: utils.getNetwork("baseGoerli").provider,
      chainId: utils.getNetwork("baseGoerli").chainId,
      gasPrice: 300000000,
      //gasPrice: 30000000000,
      accounts: { mnemonic },
    },
    polygonZkEvmGoerli: {
      url: utils.getNetwork("polygonZkEvmGoerli").provider,
      chainId: utils.getNetwork("polygonZkEvmGoerli").chainId,
      // gasPrice: 30000000000,
      accounts: { mnemonic }
    },
    lineaGoerli: {
      url: utils.getNetwork("lineaGoerli").provider,
      chainId: utils.getNetwork("lineaGoerli").chainId,
      gasPrice: 2000000000,
      accounts: { mnemonic },
    },
    taikoTestnet: {
      url: utils.getNetwork("taikoTestnet").provider,
      chainId: utils.getNetwork("taikoTestnet").chainId,
      gas: 5600000,
      //gasPrice: 30000000000,
      accounts: { mnemonic },
    },
    sepolia: {
      url: utils.getNetwork("sepolia").provider,
      chainId: utils.getNetwork("sepolia").chainId,
      //gasPrice: 30000000000,
      accounts: { mnemonic },
    },
    polygonZkEvm: {
      url: utils.getNetwork("polygonZkEvm").provider,
      chainId: utils.getNetwork("polygonZkEvm").chainId,
      // gasPrice: 30000000000,
      accounts: { mnemonic },
    },
    linea: {
      url: utils.getNetwork("linea").provider,
      chainId: utils.getNetwork("linea").chainId,
      // gasPrice: 30000000000,
      accounts: { mnemonic },
    },
    mantleTestnet: {
      url: utils.getNetwork("mantleTestnet").provider,
      chainId: utils.getNetwork("mantleTestnet").chainId,
      // gasPrice: 30000000000,
      accounts: { mnemonic },
    },
    zkSync: {
      url: utils.getNetwork("zkSync").provider,
      chainId: utils.getNetwork("zkSync").chainId,
      ethNetwork: utils.getNetwork("mainnet").provider, // Can also be the RPC URL of the network (e.g. `https://goerli.infura.io/v3/<API_KEY>`)
      //zksync: true,
      accounts: { mnemonic }
    },
    base: {
      url: utils.getNetwork("base").provider,
      chainId: utils.getNetwork("base").chainId,
      gasPrice: 300000000,
      //gasPrice: 30000000000,
      accounts: { mnemonic },
    },
    mantle: {
      url: utils.getNetwork("mantle").provider,
      chainId: utils.getNetwork("mantle").chainId,
      // gasPrice: 30000000000,
      accounts: { mnemonic },
    },
    scroll: {
      url: utils.getNetwork("scroll").provider,
      chainId: utils.getNetwork("scroll").chainId,
      //gasPrice: 30000000000,
      accounts: { mnemonic }
    },
  },
  gasReporter: {
    enabled: true,
    currency: 'USD',
    coinmarketcap: "",
    gasPrice: 21
  },
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 30,
        details: {
          yul: true
        }
      },
    }
  }
};

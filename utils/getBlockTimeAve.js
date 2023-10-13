const Web3 = require('web3');
require('dotenv').config({ path: '../.env' });

const networkList = [
  "mainnet",
  "goerli",
  "mumbai",
  "polygon",
  "optimism",
  "optimismGoerli",
  "arbitrum",
  "arbitrumGoerli",
  "scrollTestnet",
  "zkSyncTestnet",
  "baseGoerli",
  "polygonZkEvmGoerli",
  "lineaGoerli",
  "taikoTestnet",
  "sepolia"
];

const utils = require('./index');

const main = async () => {
  for (let i = 0; i < networkList.length; i++) {
    console.log(`===== network: ${networkList[i]} =====`);
    const network = await utils.getNetwork(networkList[i]);
    const web3 = new Web3(network.provider);
    const latestBlock = await web3.eth.getBlock('latest');
    let blockTimeAve = 0;
    if (latestBlock.number > 1000000) {
      const millionPassedBlock = await web3.eth.getBlock(latestBlock.number - 1000000);
      blockTimeAve = (latestBlock.timestamp - millionPassedBlock.timestamp) / 1000000;
      console.log(`blockTimeAve: ${blockTimeAve} in 1000000 blocks`);
    } else {
      const hundredThousandPassedBlock = await web3.eth.getBlock(latestBlock.number - 100000);
      blockTimeAve = (latestBlock.timestamp - hundredThousandPassedBlock.timestamp) / 100000;
      console.log(`blockTimeAve: ${blockTimeAve} in 100000 blocks`);
    }
    console.log("=============================");
  }
}

 main();
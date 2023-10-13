const HDWalletProvider = require("@truffle/hdwallet-provider");
require('dotenv').config({ path: '../.env' });
const Web3 = require('web3');
const readlineSync = require('readline-sync')
const fs = require('fs');
const utils = require('../scripts/utils')
const BN = require('bn.js');

const bridge = JSON.parse(fs.readFileSync('../artifacts/contracts/PheasantNetworkBridgeChild.sol/PheasantNetworkBridgeChild.json', 'utf8'));
let contractAddressObj = utils.getContractAddresses("../")
const abi = bridge.abi;

const token = JSON.parse(fs.readFileSync('../artifacts/contracts/TestToken.sol/TestToken.json', 'utf8'));

const web3_mumbai = new Web3(new HDWalletProvider({
  mnemonic: process.env.MNEMONIC,
  providerOrUrl: process.env.PROVIDER_MUMBAI,
  chainId: 80001
}));

const web3_polygon = new Web3(new HDWalletProvider({
  mnemonic: process.env.MNEMONIC,
  providerOrUrl: process.env.PROVIDER_POLYGON,
  chainId: 137
}));



const main = async () => {
  const accounts = await web3_mumbai.eth.getAccounts();
  const address = contractAddressObj["mumbai"].PheasantNetworkBridgeChild;
  const bridgeContract = new web3_mumbai.eth.Contract(abi , address);
  const tokenAddress = contractAddressObj["mumbai"].WETH;
  const tokenContract = new web3_mumbai.eth.Contract(token.abi, tokenAddress);
  const approveAmount = new BN("100000000000000000");
  const sendOrReceive = readlineSync.question("deposit or withdraw or balanceOf? (d/w/b)");

  if(sendOrReceive == "d") {
    let response = await tokenContract.methods.approve(address, approveAmount).send({from:accounts[0]});
    console.log(response);
    response = await bridgeContract.methods.depositBond(approveAmount).send({from:accounts[0]});
    console.log(response);
  } else if(sendOrReceive == "w") {
    response = await bridgeContract.methods.withdrawBond().send({from:accounts[0]});
    console.log(response);
  } else if(sendOrReceive == "b") {
    let response = await bridgeContract.methods.getRelayerBondBalance(accounts[0]).call();
    console.log(response);
  }
 

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


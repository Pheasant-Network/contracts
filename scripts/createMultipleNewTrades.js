require('dotenv').config({ path: '../.env' });
const { Signer } = require('ethers');
const readlineSync = require('readline-sync');
const utils = require('../utils/index')

let contractAddressObj = utils.getContractAddresses()

const main = async () => {

  const accounts = await ethers.getSigners();

  let response
  let pheasantNetworkBridgeChild;
  let param;
  let tradeAmount = readlineSync.question("Input the trade amount : ");
  let tradeCount = readlineSync.question("how many trade? : ");

  const address = contractAddressObj[hre.network.name].PheasantNetworkBridgeChild;

  if (
    hre.network.name == "mumbai" || hre.network.name == "polygon"
  ) {
    // approve
    const tokenAddress = contractAddressObj[hre.network.name].WETH;
    pheasantNetworkBridgeChild = await hre.ethers.getContractAt(
      "TestToken",
      tokenAddress
    );
    response = await tokenContract.approve(
      address,
      tradeAmount
    );
    console.log(response);

    // set bridge contract instance
    pheasantNetworkBridgeChild = await hre.ethers.getContractAt(
      "contracts/polygon/PheasantNetworkBridgeChild.sol:PheasantNetworkBridgeChild",
      address
    );

    // tx param
    param = {
      from: accounts[0].address
    }

  } else { // for EVM equivalent L2. ex, Optimism, Arbitrum, scroll
    // set bridge contract instance
    const address = contractAddressObj[hre.network.name].PheasantNetworkBridgeChild;
    pheasantNetworkBridgeChild = await hre.ethers.getContractAt(
      "contracts/L2/PheasantNetworkBridgeChild.sol:PheasantNetworkBridgeChild",
      address
    );
    // tx param
    param = {
      from: accounts[0].address,
      value: tradeAmount
    }
  }

  // execute newTrade
   
  for (let i = 0; i < tradeCount; i++) {
    response = await pheasantNetworkBridgeChild.newTrade(
      tradeAmount,
      accounts[0].address, // to address
      Math.round(Number(21000 * ethers.utils.parseUnits("60", "gwei")) * 2), //fee
      0, // tokenType
      param
    );
    console.log(response);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


require('dotenv').config({ path: '../.env' });
const { Signer } = require('ethers');
const readlineSync = require('readline-sync');
const utils = require('../utils/index')

let contractAddressObj = utils.getContractAddresses()

const main = async () => {

  const accounts = await ethers.getSigners();

  let response
  let pheasantNetworkBridgeChild;
  let userAddress = readlineSync.question("Input userAddress : ");
  let index = readlineSync.question("Input index : ");

  const DISPUTE_DEPOSIT_AMOUNT = "5000000000000000";
  const ETH_TOKEN_INDEX = 0;

  if (
    hre.network.name == "mumbai" || hre.network.name == "polygon"
  ) {
    const address = contractAddressObj[hre.network.name].PheasantNetworkBridgeChild;    
    const tokenAddress = contractAddressObj[hre.network.name].WETH;
    tokenContract = await hre.ethers.getContractAt(
      "TestToken",
      tokenAddress
    );
    response = await tokenContract.approve(
      address,
      DISPUTE_DEPOSIT_AMOUNT
    );
    console.log(response);
    // set bridge contract instance
    pheasantNetworkBridgeChild = await hre.ethers.getContractAt(
      "contracts/polygon/PolygonPheasantNetworkBridgeChild.sol:PolygonPheasantNetworkBridgeChild",
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
      value: DISPUTE_DEPOSIT_AMOUNT
    }
  }

  // execute dispute
  response = await pheasantNetworkBridgeChild.dispute(
    ETH_TOKEN_INDEX,
    DISPUTE_DEPOSIT_AMOUNT,
    userAddress,
    index,
    param
  );

  console.log(response);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


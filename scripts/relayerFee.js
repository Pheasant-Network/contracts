require('dotenv').config({ path: '../.env' });
const readlineSync = require('readline-sync');
const utils = require('../utils/index');

const contractAddressObj = utils.getContractAddresses();

const main = async () => {
  const accounts = await ethers.getSigners();

  const contractAddress = contractAddressObj[hre.network.name].PheasantNetworkBridgeChild;

  // set contract instance
  if (
    hre.network.name == "mumbai" || hre.network.name == "polygon"
  ) {
    // set bridge contract instance
    pheasantNetworkBridgeChild = await hre.ethers.getContractAt(
      "contracts/polygon/PheasantNetworkBridgeChild.sol:PheasantNetworkBridgeChild",
      contractAddress
    );
  } else { // for EVM equivalent L2. ex, Optimism, Arbitrum, scroll
    // set bridge contract instance
    pheasantNetworkBridgeChild = await hre.ethers.getContractAt(
      "contracts/L2/PheasantNetworkBridgeChild.sol:PheasantNetworkBridgeChild",
      contractAddress
    );
  }

  // ask network
  const amount = readlineSync.question("Input the relayer fee amount : ");

  if(!isNaN(amount)) {
    let response = await pheasantNetworkBridgeChild.setNextFeeSetting([0, 0, 0, 0, 0]);
    console.log(response);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


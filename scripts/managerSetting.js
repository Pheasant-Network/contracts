require('dotenv').config({ path: '../.env' });
const { Signer } = require('ethers');
const readlineSync = require('readline-sync');
const utils = require('../utils/index')

let contractAddressObj = utils.getContractAddresses()

const main = async () => {
  const accounts = await ethers.getSigners();

  let pheasantNetworkBridgeChild;
  let response;

  if (
    hre.network.name == "mumbai" || hre.network.name == "polygon"
  ) {
    const address = contractAddressObj[hre.network.name].PheasantNetworkBridgeChild;
    console.log("address", address);
    pheasantNetworkBridgeChild = await hre.ethers.getContractAt(
      "contracts/polygon/PolygonPheasantNetworkBridgeChild.sol:PolygonPheasantNetworkBridgeChild",
      address
    );
  } else {
    const address = contractAddressObj[hre.network.name].PheasantNetworkBridgeChild;
    pheasantNetworkBridgeChild = await hre.ethers.getContractAt(
      "contracts/L2/PheasantNetworkBridgeChild.sol:PheasantNetworkBridgeChild",
      address
    );
  }

  let operation = readlineSync.question("Execute, finalize, remaining time, or check address? [e/f/t/c]");
  if (operation == "e") {
    // const bridgeDisputeManager = contractAddressObj[hre.network.name].BridgeDisputeManager;
    const bondManager = contractAddressObj[hre.network.name].BondManager;
    response = await pheasantNetworkBridgeChild.executeManagerUpdate(
      1,
      bondManager
    );
    console.log(response);
  } else if (operation == "f") {
    response = await pheasantNetworkBridgeChild.finalizeManagerUpdate();
    console.log(response);
  } else if (operation == "t") {
    response = await pheasantNetworkBridgeChild.managerUpdate();
    console.log(response);
  } else {
    console.log("Wrong operation!");
  } 

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
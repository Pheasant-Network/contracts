require('dotenv').config({ path: '../.env' });
const { Signer } = require('ethers');
const readlineSync = require('readline-sync');
const utils = require('../utils/index')

let contractAddressObj = utils.getContractAddresses()

const main = async () => {

  let pheasantNetworkParameters;
  let response;

  const address = contractAddressObj[hre.network.name].PheasantNetworkParameters;
  pheasantNetworkParameters = await hre.ethers.getContractAt(
    "contracts/L2/PheasantNetworkParameters.sol:PheasantNetworkParameters",
    address
  );

  let operation = readlineSync.question("Execute, finalize, remaining time, available network, slashable network or not native network? [e/f/t/a/s/n]");
  if (operation == "e") {
    response = await pheasantNetworkParameters.executeNetworkSettingUpdate(
      [0, 0, 0, 0, 0, 0, 0],
      [1003, 1002, 1004, 1006, 1005, 1007, 1009],
      [1, 1, 1, 1, 1, 1, 1]
    );
    console.log(response);
  } else if (operation == "f") {
    response = await pheasantNetworkParameters.finalizeNetworkSettingUpdate();
    console.log(response);
  } else if (operation == "t") {
    response = await pheasantNetworkParameters.networkSettingUpdate();
    console.log(response);
  } else if (operation == "a") {
    let networkCode = readlineSync.question("Pls input network code:");
    response = await pheasantNetworkParameters.availableNetwork(networkCode);
    console.log(response);
  } else if (operation == "s") {
    let networkCode = readlineSync.question("Pls input network code:");
    response = await pheasantNetworkParameters.slashableNetwork(networkCode);
    console.log(response);
  } else if (operation == "n") {
    let networkCode = readlineSync.question("Pls input network code:");
    response = await pheasantNetworkParameters.nativeIsNotETH(networkCode);
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
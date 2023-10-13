require('dotenv').config();
const utils = require('../utils/index')
const readlineSync = require('readline-sync');
const BN = require('bn.js');

let contractAddressObj = utils.getContractAddresses();

const main = async () => {

  const accounts = await ethers.getSigners();

  let response
  let param;

  let depositAmount = Math.floor(Number(process.env.THRESHOLD_ETH_AMOUNT) * 2.2).toString();

  const operation = readlineSync.question(
    "deposit, withdraw, extend, balanceOf, checkUnlockDate? (d/w/e/b/c) : "
  );
  
  const address = contractAddressObj[hre.network.name].BondManager;

  const bondManager = await hre.ethers.getContractAt(
    "contracts/bond-manager/BondManager.sol:BondManager",
    address
  );

  if (
    hre.network.name == "mumbai" || hre.network.name == "polygon"
  ) {
    
    if (operation == "d") {
      const tokenAddress = contractAddressObj[hre.network.name].WETH;
      tokenContract = await hre.ethers.getContractAt(
        "TestToken",
        tokenAddress
      );
      response = await tokenContract.approve(
        address,
        depositAmount
      );
      console.log(response);
    }

    // tx param
    param = {
      from: accounts[0].address
    }

  } else { // for EVM equivalent L2. ex, Optimism, Arbitrum, scroll
    // tx param
    param = {
      from: accounts[0].address,
      value: depositAmount
    }
  }

  if (operation == "d") {
    response = await bondManager.deposit(0, depositAmount, param);
    // response = await pheasantNetworkBridgeChild.depositBond("1000", 60 * 60 * 3 , param);
    console.log(response);
  } else if (operation == "w") {
    response = await bondManager.executeWithdrawBond();
    console.log(response);
  } else if (operation == "f") {
    response = await bondManager.finalizeWithdrawalBond();
    console.log(response);
  } else if (operation == "b") {
    let response = await bondManager.getBond(0);
    console.log(response);
  } else if (operation == "c") {
    let response = await bondManager.getBondUnlockDate();
    console.log(response);
  }


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


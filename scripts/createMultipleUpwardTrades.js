require('dotenv').config({ path: '../.env' });
const readlineSync = require('readline-sync');

const main = async () => {

  let amount = readlineSync.question("Input the trade amount in wei: ");
  let networkCode;
  const network = readlineSync.question("Which network do you want to send?[p/o/a/s/z/b/pz/l/sn]");
  if (network == "p") {
    networkCode = 1002;
  } else if (network == "o") {
    networkCode = 1003;
  } else if (network == "a") {
    networkCode = 1004;
  } else if (network == "s") {
    networkCode = 1005;
  } else if (network == "z") {
    networkCode = 1006;
  } else if (network == "b") {
    networkCode = 1007;
  } else if (network == "pz") {
    networkCode = 1008;
  } else if (network == "l") {
    networkCode = 1009;
  } else if (network == "sn") {
    networkCode = 1011;
  }
  if (amount < 10000) {
    console.log("Pls set more than 9999 wei!");
  } else {
    amount = await ethers.BigNumber.from(amount);
    amount = amount.add(await ethers.BigNumber.from(networkCode));
    console.log("Trading amount=", amount);
    const tradeNum = readlineSync.question("How many trades do you want to create : ");
    const accounts = await ethers.getSigners();

    // Pls change destination address that you prefer!
    const destAddress = accounts[0].address;

    for (let i = 0; i < tradeNum; i++) {
      response = await accounts[0].sendTransaction({
        to: destAddress,
        value: amount,
      });
      console.log(response);
    }

  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

/* global ethers */
/* eslint prefer-const: "off" */

const { getSelectors, FacetCutAction } = require('./libraries/diamond.js')
const utils = require('../utils/index');
const { network } = require('hardhat');

async function deployDiamond () {
  let contractAddressObj = utils.getContractAddresses();
  const accounts = await ethers.getSigners()
  const contractOwner = process.env.NEW_OWNER
  let deployedAddress = "";

  // Deploy DiamondInit
  // DiamondInit provides a function that is called when the diamond is upgraded or deployed to initialize state variables
  // Read about how the diamondCut function works in the EIP2535 Diamonds standard
  const DiamondInit = await ethers.getContractFactory('DiamondInit')
  const diamondInit = await DiamondInit.deploy();
  console.log("DiamondInit TxHash:", diamondInit.deployTransaction.hash);
  await diamondInit.deployed();
  console.log('DiamondInit deployed:', diamondInit.address);
  if (hre.network.name != "hardhat") {
    contractAddressObj[hre.network.name].DiamondInit = diamondInit.address;
    utils.saveContractAddress(
      network,
      "DiamondInit.sol",
      diamondInit.address,
      //accounts[0].address
      contractOwner
    );
  }

  // Deploy facets and set the `facetCuts` variable
  console.log('')
  console.log('Deploying facets')
  const FacetNames = [
    'DiamondCutFacet',
    'DiamondLoupeFacet',
    'OwnershipFacet'
  ]
  // The `facetCuts` variable is the FacetCut[] that contains the functions to add during diamond deployment
  const facetCuts = []
  for (const FacetName of FacetNames) {
    const Facet = await ethers.getContractFactory(FacetName)
    const facet = await Facet.deploy()
    console.log(`${FacetName} TxHash: ${facet.deployTransaction.hash}`)
    await facet.deployed()
    console.log(`${FacetName} deployed: ${facet.address}`)
    facetCuts.push({
      facetAddress: facet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facet)
    });
    if (hre.network.name != "hardhat") {
      contractAddressObj[hre.network.name][FacetName] = facet.address;
      utils.saveContractAddress(
        network,
        FacetName + ".sol",
        facet.address,
        //accounts[0].address
        contractOwner
      );
    }
  }

  // Creating a function call
  // This call gets executed during deployment and can also be executed in upgrades
  // It is executed with delegatecall on the DiamondInit address.
  let functionCall = diamondInit.interface.encodeFunctionData('init')

  // Setting arguments that will be used in the diamond constructor
  const diamondArgs = {
    owner: contractOwner,
    init: diamondInit.address,
    initCalldata: functionCall
  }

  // deploy Diamond
  const Diamond = await ethers.getContractFactory('Diamond')
  const diamond = await Diamond.deploy(facetCuts, diamondArgs)
  console.log("Diamond TxHash:", diamond.deployTransaction.hash)
  await diamond.deployed()
  console.log('Diamond deployed:', diamond.address);
  if (hre.network.name != "hardhat") {
    contractAddressObj[hre.network.name].Diamond = diamond.address;

    utils.saveContractAddress(
      network,
      "Diamond.sol",
      diamond.address,
      //accounts[0].address
      contractOwner
    );
    utils.writeContractAddresses(contractAddressObj);
  }

  // returning the address of the diamond
  return diamond.address
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  deployDiamond()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

exports.deployDiamond = deployDiamond

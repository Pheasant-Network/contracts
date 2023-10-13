require('dotenv').config({ path: '../.env' });
const readlineSync = require('readline-sync');
const utils = require('../utils/index')
const rlp = require('rlp');
const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider');

let contractAddressObj = utils.getContractAddresses()

const main = async () => {
const INFURA_GOERLI="https://goerli.infura.io/v3/deac92b380cd4b219b0c57a59cf363b1"
const provider = new HDWalletProvider({
  mnemonic: "",
  providerOrUrl: INFURA_GOERLI,
  //chainId: 80001
  chainId: 5
});

const web3_goerli = new Web3(provider);


  const accounts = await ethers.getSigners();

  const trade = {
    index: '4',
    user: '0xfc976D96ccc57bC9D04AeA92A4a66Abd71926298',
    tokenTypeIndex: '0',
    amount: '5000000000000000',
    timestamp: '1678943520',
    to: '0xfc976D96ccc57bC9D04AeA92A4a66Abd71926298',
    relayer: '0x1650683e50e075EFC778Be4D1A6bE929F3831719',
    status: '1',
    fee: '546000000000000',
    disputeTimestamp: '1678943520',
    isUpward: false
  }
  
  const evidence = {
    blockNumber: 8663139,
    blockHash: '0xe2f18d088596647916c58e828580822f84287d282ee8575843824a690969f01b',
    txReceiptProof: [],
    txProof: [
      '0xf8b1a029c3bc180c1382ec48d09a430c5e5e56833dcbcd5951777fd67e535d5518db40a0c12e3aa3912e1c1004d8e3e54753000b67f0d68e64a3883409c9973165d7a73aa0e22a16649d23c7576f2155c70d2125b57cee780553dfbe6d3ff82420f7b30b37a0bc809a1c01886a4888b6a3390561bc760de9bd8d570a7c5be41685decf3396e780808080a0223753215e5ec285206ea2d4b18a6f1e8e3582b9b96aaecfdfa889083054e5fe8080808080808080',
      '0xf90211a0da3702fb029f57ed680fb11d63734965ac014e8c477bd2398d7d635fcfc35b40a0bda424b050fb575b9a4f748879974c6875ad4db33963080b77c8920be083fdc6a0a95794749d6ba7cd169cf0393e4353207345a930bdea73541ef40f4b52333771a080e60e2b2681ac09588ab1639a0fd5eb8b5ea57914b4cd84b567efee11b8d1c5a06cc800d7d09a26a713d32e4711c7b2fc6213517bbdc8b15c6d7aced0ee26bd13a025923ff3dca4afbadaa0a11aa751dcca16862b0c539f17af866bbac2872fdf11a0149652172aaa2034a4e56824c483c85822ad7fa66f2129a0569c6aebdd9cc554a000c6f91e013381d2fce41064e3b2ce4f7428d46967cdfc52f9264127314e3b26a06e857d1bf23fa787b17fa19cf04886991aafae02b1ffd299631455ad67b737f0a005149bc9a747bee1d6af7b270c629a9430febdd2c470a82a5bbc3b25f33fbefba015dd369a21e2bfe14de12635c10aff6501a6d8f9699b287062ac97dc44a9cf0da09548f28e008b6a450645ac0e1fcc3d484722c5cca5076c8446b668c79ba05a44a05e2a18f80cf9b5c89e5232249ea3852eeef6f26da64e98af3883ad5235f3668fa07cb24e8da69b40b36f0ab0c150b8c8d47ef4bd956701c02e5df9b295442accb1a0466fcf4d438a29a8e9300e532332cc6380c59d3ea9a2f27e4bf298f22fa98bdaa0b39eb4b613b8ddfc43fa357df37a71013b12fca0c6c37b40adb17b956bb0d93b80',
      '0xf87820b87502f87205578477359400852e90edd00082520894fc976d96ccc57bc9d04aea92a4a66abd71926298870fd2e3afd4600080c001a08314b7c04620705e92fbf736e518ace2690c62a3432034980f159560a990e118a045369675a427365b45b4b4750d349e520dbf010515dae8bea624fb8bbfe3bcca'
    ],
    transaction: '0x02f87205578477359400852e90edd00082520894fc976d96ccc57bc9d04aea92a4a66abd71926298870fd2e3afd4600080c001a08314b7c04620705e92fbf736e518ace2690c62a3432034980f159560a990e118a045369675a427365b45b4b4750d349e520dbf010515dae8bea624fb8bbfe3bcca',
    txDataSpot: [ 0, 0 ],
    path: [ 1, 2 ],
    txReceipt: '0x',
    rawTx: [
      '0x05',
      '0x57',
      '0x77359400',
      '0x2e90edd000',
      '0x5208',
      '0xfc976D96ccc57bC9D04AeA92A4a66Abd71926298',
      '0x0fd2e3afd46000',
      '0x',
      [],
      '0x01',
      '0x8314b7c04620705e92fbf736e518ace2690c62a3432034980f159560a990e118',
      '0x45369675a427365b45b4b4750d349e520dbf010515dae8bea624fb8bbfe3bcca'
    ],
    rawBlockHeader: [
      '0x7660abc16344ebaeb92eb7f2c3baa009e1a225fdddf33808f80e19a44fdf44f8',
      '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347',
      '0x4E0100D71Ad71940C95710888E1d2501f72c823E',
      '0x6bf4b869e1370c6277752a981b7d652fadb184312350cd6b56b3e427d733daca',
      '0xf66040d8c3aef22fc8da0c2a1c75d3ccc8bcc496e59996ca4512c91202824e2e',
      '0x05093e13336e61f2cf92109fb8507f9da74540922b538ee1e9faf4b88d88f604',
      '0xf52128570404000c08411c04b00200804a8808000a00180201c900142d02000020205000000002010010000821050802822140200302228002000a24d02c0440020040804c7040984a020039403006a06001c145815270808910848282b5208004413010120844414430012481a0080800180880002047018d22101124080044510228781840200a20ce084082280012000004810004920802000140148243269238847018b01808104001021104800404040340240c0000891805c808302100022040220008020141800021050d4008064a2080048140110005210a300231062858002100601344e010000000108a0180801030019120502200001000100401',
      '0x',
      '0x843063',
      '0x01c9c380',
      '0x90e88a',
      '0x6412a6a0',
      '0x636170656c6c612d6275696c646f72',
      '0x38f6d37e59ea0f47d02e9db713850dcabfcbd4446fad9954796c1e751266c1be',
      '0x0000000000000000',
      '0x629c77c2',
      '0xc026f3270ddf993200d95fdd0430ecf8f9743d078dcec2b03191dab4c97d6b57'
    ]
  }
  /*difficulty: '0',
  extraData: '0x636170656c6c612d6275696c646f72',
  gasLimit: 30000000,
  gasUsed: 9496714,
  hash: '0xe2f18d088596647916c58e828580822f84287d282ee8575843824a690969f01b',
  logsBloom: '0xf52128570404000c08411c04b00200804a8808000a00180201c900142d02000020205000000002010010000821050802822140200302228002000a24d02c0440020040804c7040984a020039403006a06001c145815270808910848282b5208004413010120844414430012481a0080800180880002047018d22101124080044510228781840200a20ce084082280012000004810004920802000140148243269238847018b01808104001021104800404040340240c0000891805c808302100022040220008020141800021050d4008064a2080048140110005210a300231062858002100601344e010000000108a0180801030019120502200001000100401',
  miner: '0x4E0100D71Ad71940C95710888E1d2501f72c823E',
  mixHash: '0x38f6d37e59ea0f47d02e9db713850dcabfcbd4446fad9954796c1e751266c1be',
  number: 8663139,
  parentHash: '0x7660abc16344ebaeb92eb7f2c3baa009e1a225fdddf33808f80e19a44fdf44f8',
  receiptsRoot: '0x05093e13336e61f2cf92109fb8507f9da74540922b538ee1e9faf4b88d88f604',
  sha3Uncles: '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347',
  size: 46070,
  stateRoot: '0x6bf4b869e1370c6277752a981b7d652fadb184312350cd6b56b3e427d733daca',
  timestamp: 1678943904,
  totalDifficulty: '10790000',
  transactions: [*/


  //const currentBlockNumber = await web3_goerli.eth.getBlockNumber();

  const address = contractAddressObj[hre.network.name].BridgeDisputeManager;

  let bridgeDisputeManager;
  if (hre.network.name == "mumbai" || hre.network.name == "polygon") {
    bridgeDisputeManager = await hre.ethers.getContractAt(
      "contracts/bridge-dispute-manager/BridgeDisputeManager.sol:BridgeDisputeManager",
      address
    );

  } else if (hre.network.name == "optimismGoerli" || hre.network.name == "optimism") {


  } else if (hre.network.name == "arbitrumGoerli" || hre.network.name == "arbitrum") {

  }

  let response;
  response = await bridgeDisputeManager.checkTransferTx(evidence.transaction, trade.to, trade.amount - trade.fee, 0);
  //console.log(response);
  console.log(Web3.utils.keccak256("0x" + rlp.encode(evidence.rawBlockHeader).toString('hex')));
  const block = await web3_goerli.eth.getBlock(8663139);
  console.log(block);
  response = await bridgeDisputeManager.verifyBlockHeader(evidence.blockHash, evidence.rawBlockHeader)
  console.log("verifyBlockHeader");
  console.log(response);
  console.log("verifyBlockHeader");
  const bufferTransaction = Buffer.from(evidence.transaction.slice(2), 'hex')
  //console.log(bufferTransaction);

  const txhash = Web3.utils.keccak256("0x" + bufferTransaction.toString('hex'));
  console.log(txhash);
  console.log(evidence.rawBlockHeader[4]);
  console.log(evidence.txProof);
  console.log(evidence.path);
  response = await bridgeDisputeManager.verifyProof(txhash, evidence.txProof, evidence.rawBlockHeader[4], evidence.path)
  console.log(response);
  response = await bridgeDisputeManager.verifyRawTx(evidence.transaction, evidence.rawTx);

  console.log(response);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });



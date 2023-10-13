const { expect, assert } = require('chai');
const { ethers } = require('hardhat');
const { expectRevert } = require('@openzeppelin/test-helpers');
const utils = require('./utils.js');
const TestData = utils.TestData;
const rlp = require('rlp');
const { EthereumProof } = require('ethereum-proof');
const Web3 =require("web3");
// const hre = require("hardhat");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */

const getRlpEncodableData = (txData) => {
  const ethereumProof = new EthereumProof(new Web3())
  const txData1 = {};

  txData = ethereumProof.toRlpEncodableObject(txData);

  if(txData.type != "0x" && txData.type != undefined) {
    txData1.chainId =  txData.chainId;
  }

  txData1.nonce =  txData.nonce;

  if(txData.type == "0x" || txData.type == undefined) {
    txData1.gasPrice = txData.gasPrice;
  }
  else if(txData.type == "0x01") {
    txData1.gasPrice = txData.gasPrice;
  } else {
    txData1.maxPriorityFeePerGas = txData.maxPriorityFeePerGas;
    txData1.maxFeePerGas =  txData.maxFeePerGas;
  }
  txData1.gasLimit =  txData.gas;
  txData1.to =  txData.to;
  txData1.value =  txData.value;
  txData1.data =  txData.input;

  if(txData.type != "0x" && txData.type != undefined) {
      txData1.accessList =  txData.accessList.map((item) => {
        return Object.values(item);
      });
  }

  txData1.v = txData.v;
  txData1.r = txData.r;
  txData1.s = txData.s;

  return Object.values(txData1);
}

describe('BridgeDisputeManager', function (/* accounts */) {
  let RLPDecoder;
  let rlpDecoder;
  let DecoderHelper;
  let decoderHelper;
  let TestToken;
  let testToken;
  let TestCheckpointManager;
  let testCheckpointManager;
  let testContractCall;

  let BridgeDisputeManager;
  let bridgeDisputeManager;
  let accounts;
  let DisputeHelper;
  let disputeHelper;

  before(async () => {
    accounts = await ethers.getSigners();
    RLPDecoder = await hre.ethers.getContractFactory('SolRLPDecoder');
    rlpDecoder = await RLPDecoder.deploy();
    DecoderHelper = await hre.ethers.getContractFactory('DecoderHelper', {
      libraries: {
        SolRLPDecoder: rlpDecoder.address,
      },
    });
    decoderHelper = await DecoderHelper.deploy();
    TestToken = await hre.ethers.getContractFactory('TestToken');
    TestCheckpointManager = await hre.ethers.getContractFactory(
      'TestCheckpointManager',
    );
    testCheckpointManager = await TestCheckpointManager.deploy();

    const TestContractCall = await hre.ethers.getContractFactory("TestContractCall");
    testContractCall = await TestContractCall.connect(accounts[0]).deploy();
  });

  beforeEach(async () => {
    testToken = await TestToken.connect(accounts[0]).deploy(
      accounts[0].address,
    );

    const BridgeDisputeManager = await hre.ethers.getContractFactory(
      'BridgeDisputeManager',
      {
        libraries: {
          SolRLPDecoder: rlpDecoder.address,
        },
      },
    );

    const DisputeHelper = await hre.ethers.getContractFactory('DisputeHelper', {
      libraries: {
        SolRLPDecoder: rlpDecoder.address,
      },
    });

    bridgeDisputeManager = await BridgeDisputeManager.connect(
      accounts[0],
    ).deploy(testCheckpointManager.address);
    disputeHelper = await DisputeHelper.connect(accounts[0]).deploy(
      testCheckpointManager.address,
    );

    testData = new TestData(accounts, disputeHelper);
  });

  describe('deployment', function () {
    it('should revert if checkpoint manager is zero address', async function () {
      const BridgeDisputeManager = await hre.ethers.getContractFactory(
        'BridgeDisputeManager',
        {
          libraries: {
            SolRLPDecoder: rlpDecoder.address,
          },
        },
      );

      await expect(
        BridgeDisputeManager.deploy(
          ethers.constants.AddressZero,
        ),
      ).to.be.revertedWith('Invalid checkpoint manager address');
    });
  });

  describe("checkEvidenceExceptBlockHash", function () {
    it("checkEvidenceExceptBlockHash : native check with valid evidence return false", async function () {
      const evidence = JSON.parse(JSON.stringify(testData.getEvidence(9)));
      const [to, value] = await disputeHelper.connect(accounts[0]).decodeToAndValueFromTxData(
        evidence.transaction
      );
      const result = await disputeHelper.checkEvidenceExceptBlockHash(
        true,
        value,
        value.mod(10000).toNumber(),
        to,
        ethers.constants.AddressZero,
        evidence
      );
      assert.isTrue(result);
    });

    it("checkEvidenceExceptBlockHash : erc20 check with valid evidence return false", async function () {
      const evidence = JSON.parse(JSON.stringify(testData.getEvidence(11)));
      const [tokenAddress, to, value] = await disputeHelper.connect(accounts[0]).decodeToAndValueFromERC20TxData(
        evidence.transaction
      );
      const result = await disputeHelper.checkEvidenceExceptBlockHash(
        false,
        value,
        value.mod(10000).toNumber(),
        to,
        tokenAddress,
        evidence
      );
      assert.isTrue(result);
    });

  });

  describe("verifyProof", function () {
    it('verifyProof', async function () {
      const testProof = testData.getProofData(0);
      const result = await bridgeDisputeManager.verifyProof(
        testProof.txHash,
        testProof.proof,
        testProof.txRoot,
        testProof.path,
      );
      assert.isTrue(result);
    });

    it('verifyProof wrong root', async function () {
      const testProof = testData.getProofData(1);
      const result = await bridgeDisputeManager.verifyProof(
        testProof.txHash,
        testProof.proof,
        testProof.txRoot,
        testProof.path,
      )
      assert.equal(result, false);
    });

    it('verifyProof invalid proof', async function () {
      const testProof = testData.getProofData(2);
      const result = await bridgeDisputeManager.verifyProof(
        testProof.txHash,
        testProof.proof,
        testProof.txRoot,
        testProof.path,
      )
      assert.equal(result, false);
    });

    it('verifyProof invalid path', async function () {
      const testProof = testData.getProofData(3);
      const result = await bridgeDisputeManager.verifyProof(
        testProof.txHash,
        testProof.proof,
        testProof.txRoot,
        testProof.path,
      )
      assert.equal(result, false);
    });

    it('verifyProof txReceipt', async function () {
      const testReceipt = testData.getReceiptData(0);
      const result = await bridgeDisputeManager.verifyProof(
        ethers.utils.keccak256(testReceipt.txReceipt),
        testReceipt.txReceiptProof,
        testReceipt.rawBlockHeader[5],
        testReceipt.path
      );
      assert.isTrue(result);
    });
  });

  describe("verifyBlockHash", function () {
    it('verifyBlockHash', async function () {
      const blockHash =
        '0xd858caa161bde78ebc8a8fe12adae6ecf7f0bcb8b1547b992215bf13fdbe17f9';
      const blockNumber = 5858981;
      const networkCode = 1001;
      await testCheckpointManager
        .connect(accounts[0])
        .setBlockHash(networkCode, blockNumber, blockHash);
      const blockHashResult = await testCheckpointManager.getBlockHash(
        networkCode,
        blockNumber,
      );

      assert.equal(blockHashResult, blockHash);
      const result = await bridgeDisputeManager.verifyBlockHash(
        blockHash,
        networkCode,
        blockNumber,
      );
      assert.isTrue(result);
    });

    it('verifyBlockHash blockhash not match', async function () {
      const blockHash =
        '0xd858caa161bde78ebc8a8fe12adae6ecf7f0bcb8b1547b992215bf13fdbe17f9';
      const notMatchBlockHash =
        '0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c';

      const blockNumber = 5858981;
      const networkCode = 1001;

      await testCheckpointManager
        .connect(accounts[0])
        .setBlockHash(networkCode, blockNumber, notMatchBlockHash);
      const blockHashResult = await testCheckpointManager.getBlockHash(
        networkCode,
        blockNumber,
      );

      assert.equal(blockHashResult, notMatchBlockHash);
      const result = await bridgeDisputeManager.verifyBlockHash(
        blockHash,
        networkCode,
        blockNumber,
      );
      assert.isFalse(result);
    });

    it('verifyBlockHash not set', async function () {
      const blockHash =
        '0xd858caa161bde78ebc8a8fe12adae6ecf7f0bcb8b1547b992215bf13fdbe17f9';
      const blockNumber = 5858982;
      const networkCode = 1001
      await expect(
        bridgeDisputeManager.verifyBlockHash(blockHash, networkCode, blockNumber)
      ).to.be.revertedWith("Relay blockhash first");
    });

  });

  describe("verifyRawTx", function () {
    it('verifyRawTx', async function () {
      const testTx = testData.getTxData(3);
      const encoded = rlp.encode(testTx.rawTx);
      const encodedHex = '0x02' + encoded.toString('hex'); //type2 tx

      const result = await bridgeDisputeManager.verifyRawTx(
        testTx.transaction,
        testTx.rawTx,
      );
      assert.isTrue(result);
      assert.equal(encodedHex, testTx.transaction);
    });

    it('verifyRawTx false', async function () {
      const testTx = testData.getTxData(4);
      const encoded = rlp.encode(testTx.rawTx);
      const encodedHex = '0x02' + encoded.toString('hex'); //type2 tx

      const result = await bridgeDisputeManager.verifyRawTx(
        testTx.transaction,
        testTx.rawTx,
      );
      assert.isNotTrue(result);
      assert.notEqual(encodedHex, testTx.transaction);
    });
  });

  describe("checkTransferTx", function () {
    it('checkTransferTx', async function () {
      const testTx = testData.getTransferTxData(0);
      let result = await disputeHelper.checkTransferTx(
        testTx.transaction,
        testTx.to,
        testTx.amount,
        0
      );
      assert.equal(result, true);
    });

    it('checkTransferTx upward', async function () {
      const testTx = testData.getTransferTxData(4);
      let result = await disputeHelper.checkTransferTx(
        testTx.transaction,
        testTx.to,
        testTx.amount,
        1001
      );
      assert.equal(result, true);
    });

    it('checkTransferTx, invalid to', async function () {
      const testTx = testData.getTransferTxData(1);
      let result = await disputeHelper.checkTransferTx(
        testTx.transaction,
        testTx.to,
        testTx.amount,
        0
      );
      assert.equal(result, false);
    });

    it('checkTransferTx, invalid amount', async function () {
      const testTx = testData.getTransferTxData(2);
      let result = await disputeHelper.checkTransferTx(
        testTx.transaction,
        testTx.to,
        testTx.amount,
        0
      );
      assert.equal(result, false);
    });

    it('checkTransferTx, upward invalid last 4 digits', async function () {
      const testTx = testData.getTransferTxData(2);
      let result = await disputeHelper.checkTransferTx(
        testTx.transaction,
        testTx.to,
        testTx.amount,
        1001
      );
      assert.equal(result, false);
    });
  });

  describe("checkERC20TransferTx", function () {
    it('checkERC20TransferTx', async function () {
      const testTx = testData.getTransferTxData(3);
      let result = await disputeHelper.checkERC20TransferTx(
        testTx.transaction,
        testTx.tokenAddress,
        testTx.to,
        testTx.amount,
        0
      );
      assert.equal(result, true);
    });

    it('checkERC20TransferTx : check dest code', async function () {
      const testTx = testData.getTransferTxData(6);
      let result = await disputeHelper.checkERC20TransferTx(
        testTx.transaction,
        testTx.tokenAddress,
        testTx.to,
        testTx.amount,
        1001
      );
      assert.equal(result, true);
    });

    it('checkERC20TransferTx : invalid tokenAddress', async function () {
      const testTx = testData.getTransferTxData(3);
      let result = await disputeHelper.checkERC20TransferTx(
        testTx.transaction,
        accounts[0].address,
        testTx.to,
        testTx.amount,
        0
      );
      assert.equal(result, false);
    });

    it('checkERC20TransferTx : invalid methodId', async function () {
      const testTx = testData.getTransferTxData(5);
      let result = await disputeHelper.checkERC20TransferTx(
        testTx.transaction,
        testTx.tokenAddress,
        testTx.to,
        testTx.amount,
        0
      );
      assert.equal(result, false);
    });

    it('checkERC20TransferTx : invalid recipient', async function () {
      const testTx = testData.getTransferTxData(3);
      let result = await disputeHelper.checkERC20TransferTx(
        testTx.transaction,
        testTx.tokenAddress,
        accounts[3].address,
        testTx.amount,
        0
      );
      assert.equal(result, false);
    });

    it('checkERC20TransferTx : invalid amount', async function () {
      const testTx = testData.getTransferTxData(3);
      let result = await disputeHelper.checkERC20TransferTx(
        testTx.transaction,
        testTx.tokenAddress,
        testTx.to,
        testTx.amount + "10000",
        0
      );
      assert.equal(result, false);
    });

  });

  describe("verifyReceipt", function () {
    it('verifyReceipt', async function () {
      const testReceipt = testData.getReceiptData(0);
      const result = await disputeHelper.verifyReceipt(
        testReceipt.txReceipt
      );
      assert.equal(result, true);
    });

    it('verifyReceipt false', async function () {
      const testReceipt = testData.getReceiptData(1);
      const result = await disputeHelper.verifyReceipt(
        testReceipt.txReceipt
      );
      assert.equal(result, false);
    });
  });

  describe("decode", async function () {
    it('decodeToAndValueFromTxData', async function () {
      const testTx = testData.getTransferTxData(0);
      const result = await disputeHelper.decodeToAndValueFromTxData(testTx.transaction);
      assert.equal(result[0], testTx.to);
      assert.equal(result[1], testTx.amount);
    });

    it('decodeToAndValueFromERC20TxData', async function () {
      const testTx = testData.getTransferTxData(3);
      const result = await disputeHelper.decodeToAndValueFromERC20TxData(testTx.transaction);
      assert.equal(result[0], testTx.tokenAddress);
      assert.equal(result[1], testTx.to);
      assert.equal(result[2], testTx.amount);
    });
  });

  describe('recoverAddress', function () {
    it('recoverAddress', async function () {
      const testEvidence = testData.getEvidence(9);
      const result = await bridgeDisputeManager.recoverAddress(
        testEvidence.rawTx,
      );

      assert.equal("0x6D29Fc79Eab50b1aB0C8550EC2952896aBCf0472", result);
    });

    it('recoverAddress : 2', async function () {
      const testEvidence = testData.getEvidence(10);
      const result = await bridgeDisputeManager.recoverAddress(
        testEvidence.rawTx,
      );

      assert.equal("0x6D29Fc79Eab50b1aB0C8550EC2952896aBCf0472", result);
    });
  })

  describe("utils", function () {
    it('verifyBlockHeader', async function () {
      const testBlockHeader = testData.getBlockHeaderData(0);
      const encoded = rlp.encode(testBlockHeader.blockHeader);
      const encodedHex = '0x' + encoded.toString('hex');
      const hash = await ethers.utils.keccak256(encodedHex);

      const result = await bridgeDisputeManager.verifyBlockHeader(
        testBlockHeader.blockHash,
        testBlockHeader.blockHeader,
      );
      assert.isTrue(result);
      assert.equal(testBlockHeader.blockHash, hash);
    });

    it('verifyBlockHeader false', async function () {
      const testBlockHeader = testData.getBlockHeaderData(1);
      const encoded = rlp.encode(testBlockHeader.blockHeader);
      const encodedHex = '0x' + encoded.toString('hex');
      const hash = await ethers.utils.keccak256(encodedHex);

      const result = await bridgeDisputeManager.verifyBlockHeader(
        testBlockHeader.blockHash,
        testBlockHeader.blockHeader,
      );
      assert.isNotTrue(result);
      assert.notEqual(testBlockHeader.blockHash, hash);
    });

    it('rlpEncode', async function () {
      const testBlockHeader = testData.getBlockHeaderData(0);
      const rlpEncoded = rlp.encode(testBlockHeader.blockHeader);
      const rlpEncodedHex = '0x' + rlpEncoded.toString('hex');

      const result = await disputeHelper.helperRlpEncode(
        testBlockHeader.blockHeader,
        false
      );
      assert.equal(rlpEncodedHex, result);
    });

    it('rlpEncode txEncode', async function () {

      // check : work in test but does not work in coverage
      // const tx = await accounts[0].sendTransaction({
      //   to: accounts[1].address,
      //   value: ethers.utils.parseEther("1.0"),
      // });
      // const txData = await hre.network.provider.send("eth_getTransactionByHash", [
      //   tx.hash,
      // ]);

      // const rlpEncodableData = getRlpEncodableData(txData);

      const rlpEncodableData = testData.getTxData(0).rawTx;
      const expextedData = ethers.utils.RLP.encode(
        rlpEncodableData
      );

      const result = await disputeHelper.helperRlpEncode(
        rlpEncodableData,
        true
      );

      assert.equal(expextedData, result);
    });

    it('composeTx', async function () {

      // check : work in test but does not work in coverage
      // const tx = await accounts[0].sendTransaction({
      //   to: accounts[1].address,
      //   value: ethers.utils.parseEther("1.0"),
      // });
      // const txData = await hre.network.provider.send("eth_getTransactionByHash", [
      //   tx.hash,
      // ]);

      // const rlpEncodableData = getRlpEncodableData(txData);

      const rlpEncodableData = testData.getTxData(0).rawTx;

      const expextedData = "0x02" + ethers.utils.RLP.encode(
        rlpEncodableData
      ).slice(2);
      const result = await disputeHelper.helperComposeTx(
        rlpEncodableData,
      );

      assert.equal(expextedData, result)
    });

    it('bufferToNibble', async function () {
      const bufferStringArray = [
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        'a',
        'b',
        'c',
      ];
      const buffer = Buffer.from(bufferStringArray.join(''), 'hex');
      const result = await disputeHelper.helperBufferToNibble(buffer);
      assert.equal(bufferStringArray.length, result.length);
      for (let i = 0; i < result.length; i++) {
        assert.equal(result[i].toString(16), bufferStringArray[i]);
      }
    });
  });
});

describe('SolRLPDecoder', function (/* accounts */) {
  let RLPDecoder;
  let rlpDecoder;
  let DecoderHelper;
  let decoderHelper;

  before(async () => {
    accounts = await ethers.getSigners();
    RLPDecoder = await hre.ethers.getContractFactory('SolRLPDecoder');
    rlpDecoder = await RLPDecoder.deploy();
    DecoderHelper = await hre.ethers.getContractFactory('DecoderHelper', {
      libraries: {
        SolRLPDecoder: rlpDecoder.address,
      },
    });
    decoderHelper = await DecoderHelper.deploy();
  });

  it('first byte < 0x7f, return byte itself', async function () {
    const decoded = await decoderHelper.decode('0x61');
    assert.equal(4, decoded[0].length);
    assert.equal(decoded[0], '0x61');
  });

  it('first byte < 0xb7, data is everything except first byte', async function () {
    const decoded = await decoderHelper.decode('0x83646f67');
    assert.equal(8, decoded[0].length);
    assert.equal(decoded[0], '0x646f67');
  });

  it('first byte == 0x80, data is null', async function () {
    const decoded = await decoderHelper.decode('0x80');
    assert.equal(decoded[0], '0x');
  });

  it('strings over 55 bytes long', async function () {
    const testString =
      'This function takes in a data, convert it to buffer if not, and a length for recursion';
    const testBuffer = Buffer.from(testString);
    const encoded = rlp.encode(testBuffer);
    //console.log(testBuffer.toString('hex'));
    const encodedHex =
      '0x' + Buffer.from(new Uint8Array(encoded)).toString('hex');
    const decoded = await decoderHelper.decode(encodedHex);
    assert.equal(
      Buffer.from(decoded[0].slice(2), 'hex').toString(),
      testString,
    );
  });

  it('a list', async function () {
    const list = [
      '0x54686973',
      '0x546869732066756e6374696f6e2074616b657320696e206120646174612c20636f6e7665727420697420746f20627566666572206966206e6f742c20616e642061206c656e67746820666f7220726563757273696f6e',
      '0x07',
      '0x05',
      ,
    ];
    const encoded = rlp.encode(list);
    const encodedHex =
      '0x' + Buffer.from(new Uint8Array(encoded)).toString('hex');
    const decoded = await decoderHelper.decode(encodedHex);
    assert.deepEqual(decoded, [
      '0x54686973',
      '0x546869732066756e6374696f6e2074616b657320696e206120646174612c20636f6e7665727420697420746f20627566666572206966206e6f742c20616e642061206c656e67746820666f7220726563757273696f6e',
      '0x07',
      '0x05',
      '0x',
    ]);
  });

  it('a list  over 55 bytes long', async function () {
    const list = [
      'This',
      'function',
      'takes',
      'in',
      'a',
      'data',
      'convert',
      'it',
      'to',
      'buffer',
      'if',
      'not',
      'and',
      'a',
      'length',
      'for',
      'recursion',
      'a1',
      'a2',
      'a3',
      'ia4',
      'a5',
      'a6',
      'a7',
      'a8',
      'ba9',
    ];

    const encoded = rlp.encode(list);
    const encodedHex =
      '0x' + Buffer.from(new Uint8Array(encoded)).toString('hex');
    const decoded = await decoderHelper.decode(encodedHex);

    const decodedBuffer = rlp.decode(encoded);
    let rlpdecoded = [];
    for (let i = 0; i < decodedBuffer.length; i++) {
      rlpdecoded[i] = '0x' + decodedBuffer[i].toString('hex');
    }

    assert.deepEqual(decoded, rlpdecoded);
  });

  it('decode a long list using actual data', async function () {
    const string =
      '0xf90131a0b7030de7565b7531315fefd37f135a84fcfc82896e38bf7321d458d6846c4285a04c05e9cd442533a0fe8cfa6948540dc3e178f6add3fe1a4a253694d345b97198a0667e9f9a0e2a7ee536a4c9bd2013d06296430ae8181ea08c76c737debf379d63a01d1146f205eaeca9bf69943a5882e81de1ac7e7fceaf112af76bf29deb34bc47a022715dfc9109f2e78dbc177f48b3e181ad3044b936e3d50ddc958c42ff76a23fa00c32dd02fc4143baa82d42182151637ac256e6262036dc9c353c561b8b15b8d1a055c39110aff8d0a5469fd6a3dfa966dbbd0ae726c8ecab006a3093806c45e03ba0d6bdf0cc3e37ae46f2a295d18f35cd019bb4d189a1c18fb94ae38e70c6b8eae8a0cedb936c7df2fb8e6720770b3eab8ff0320182b0e2a28c517e38bcbdbc13178f8080808080808080';

    const encoded = Buffer.from(string.slice(2), 'hex');
    const decodedBuffer = rlp.decode(encoded);
    const decoded = await decoderHelper.decode(string);
    let rlpdecoded = [];
    for (let i = 0; i < decodedBuffer.length; i++) {
      rlpdecoded[i] = '0x' + decodedBuffer[i].toString('hex');
    }
    assert.deepEqual(decoded, rlpdecoded);
  });
});

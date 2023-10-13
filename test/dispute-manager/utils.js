const testTransferTx = require('./data/checkTransferTx.json');
const testTx = require('./data/tx.json');
const testBlockHeader = require('./data/blockHeader.json');
const testProof = require('./data/proof.json');
const testEvidence = require('./data/exceptionEvidence.json');
const testReceipt = require('./data/receipt.json');

class TestData {
  constructor(_accounts) {
    this.accounts = _accounts;
  }

  getTransferTxData(index) {
    return testTransferTx[index];
  }
  getTxData(index) {
    return testTx[index];
  }

  getBlockHeaderData(index) {
    return testBlockHeader[index];
  }

  getProofData(index) {
    return testProof[index];
  }

  getEvidence(index) {
    return testEvidence[index];
  }

  getReceiptData(index) {
    return testReceipt[index];
  }
}

exports.TestData = TestData;

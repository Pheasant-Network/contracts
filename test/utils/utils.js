const testTrade = require('../utils/data/trade.json');
const testBond = require('../utils/data/bond.json');
const testAsset = require('../utils/data/asset.json');
const testEvidence = require('../utils/data/evidence.json');
const testTransferTx = require('../utils/data/checkTransferTx.json');
const testRelayerFee = require('../utils/data/relayerFee.json');

const defaultDestId = 1002;

class TestData {
  constructor(_accounts, _helper, _parametersHelper, _token, _isL2) {
    this.accounts = _accounts;
    this.helper = _helper;
    this.parametersHelper = _parametersHelper;
    this.token = _token;
    this.isL2 = _isL2;
  }

  getTradeData(index, time = null) {
    let data = testTrade[index];
    if(Number.isInteger(data.to)) {
      data.to = this.accounts[data.to].address
    }

    if(Number.isInteger(data.sender)) {
      data.sender = this.accounts[data.sender].address
    }

    if(Number.isInteger(data.user)) {
      data.user = this.accounts[data.user].address
    }

    if(Number.isInteger(data.relayer)) {
      data.relayer = this.accounts[data.relayer].address
    }

    if(time == null) {
      data.timestamp = Math.floor(Date.now() / 1000);
    } else {
      data.timestamp = time;
    }
    return data;
  }

  getEvidenceData(index) {
    return testEvidence[index];
  }

  getTransferTxData(index) {
    return testTransferTx[index];
  }

  getBondData(index) {
    return testBond[index];
  }

  getAssetData(index) {
    return testAsset[index];
  }

  async setUpTrade(testData, accountIndex, isDeposit = false, destId = defaultDestId){
    await this.helper.connect(this.accounts[accountIndex]).setUpTrade(
      testData.sender,
      testData.index,
      testData.user,
      testData.tokenTypeIndex,
      testData.amount,
      testData.timestamp,
      testData.to,
      testData.relayer,
      testData.status,
      testData.fee,
      destId
    );

    if(isDeposit) {
      if (this.isL2 && testData.tokenTypeIndex === 0) {
        await this.helper.connect(this.accounts[accountIndex]).setUpDeposit(
          testData.tokenTypeIndex,
          testData.amount,
          { value: testData.amount }
        );
      } else {
        await this.token.connect(this.accounts[accountIndex]).approve(this.helper.address, testData.amount);
        await this.token.connect(this.accounts[accountIndex]).transfer(this.helper.address, testData.amount);
      }
    }

  }

  async setUpHashedEvidence(user, index, evidence, accountIndex){
    await this.helper.connect(this.accounts[accountIndex]).setUpHashedEvidence(
      user,
      index,
      evidence
    );
  }

  async setUpBalance(amount, accountIndex){
    await this.token.connect(this.accounts[0]).transfer(this.accounts[accountIndex].address, amount);
  }

  async setUpIsUniqueHashedEvidence(evidence, accountIndex){
    await this.helper.connect(this.accounts[accountIndex]).setUpIsUniqueHashedEvidence(
      evidence
    );
  }

  async setUpDisputeDepositThresholdAmount(tokenTypeIndex, amount, accountIndex) {
    await this.parametersHelper.connect(this.accounts[accountIndex]).setUpDisputeDepositThresholdAmount(
      tokenTypeIndex, amount
    );
  }

  async setUpDispute(_userTrade, _dispute, accountIndex) {
    await this.helper.connect(this.accounts[accountIndex]).setUpDispute(
      _userTrade, _dispute
    );
  }

  getRelayerFeeData(index) {
    return testRelayerFee[index];
  }

  async setRelayerFeeSetting(address, current, next, nextTimestamp, isActive, accountIndex){
    address = this.accounts[address].address
    await this.parametersHelper.connect(this.accounts[accountIndex]).setRelayerFeeSetting(address, current, next, nextTimestamp, isActive);
  }
}

const setUpMockDisputeManager = async function(mockDisputeManager, results) {
  await mockDisputeManager.mock.verifyBlockHash.returns(results[0]);
  await mockDisputeManager.mock.checkEvidenceExceptBlockHash.returns(results[1]);
  await mockDisputeManager.mock.recoverAddress.returns("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  return mockDisputeManager;
}

exports.setUpMockDisputeManager = setUpMockDisputeManager;
exports.TestData = TestData;

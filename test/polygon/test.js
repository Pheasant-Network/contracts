const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const tradeThreshold = "1000000000000000000";
const tradeMinimumAmount = "10000";
const utils = require('../utils/utils.js');
const TestData = utils.TestData;
const setUpMockDisputeManager = utils.setUpMockDisputeManager;
const {deployMockContract} = require('@ethereum-waffle/mock-contract');
const { mine } = require("@nomicfoundation/hardhat-network-helpers");
const TestDisputeManagerJSON = require('../../artifacts/contracts/test/TestDisputeManager.sol/TestDisputeManager');

const tradableBondRatio = 211;
const WETH_TOKEN_INDEX = 0;
const ERC20_TOKEN_INDEX = 1;

const RELAYER_INDEX = 0;
const USER_INDEX = 1;
const DISPUTER_INDEX = 2;

const networkCode = 1001;
const defaultDestCode = 1002;

const DISPUTE_DEPOSIT_AMOUNT = 5000000000000000;

const STATUS_START = 0;
const STATUS_PAID = 2;
const STATUS_DISPUTE = 3;
const STATUS_SLASHED = 4;
const STATUS_PROVED = 5;
const STATUS_SLASH_COMPLETED = 6;
const STATUS_CANCEL = 99;

const CANCELABLE_PERIOD = 7200;
const DEFENCE_PERIOD = 10800000;

const feeList = {
  "high" : 1000,
  "medium" : 1000,
  "low" : 1000,
  "gasPriceThresholdHigh" : 0,
  "gasPriceThresholdLow" : 0
}

const bond = String(tradeThreshold * 3);

describe("PolygonPheasantNetworkBridgeChild", function () {

  let helper;
  let TestDisputeManager;
  let testDisputeManager;
  let mockDisputeManager;
  let TestToken;
  let testToken;
  let testTokenSecond;
  let testContractCall;
  let BondManager;
  let bondManager;
  let ParametersHelper;
  let parametersHelper;
  let accounts;
  let tokenAddressList;
  let testData;
  let oneDay = 60 * 60 * 24;

  const updatePeriod = 60 * 60 * 3;

  before(async () => {
    TestToken = await hre.ethers.getContractFactory("TestToken");
    TestDisputeManager = await hre.ethers.getContractFactory("TestDisputeManager");
    accounts =  await ethers.getSigners();
    mockDisputeManager = await deployMockContract(accounts[0], TestDisputeManagerJSON.abi);
    testDisputeManager = await TestDisputeManager.connect(accounts[0]).deploy();

    BondManager = await hre.ethers.getContractFactory("BondManager");
    ParametersHelper = await hre.ethers.getContractFactory("ParameterHelper");
  });

  beforeEach(async () => {
    testToken = await TestToken.connect(accounts[RELAYER_INDEX]).deploy(accounts[RELAYER_INDEX].address);
    testTokenSecond = await TestToken.connect(accounts[RELAYER_INDEX]).deploy(accounts[RELAYER_INDEX].address);
    tokenAddressList = [
      testToken.address
    ];

    parametersHelper = await ParametersHelper
      .connect(accounts[RELAYER_INDEX])
      .deploy(
        tokenAddressList,
        accounts[RELAYER_INDEX].address,
        {
          "tradeThreshold" : tradeThreshold.toString(),
          "tradeMinimumAmount" : tradeMinimumAmount,
          "networkCode" : networkCode,
          "tradableBondRatio" : tradableBondRatio,
          "disputeDepositAmount": DISPUTE_DEPOSIT_AMOUNT
        },
        [networkCode, defaultDestCode],
        [networkCode, defaultDestCode],
        [networkCode],
        feeList
      );

    const helperContractAddress = ethers.utils.getContractAddress(
      {from: accounts[RELAYER_INDEX].address, nonce: await accounts[RELAYER_INDEX].getTransactionCount() + 1},
    )
    bondManager = await BondManager
      .connect(accounts[RELAYER_INDEX])
      .deploy(
        accounts[RELAYER_INDEX].address,
        helperContractAddress,
        parametersHelper.address,
        false
      );

    const Helper = await hre.ethers.getContractFactory("contracts/polygon/Helper.sol:Helper");
    helper = await Helper
      .connect(accounts[RELAYER_INDEX])
      .deploy(
        parametersHelper.address,
        mockDisputeManager.address,
        bondManager.address,
        accounts[RELAYER_INDEX].address
      );

    const TestContractCall = await hre.ethers.getContractFactory("TestContractCall");
    testContractCall = await TestContractCall.connect(accounts[RELAYER_INDEX]).deploy();
    await testToken.connect(accounts[RELAYER_INDEX]).transfer(testContractCall.address, "1000000000000000000000");
    await testToken.connect(accounts[RELAYER_INDEX]).transfer(accounts[DISPUTER_INDEX].address, "1000000000000000000000");
    await testToken.connect(accounts[RELAYER_INDEX]).transfer(accounts[USER_INDEX].address, "1000000000000000000000");

    testData = new TestData(accounts, helper, parametersHelper, testToken, false);
  });

  describe("deployment", () => {
    it("relayers : _newOwner should be set as relayer", async function() {
      assert.equal(
        await helper.relayer(),
        accounts[0].address
      );
    });

    it("networkCode should be set", async function() {
      assert.equal(
        await parametersHelper.networkCode(),
        networkCode
      )
    })

    it("networkCode and defaultDestCode should be set as availableNetwork", async function() {
      assert.equal(
        await parametersHelper.availableNetwork(networkCode),
        1
      )
      assert.equal(
        await parametersHelper.availableNetwork(defaultDestCode),
        1
      )
    })

  });

  describe("newTrade function", () => {

    it("newTrade", async function () {

      const testTradeData = testData.getTradeData(0);
      await testToken.connect(accounts[0]).approve(helper.address, testTradeData.amount);
      await expect(helper.connect(accounts[0]).newTrade(
        testTradeData.amount,
        testTradeData.to,
        testTradeData.fee,
        testTradeData.tokenTypeIndex,
        testTradeData.destCode,
      ))
      .to.changeTokenBalances(
        testToken,
        [helper.address, accounts[0]],
        [testTradeData.amount, -testTradeData.amount]
      )
      .to.emit(helper, "NewTrade")
      .withArgs(accounts[0].address, 0);

      const trade = await helper.getTrade(accounts[0].address, 0);
      tradeAssert(testTradeData, trade, false, testTradeData.destCode);
    });

    it("newTrade : Second ERC20", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.tokenTypeIndex = ERC20_TOKEN_INDEX;

      await parametersHelper.connect(accounts[0]).addTokenAddressHelper(
        [networkCode, defaultDestCode], [ERC20_TOKEN_INDEX, ERC20_TOKEN_INDEX], [testTokenSecond.address, testTokenSecond.address]
      );

      await parametersHelper.connect(accounts[0]).updateTradableAmountHelper(
        ERC20_TOKEN_INDEX, tradeMinimumAmount, tradeThreshold
      );

      await testTokenSecond.connect(accounts[0]).approve(helper.address, testTradeData.amount);

      await expect(helper.connect(accounts[0]).newTrade(
        testTradeData.amount,
        testTradeData.to,
        testTradeData.fee,
        testTradeData.tokenTypeIndex,
        testTradeData.destCode,
      ))
      .to.changeTokenBalances(
        testTokenSecond,
        [helper.address, accounts[0]],
        [testTradeData.amount, -testTradeData.amount]
      )
      .to.emit(helper, "NewTrade")
      .withArgs(accounts[0].address, 0);

      const trade = await helper.getTrade(accounts[0].address, 0);
      tradeAssert(testTradeData, trade, false, testTradeData.destCode);
    });

    it("newTrade dest network code is unavailable", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.destCode = 1559;

      await testToken.connect(accounts[0]).approve(helper.address, testTradeData.amount);
      await expect(
        helper.connect(accounts[0]).newTrade(testTradeData.amount, testTradeData.to, testTradeData.fee, testTradeData.tokenTypeIndex, testTradeData.destCode)
      ).to.be.revertedWith("Unavailable dest code");

    });

    it("newTrade over tradeThreshold", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.amount = tradeThreshold + 1;

      await testToken.connect(accounts[0]).approve(helper.address, String(testTradeData.amount))
      await expect(
        helper.connect(accounts[0]).newTrade(String(testTradeData.amount), testTradeData.to, testTradeData.fee, testTradeData.tokenTypeIndex, testTradeData.destCode)
      ).to.be.revertedWith("Exceed exchangeable limit!");

    });

    it("newTrade below tradeThreshold", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.amount = tradeMinimumAmount - 1;

      await testToken.connect(accounts[0]).approve(helper.address, String(testTradeData.amount));
      await expect(
        helper.connect(accounts[0]).newTrade(String(testTradeData.amount), testTradeData.to, testTradeData.fee, testTradeData.tokenTypeIndex, testTradeData.destCode)
      ).to.be.revertedWith("Amount too low!");

    });

    it("newTrade invalid tokenTypeIndex", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.tokenTypeIndex = 100;

      await testToken.connect(accounts[0]).approve(helper.address, testTradeData.amount);
      await expect(
        helper.connect(accounts[0]).newTrade(testTradeData.amount, testTradeData.to, testTradeData.fee, testTradeData.tokenTypeIndex, testTradeData.destCode)
      ).to.be.revertedWith("Invalid token index");

    });

    it("newTrade should revert when user does't have enough balance", async function () {

      await testToken.connect(accounts[USER_INDEX]).transfer(accounts[RELAYER_INDEX].address, "1000000000000000000000");
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      await testToken.connect(accounts[1]).approve(helper.address, testTradeData.amount);
      await expect(
        helper.connect(accounts[1]).newTrade(testTradeData.amount, testTradeData.to, testTradeData.fee, testTradeData.tokenTypeIndex, testTradeData.destCode)
      ).to.be.revertedWith("TRANSFER_FROM_FAILED");

    });
  })

  describe("withdraw", () => {

    beforeEach(async () => {
      const bond = String(tradeThreshold * 3);
      await testToken.connect(accounts[0]).approve(bondManager.address, bond);
      await bondManager.deposit(WETH_TOKEN_INDEX, bond);

      await parametersHelper.addTokenAddressHelper([networkCode], [ERC20_TOKEN_INDEX], [testTokenSecond.address]);
      await testTokenSecond.approve(bondManager.address, bond);
      await bondManager.deposit(ERC20_TOKEN_INDEX, bond);
    });

    it("withdraw", async function () {
      const block = await ethers.provider.getBlock();
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2, block.timestamp - 10)));
      await testData.setUpTrade(testTradeData, 0, true);
      const evidence = testData.getEvidenceData(2);
      const hashedEvidence = await helper.helperHashEvidence(evidence);

      await expect(() =>
        helper.connect(accounts[0]).helperWithdraw(testTradeData.user, testTradeData.index, hashedEvidence)
      ).to.changeTokenBalances(
        testToken,
        [helper, accounts[0]],
        [-testTradeData.amount, testTradeData.amount]
      );

      const trade = await helper.getTrade(testTradeData.user, testTradeData.index);
      const expectedData = testTradeData
      expectedData.status = "2"
      tradeAssert(expectedData, trade, false);

      const contractHashedEvidence = await helper.hashedEvidences(accounts[0].address, 0);
      const expectHashedEvidence = await helper.helperHashEvidence(evidence);
      assert.equal(contractHashedEvidence, expectHashedEvidence)
    });

    it("withdraw second ERC20", async function () {
      const block = await ethers.provider.getBlock();
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2, block.timestamp - 10)));
      // set up ERC20
      testTradeData.tokenTypeIndex = ERC20_TOKEN_INDEX;
      await parametersHelper.connect(accounts[0]).addTokenAddressHelper(
        [networkCode, defaultDestCode], [ERC20_TOKEN_INDEX, ERC20_TOKEN_INDEX], [testTokenSecond.address, testTokenSecond.address]
      );
      await parametersHelper.connect(accounts[0]).updateTradableAmountHelper(
        ERC20_TOKEN_INDEX, tradeMinimumAmount, tradeThreshold
      );
      await testTokenSecond.connect(accounts[0]).approve(helper.address, testTradeData.amount);

      const tempTestData = new TestData(accounts, helper, parametersHelper, testTokenSecond);
      await tempTestData.setUpTrade(testTradeData, 0, true);
      const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(2)));
      evidence.blockNumber = await ethers.provider.getBlockNumber();
      const hashedEvidence = await helper.helperHashEvidence(evidence);

      await expect(() =>
        helper.connect(accounts[0]).helperWithdraw(testTradeData.user, testTradeData.index, hashedEvidence)
      ).to.changeTokenBalances(
        testTokenSecond,
        [helper, accounts[0]],
        [-testTradeData.amount, testTradeData.amount]
      );

      const trade = await helper.getTrade(testTradeData.user, testTradeData.index);
      const expectedData = testTradeData
      expectedData.status = "2"
      tradeAssert(expectedData, trade, false);

      const contractHashedEvidence = await helper.hashedEvidences(accounts[0].address, 0);
      const expectHashedEvidence = await helper.helperHashEvidence(evidence);
      assert.equal(contractHashedEvidence, expectHashedEvidence)

    });

    it("withdraw insufficient bond amount", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
      await testData.setUpTrade(testTradeData, 0, true);
      const evidence = testData.getEvidenceData(0);
      const hashedEvidence = await helper.helperHashEvidence(evidence);

      await bondManager.connect(accounts[0]).executeWithdrawBond(
        WETH_TOKEN_INDEX,
        await bondManager.getBond(WETH_TOKEN_INDEX)
      );

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await bondManager.finalizeWithdrawalBond(WETH_TOKEN_INDEX);

      await expect(
        helper.connect(accounts[0]).helperWithdraw(accounts[0].address, 0, hashedEvidence)
      ).to.be.revertedWith("Insufficient bond amount for trade");

    });

    it("withdraw invalid status", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
      testTradeData.status = "1";
      await testData.setUpTrade(testTradeData, 0, true);

      const evidence = testData.getEvidenceData(0);
      const hashedEvidence = await helper.helperHashEvidence(evidence);

      await expect(
        helper.connect(accounts[0]).helperWithdraw(accounts[0].address, 0, hashedEvidence)
      ).to.be.revertedWith("Only for START trade");

    });

    it("withdraw invalid relayer", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
      await testData.setUpTrade(testTradeData, 0, true);
      //NO BID
      const evidence = testData.getEvidenceData(0);
      const hashedEvidence = await helper.helperHashEvidence(evidence);
      await expect(
        helper.connect(accounts[3]).helperWithdraw(accounts[0].address, 0, hashedEvidence)
      ).to.be.revertedWith("Only for relayer");

    });

    it("withdraw not unique evidence", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
      const block = await ethers.provider.getBlock('latest');
      const now = block.timestamp;
      testTradeData.timestamp = now;
      await testData.setUpTrade(testTradeData, 0, true);
      const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(2)));
      evidence.blockNumber = await ethers.provider.getBlockNumber();
      const hashedEvidence = await helper.helperHashEvidence(evidence);

      // first time withdraw
      await helper.connect(accounts[0]).helperWithdraw(testTradeData.user, testTradeData.index, hashedEvidence)

      // second time withdraw with same evidence with first time withdrawal
      testTradeData.index = 1;
      testTradeData.status = 0; // fix status because status will change after used as trade data.
      await testData.setUpTrade(testTradeData, 0, true);
      await expect(
        helper.connect(accounts[0]).helperWithdraw(testTradeData.user, testTradeData.index, hashedEvidence) //not unique evidence
      ).to.be.revertedWith("Not unique hashed evidence");

    });

    it("bulkWithdraw", async function () {
      const block = await ethers.provider.getBlock('latest');
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
      const testTradeData2 = JSON.parse(JSON.stringify(testData.getTradeData(9)));
      testTradeData.timestamp = block.timestamp;
      testTradeData2.timestamp = block.timestamp;
      await testData.setUpTrade(testTradeData, 0, true);
      await testData.setUpTrade(testTradeData2, 0, true);

      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index},
        {userAddress: testTradeData2.user, index: testTradeData2.index}
      ]

      const evidences = [
        JSON.parse(JSON.stringify(testData.getEvidenceData(0))),
        JSON.parse(JSON.stringify(testData.getEvidenceData(1)))
      ]

      evidences[0].blockNumber = await ethers.provider.getBlockNumber();
      evidences[1].blockNumber = await ethers.provider.getBlockNumber();

      const hashedEvidences = [
        await helper.helperHashEvidence(evidences[0]),
        await helper.helperHashEvidence(evidences[1])
      ]

      await helper.connect(accounts[0]).bulkWithdraw(userTrades , hashedEvidences);
      trade = await helper.getTrade(testTradeData.user, testTradeData.index);
      const expectedData = testTradeData
      expectedData.status = "2"
      tradeAssert(expectedData, trade, false);

      trade = await helper.getTrade(testTradeData2.user, testTradeData2.index);
      const expectedData2 = testTradeData2
      expectedData2.status = "2"
      tradeAssert(expectedData2, trade, false);


    });

    it("bulkWithdraw insufficient bond amount", async function () {

      const block = await ethers.provider.getBlock('latest');
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
      const testTradeData2 = JSON.parse(JSON.stringify(testData.getTradeData(9)));
      testTradeData.timestamp = block.timestamp;
      testTradeData2.timestamp = block.timestamp;
      await testData.setUpTrade(testTradeData, 0, true);
      await testData.setUpTrade(testTradeData2, 0, true);

      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index},
        {userAddress: testTradeData2.user, index: testTradeData2.index}
      ]

      const evidences = [
        JSON.parse(JSON.stringify(testData.getEvidenceData(0))),
        JSON.parse(JSON.stringify(testData.getEvidenceData(1)))
      ]

      const hashedEvidences = [
        await helper.helperHashEvidence(evidences[0]),
        await helper.helperHashEvidence(evidences[1])
      ]

      await bondManager.connect(accounts[0]).executeWithdrawBond(
        WETH_TOKEN_INDEX,
        await bondManager.getBond(WETH_TOKEN_INDEX)
      );

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await bondManager.finalizeWithdrawalBond(WETH_TOKEN_INDEX);

      await expect(
        helper.connect(accounts[0]).bulkWithdraw(userTrades , hashedEvidences)
      ).to.be.revertedWith("Insufficient bond amount for trade");

    });

    it("bulkWithdraw invalid status", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
      const testTradeData2 = JSON.parse(JSON.stringify(testData.getTradeData(9)));
      testTradeData2.status =  1;
      const block = await ethers.provider.getBlock('latest');
      testTradeData.timestamp = block.timestamp;
      testTradeData2.timestamp = block.timestamp;

      await testData.setUpTrade(testTradeData, 0, true);
      await testData.setUpTrade(testTradeData2, 0, true);

      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index},
        {userAddress: testTradeData2.user, index: testTradeData2.index}
      ]

      const evidences = [
        testData.getEvidenceData(0),
        testData.getEvidenceData(0)
      ]

      const hashedEvidences = [
        await helper.helperHashEvidence(evidences[0]),
        await helper.helperHashEvidence(evidences[1])
      ]

      await expect(
        helper.connect(accounts[0]).bulkWithdraw(userTrades , hashedEvidences)
      ).to.be.revertedWith("Only for START trade");

    });

    it("buldwithdraw not unique evidences", async function () {

      const block = await ethers.provider.getBlock('latest');
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
      const testTradeData2 = JSON.parse(JSON.stringify(testData.getTradeData(9)));
      testTradeData.timestamp = block.timestamp;
      testTradeData2.timestamp = block.timestamp;
      await testData.setUpTrade(testTradeData, 0, true);
      await testData.setUpTrade(testTradeData2, 0, true);

      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index},
        {userAddress: testTradeData2.user, index: testTradeData2.index}
      ]

      const evidences = [
        JSON.parse(JSON.stringify(testData.getEvidenceData(0))),
        JSON.parse(JSON.stringify(testData.getEvidenceData(0)))
      ]

      evidences[0].blockNumber = await ethers.provider.getBlockNumber();
      evidences[1].blockNumber = await ethers.provider.getBlockNumber();

      const hashedEvidences = [
        await helper.helperHashEvidence(evidences[0]),
        await helper.helperHashEvidence(evidences[1])
      ]

      await expect(
        helper.connect(accounts[0]).bulkWithdraw(userTrades , hashedEvidences)
      ).to.be.revertedWith("Not unique hashed evidence");

    });

    it("buldWithdraw fail if called by other than the relayer", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
      const testTradeData2 = JSON.parse(JSON.stringify(testData.getTradeData(9)));

      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index},
        {userAddress: testTradeData2.user, index: testTradeData2.index}
      ]

      const evidences = [
        testData.getEvidenceData(0),
        testData.getEvidenceData(0)
      ]

      const hashedEvidences = [
        await helper.helperHashEvidence(evidences[0]),
        await helper.helperHashEvidence(evidences[1])
      ]

      await expect(
        helper.connect(accounts[1]).bulkWithdraw(userTrades , hashedEvidences)
      ).to.be.revertedWith("Only for relayer");

    });

  })

  describe("cancel trade", async function () {
    it("cancelTrade", async function () {
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);

      const testTradeData = JSON.parse(JSON.stringify(
        testData.getTradeData(0, block.timestamp)
      ));
      testTradeData.timestamp = block.timestamp - CANCELABLE_PERIOD;
      await testData.setUpTrade(testTradeData, 0, true);

      await hre.ethers.provider.send("evm_increaseTime", [60 * 60 * 3]); // 1 hour
      await hre.ethers.provider.send("evm_mine");

      await expect(
        helper.connect(accounts[0]).cancelTrade(0)
      )
      .to.changeTokenBalance(testToken, accounts[0], testTradeData.amount)
      .to.emit(helper, "Cancel")
      .withArgs(accounts[0].address, 0, "");

      let trade = await helper.getTrade(accounts[0].address, 0);
      const expectedData = testTradeData
      expectedData.status = "99"
      tradeAssert(expectedData, trade, false);

    });

    it("cancelTrade: Second ERC20", async function () {
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);

      const testTradeData = JSON.parse(JSON.stringify(
        testData.getTradeData(0, block.timestamp)
      ));

      testTradeData.tokenTypeIndex = ERC20_TOKEN_INDEX;
      testTradeData.timestamp = block.timestamp - CANCELABLE_PERIOD;
      await parametersHelper.connect(accounts[0]).addTokenAddressHelper(
        [networkCode, defaultDestCode], [ERC20_TOKEN_INDEX, ERC20_TOKEN_INDEX], [testTokenSecond.address, testTokenSecond.address]
      );
      await parametersHelper.connect(accounts[0]).updateTradableAmountHelper(
        ERC20_TOKEN_INDEX, tradeMinimumAmount, tradeThreshold
      );
      await testTokenSecond.connect(accounts[0]).approve(helper.address, testTradeData.amount);

      const tempTestData = new TestData(accounts, helper, parametersHelper, testTokenSecond);
      await tempTestData.setUpTrade(testTradeData, 0, true);

      await hre.ethers.provider.send("evm_increaseTime", [60 * 60]); // 1 hour
      await hre.ethers.provider.send("evm_mine");

      await expect(
        helper.connect(accounts[0]).cancelTrade(0)
      )
      .to.changeTokenBalance(testTokenSecond, accounts[0], testTradeData.amount)
      .to.emit(helper, "Cancel")
      .withArgs(accounts[0].address, 0, "");

      let trade = await helper.getTrade(accounts[0].address, 0);
      const expectedData = testTradeData
      expectedData.status = "99"
      tradeAssert(expectedData, trade, false);

    });

    it("cancelTrade: revert if status is other than start", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.status = "1";
      testTradeData.tokenTypeIndex = WETH_TOKEN_INDEX;

      await testData.setUpTrade(testTradeData, 0, true);
      await expect(
        helper.connect(accounts[0]).cancelTrade(0)
      ).to.be.revertedWith("Only for START status");

    });

    it("cancelTrade: revert if called within a certain period", async function () {
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);

      const testTradeData = testData.getTradeData(0, block.timestamp);
      await testData.setUpTrade(testTradeData, 0, true);

      await expect(
        helper.connect(accounts[0]).cancelTrade(0)
      ).to.be.revertedWith("After cancel period");

    });

    it("cancelTradeByRelayer", async function () {

      const testTradeData = JSON.parse(JSON.stringify(
        testData.getTradeData(0)
      ));
      await testData.setUpTrade(testTradeData, 0, true);

      const memo = "hello"

      await expect(
        helper.connect(accounts[0]).cancelTradeByRelayer(accounts[0].address, 0, memo)
      )
      .to.changeTokenBalance(testToken, accounts[0], testTradeData.amount)
      .to.emit(helper, "Cancel")
      .withArgs(accounts[0].address, 0, memo);

      let trade = await helper.getTrade(accounts[0].address, 0);
      const expectedData = testTradeData
      expectedData.status = "99"
      tradeAssert(expectedData, trade, false);

    });

    it("cancelTradeByRelayer: Only relayer can call", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      await testData.setUpTrade(testTradeData, 0, true);

      await expect(
        helper.connect(accounts[1]).cancelTradeByRelayer(accounts[0].address, 0, "0x")
      ).to.be.revertedWith("Only for relayer");

    });

    it("cancelTradeByRelayer: revert if status is other than start", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.status = "1";
      await testData.setUpTrade(testTradeData, 0, true);

      await expect(
        helper.connect(accounts[0]).cancelTradeByRelayer(accounts[0].address, 0, "0x")
      ).to.be.revertedWith("Only for START status");

    });
  })

  describe("slash", () => {

    it("dispute, in valid status", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(13)));
      const block = await ethers.provider.getBlock('latest');
      testTradeData.timestamp = block.timestamp;
      await testData.setUpTrade(testTradeData, DISPUTER_INDEX, false, testTradeData.destCode);
      await testData.setUpDisputeDepositThresholdAmount(WETH_TOKEN_INDEX, DISPUTE_DEPOSIT_AMOUNT, RELAYER_INDEX);

      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];

      await testToken.connect(accounts[DISPUTER_INDEX]).approve(helper.address, DISPUTE_DEPOSIT_AMOUNT);

      await expect(
        await helper.connect(accounts[DISPUTER_INDEX]).dispute(
          WETH_TOKEN_INDEX,
          DISPUTE_DEPOSIT_AMOUNT,
          userTrades[0].userAddress,
          userTrades[0].index
        )
      ).to.changeTokenBalances(
        testToken,
        [helper.address, accounts[DISPUTER_INDEX]],
        [DISPUTE_DEPOSIT_AMOUNT, -DISPUTE_DEPOSIT_AMOUNT]
      )
      .to.emit(helper, "Dispute");
      const dispute = await helper.connect(accounts[DISPUTER_INDEX]).disputes(userTrades[0].userAddress, userTrades[0].index);
      assert.equal(dispute.disputer, accounts[DISPUTER_INDEX].address);
      assert.equal(dispute.tokenTypeIndex, WETH_TOKEN_INDEX);
      assert.equal(dispute.deposit, DISPUTE_DEPOSIT_AMOUNT);
      const trade = await helper.getTrade(userTrades[0].userAddress, userTrades[0].index);
      const expectedData = testTradeData
      expectedData.status = STATUS_DISPUTE
      tradeAssert(expectedData, trade, false);
    });

    it("dispute, should be reverted with invalid status", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDisputeDepositThresholdAmount(WETH_TOKEN_INDEX, DISPUTE_DEPOSIT_AMOUNT, RELAYER_INDEX);

      const depositEthAmount = "5000000000000000";

      await expect(
        helper.connect(accounts[DISPUTER_INDEX]).dispute(
          WETH_TOKEN_INDEX,
          depositEthAmount,
          userTrades[0].userAddress,
          userTrades[0].index,
          { value: depositEthAmount }
        )
      ).to.be.revertedWith("Only for PAID status");
    });

    it("dispute, should be reverted with unslashable network", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.status = 2;
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];
      await testData.setUpTrade(testTradeData, USER_INDEX, false, 4200);
      await testData.setUpDisputeDepositThresholdAmount(WETH_TOKEN_INDEX, DISPUTE_DEPOSIT_AMOUNT, RELAYER_INDEX);

      const depositEthAmount = "5000000000000000";

      await expect(
        helper.connect(accounts[2]).dispute(
          WETH_TOKEN_INDEX,
          depositEthAmount,
          userTrades[0].userAddress,
          userTrades[0].index,
          { value: depositEthAmount }
        )
      ).to.be.revertedWith("Unavailable dest code");
    });

    it("dispute, should be reverted with timestamp", async function () {
      const block = await ethers.provider.getBlock('latest');
      const disputablePeriod = await parametersHelper.disputablePeriod();
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.status = 2;
      testTradeData.timestamp = block.timestamp - disputablePeriod;
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDisputeDepositThresholdAmount(WETH_TOKEN_INDEX, DISPUTE_DEPOSIT_AMOUNT, RELAYER_INDEX);

      const depositEthAmount = "5000000000000000";

      await expect(
        helper.connect(accounts[DISPUTER_INDEX]).dispute(
          WETH_TOKEN_INDEX,
          depositEthAmount,
          userTrades[0].userAddress,
          userTrades[0].index,
          { value: depositEthAmount }
        )
      ).to.be.revertedWith("Not in disputable period");
    });

    it("dispute, should be reverted with insufficient amount", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.status = 2;
      const block = await ethers.provider.getBlock('latest');
      testTradeData.timestamp = block.timestamp;
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDisputeDepositThresholdAmount(WETH_TOKEN_INDEX, DISPUTE_DEPOSIT_AMOUNT, RELAYER_INDEX);

      const depositEthAmount = "499999999999999";

      await expect(
        helper.connect(accounts[DISPUTER_INDEX]).dispute(
          WETH_TOKEN_INDEX,
          depositEthAmount,
          userTrades[0].userAddress,
          userTrades[0].index,
          { value: depositEthAmount }
        )
      ).to.be.revertedWith("Amount too low!");
    });

    it("dispute, should be reverted with invalid tokenTypeIndex", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.status = 2;
      const block = await ethers.provider.getBlock('latest');
      testTradeData.timestamp = block.timestamp;
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDisputeDepositThresholdAmount(WETH_TOKEN_INDEX, DISPUTE_DEPOSIT_AMOUNT, RELAYER_INDEX);

      const depositEthAmount = "5000000000000000";

      const networkCode = await parametersHelper.networkCode();
      await parametersHelper.connect(accounts[RELAYER_INDEX]).addTokenAddressHelper(
        [networkCode],
        [2],
        ["0xdAC17F958D2ee523a2206206994597C13D831ec7"]
      );

      await expect(
        helper.connect(accounts[DISPUTER_INDEX]).dispute(
          2,
          depositEthAmount,
          userTrades[0].userAddress,
          userTrades[0].index,
          { value: depositEthAmount }
        )
      ).to.be.revertedWith("Invalid tokenTypeIndex");
    });

  })

  describe("Defence", () => {
    it("relayer defence, when valid evidence", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.status = STATUS_DISPUTE;
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];
      const block = await ethers.provider.getBlock('latest');
      const testDisputeData = {
        disputer: accounts[DISPUTER_INDEX].address,
        tokenTypeIndex: WETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp
      };
      const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(3)));
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await testData.setUpHashedEvidence(testTradeData.user, testTradeData.index, evidence, RELAYER_INDEX);
      await testToken.connect(accounts[DISPUTER_INDEX]).approve(helper.address, DISPUTE_DEPOSIT_AMOUNT);
      await helper.connect(accounts[DISPUTER_INDEX]).setUpDeposit(
        WETH_TOKEN_INDEX,
        DISPUTE_DEPOSIT_AMOUNT,
        { value: DISPUTE_DEPOSIT_AMOUNT }
      );
      mockDisputeManager = await setUpMockDisputeManager(mockDisputeManager, [true, true]);
      await expect(
        helper.connect(accounts[RELAYER_INDEX]).defence(
          userTrades[0].userAddress,
          userTrades[0].index,
          evidence
        )
      ).to.changeTokenBalances(
        testToken,
        [helper.address, accounts[RELAYER_INDEX]],
        [-DISPUTE_DEPOSIT_AMOUNT, DISPUTE_DEPOSIT_AMOUNT]
      )
      .to.emit(helper, "Defence")
      .withArgs(userTrades[0].userAddress, userTrades[0].index, STATUS_PROVED);

      const dispute = await helper.connect(accounts[RELAYER_INDEX]).disputes(
        userTrades[0].userAddress, userTrades[0].index
      );
      assert.equal(dispute.deposit, 0);

      const trade = await helper.getTrade(userTrades[0].userAddress, userTrades[0].index);
      const expectedData = testTradeData
      expectedData.status = STATUS_PROVED
      tradeAssert(expectedData, trade, false);
    });

    it("relayer defence: should be reverted with wrong evidence", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.status = STATUS_DISPUTE;
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];
      const block = await ethers.provider.getBlock('latest');
      const testDisputeData = {
        disputer: accounts[DISPUTER_INDEX].address,
        tokenTypeIndex: WETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp
      };
      const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(3)));
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await testData.setUpHashedEvidence(testTradeData.user, testTradeData.index, evidence, RELAYER_INDEX);
      await testToken.connect(accounts[DISPUTER_INDEX]).approve(helper.address, DISPUTE_DEPOSIT_AMOUNT);
      const wrongEvidence = JSON.parse(JSON.stringify(testData.getEvidenceData(4)));
      await expect(
        helper.connect(accounts[RELAYER_INDEX]).defence(
          userTrades[0].userAddress,
          userTrades[0].index,
          wrongEvidence
        )
      ).to.be.revertedWith("Wrong evidence!");
    });

    it("relayer defence: should be reverted if status is not DISPUTE", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.status = STATUS_PAID;
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];
      const block = await ethers.provider.getBlock('latest');
      const testDisputeData = {
        disputer: accounts[DISPUTER_INDEX].address,
        tokenTypeIndex: WETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp
      };
      const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(3)));
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await testData.setUpHashedEvidence(testTradeData.user, testTradeData.index, evidence, RELAYER_INDEX);
      await testToken.connect(accounts[DISPUTER_INDEX]).approve(helper.address, DISPUTE_DEPOSIT_AMOUNT);
      await expect(
        helper.connect(accounts[RELAYER_INDEX]).defence(
          userTrades[0].userAddress,
          userTrades[0].index,
          evidence
        )
      ).to.be.revertedWith("Only for DISPUTE status");
    });

    it("relayer defence, when invalid evidence", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.status = STATUS_DISPUTE;
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];
      const block = await ethers.provider.getBlock('latest');
      const testDisputeData = {
        disputer: accounts[DISPUTER_INDEX].address,
        tokenTypeIndex: WETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp
      };
      const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(3)));
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await testData.setUpHashedEvidence(testTradeData.user, testTradeData.index, evidence, RELAYER_INDEX);
      await testToken.connect(accounts[DISPUTER_INDEX]).approve(helper.address, DISPUTE_DEPOSIT_AMOUNT);
      await helper.connect(accounts[DISPUTER_INDEX]).setUpDeposit(
        WETH_TOKEN_INDEX,
        DISPUTE_DEPOSIT_AMOUNT,
        { value: DISPUTE_DEPOSIT_AMOUNT }
      );
      mockDisputeManager = await setUpMockDisputeManager(mockDisputeManager, [false, false]);
      await expect(
        helper.connect(accounts[RELAYER_INDEX]).defence(
          userTrades[0].userAddress,
          userTrades[0].index,
          evidence
        )
      )
      .to.emit(helper, "Defence")
      .withArgs(userTrades[0].userAddress, userTrades[0].index, STATUS_SLASHED);
      const trade = await helper.getTrade(userTrades[0].userAddress, userTrades[0].index);
      const expectedData = testTradeData
      expectedData.status = STATUS_SLASHED
      tradeAssert(expectedData, trade, false);
    });
  });

  describe("slash", () => {
    it("slash, able to slash for failed defence", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.status = STATUS_SLASHED;
      testTradeData.relayer = accounts[RELAYER_INDEX].address;
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];
      const block = await ethers.provider.getBlock('latest');
      const testDisputeData = {
        disputer: accounts[DISPUTER_INDEX].address,
        tokenTypeIndex: WETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp
      };
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await testToken.connect(accounts[DISPUTER_INDEX]).approve(helper.address, DISPUTE_DEPOSIT_AMOUNT);
      await testToken.connect(accounts[RELAYER_INDEX]).approve(bondManager.address, bond);
      await helper.connect(accounts[DISPUTER_INDEX]).setUpDeposit(
        WETH_TOKEN_INDEX,
        DISPUTE_DEPOSIT_AMOUNT,
        // { value: DISPUTE_DEPOSIT_AMOUNT }
      );
      await bondManager.deposit(WETH_TOKEN_INDEX, bond, {value : bond});

      const expectedReceiveAmount = Math.round(testTradeData.amount * tradableBondRatio / 100) / 2;
      const expectedRemainder = bond  - expectedReceiveAmount * 2;
      await expect(
        helper.connect(accounts[DISPUTER_INDEX]).slash(
          userTrades[0].userAddress,
          userTrades[0].index
        )
      ).to.changeTokenBalances(
        testToken,
        [helper.address, accounts[DISPUTER_INDEX]],
        [-DISPUTE_DEPOSIT_AMOUNT, DISPUTE_DEPOSIT_AMOUNT + expectedReceiveAmount]
      )
      .to.emit(helper, "Slash")
      .withArgs(userTrades[0].userAddress, userTrades[0].index, accounts[RELAYER_INDEX].address);
      const expectedData = testTradeData;
      expectedData.status = STATUS_SLASH_COMPLETED;
      const trade = await helper.getTrade(userTrades[0].userAddress, userTrades[0].index);
      tradeAssert(expectedData, trade, false);
      const relayerBalance = await bondManager.getBond(WETH_TOKEN_INDEX);
      assert.equal(relayerBalance.toString(), expectedRemainder);
    });

    it("slash, able to slash after certain period even relayer have not defenced", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.status = STATUS_DISPUTE;
      testTradeData.relayer = accounts[RELAYER_INDEX].address;
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];
      const block = await ethers.provider.getBlock('latest');
      const testDisputeData = {
        disputer: accounts[DISPUTER_INDEX].address,
        tokenTypeIndex: WETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp - DEFENCE_PERIOD
      };
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await testToken.connect(accounts[DISPUTER_INDEX]).approve(helper.address, DISPUTE_DEPOSIT_AMOUNT);
      await testToken.connect(accounts[RELAYER_INDEX]).approve(bondManager.address, bond);
      await helper.connect(accounts[DISPUTER_INDEX]).setUpDeposit(
        WETH_TOKEN_INDEX,
        DISPUTE_DEPOSIT_AMOUNT,
        { value: DISPUTE_DEPOSIT_AMOUNT }
      );
      await bondManager.deposit(WETH_TOKEN_INDEX, bond, {value : bond});

      const expectedReceiveAmount = Math.round(testTradeData.amount * tradableBondRatio / 100) / 2;
      const expectedRemainder = bond  - expectedReceiveAmount * 2;
      await expect(
        helper.connect(accounts[DISPUTER_INDEX]).slash(
          userTrades[0].userAddress,
          userTrades[0].index
        )
      ).to.changeTokenBalances(
        testToken,
        [helper.address, accounts[DISPUTER_INDEX]],
        [-DISPUTE_DEPOSIT_AMOUNT, DISPUTE_DEPOSIT_AMOUNT + expectedReceiveAmount]
      )
      .to.emit(helper, "Slash")
      .withArgs(userTrades[0].userAddress, userTrades[0].index, accounts[RELAYER_INDEX].address);
      const expectedData = testTradeData;
      expectedData.status = STATUS_SLASH_COMPLETED;
      const trade = await helper.connect(accounts[DISPUTER_INDEX]).getTrade(userTrades[0].userAddress, userTrades[0].index);
      tradeAssert(expectedData, trade, false);
      const relayerBalance = await bondManager.getBond(WETH_TOKEN_INDEX);
      assert.equal(relayerBalance.toString(), expectedRemainder);
    });

    it("slash, should be reverted when initial disputer is not the msg.sender", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.status = STATUS_SLASHED;
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];
      const block = await ethers.provider.getBlock('latest');
      const testDisputeData = {
        disputer: accounts[DISPUTER_INDEX].address,
        tokenTypeIndex: WETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp
      };
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await testToken.connect(accounts[DISPUTER_INDEX]).approve(helper.address, DISPUTE_DEPOSIT_AMOUNT);
      await testToken.connect(accounts[RELAYER_INDEX]).approve(bondManager.address, bond);
      await helper.connect(accounts[DISPUTER_INDEX]).setUpDeposit(
        WETH_TOKEN_INDEX,
        DISPUTE_DEPOSIT_AMOUNT,
        { value: DISPUTE_DEPOSIT_AMOUNT }
      );
      await bondManager.deposit(WETH_TOKEN_INDEX, bond, {value : bond});
      await expect(
        helper.connect(accounts[USER_INDEX]).slash(
          userTrades[0].userAddress,
          userTrades[0].index
        )
      ).to.be.revertedWith(
        "Only for disputer"
      );
    });

    it("slash, should be reverted if trade status is not SLASHED or DISPUTED", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.status = STATUS_PAID;
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];
      const block = await ethers.provider.getBlock('latest');
      const testDisputeData = {
        disputer: accounts[DISPUTER_INDEX].address,
        tokenTypeIndex: WETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp
      };
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await testToken.connect(accounts[DISPUTER_INDEX]).approve(helper.address, DISPUTE_DEPOSIT_AMOUNT);
      await testToken.connect(accounts[RELAYER_INDEX]).approve(bondManager.address, bond);
      await helper.connect(accounts[DISPUTER_INDEX]).setUpDeposit(
        WETH_TOKEN_INDEX,
        DISPUTE_DEPOSIT_AMOUNT,
        { value: DISPUTE_DEPOSIT_AMOUNT }
      );
      await bondManager.deposit(WETH_TOKEN_INDEX, bond, {value : bond});
      await expect(
        helper.connect(accounts[DISPUTER_INDEX]).slash(
          userTrades[0].userAddress,
          userTrades[0].index
        )
      ).to.be.revertedWith(
        "Only for disputed trade"
      );
    });

    it("slash, should be reverted if trade status is DISPUTED but it has not passed DEFENCE_PERIOD", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.status = STATUS_DISPUTE;
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];
      const block = await ethers.provider.getBlock('latest');
      const testDisputeData = {
        disputer: accounts[DISPUTER_INDEX].address,
        tokenTypeIndex: WETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp
      };
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await testToken.connect(accounts[DISPUTER_INDEX]).approve(helper.address, DISPUTE_DEPOSIT_AMOUNT);
      await testToken.connect(accounts[RELAYER_INDEX]).approve(bondManager.address, bond);
      await helper.connect(accounts[DISPUTER_INDEX]).setUpDeposit(
        WETH_TOKEN_INDEX,
        DISPUTE_DEPOSIT_AMOUNT,
        { value: DISPUTE_DEPOSIT_AMOUNT }
      );
      await bondManager.deposit(WETH_TOKEN_INDEX, bond, {value : bond});
      await expect(
        helper.connect(accounts[DISPUTER_INDEX]).slash(
          userTrades[0].userAddress,
          userTrades[0].index
        )
      ).to.be.revertedWith(
        "Not yet slashed"
      );
    });

  })

  describe("bond", () => {

    it("getRequiredBondAmount", async function () {
      const tradeAmount = 100000010000000;
      const requiredBondAmount = await parametersHelper.connect(accounts[0]).getRequiredBondAmount(tradeAmount);
      assert.equal(requiredBondAmount, Math.round(100000010000000 * tradableBondRatio / 100));
    });

  })

  describe("contract related function", () => {

    it("getTokenAddress", async function () {
      // assert.equal(l2Address, testToken.address)
      const l2Address =  await parametersHelper.tokenAddress(networkCode, 0);
      assert.equal(l2Address, testToken.address)
    });

  })

  describe("Contract account related test", () => {
    it("newTrade call from contract account", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.user = testContractCall.address;

      await testContractCall.connect(accounts[0]).functionCall(
        testToken.address,
        testToken.interface.encodeFunctionData(
          "approve",
          [ helper.address, testTradeData.amount ]
        ),
        0
      );

      const encodedData = helper.interface.encodeFunctionData(
        "newTrade",
        [ testTradeData.amount, testTradeData.to, testTradeData.fee, testTradeData.tokenTypeIndex, testTradeData.destCode]
      );

      await expect(
        testContractCall.connect(accounts[0]).functionCall(
          helper.address,
          encodedData,
          0
        )
      )
      .to.emit(helper, "NewTrade")
      .withArgs(testContractCall.address, 0);

      const trade = await helper.getTrade(testContractCall.address, 0);

      tradeAssert(testTradeData, trade, false);
    });

    it("dispute: successfully call from contract account and send to contract account", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(17)));
      const block = await ethers.provider.getBlock('latest');
      testTradeData.sender = testContractCall.address;
      testTradeData.user = testContractCall.address;
      testTradeData.to = testContractCall.address;
      testTradeData.status = STATUS_PAID;
      testTradeData.timestamp = block.timestamp;
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];
      await testData.setUpTrade(testTradeData, 0, false, testTradeData.destCode);

      await testContractCall.connect(accounts[DISPUTER_INDEX]).functionCall(
        testToken.address,
        testToken.interface.encodeFunctionData(
          "approve",
          [ helper.address, DISPUTE_DEPOSIT_AMOUNT ]
        ),
        0
      );

      const encodedData = helper.interface.encodeFunctionData(
        "dispute",
        [
          WETH_TOKEN_INDEX,
          DISPUTE_DEPOSIT_AMOUNT,
          userTrades[0].userAddress,
          userTrades[0].index
         ]
      );

      const latestBlock = await ethers.provider.getBlock('latest');

      await expect(
        testContractCall.connect(accounts[DISPUTER_INDEX]).functionCall(
          helper.address,
          encodedData,
          0
        )
      ).to.changeTokenBalances(
        testToken,
        [helper.address, testContractCall],
        [DISPUTE_DEPOSIT_AMOUNT, -DISPUTE_DEPOSIT_AMOUNT]
      )
      .to.emit(helper, "Dispute");

      const trade = await helper.getTrade(userTrades[0].userAddress, userTrades[0].index);
      const expectedData = testTradeData
      expectedData.status = STATUS_DISPUTE
      tradeAssert(expectedData, trade, false);
      const dispute = await helper.disputes(userTrades[0].userAddress, userTrades[0].index);
      assert.equal(dispute.disputer, testContractCall.address);
      assert.equal(dispute.tokenTypeIndex, WETH_TOKEN_INDEX);
      assert.equal(dispute.deposit, DISPUTE_DEPOSIT_AMOUNT);
    })

    it("slash : successfully call from contract account and send to contract account", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(17)));
      testTradeData.sender = testContractCall.address;
      testTradeData.user = testContractCall.address;
      testTradeData.to = testContractCall.address;
      testTradeData.status = STATUS_SLASHED;
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];
      const latestBlock = await ethers.provider.getBlock('latest');
      const now = latestBlock.timestamp;
      const testDisputeData = {
        disputer: testContractCall.address,
        tokenTypeIndex: WETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: now
      };
      await testData.setUpTrade(testTradeData, 0, false, testTradeData.destCode);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await testToken.connect(accounts[DISPUTER_INDEX]).approve(helper.address, DISPUTE_DEPOSIT_AMOUNT);
      await testToken.connect(accounts[RELAYER_INDEX]).approve(bondManager.address, bond);
      await helper.connect(accounts[DISPUTER_INDEX]).setUpDeposit(
        WETH_TOKEN_INDEX,
        DISPUTE_DEPOSIT_AMOUNT
      );

      await bondManager.deposit(WETH_TOKEN_INDEX, bond, {value : bond});

      mockDisputeManager = await setUpMockDisputeManager(mockDisputeManager, [false, false]);

      const evidence = testData.getEvidenceData(3);
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      evidence.rawBlockHeader[11] = "0x"+ Number(block.timestamp).toString(16);

      await testData.setUpHashedEvidence(testContractCall.address, 0, evidence, 0)

      const expectedReceiveAmount = Math.round(testTradeData.amount * tradableBondRatio / 100) / 2;

      const encodedData = helper.interface.encodeFunctionData(
        "slash",
        [
          userTrades[0].userAddress,
          userTrades[0].index
        ]
      );

      await expect(
        testContractCall.connect(accounts[DISPUTER_INDEX]).functionCall(
          helper.address,
          encodedData,
          0
        )
      ).to.changeTokenBalances(
        testToken,
        [helper.address, testContractCall],
        [-DISPUTE_DEPOSIT_AMOUNT, DISPUTE_DEPOSIT_AMOUNT + expectedReceiveAmount * 2]
      )
      .to.emit(helper, "Slash")
      .withArgs(userTrades[0].userAddress, userTrades[0].index, accounts[RELAYER_INDEX].address);

      const trade = await helper.getTrade(testContractCall.address, 0);
      const expectedData = testTradeData
      expectedData.status = STATUS_SLASH_COMPLETED
      tradeAssert(expectedData, trade, false);

      const relayerBalance = await bondManager.getBond(WETH_TOKEN_INDEX);

      const expectedRemainder = bond  - expectedReceiveAmount * 2;
      assert.equal(relayerBalance.toString(), expectedRemainder)

    });
  })
});

const tradeAssert = function(rawExpectedData, rawActualData, isTimeStampCheck, destCode) {
  const expect = Object.fromEntries(
    Object.entries(rawExpectedData)
    .map(([ key, val ]) => [ key, String(val) ])
  );

  const actual = Object.fromEntries(
    Object.entries(rawActualData)
    .map(([ key, val ]) => [ key, String(val) ])
  );

  assert.equal(expect.index, actual.index);
  assert.equal(expect.user, actual.user);
  assert.equal(expect.tokenTypeIndex, actual.tokenTypeIndex);
  assert.equal(expect.amount, actual.amount);
  assert.equal(expect.to, actual.to);
  assert.equal(expect.relayer, actual.relayer);
  assert.equal(expect.status, actual.status);
  assert.equal(expect.fee, actual.fee);

  if (destCode) {
    assert.equal(expect.destCode, actual.destCode);
  }

  if(isTimeStampCheck) {
    assert.equal(expect.timestamp, actual.timestamp);
  }
}



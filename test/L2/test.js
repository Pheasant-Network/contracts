const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const tradeThreshold = "1000000000000000000";
const tradeMinimumAmount = "10000";
const utils = require('../utils/utils.js');
const TestData = utils.TestData;
const setUpMockDisputeManager = utils.setUpMockDisputeManager;
const { deployMockContract } = require('@ethereum-waffle/mock-contract');
const TestDisputeManagerJSON = require('../../artifacts/contracts/test/TestDisputeManager.sol/TestDisputeManager');

const { mine, time } = require("@nomicfoundation/hardhat-network-helpers");

const tradableBondRatio = 200;

const DISPUTE_DEPOSIT_AMOUNT_INDEX = 4;

const ETH_TOKEN_INDEX = 0;
const ERC20_TOKEN_INDEX = 1;

const networkCode = 1001;
const defaultDestCode = 1002;

const STATUS_START = 0;
const STATUS_PAID = 2;
const STATUS_DISPUTE = 3;
const STATUS_SLASHED = 4;
const STATUS_PROVED = 5;
const STATUS_SLASH_COMPLETED = 6;
const STATUS_CANCEL = 99;

const SLASHABLE_PERIOD = 1209600000; // 14days in mili seconds
const DEFENCE_PERIOD = 10800000;

const DISPUTE_DEPOSIT_AMOUNT = 5000000000000000;

const RELAYER_INDEX = 0;
const USER_INDEX = 1;
const DISPUTER_INDEX = 2;

const feeList = {
  "high" : 1500,
  "medium" : 1000,
  "low" : 500,
  "gasPriceThresholdHigh" : ethers.utils.parseUnits("4", "gwei"),
  "gasPriceThresholdLow" : ethers.utils.parseUnits("2", "gwei")
}

const bond = String(tradeThreshold * 3);

describe("L2/PheasantNetworkBridgeChild", function () {

  let TestDisputeManager;
  let testDisputeManager;
  let mockDisputeManager;
  let TestToken;
  let testToken;
  let testContractCall;
  let BondManager;
  let bondManager;
  let ParametersHelper;
  let parametersHelper;
  let accounts;
  let helper;
  let tokenAddressList;
  let testData;
  let oneDay = 60 * 60 * 24;

  const updatePeriod = 60 * 60 * 3

  before(async () => {
    TestToken = await hre.ethers.getContractFactory("TestToken");
    TestDisputeManager = await hre.ethers.getContractFactory("TestDisputeManager");

    accounts =  await ethers.getSigners();
    mockDisputeManager = await deployMockContract(accounts[0], TestDisputeManagerJSON.abi);
    testDisputeManager = await TestDisputeManager.connect(accounts[0]).deploy();

    BondManager = await hre.ethers.getContractFactory("BondManager");
    ParametersHelper = await hre.ethers.getContractFactory("ParameterHelper");

    // ContractCall deployment
    const TestContractCall = await hre.ethers.getContractFactory("TestContractCall");
    testContractCall = await TestContractCall.connect(accounts[0]).deploy();
  });

  beforeEach(async () => {
    testToken = await TestToken.connect(accounts[0]).deploy(accounts[0].address);
    tokenAddressList = [
      ethers.constants.AddressZero,
    ]


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
        [],
        feeList
      );

    const helperContractAddress = ethers.utils.getContractAddress(
      {from: accounts[0].address, nonce: await accounts[0].getTransactionCount() + 1},
    );
    bondManager = await BondManager
      .connect(accounts[RELAYER_INDEX])
      .deploy(
        accounts[0].address,
        helperContractAddress,
        parametersHelper.address,
        true
      );

    const Helper = await hre.ethers.getContractFactory("contracts/L2/Helper.sol:Helper");
    helper = await Helper
      .connect(accounts[RELAYER_INDEX])
      .deploy(
        parametersHelper.address,
        mockDisputeManager.address,
        bondManager.address,
        accounts[RELAYER_INDEX].address
      );

    testData = new TestData(accounts, helper, parametersHelper, testToken, true);
  });

  describe("deployment", () => {
    it("relayer : _newOwner should be set as relayer", async function() {
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

  describe("setup function", () => {

    it("setUpTrade", async function () {
      let testTradeData = testData.getTradeData(0);
      await testData.setUpTrade(testTradeData, 0);
      const setUpData = await helper.getTrade(testTradeData.sender, testTradeData.index);
      tradeAssert(testTradeData, setUpData);
    });

    it("setUpBalance", async function () {
      const testBondData = testData.getBondData(0);

      await testData.setUpBalance(testBondData.bond, 2);
      const balance = await testToken.balanceOf(accounts[2].address);
      assert.equal(balance.toString(), String(testBondData.bond));
    });

    it("setUpIsUniqueHashedEvidence", async function () {
      const evidence = testData.getEvidenceData(2);
      let result = await helper.getIsUniqueHashedEvidence(evidence);
      assert.equal(result, 0);

      await testData.setUpIsUniqueHashedEvidence(evidence, 0);
      result = await helper.getIsUniqueHashedEvidence(evidence);
      assert.equal(result, 1);
    });

  })

  describe("newTrade function", () => {

    it("newTrade", async function () {

      const testTradeData = testData.getTradeData(0);
      await expect(
        helper.connect(accounts[0]).newTrade(
          testTradeData.amount,
          testTradeData.to,
          testTradeData.fee,
          testTradeData.tokenTypeIndex,
          testTradeData.destCode,
          { value: testTradeData.amount }
        )
      )
      .to.changeEtherBalances(
        [helper.address, accounts[0]],
        [testTradeData.amount, -testTradeData.amount]
      )
      .to.emit(helper, "NewTrade")
      .withArgs(accounts[0].address, 0);

      const trade = await helper.getTrade(accounts[0].address, 0);
      tradeAssert(testTradeData, trade, false, testTradeData.destCode);
    });

    it("newTrade : ERC20", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.tokenTypeIndex = ERC20_TOKEN_INDEX;

      await parametersHelper.connect(accounts[0]).addTokenAddressHelper(
        [networkCode, defaultDestCode], [ERC20_TOKEN_INDEX, ERC20_TOKEN_INDEX], [testToken.address, testToken.address]
      );

      await parametersHelper.connect(accounts[0]).updateTradableAmountHelper(
        ERC20_TOKEN_INDEX, tradeMinimumAmount, tradeThreshold
      );

      await testToken.connect(accounts[0]).approve(helper.address, testTradeData.amount);

      await expect(
        helper.connect(accounts[0]).newTrade(
          testTradeData.amount,
          testTradeData.to,
          testTradeData.fee,
          testTradeData.tokenTypeIndex,
          testTradeData.destCode
        )
      )
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

    it("newTrade dest network id is unavailable", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.destCode = 1559;

      await testToken.connect(accounts[0]).approve(helper.address, String(testTradeData.amount));
      await expect(
        helper.connect(accounts[0]).newTrade(String(testTradeData.amount), testTradeData.to, testTradeData.fee, testTradeData.tokenTypeIndex, testTradeData.destCode)
      ).to.be.revertedWith("Unavailable dest code");

    });

    it("newTrade over tradeThreshold", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.amount = tradeThreshold + 1;

      await expect(
        helper.connect(accounts[0]).newTrade(String(testTradeData.amount), testTradeData.to, testTradeData.fee, testTradeData.tokenTypeIndex, testTradeData.destCode)
      ).to.be.revertedWith("Exceed exchangeable limit!");

    });

    it("newTrade below tradeThreshold", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.amount = tradeMinimumAmount - 1;

      await expect(
        helper.connect(accounts[0]).newTrade(String(testTradeData.amount), testTradeData.to, testTradeData.fee, testTradeData.tokenTypeIndex, testTradeData.destCode)
      ).to.be.revertedWith("Amount too low!");

    });

    it("newTrade invalid tokenTypeIndex", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.tokenTypeIndex = 100;

      await expect(
        helper.connect(accounts[0]).newTrade(testTradeData.amount, testTradeData.to, testTradeData.fee, testTradeData.tokenTypeIndex, testTradeData.destCode)
      ).to.be.revertedWith("Invalid token index");

    });

    it("newTrade should revert msg.value is insufficient", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      const insufficientAmount = testTradeData.amount - 1;

      await testToken.connect(accounts[0]).approve(helper.address, testTradeData.amount);
      await expect(
        helper.connect(accounts[0]).newTrade(
          testTradeData.amount, testTradeData.to, testTradeData.fee, testTradeData.tokenTypeIndex, testTradeData.destCode,
          { value: insufficientAmount }
        )
      ).to.be.revertedWith("Insufficient msg.value");

    });

    it("newTrade should revert ERC20 balance is insufficient", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.tokenTypeIndex = ERC20_TOKEN_INDEX;

      await parametersHelper.connect(accounts[0]).addTokenAddressHelper(
        [networkCode, defaultDestCode], [ERC20_TOKEN_INDEX, ERC20_TOKEN_INDEX], [testToken.address, testToken.address]
      );

      await parametersHelper.connect(accounts[0]).updateTradableAmountHelper(
        ERC20_TOKEN_INDEX, tradeMinimumAmount, tradeThreshold
      );

      await testToken.connect(accounts[0]).approve(helper.address, testTradeData.amount);

      await testToken.connect(accounts[0])
        .transfer(accounts[1].address, await testToken.balanceOf(accounts[0].address));

      await expect(
        helper.connect(accounts[0]).newTrade(
          testTradeData.amount,
          testTradeData.to,
          testTradeData.fee,
          testTradeData.tokenTypeIndex,
          testTradeData.destCode
        )
      ).to.be.revertedWith("TRANSFER_FROM_FAILED");
    });
  })

  describe("withdraw", () => {

    beforeEach(async () => {
      // set up bond
      const bond = String(tradeThreshold * 3);
      await bondManager.deposit(ETH_TOKEN_INDEX, bond, {value : bond});

      await parametersHelper.addTokenAddressHelper([networkCode], [ERC20_TOKEN_INDEX], [testToken.address]);
      await testToken.approve(bondManager.address, bond);
      await bondManager.deposit(ERC20_TOKEN_INDEX, bond);
    });

    it("withdraw", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
      await testData.setUpTrade(testTradeData, 0, true);

      const evidence = testData.getEvidenceData(2);
      const hashedEvidence = await helper.helperHashEvidence(evidence);
      const txhash = ethers.utils.keccak256(evidence.transaction);
      mockDisputeManager = await setUpMockDisputeManager(mockDisputeManager, [true, true, true, true, true, true, true]);

      await expect(() =>
        helper.connect(accounts[0]).helperWithdraw(testTradeData.user, testTradeData.index, txhash, hashedEvidence)
      ).to.changeEtherBalances(
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

    it("withdraw ERC20", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
      testTradeData.tokenTypeIndex = ERC20_TOKEN_INDEX;

      // set up ERC20
      await parametersHelper.connect(accounts[0]).addTokenAddressHelper(
        [networkCode, defaultDestCode], [ERC20_TOKEN_INDEX, ERC20_TOKEN_INDEX], [testToken.address, testToken.address]
      );
      await parametersHelper.connect(accounts[0]).updateTradableAmountHelper(
        ERC20_TOKEN_INDEX, tradeMinimumAmount, tradeThreshold
      );
      await testToken.connect(accounts[0]).approve(helper.address, testTradeData.amount);

      await testData.setUpTrade(testTradeData, 0, true);
      const evidence = testData.getEvidenceData(2);
      const txhash = ethers.utils.keccak256(evidence.transaction);
      const hashedEvidence = await helper.helperHashEvidence(evidence);

      await expect(() =>
        helper.connect(accounts[0]).helperWithdraw(testTradeData.user, testTradeData.index, txhash, hashedEvidence)
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

    it("withdraw insufficient bond amount", async function () {

      const testTradeData = testData.getTradeData(2);
      await testData.setUpTrade(testTradeData, 0, true);
      const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(0)));
      evidence.blockNumber = await ethers.provider.getBlockNumber();
      const txhash = ethers.utils.keccak256(evidence.transaction);
      const hashedEvidence = await helper.helperHashEvidence(evidence);

      // withdraw bond
      await bondManager.connect(accounts[0]).executeWithdrawBond(
        ETH_TOKEN_INDEX,
        await bondManager.getBond(ETH_TOKEN_INDEX)
      );
      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');
      await bondManager.finalizeWithdrawalBond(ETH_TOKEN_INDEX);

      await expect(
        helper.connect(accounts[0]).helperWithdraw(accounts[0].address, 0, txhash, hashedEvidence)
      ).to.be.revertedWith("Insufficient bond amount for trade");

    });

    it("withdraw invalid status", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
      testTradeData.status = "1";
      await testData.setUpTrade(testTradeData, 0, true);

      const evidences = testData.getEvidenceData(0);
      const txhash = ethers.utils.keccak256(evidences.transaction);
      const hashedEvidences = await helper.helperHashEvidence(evidences);

      await expect(
        helper.connect(accounts[0]).helperWithdraw(accounts[0].address, 0, txhash, hashedEvidences)
      ).to.be.revertedWith("Only for START trade");

    });

    it("withdraw after withdrawal period", async function () {
      const block = await ethers.provider.getBlock('latest');
      const withdrawalPeriod = await parametersHelper.withdrawalPeriod();
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
      testTradeData.status = "0";
      testTradeData.timestamp = block.timestamp - withdrawalPeriod;
      await testData.setUpTrade(testTradeData, 0, true);

      const evidences = testData.getEvidenceData(0);
      const txhash = ethers.utils.keccak256(evidences.transaction);
      const hashedEvidences = await helper.helperHashEvidence(evidences);

      await expect(
        helper.connect(accounts[0]).helperWithdraw(accounts[0].address, 0, txhash, hashedEvidences)
      ).to.be.revertedWith("Only for withdrawal period");

    });

    // it("withdraw invalid block number", async function () {

    //   const testTradeData = testData.getTradeData(2);
    //   await testData.setUpTrade(testTradeData, 0, true);
    //   const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(2)));

    //   // set block number to 256 blocks later
    //   const currentBlockNumber = await ethers.provider.getBlockNumber();
    //   evidence.blockNumber = currentBlockNumber;
    //   await mine(currentBlockNumber + 256);

    //   await expect(
    //     helper.connect(accounts[0]).helperWithdraw(accounts[0].address, 0, evidence)
    //   ).to.be.revertedWith("Cannot withdraw with evidence that have passed certain period");

    // });

    it("withdraw revert if called other than relayer", async function () {

      const testTradeData = testData.getTradeData(2);
      await testData.setUpTrade(testTradeData, 0, true);

      const evidence = testData.getEvidenceData(0);
      const txhash = ethers.utils.keccak256(evidence.transaction);
      const hashedEvidence = await helper.helperHashEvidence(evidence);
      await expect(
        helper.connect(accounts[3]).helperWithdraw(accounts[0].address, 0, txhash, hashedEvidence)
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
      const txhash = ethers.utils.keccak256(evidence.transaction);
      const hashedEvidence = await helper.helperHashEvidence(evidence);

      // first time withdraw
      await helper.connect(accounts[0]).helperWithdraw(testTradeData.user, testTradeData.index, txhash, hashedEvidence)

      // second time withdraw with same evidence with first time withdrawal
      testTradeData.index = 1;
      testTradeData.status = 0; // fix status because status will change after used as trade data.
      await testData.setUpTrade(testTradeData, 0, true);

      await expect(
        helper.connect(accounts[0]).helperWithdraw(testTradeData.user, testTradeData.index, txhash, hashedEvidence) //not unique evidence
      ).to.be.revertedWith("Not unique hashed evidence");

    });

    it("bulkWithdraw", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
      const testTradeData2 = JSON.parse(JSON.stringify(testData.getTradeData(9)));
      const block = await ethers.provider.getBlock('latest');
      const now = block.timestamp;
      testTradeData.timestamp = now;
      testTradeData2.timestamp = now;
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
      
      const txHashes = [
        ethers.utils.keccak256(evidences[0].transaction),
        ethers.utils.keccak256(evidences[1].transaction)
      ]
      const hashedEvidences = [
        await helper.helperHashEvidence(evidences[0]),
        await helper.helperHashEvidence(evidences[1])
      ]

      await helper.connect(accounts[0]).bulkWithdraw(userTrades , txHashes, hashedEvidences);
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

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
      const testTradeData2 = JSON.parse(JSON.stringify(testData.getTradeData(9)));
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

      const txHashes = [
        ethers.utils.keccak256(evidences[0].transaction),
        ethers.utils.keccak256(evidences[1].transaction)
      ]
      const hashedEvidences = [
        await helper.helperHashEvidence(evidences[0]),
        await helper.helperHashEvidence(evidences[1])
      ]

      await bondManager.connect(accounts[0]).executeWithdrawBond(
        ETH_TOKEN_INDEX,
        await bondManager.getBond(ETH_TOKEN_INDEX)
      );

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await bondManager.finalizeWithdrawalBond(ETH_TOKEN_INDEX);

      await expect(
        helper.connect(accounts[0]).bulkWithdraw(userTrades , txHashes, hashedEvidences)
      ).to.be.revertedWith("Insufficient bond amount for trade");

    });

    it("bulkWithdraw invalid status", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
      const testTradeData2 = JSON.parse(JSON.stringify(testData.getTradeData(9)));
      const block = await ethers.provider.getBlock('latest');
      const now = block.timestamp;
      testTradeData.timestamp = now;
      testTradeData2.timestamp = now;
      testTradeData2.status = 1;

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

      const txHashes = [
        ethers.utils.keccak256(evidences[0].transaction),
        ethers.utils.keccak256(evidences[1].transaction)
      ]
      const hashedEvidences = [
        await helper.helperHashEvidence(evidences[0]),
        await helper.helperHashEvidence(evidences[1])
      ]

      await expect(
        helper.connect(accounts[0]).bulkWithdraw(userTrades , txHashes, hashedEvidences)
      ).to.be.revertedWith("Only for START trade");

    });

    // it("buldWithdraw invalid block number", async function () {

    //   const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
    //   const testTradeData2 = JSON.parse(JSON.stringify(testData.getTradeData(9)));
    //   await testData.setUpTrade(testTradeData, 0, true);
    //   await testData.setUpTrade(testTradeData2, 0, true);

    //   const userTrades = [
    //     {userAddress: testTradeData.user, index: testTradeData.index},
    //     {userAddress: testTradeData2.user, index: testTradeData2.index}
    //   ]

    //   const evidences = [
    //     JSON.parse(JSON.stringify(testData.getEvidenceData(0))),
    //     JSON.parse(JSON.stringify(testData.getEvidenceData(1)))
    //   ]

    //   const currentBlockNumber = await ethers.provider.getBlockNumber();
    //   evidences[0].blockNumber = currentBlockNumber;
    //   evidences[1].blockNumber = currentBlockNumber;

    //   await mine(currentBlockNumber + 256);

    //   await expect(
    //     helper.connect(accounts[0]).bulkWithdraw(userTrades , evidences)
    //   ).to.be.revertedWith("Cannot withdraw with evidence that have passed certain period");

    // });

    it("bulkWithdraw not unique evidences", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(2)));
      const testTradeData2 = JSON.parse(JSON.stringify(testData.getTradeData(9)));
      const block = await ethers.provider.getBlock('latest');
      const now = block.timestamp;
      testTradeData.timestamp = now;
      testTradeData2.timestamp = now;
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

      evidences[0].blockNumber = await ethers.provider.getBlockNumber();;
      evidences[1].blockNumber = await ethers.provider.getBlockNumber();;

      const txHashes = [
        ethers.utils.keccak256(evidences[0].transaction),
        ethers.utils.keccak256(evidences[1].transaction)
      ]
      const hashedEvidences = [
        await helper.helperHashEvidence(evidences[0]),
        await helper.helperHashEvidence(evidences[1])
      ]

      await expect(
        helper.connect(accounts[0]).bulkWithdraw(userTrades , txHashes, hashedEvidences)
      ).to.be.revertedWith("Not unique hashed evidence");

    });

    it("bulkWithdraw fail if called by other than the relayer", async function () {

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

      const txHashes = [
        ethers.utils.keccak256(evidences[0].transaction),
        ethers.utils.keccak256(evidences[1].transaction)
      ]
      const hashedEvidences = [
        await helper.helperHashEvidence(evidences[0]),
        await helper.helperHashEvidence(evidences[1])
      ]

      await expect(
        helper.connect(accounts[1]).bulkWithdraw(userTrades , txHashes, hashedEvidences)
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
      await testData.setUpTrade(testTradeData, 0, true);

      await hre.ethers.provider.send("evm_increaseTime", [60 * 60 * 3]); // 3 hours
      await hre.ethers.provider.send("evm_mine");

      await expect(
        helper.connect(accounts[0]).cancelTrade(0)
      )
      .to.changeEtherBalance(accounts[0], testTradeData.amount)
      .to.emit(helper, "Cancel")
      .withArgs(accounts[0].address, 0, "");

      let trade = await helper.getTrade(accounts[0].address, 0);
      const expectedData = testTradeData
      expectedData.status = "99"
      tradeAssert(expectedData, trade, false);

    });

    it("cancelTrade : ERC20", async function () {
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);

      const testTradeData = JSON.parse(JSON.stringify(
        testData.getTradeData(0, block.timestamp)
      ));

      testTradeData.tokenTypeIndex = ERC20_TOKEN_INDEX;
      await parametersHelper.connect(accounts[0]).addTokenAddressHelper(
        [networkCode, defaultDestCode], [ERC20_TOKEN_INDEX, ERC20_TOKEN_INDEX], [testToken.address, testToken.address]
      );
      await parametersHelper.connect(accounts[0]).updateTradableAmountHelper(
        ERC20_TOKEN_INDEX, tradeMinimumAmount, tradeThreshold
      );
      await testToken.connect(accounts[0]).approve(helper.address, testTradeData.amount);

      await testData.setUpTrade(testTradeData, 0, true);

      await hre.ethers.provider.send("evm_increaseTime", [60 * 60 * 3]); // 3 hours
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

    it("cancelTrade : revert if status is other than start", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.status = "1";
      await testData.setUpTrade(testTradeData, 0, true);

      await expect(
        helper.connect(accounts[0]).cancelTrade(0)
      ).to.be.revertedWith("Only for START status");

    });

    it("cancelTrade : revert if called within a certain period", async function () {
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

      testTradeData.tokenTypeIndex = ERC20_TOKEN_INDEX;
      await parametersHelper.connect(accounts[0]).addTokenAddressHelper(
        [networkCode, defaultDestCode], [ERC20_TOKEN_INDEX, ERC20_TOKEN_INDEX], [testToken.address, testToken.address]
      );
      await parametersHelper.connect(accounts[0]).updateTradableAmountHelper(
        ERC20_TOKEN_INDEX, tradeMinimumAmount, tradeThreshold
      );
      await testToken.connect(accounts[0]).approve(helper.address, testTradeData.amount);

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

    it("cancelTradeByRelayer : Only relayer can call", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      await testData.setUpTrade(testTradeData, 0, true);

      await expect(
        helper.connect(accounts[1]).cancelTradeByRelayer(accounts[0].address, 0, "0x")
      ).to.be.revertedWith("Only for relayer");
    });

    it("cancelTradeByRelayer : revert if the reason is more than 100 characters", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      await testData.setUpTrade(testTradeData, 0, true);

      await expect(
        helper.connect(accounts[0]).cancelTradeByRelayer(accounts[0].address, 0, "a".repeat(101))
      ).to.be.revertedWith("Too long reason");
    });

    it("cancelTradeByRelayer : revert if status is other than start", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.status = "1";
      await testData.setUpTrade(testTradeData, 0, true);

      await expect(
        helper.connect(accounts[0]).cancelTradeByRelayer(accounts[0].address, 0, "0x")
      ).to.be.revertedWith("Only for START status");

    });
  })

  describe("getTrade", () => {

    it("getTrade No Trade Error", async function () {
      await expect(
        helper.getTrade(accounts[0].address, 0)
      ).to.be.revertedWith("No Trade Exists");
    });

    it("getTrades", async function () {

      const testTradeData = testData.getTradeData(0);
      const testTradeData2 = testData.getTradeData(1);
      await testData.setUpTrade(testTradeData, 0);
      await testData.setUpTrade(testTradeData2, 0);
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index},
        {userAddress: testTradeData2.user, index: testTradeData2.index}
      ]

      const trades = await helper.getTrades(userTrades);
      tradeAssert(testTradeData, trades[0], false);
      tradeAssert(testTradeData2, trades[1], false);
    });

    it("getTradeLength", async function () {
      const testTradeData = testData.getTradeData(0);
      const testTradeData2 = testData.getTradeData(1);
      const testTradeData3 = testData.getTradeData(11);
      await testData.setUpTrade(testTradeData, 0);
      await testData.setUpTrade(testTradeData2, 0);
      await testData.setUpTrade(testTradeData3, 0);

      const length = await helper.connect(accounts[0]).getTradeLength(
        accounts[0].address,
      );
      assert.equal(length, 3)
    });

    it("getTradeList : latest trade", async function () {
      const testTradeData = testData.getTradeData(0);
      const testTradeData2 = testData.getTradeData(1);
      const testTradeData3 = testData.getTradeData(11);
      await testData.setUpTrade(testTradeData, 0);
      await testData.setUpTrade(testTradeData2, 0);
      await testData.setUpTrade(testTradeData3, 0);

      const trades = await helper.connect(accounts[0]).getTradeList(
        accounts[0].address,
        0,
        0
      );

      assert.equal(trades.length, 3)
      tradeAssert(testTradeData, trades[0], false);
      tradeAssert(testTradeData2, trades[1], false);
    });

    it("getTradeList : specific trades", async function () {
      const testTradeData = testData.getTradeData(0);
      const testTradeData2 = testData.getTradeData(1);
      const testTradeData3 = testData.getTradeData(11);
      await testData.setUpTrade(testTradeData, 0);
      await testData.setUpTrade(testTradeData2, 0);
      await testData.setUpTrade(testTradeData3, 0);

      const trades = await helper.connect(accounts[0]).getTradeList(
        accounts[0].address,
        1,
        2
      );
      assert.equal(trades.length, 2)
      tradeAssert(testTradeData2, trades[0], false);
      tradeAssert(testTradeData3, trades[1], false);
    });

    it("getUserTradeListLength", async function () {

      const testTradeData = testData.getTradeData(0);
      const testTradeData2 = testData.getTradeData(1);
      await testData.setUpTrade(testTradeData, 0);
      await testData.setUpTrade(testTradeData2, 0);


      const userTradeList = await helper.getUserTradeListLength();
      assert.equal(userTradeList, 2);
    });

    it("getUserTradeListByIndex", async function () {

      const testTradeData = testData.getTradeData(0);
      const testTradeData2 = testData.getTradeData(10);
      const testTradeData3 = testData.getTradeData(11);
      const testTradeData4 = testData.getTradeData(12);
      await testData.setUpTrade(testTradeData, 0, true);
      await testData.setUpTrade(testTradeData2, 0, true);
      await testData.setUpTrade(testTradeData3, 0, true);
      await testData.setUpTrade(testTradeData4, 0, true);

      const startIndex = 0;
      const endIndex = await helper.getUserTradeListLength() - 1;

      let userTradeList = await helper.getUserTradeListByIndex(startIndex, endIndex);

      assert.equal(userTradeList.length, 4)
      assert.equal(userTradeList[0].index, 0)
      assert.equal(userTradeList[1].index, 1)
      assert.equal(userTradeList[2].index, 2)
      assert.equal(userTradeList[3].index, 3)
    });

    it("getUserTradeListByIndex out of bounds", async function () {

      const testTradeData = testData.getTradeData(0);
      await testData.setUpTrade(testTradeData, 0, true);
      const index = 2;
      await expect(
        helper.getUserTradeListByIndex(0, 2),
      ).to.be.revertedWith("End Index Out of Bounds");
    });

    it("getUserTradeListByIndex invalid range", async function () {

      const testTradeData = testData.getTradeData(0);
      const testTradeData2 = testData.getTradeData(1);
      await testData.setUpTrade(testTradeData, 0, true);
      const index = 1;
      await expect(
        helper.getUserTradeListByIndex(1, 0),
      ).to.be.revertedWith("Invalid Range");
    });

  })

  describe("dispute", () => {

    it("dispute, in proper status", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(13)));
      const block = await ethers.provider.getBlock('latest');
      testTradeData.timestamp = block.timestamp;
      await testData.setUpTrade(testTradeData, DISPUTER_INDEX, false, testTradeData.destCode);
      await testData.setUpDisputeDepositThresholdAmount(ETH_TOKEN_INDEX, DISPUTE_DEPOSIT_AMOUNT, RELAYER_INDEX);

      const depositEthAmount = "5000000000000000";
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];

      await expect(
        helper.connect(accounts[DISPUTER_INDEX]).dispute(
          ETH_TOKEN_INDEX,
          depositEthAmount,
          userTrades[0].userAddress,
          userTrades[0].index,
          { value: depositEthAmount }
        )
      ).to.changeEtherBalances(
        [helper.address, accounts[DISPUTER_INDEX]],
        [depositEthAmount, -depositEthAmount]
      )
      .to.emit(helper, "Dispute");
      const dispute = await helper.connect(accounts[DISPUTER_INDEX]).disputes(userTrades[0].userAddress, userTrades[0].index);
      assert.equal(dispute.disputer, accounts[DISPUTER_INDEX].address);
      assert.equal(dispute.tokenTypeIndex, ETH_TOKEN_INDEX);
      assert.equal(dispute.deposit, depositEthAmount);
      const trade = await helper.getTrade(userTrades[0].userAddress, userTrades[0].index);
      const expectedData = testTradeData
      expectedData.status = STATUS_DISPUTE
      tradeAssert(expectedData, trade, false);
    });

    it("dispute, should be reverted with wrong status", async function () {
      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      const userTrades = [
        {userAddress: testTradeData.user, index: testTradeData.index}
      ];
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDisputeDepositThresholdAmount(ETH_TOKEN_INDEX, DISPUTE_DEPOSIT_AMOUNT, RELAYER_INDEX);

      const depositEthAmount = "5000000000000000";

      await expect(
        helper.connect(accounts[DISPUTER_INDEX]).dispute(
          ETH_TOKEN_INDEX,
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
      await testData.setUpDisputeDepositThresholdAmount(ETH_TOKEN_INDEX, DISPUTE_DEPOSIT_AMOUNT, RELAYER_INDEX);

      const depositEthAmount = "5000000000000000";

      await expect(
        helper.connect(accounts[2]).dispute(
          ETH_TOKEN_INDEX,
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
      await testData.setUpDisputeDepositThresholdAmount(ETH_TOKEN_INDEX, DISPUTE_DEPOSIT_AMOUNT, RELAYER_INDEX);

      const depositEthAmount = "5000000000000000";

      await expect(
        helper.connect(accounts[DISPUTER_INDEX]).dispute(
          ETH_TOKEN_INDEX,
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
      await testData.setUpDisputeDepositThresholdAmount(ETH_TOKEN_INDEX, DISPUTE_DEPOSIT_AMOUNT, RELAYER_INDEX);

      const depositEthAmount = "499999999999999";

      await expect(
        helper.connect(accounts[DISPUTER_INDEX]).dispute(
          ETH_TOKEN_INDEX,
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
      await testData.setUpDisputeDepositThresholdAmount(ETH_TOKEN_INDEX, DISPUTE_DEPOSIT_AMOUNT, RELAYER_INDEX);

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
        tokenTypeIndex: ETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp
      };
      const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(3)));
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await testData.setUpHashedEvidence(testTradeData.user, testTradeData.index, evidence, RELAYER_INDEX);
      await helper.connect(accounts[DISPUTER_INDEX]).setUpDeposit(
        ETH_TOKEN_INDEX,
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
      ).to.changeEtherBalances(
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
        tokenTypeIndex: ETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp
      };
      const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(3)));
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await testData.setUpHashedEvidence(testTradeData.user, testTradeData.index, evidence, RELAYER_INDEX);
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
        tokenTypeIndex: ETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp
      };
      const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(3)));
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await testData.setUpHashedEvidence(testTradeData.user, testTradeData.index, evidence, RELAYER_INDEX);
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
        tokenTypeIndex: ETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp
      };
      const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(3)));
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await testData.setUpHashedEvidence(testTradeData.user, testTradeData.index, evidence, RELAYER_INDEX);
      await helper.connect(accounts[DISPUTER_INDEX]).setUpDeposit(
        ETH_TOKEN_INDEX,
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
        tokenTypeIndex: ETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp
      };
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await helper.connect(accounts[DISPUTER_INDEX]).setUpDeposit(
        ETH_TOKEN_INDEX,
        DISPUTE_DEPOSIT_AMOUNT,
        { value: DISPUTE_DEPOSIT_AMOUNT }
      );
      await bondManager.deposit(ETH_TOKEN_INDEX, bond, {value : bond});

      const expectedReceiveAmount = Math.round(testTradeData.amount * tradableBondRatio / 100) / 2;
      const expectedRemainder = bond  - expectedReceiveAmount * 2;
      await expect(
        helper.connect(accounts[DISPUTER_INDEX]).slash(
          userTrades[0].userAddress,
          userTrades[0].index
        )
      ).to.changeEtherBalances(
        [helper.address, accounts[DISPUTER_INDEX]],
        [-DISPUTE_DEPOSIT_AMOUNT, DISPUTE_DEPOSIT_AMOUNT + expectedReceiveAmount]
      )
      .to.emit(helper, "Slash")
      .withArgs(userTrades[0].userAddress, userTrades[0].index, accounts[RELAYER_INDEX].address);
      const expectedData = testTradeData;
      expectedData.status = STATUS_SLASH_COMPLETED;
      const trade = await helper.getTrade(userTrades[0].userAddress, userTrades[0].index);
      tradeAssert(expectedData, trade, false);
      const relayerBalance = await bondManager.getBond(ETH_TOKEN_INDEX);
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
        tokenTypeIndex: ETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp - DEFENCE_PERIOD
      };
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await helper.connect(accounts[DISPUTER_INDEX]).setUpDeposit(
        ETH_TOKEN_INDEX,
        DISPUTE_DEPOSIT_AMOUNT,
        { value: DISPUTE_DEPOSIT_AMOUNT }
      );
      await bondManager.deposit(ETH_TOKEN_INDEX, bond, {value : bond});

      const expectedReceiveAmount = Math.round(testTradeData.amount * tradableBondRatio / 100) / 2;
      const expectedRemainder = bond  - expectedReceiveAmount * 2;
      await expect(
        helper.connect(accounts[DISPUTER_INDEX]).slash(
          userTrades[0].userAddress,
          userTrades[0].index
        )
      ).to.changeEtherBalances(
        [helper.address, accounts[DISPUTER_INDEX]],
        [-DISPUTE_DEPOSIT_AMOUNT, DISPUTE_DEPOSIT_AMOUNT + expectedReceiveAmount]
      )
      .to.emit(helper, "Slash")
      .withArgs(userTrades[0].userAddress, userTrades[0].index, accounts[RELAYER_INDEX].address);
      const expectedData = testTradeData;
      expectedData.status = STATUS_SLASH_COMPLETED;
      const trade = await helper.connect(accounts[DISPUTER_INDEX]).getTrade(userTrades[0].userAddress, userTrades[0].index);
      tradeAssert(expectedData, trade, false);
      const relayerBalance = await bondManager.getBond(ETH_TOKEN_INDEX);
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
        tokenTypeIndex: ETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp
      };
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await helper.connect(accounts[DISPUTER_INDEX]).setUpDeposit(
        ETH_TOKEN_INDEX,
        DISPUTE_DEPOSIT_AMOUNT,
        { value: DISPUTE_DEPOSIT_AMOUNT }
      );
      await bondManager.deposit(ETH_TOKEN_INDEX, bond, {value : bond});
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
        tokenTypeIndex: ETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp
      };
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await helper.connect(accounts[DISPUTER_INDEX]).setUpDeposit(
        ETH_TOKEN_INDEX,
        DISPUTE_DEPOSIT_AMOUNT,
        { value: DISPUTE_DEPOSIT_AMOUNT }
      );
      await bondManager.deposit(ETH_TOKEN_INDEX, bond, {value : bond});
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
        tokenTypeIndex: ETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: block.timestamp
      };
      await testData.setUpTrade(testTradeData, USER_INDEX, false);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await helper.connect(accounts[DISPUTER_INDEX]).setUpDeposit(
        ETH_TOKEN_INDEX,
        DISPUTE_DEPOSIT_AMOUNT,
        { value: DISPUTE_DEPOSIT_AMOUNT }
      );
      await bondManager.deposit(ETH_TOKEN_INDEX, bond, {value : bond});
      await expect(
        helper.connect(accounts[DISPUTER_INDEX]).slash(
          userTrades[0].userAddress,
          userTrades[0].index
        )
      ).to.be.revertedWith(
        "Not yet slashed"
      );
    });
  });

  describe("bond", () => {

    it("getRequiredBondAmount", async function () {
      const tradeAmount = 100000010000000;
      const requiredBondAmount = await parametersHelper.connect(accounts[0]).getRequiredBondAmount(tradeAmount);
      assert.equal(requiredBondAmount, Math.round(100000010000000 * tradableBondRatio / 100));
    });

  })

  describe("contract related function", () => {

    it("getTokenAddress", async function () {
      const l2Address =  await parametersHelper.tokenAddress(networkCode, 0);
      assert.equal(l2Address, "0x0000000000000000000000000000000000000000")
    });

    it("toggleContractActive", async function () {
      let isActive = await helper.connect(accounts[0]).getContractStatus();
      assert.equal(isActive, true)
      await helper.connect(accounts[0]).toggleContractActive();
      isActive = await helper.connect(accounts[0]).getContractStatus();
      assert.equal(isActive, false)
    });

    it("toggleContractActive should fail when called other than owner", async function () {
      await expect(
        helper.connect(accounts[1]).toggleContractActive()
      ).to.be.revertedWith("UNAUTHORIZED");
    });

    it("getTradeThreshold", async function () {
      const contractTradeThreshold = await parametersHelper.connect(accounts[0]).tradeThreshold(0);
      assert.equal(contractTradeThreshold, tradeThreshold)
    });

    it("getTradeMinimumAmount", async function () {
      const contractTradeMinimumAmount = await parametersHelper.tradeMinimumAmount(0);
      assert.equal(contractTradeMinimumAmount, tradeMinimumAmount)
    });
  })

  describe("update function", () => {
    it("get availableNetwork", async function() {
      assert.equal(await parametersHelper.availableNetwork(networkCode), 1);
      assert.equal(await parametersHelper.availableNetwork(defaultDestCode), 1);
    });

    it("get slashableNetwork", async function() {
      assert.equal(await parametersHelper.availableNetwork(networkCode), 1);
      assert.equal(await parametersHelper.slashableNetwork(defaultDestCode), 1);
    });

    it("executeNetworkSettingUpdate", async function() {

      const operations = [0, 0, 1, 1];
      const networkCodes = [1003, 1004, 1003, 1004];
      const nativeIsNotETH = [false, false, true, false];

      await expect(
        parametersHelper.connect(accounts[0]).executeNetworkSettingUpdate(
          operations,
          networkCodes,
          nativeIsNotETH
        )
      )
      .to.emit(parametersHelper, "NetworkSettingUpdate")
      .withArgs(false, operations, networkCodes, nativeIsNotETH);

      const networkSettingUpdate = await parametersHelper.connect(accounts[0]).getNetworkSettingUpdate();
      // assert.equal(networkSettingUpdate.operations, operations);
      assert.equal(networkSettingUpdate.networkCodes[0], networkCodes[0]);
      assert.equal(networkSettingUpdate.networkCodes[1], networkCodes[1]);
      assert.equal(networkSettingUpdate.networkCodes[2], networkCodes[2]);
      assert.equal(networkSettingUpdate.networkCodes[3], networkCodes[3]);
      assert.equal(networkSettingUpdate.nativeIsNotETH[0], nativeIsNotETH[0]);
      assert.equal(networkSettingUpdate.nativeIsNotETH[1], nativeIsNotETH[1]);
      assert.equal(networkSettingUpdate.nativeIsNotETH[2], nativeIsNotETH[2]);
      assert.equal(networkSettingUpdate.nativeIsNotETH[3], nativeIsNotETH[3]);
    });

    it("executeNetworkSettingUpdate should be revert if invalid length array", async function() {

      let operations = [0, 0];
      let networkCodes = [1003, 1004, 1003];
      let nativeIsNotETH = [1, 1, 1, 1, 0];

      await expect(
        parametersHelper.connect(accounts[0]).executeNetworkSettingUpdate(
          operations,
          networkCodes,
          nativeIsNotETH
        )
      ).to.be.revertedWith("Invalid length of array");

      // operations = [0, 0];
      // networkCodes = [];
      // enableStatuses = [1, 1];

      // await expect(
      //   helper.connect(accounts[0]).executeNetworkSettingUpdate(
      //     operations,
      //     networkCodes,
      //     enableStatuses
      //   )
      // ).to.be.revertedWith("reverted with panic code 0x32 (Array accessed at an out-of-bounds or negative index)");
    });

    it("finalizeNetworkSettingUpdate", async function() {

      // add available network 1003, 1004 and make 1004 NativeIsNotETH
      // add slashable network 1003
      const operations = [0, 0, 2];
      const networkCodes = [1003, 1004, 1003];
      const nativeIsNotETH = [false, true, false];

      await parametersHelper.connect(accounts[0]).executeNetworkSettingUpdate(
        operations,
        networkCodes,
        nativeIsNotETH
      );

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await expect(
        parametersHelper.finalizeNetworkSettingUpdate()
      )
      .to.emit(parametersHelper, "NetworkSettingUpdate")
      .withArgs(true, operations, networkCodes, nativeIsNotETH);

      // check available network setting
      assert.equal(await parametersHelper.availableNetwork(networkCodes[0]), true);
      assert.equal(await parametersHelper.availableNetwork(networkCodes[1]), true);

      // check nativeIsNotETH setting
      assert.equal(await parametersHelper.nativeIsNotETH(networkCodes[0]), nativeIsNotETH[0]);
      assert.equal(await parametersHelper.nativeIsNotETH(networkCodes[1]), nativeIsNotETH[1]);

      // check slashable network setting
      assert.equal(await parametersHelper.slashableNetwork(networkCodes[2]), true);
    });

    it("finalizeNetworkSettingUpdate toggle available network", async function() {

      // add available network
      const operations = [0, 0, 0];
      const networkCodes = [1003, 1004, 1005];
      const nativeIsNotETH = [false, false, false];

      await parametersHelper.connect(accounts[0]).executeNetworkSettingUpdate(
        operations,
        networkCodes,
        nativeIsNotETH
      );
      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');
      await parametersHelper.finalizeNetworkSettingUpdate();
      assert.equal(
        await parametersHelper.availableNetwork(networkCodes[0]), 1,
        "available network[0] should be 1"
      );
      assert.equal(
        await parametersHelper.availableNetwork(networkCodes[1]), 1,
        "available network[1] should be 1"
      );

      // toggle available network
      const toggleOperations = [1, 1];
      const toggleNetworkCodes = [1003, 1004];
      const toggleNativeIsNotETH = [0, 0];

      await parametersHelper.connect(accounts[0]).executeNetworkSettingUpdate(
        toggleOperations,
        toggleNetworkCodes,
        toggleNativeIsNotETH
      );
      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');
      await parametersHelper.finalizeNetworkSettingUpdate();

      assert.equal(
        await parametersHelper.availableNetwork(toggleNetworkCodes[0]), 2,
        "toggle available network[0] should be 2"
      );
      assert.equal(
        await parametersHelper.availableNetwork(toggleNetworkCodes[1]), 2,
        "toggle available network[1] should be 2"
      );

      // toggle available network again
      await parametersHelper.connect(accounts[0]).executeNetworkSettingUpdate(
        toggleOperations,
        toggleNetworkCodes,
        toggleNativeIsNotETH
      );
      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');
      await parametersHelper.finalizeNetworkSettingUpdate();

      assert.equal(
        await parametersHelper.availableNetwork(toggleNetworkCodes[0]), 1,
        "toggle available network[0] should be 1"
      );
      assert.equal(await parametersHelper.availableNetwork(
        toggleNetworkCodes[1]), 1,
        "toggle available network[1] should be 1"
      );
    });

    it("finalizeNetworkSettingUpdate should revert if called within update period", async function() {

      const operations = [0, 0, 1, 1];
      const networkCodes = [1003, 1004, 1003, 1004];
      const enableStatuses = [1, 1, 1, 1];

      await parametersHelper.connect(accounts[0]).executeNetworkSettingUpdate(
        operations,
        networkCodes,
        enableStatuses
      );

      await ethers.provider.send('evm_increaseTime', [60 * 60]);
      await ethers.provider.send('evm_mine');

      await expect(
        parametersHelper.connect(accounts[0]).finalizeNetworkSettingUpdate()
      ).to.be.revertedWith("Ongoing update period");
    });

    it("finalizeNetworkSettingUpdate cannot operate for already added available network", async function() {

      const operations = [0, 0];
      const networkCodes = [1003, 1004];
      const enableStatuses = [0, 0];

      await parametersHelper.connect(accounts[0]).executeNetworkSettingUpdate(
        operations,
        networkCodes,
        enableStatuses
      );
      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');
      await parametersHelper.finalizeNetworkSettingUpdate();

      await parametersHelper.connect(accounts[0]).executeNetworkSettingUpdate(
        operations,
        networkCodes,
        enableStatuses
      );
      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await expect(
        parametersHelper.finalizeNetworkSettingUpdate()
      ).to.be.revertedWith("Network is already available");
    });

    it("finalizeNetworkSettingUpdate just skip toggle operation for non available network", async function() {

      const operations = [1, 1];
      const networkCodes = [1003, 1004];
      const enableStatuses = [0, 0];

      await parametersHelper.connect(accounts[0]).executeNetworkSettingUpdate(
        operations,
        networkCodes,
        enableStatuses
      );

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await parametersHelper.finalizeNetworkSettingUpdate();

      // check available network setting
      assert.equal(await parametersHelper.availableNetwork(networkCodes[0]), false);
      assert.equal(await parametersHelper.availableNetwork(networkCodes[1]), false);

    });

    it("finalizeNetworkSettingUpdate should revert if called within update period", async function() {

      const operations = [0, 0, 1, 1];
      const networkCodes = [1003, 1004, 1003, 1004];
      const enableStatuses = [1, 1, 1, 1];

      await parametersHelper.connect(accounts[0]).executeNetworkSettingUpdate(
        operations,
        networkCodes,
        enableStatuses
      );

      await ethers.provider.send('evm_increaseTime', [60 * 60]);
      await ethers.provider.send('evm_mine');

      await expect(
        parametersHelper.connect(accounts[0]).finalizeNetworkSettingUpdate()
      ).to.be.revertedWith("Ongoing update period");
    });

    it("executeTokenAddressUpdate", async function() {
      const networkCodesArg = [1001, 1001, 1001];
      const tokenTypeIndexesArg = [0, 1, 2];
      const tokenAddressArg  = [accounts[1].address, accounts[2].address, accounts[3].address];

      await expect(
        parametersHelper.connect(accounts[0]).executeTokenAddressUpdate(
          networkCodesArg,
          tokenTypeIndexesArg,
          tokenAddressArg
        )
      )
      .to.emit(parametersHelper, "TokenAddressUpdate")
      .withArgs(false, networkCodesArg, tokenTypeIndexesArg, tokenAddressArg);

      const result = await parametersHelper.getTokenAddressUpdate();
      assert.equal(result.networkCodes[0], networkCodesArg[0]);
      assert.equal(result.networkCodes[1], networkCodesArg[1]);
      assert.equal(result.networkCodes[2], networkCodesArg[2]);
      assert.equal(result.tokenTypeIndices[0], tokenTypeIndexesArg[0]);
      assert.equal(result.tokenTypeIndices[1], tokenTypeIndexesArg[1]);
      assert.equal(result.tokenTypeIndices[2], tokenTypeIndexesArg[2]);
      assert.equal(result.tokenAddresses[0], tokenAddressArg[0]);
      assert.equal(result.tokenAddresses[1], tokenAddressArg[1]);
      assert.equal(result.tokenAddresses[2], tokenAddressArg[2]);
    });

    it("executeTokenAddressUpdate should revert if invalid length array", async function() {

      let networkCodes = [1003, 1004, 1003];
      let tokenTypeIndexes = [0, 1, 2];
      let tokenAddress  = [accounts[1].address, accounts[2].address, accounts[3].address, accounts[4].address];

      await expect(
        parametersHelper.connect(accounts[0]).executeTokenAddressUpdate(
          networkCodes,
          tokenTypeIndexes,
          tokenAddress
        )
      ).to.be.revertedWith("Invalid length of array");

      networkCodes = [1003, 1004, 1003];
      tokenTypeIndexes = [0, 1, 2];
      tokenAddress  = [accounts[1].address, accounts[2].address];

      await expect(
        parametersHelper.connect(accounts[0]).executeTokenAddressUpdate(
          networkCodes,
          tokenTypeIndexes,
          tokenAddress
        )
      ).to.be.revertedWith("Invalid length of array");
    });

    it("finalizeTokenAddressUpdate", async function() {
      const networkCodes = [1003, 1004, 1003];
      const tokenTypeIndexes = [0, 1, 2];
      const tokenAddress  = [accounts[1].address, accounts[2].address, accounts[3].address];

      await parametersHelper.connect(accounts[0]).executeTokenAddressUpdate(
        networkCodes,
        tokenTypeIndexes,
        tokenAddress
      );

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await expect(
        parametersHelper.finalizeTokenAddressUpdate()
      )
      .to.emit(parametersHelper, "TokenAddressUpdate")
      .withArgs(true, networkCodes, tokenTypeIndexes, tokenAddress);


      assert.equal(await parametersHelper.tokenAddress(networkCodes[0], tokenTypeIndexes[0]), tokenAddress[0], "1");
      assert.equal(await parametersHelper.tokenAddress(networkCodes[1], tokenTypeIndexes[1]), tokenAddress[1], "2");
      assert.equal(await parametersHelper.tokenAddress(networkCodes[2], tokenTypeIndexes[2]), tokenAddress[2], "3");
    });

    it("finalizeTokenAddressUpdate should revert if called within update period", async function() {
      const networkCodes = [1003, 1004, 1003];
      const tokenTypeIndexes = [0, 1, 2];
      const tokenAddress  = [accounts[1].address, accounts[2].address, accounts[3].address];

      await parametersHelper.connect(accounts[0]).executeTokenAddressUpdate(
        networkCodes,
        tokenTypeIndexes,
        tokenAddress
      );

      await ethers.provider.send('evm_increaseTime', [60 * 60]);
      await ethers.provider.send('evm_mine');

      await expect(
        parametersHelper.connect(accounts[0]).finalizeTokenAddressUpdate()
      ).to.be.revertedWith("Ongoing update period");
    });

    it("finalizeTokenAddressUpdate should revert if address already exists", async function() {
      const networkCodes = [1003, 1004, 1003];
      const tokenTypeIndexes = [0, 1, 2];
      const tokenAddress  = [accounts[1].address, accounts[2].address, accounts[3].address];

      await parametersHelper.connect(accounts[0]).executeTokenAddressUpdate(
        networkCodes,
        tokenTypeIndexes,
        tokenAddress
      );
      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');
      await parametersHelper.finalizeTokenAddressUpdate();

      await parametersHelper.connect(accounts[0]).executeTokenAddressUpdate(
        networkCodes,
        tokenTypeIndexes,
        tokenAddress
      );
      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');
      await expect(
        parametersHelper.connect(accounts[0]).finalizeTokenAddressUpdate()
      ).to.be.revertedWith("Token address already exists");
    });

    it("executeFeeListUpdate", async function () {
      const newFeeList = await testData.getRelayerFeeData(1);
      const block = await ethers.provider.getBlock('latest');
      const blockTimestamp = block.timestamp;

      const tx = await parametersHelper.connect(accounts[0]).executeFeeListUpdate(ETH_TOKEN_INDEX, newFeeList);
      const receipt = await tx.wait();

      assert.equal(receipt.events[0].event, "FeeListUpdate");

      const isFinalized = receipt.events[0].args.isFinalized;
      assert.equal(isFinalized, false);

      const feeListEvent = receipt.events[0].args[2];
      assert.equal(feeListEvent.high, newFeeList.high);
      assert.equal(feeListEvent.medium, newFeeList.medium);
      assert.equal(feeListEvent.low, newFeeList.low);
      assert.equal(feeListEvent.gasPriceThresholdHigh, newFeeList.gasPriceThresholdHigh);
      assert.equal(feeListEvent.gasPriceThresholdLow, newFeeList.gasPriceThresholdLow);

      const { executeAfter, newFeeList: updateFeeList } = await parametersHelper.feeListUpdate();

      assert.equal(updateFeeList.high, newFeeList.high);
      assert.equal(updateFeeList.medium, newFeeList.medium);
      assert.equal(updateFeeList.low, newFeeList.low);
      assert.equal(updateFeeList.gasPriceThresholdHigh, newFeeList.gasPriceThresholdHigh);
      assert.equal(updateFeeList.gasPriceThresholdLow, newFeeList.gasPriceThresholdLow);
      assert.equal(executeAfter, blockTimestamp + updatePeriod + 1);
    })

    it("executeFeeListUpdate should revert when called other than relayer", async function () {
      await expect(
        parametersHelper.connect(accounts[1]).executeFeeListUpdate(ETH_TOKEN_INDEX, feeList)
      ).to.be.revertedWith("Only for relayer");
    });

    it("finalizeFeeListUpdate", async function() {
      const newFeeList = await testData.getRelayerFeeData(1);
      await parametersHelper.connect(accounts[0]).executeFeeListUpdate(ETH_TOKEN_INDEX, newFeeList);

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      const tx = await parametersHelper.finalizeFeeListUpdate();
      const receipt = await tx.wait();

      assert.equal(receipt.events[0].event, "FeeListUpdate");

      const isFinalized = receipt.events[0].args.isFinalized;
      assert.equal(isFinalized, true);

      const feeListEvent = receipt.events[0].args[2];
      assert.equal(feeListEvent.high, newFeeList.high);
      assert.equal(feeListEvent.medium, newFeeList.medium);
      assert.equal(feeListEvent.low, newFeeList.low);
      assert.equal(feeListEvent.gasPriceThresholdHigh, newFeeList.gasPriceThresholdHigh);
      assert.equal(feeListEvent.gasPriceThresholdLow, newFeeList.gasPriceThresholdLow);

      const feeList = await parametersHelper.feeList(ETH_TOKEN_INDEX);

      assert.equal(feeList.high, newFeeList.high);
      assert.equal(feeList.medium, newFeeList.medium);
      assert.equal(feeList.low, newFeeList.low);
      assert.equal(feeList.gasPriceThresholdHigh, newFeeList.gasPriceThresholdHigh);
      assert.equal(feeList.gasPriceThresholdLow, newFeeList.gasPriceThresholdLow);

    });

    it("finalizeFeeListUpdate should revert if called within update period", async function () {
      const newFeeList = await testData.getRelayerFeeData(1);
      await parametersHelper.connect(accounts[0]).executeFeeListUpdate(ETH_TOKEN_INDEX, newFeeList);

      await ethers.provider.send('evm_increaseTime', [60 * 60 * 2]);
      await ethers.provider.send('evm_mine');

      await expect(
        parametersHelper.connect(accounts[0]).finalizeFeeListUpdate()
      ).to.be.revertedWith("Ongoing update period");
    });

    it("getTradeThreshold", async function () {
      const contractTradeThreshold = await parametersHelper.connect(accounts[0]).tradeThreshold(ETH_TOKEN_INDEX);
      assert.equal(contractTradeThreshold, tradeThreshold)
    });

    it("getTradeMinimumAmount", async function () {
      const contractTradeMinimumAmount = await parametersHelper.connect(accounts[0]).tradeMinimumAmount(ETH_TOKEN_INDEX);
      assert.equal(contractTradeMinimumAmount, tradeMinimumAmount)
    });

    it("getWithdrawalBlockPeriod", async function () {
      const contractWithdrawalBlockPeriod = await parametersHelper.connect(accounts[0]).withdrawalBlockPeriod();
      assert.equal(contractWithdrawalBlockPeriod, 150);
    });

    it("executeTradeParamUpdate : tradeThreshold", async function() {
      const operation = 0;
      const newValue = 100000;

      await expect(
        parametersHelper.connect(accounts[0]).executeTradeParamUpdate(
          operation,
          ETH_TOKEN_INDEX,
          newValue
        )
      )
      .to.emit(parametersHelper, "TradeParamUpdate")
      .withArgs(false, operation, ETH_TOKEN_INDEX, newValue);

      const tradeParamUpdate = await parametersHelper.connect(accounts[0]).tradeParamUpdate();

      assert.equal(tradeParamUpdate.operation, operation);
      assert.equal(tradeParamUpdate.tokenTypeIndex, ETH_TOKEN_INDEX);
      assert.equal(tradeParamUpdate.newValue, newValue);
    });

    it("executeTradeParamUpdate : tradeMinimumAmount", async function() {
      const operation = 1;
      const newValue = 100000;

      await expect(
        parametersHelper.connect(accounts[0]).executeTradeParamUpdate(
          operation,
          ETH_TOKEN_INDEX,
          newValue
        )
      )
      .to.emit(parametersHelper, "TradeParamUpdate")
      .withArgs(false, operation, ETH_TOKEN_INDEX, newValue);

      const tradeParamUpdate = await parametersHelper.connect(accounts[0]).tradeParamUpdate();

      assert.equal(tradeParamUpdate.operation, operation);
      assert.equal(tradeParamUpdate.tokenTypeIndex, ETH_TOKEN_INDEX);
      assert.equal(tradeParamUpdate.newValue, newValue);
    });

    it("executeTradeParamUpdate : withdrawalBlockPeriod", async function() {
      const operation = 2;
      const newValue = 100000;

      await expect(
        parametersHelper.connect(accounts[0]).executeTradeParamUpdate(
          operation,
          ETH_TOKEN_INDEX,
          newValue
        )
      )
      .to.emit(parametersHelper, "TradeParamUpdate")
      .withArgs(false, operation, ETH_TOKEN_INDEX, newValue);

      const tradeParamUpdate = await parametersHelper.connect(accounts[0]).tradeParamUpdate();

      assert.equal(tradeParamUpdate.operation, operation);
      assert.equal(tradeParamUpdate.tokenTypeIndex, ETH_TOKEN_INDEX);
      assert.equal(tradeParamUpdate.newValue, newValue);
    });

    it("executeTradeParamUpdate : disputeDepositAmount", async function() {
      const operation = DISPUTE_DEPOSIT_AMOUNT_INDEX;
      const newValue = 100000;

      await parametersHelper.connect(accounts[0]).executeTradeParamUpdate(
        operation,
        ETH_TOKEN_INDEX,
        newValue
      );
      const tradeParamUpdate = await parametersHelper.connect(accounts[0]).tradeParamUpdate();

      assert.equal(tradeParamUpdate.operation, operation);
      assert.equal(tradeParamUpdate.tokenTypeIndex, ETH_TOKEN_INDEX);
      assert.equal(tradeParamUpdate.newValue, newValue);
    });

    it("executeTradeParamUpdate : defencePeriod", async function() {
      const operation = 5;
      const newValue = 100000;

      await parametersHelper.connect(accounts[RELAYER_INDEX]).executeTradeParamUpdate(
        operation,
        ETH_TOKEN_INDEX,
        newValue
      );
      const tradeParamUpdate = await parametersHelper.connect(accounts[RELAYER_INDEX]).tradeParamUpdate();

      assert.equal(tradeParamUpdate.operation, operation);
      assert.equal(tradeParamUpdate.tokenTypeIndex, ETH_TOKEN_INDEX);
      assert.equal(tradeParamUpdate.newValue, newValue);
    });

    it("executeTradeParamUpdate : disputablePeriod", async function() {
      const operation = 6;
      const newValue = 100000;

      await parametersHelper.connect(accounts[RELAYER_INDEX]).executeTradeParamUpdate(
        operation,
        ETH_TOKEN_INDEX,
        newValue
      );
      const tradeParamUpdate = await parametersHelper.connect(accounts[RELAYER_INDEX]).tradeParamUpdate();

      assert.equal(tradeParamUpdate.operation, operation);
      assert.equal(tradeParamUpdate.tokenTypeIndex, ETH_TOKEN_INDEX);
      assert.equal(tradeParamUpdate.newValue, newValue);
    });

    it("executeTradeParamUpdate : withdrawalPeriod", async function() {
      const operation = 7;
      const newValue = 100000;

      await parametersHelper.connect(accounts[RELAYER_INDEX]).executeTradeParamUpdate(
        operation,
        ETH_TOKEN_INDEX,
        newValue
      );
      const tradeParamUpdate = await parametersHelper.connect(accounts[RELAYER_INDEX]).tradeParamUpdate();

      assert.equal(tradeParamUpdate.operation, operation);
      assert.equal(tradeParamUpdate.tokenTypeIndex, ETH_TOKEN_INDEX);
      assert.equal(tradeParamUpdate.newValue, newValue);
    });

    it("executeTradeParamUpdate : should revert if tokenIndex is invalid", async function () {
      const operation = 0;
      const newValue = 100000;

      await expect(
        parametersHelper.connect(accounts[0]).executeTradeParamUpdate(
          operation,
          100,
          newValue
        )
      ).to.be.revertedWith("Invalid token index");
    });

    it("executeTradeParamUpdate : should revert when called other than relayer", async function () {
      const operation = 0;
      const newValue = 100000;

      await expect(
        parametersHelper.connect(accounts[1]).executeTradeParamUpdate(
          operation,
          ETH_TOKEN_INDEX,
          newValue
        )
      ).to.be.revertedWith("Only for relayer");
    });

    it("finalizeTradeParamUpdate : tradeThreshold", async function() {
      const operation = 0;
      const newValue = 100000;

      await parametersHelper.connect(accounts[0]).executeTradeParamUpdate(
        operation,
        ETH_TOKEN_INDEX,
        newValue
      );

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');
      await expect(
        parametersHelper.connect(accounts[0]).finalizeTradeParamUpdate()
      )
      .to.emit(parametersHelper, "TradeParamUpdate")
      .withArgs(true, operation, ETH_TOKEN_INDEX, newValue);
      const tradeThreshold = await parametersHelper.connect(accounts[0]).tradeThreshold(ETH_TOKEN_INDEX);
      assert.equal(tradeThreshold, newValue);
      const tradeParamUpdate = await parametersHelper.connect(accounts[0]).tradeParamUpdate();
      assert.equal(tradeParamUpdate.operation, 0);
      assert.equal(tradeParamUpdate.tokenTypeIndex, 0);
      assert.equal(tradeParamUpdate.newValue, 0);
    });

    it("finalizeTradeParamUpdate : tradeMinimumAmount", async function() {
      const operation = 1;
      const newValue = 100000;

      await parametersHelper.connect(accounts[0]).executeTradeParamUpdate(
        operation,
        ETH_TOKEN_INDEX,
        newValue
      );

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await expect(
        parametersHelper.connect(accounts[0]).finalizeTradeParamUpdate()
      )
      .to.emit(parametersHelper, "TradeParamUpdate")
      .withArgs(true, operation, ETH_TOKEN_INDEX, newValue);

      const tradeMinimumAmount = await parametersHelper.connect(accounts[0]).tradeMinimumAmount(ETH_TOKEN_INDEX);
      assert.equal(tradeMinimumAmount, newValue);
    });

    it("finalizeTradeParamUpdate : withdrawalBlockPeriod", async function() {
      const operation = 2;
      const newValue = 100000;

      await parametersHelper.connect(accounts[0]).executeTradeParamUpdate(
        operation,
        ETH_TOKEN_INDEX,
        newValue
      );

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await expect(
        parametersHelper.connect(accounts[0]).finalizeTradeParamUpdate()
      )
      .to.emit(parametersHelper, "TradeParamUpdate")
      .withArgs(true, operation, ETH_TOKEN_INDEX, newValue);

      const withdrawalBlockPeriod = await parametersHelper.connect(accounts[0]).withdrawalBlockPeriod();
      assert.equal(withdrawalBlockPeriod, newValue);
    });

    it("finalizeTradeParamUpdate : tradableBondRatio", async function() {
      const operation = 3;
      const newValue = 300;

      await parametersHelper.connect(accounts[0]).executeTradeParamUpdate(
        operation,
        ETH_TOKEN_INDEX,
        newValue
      );

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await expect(
        parametersHelper.connect(accounts[0]).finalizeTradeParamUpdate()
      )
      .to.emit(parametersHelper, "TradeParamUpdate")
      .withArgs(true, operation, ETH_TOKEN_INDEX, newValue);

      const tradableBondRatio = await parametersHelper.connect(accounts[0]).tradableBondRatio();
      assert.equal(tradableBondRatio, newValue);
    });


    it("finalizeTradeParamUpdate : disputeDepositAmount", async function() {
      const operation = DISPUTE_DEPOSIT_AMOUNT_INDEX;
      const newValue = 100000;

      await parametersHelper.connect(accounts[0]).executeTradeParamUpdate(
        operation,
        ETH_TOKEN_INDEX,
        newValue
      );

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await parametersHelper.connect(accounts[0]).finalizeTradeParamUpdate();

      const disputeDepositAmount = await parametersHelper.connect(accounts[0]).disputeDepositAmount(ETH_TOKEN_INDEX);
      assert.equal(disputeDepositAmount, newValue);

      const tradeParamUpdate = await parametersHelper.connect(accounts[0]).tradeParamUpdate();

      assert.equal(tradeParamUpdate.operation, 0);
      assert.equal(tradeParamUpdate.tokenTypeIndex, 0);
      assert.equal(tradeParamUpdate.newValue, 0);
    });

    it("finalizeTradeParamUpdate : defencePeriod", async function() {
      const operation = 5;
      const newValue = 100000;

      await parametersHelper.connect(accounts[RELAYER_INDEX]).executeTradeParamUpdate(
        operation,
        ETH_TOKEN_INDEX,
        newValue
      );

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await parametersHelper.connect(accounts[RELAYER_INDEX]).finalizeTradeParamUpdate();

      const defencePeriod = await parametersHelper.connect(accounts[RELAYER_INDEX]).defencePeriod();
      assert.equal(defencePeriod, newValue);

      const tradeParamUpdate = await parametersHelper.connect(accounts[RELAYER_INDEX]).tradeParamUpdate();

      assert.equal(tradeParamUpdate.operation, 0);
      assert.equal(tradeParamUpdate.tokenTypeIndex, 0);
      assert.equal(tradeParamUpdate.newValue, 0);
    });

    it("finalizeTradeParamUpdate : disputablePeriod", async function() {
      const operation = 6;
      const newValue = 100000;

      await parametersHelper.connect(accounts[RELAYER_INDEX]).executeTradeParamUpdate(
        operation,
        ETH_TOKEN_INDEX,
        newValue
      );

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await parametersHelper.connect(accounts[RELAYER_INDEX]).finalizeTradeParamUpdate();

      const disputablePeriod = await parametersHelper.connect(accounts[RELAYER_INDEX]).disputablePeriod();
      assert.equal(disputablePeriod, newValue);

      const tradeParamUpdate = await parametersHelper.connect(accounts[RELAYER_INDEX]).tradeParamUpdate();

      assert.equal(tradeParamUpdate.operation, 0);
      assert.equal(tradeParamUpdate.tokenTypeIndex, 0);
      assert.equal(tradeParamUpdate.newValue, 0);
    });

    it("finalizeTradeParamUpdate : withdrawalPeriod", async function() {
      const operation = 7;
      const newValue = 100000;

      await parametersHelper.connect(accounts[RELAYER_INDEX]).executeTradeParamUpdate(
        operation,
        ETH_TOKEN_INDEX,
        newValue
      );

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await parametersHelper.connect(accounts[RELAYER_INDEX]).finalizeTradeParamUpdate();

      const withdrawalPeriod = await parametersHelper.connect(accounts[RELAYER_INDEX]).withdrawalPeriod();
      assert.equal(withdrawalPeriod, newValue);

      const tradeParamUpdate = await parametersHelper.connect(accounts[RELAYER_INDEX]).tradeParamUpdate();

      assert.equal(tradeParamUpdate.operation, 0);
      assert.equal(tradeParamUpdate.tokenTypeIndex, 0);
      assert.equal(tradeParamUpdate.newValue, 0);
    });

    it("finalizeTradeParamUpdate : should revert if update period is not over", async function () {
      const operation = 0;
      const newValue = 100000;

      await parametersHelper.connect(accounts[0]).executeTradeParamUpdate(
        operation,
        ETH_TOKEN_INDEX,
        newValue
      );

      await expect(
        parametersHelper.connect(accounts[0]).finalizeTradeParamUpdate()
      ).to.be.revertedWith("Ongoing update period");
    });

    it("executeManagerUpdate", async function () {
      const newManager = testContractCall.address;
      const block = await ethers.provider.getBlock('latest');
      const blockTimestamp = block.timestamp

      const operationArg = 0;

      await helper.connect(accounts[0]).executeManagerUpdate(operationArg, newManager);
      const { executeAfter, operation, newManager: manager } = await helper.connect(accounts[0]).managerUpdate();

      assert.equal(operation, operationArg);
      assert.equal(manager, newManager);
      assert.equal(executeAfter, blockTimestamp + updatePeriod + 1);
    });

    it("executeManagerUpdate should revert when called other than relayer", async function () {
      await expect(
        helper.connect(accounts[1]).executeManagerUpdate(0, accounts[1].address)
      ).to.be.revertedWith("Only for relayer");
    });

    it("finalizeManagerUpdate : disputeManager ", async function () {
      const newDisputeManager = testContractCall.address;
      const operationArg = 0;
      await helper.connect(accounts[0]).executeManagerUpdate(operationArg, newDisputeManager);

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await helper.connect(accounts[0]).finalizeManagerUpdate();

      const disputeManager = await helper.connect(accounts[0]).getDisputeManagerAddress();
      assert.equal(disputeManager, newDisputeManager);
    });

    it("finalizeManagerUpdate : bondManager ", async function () {
      const newBondManager = testContractCall.address;
      const operationArg = 1;
      await helper.connect(accounts[0]).executeManagerUpdate(operationArg, newBondManager);

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await helper.connect(accounts[0]).finalizeManagerUpdate();

      const bondManager = await helper.connect(accounts[0]).getBondManagerAddress();
      assert.equal(bondManager, newBondManager);
    });

    it("finalizeManagerUpdate : params ", async function () {
      const newParams = testContractCall.address;
      const operationArg = 2;
      await helper.connect(accounts[RELAYER_INDEX]).executeManagerUpdate(operationArg, newParams);

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await helper.connect(accounts[RELAYER_INDEX]).finalizeManagerUpdate();

      const params = await helper.connect(accounts[RELAYER_INDEX]).getParamsAddress();
      assert.equal(params, newParams);
    });

    it("finalizeManagerUpdate : should revert if update period is not over", async function () {
      const newDisputeManager = testContractCall.address;
      const operationArg = 0;
      await helper.connect(accounts[0]).executeManagerUpdate(operationArg, newDisputeManager);

      await expect(
        helper.connect(accounts[0]).finalizeManagerUpdate()
      ).to.be.revertedWith("Ongoing update period");
    });

    it("should fail update functions for default value", async function () {
      await expect(
        parametersHelper.connect(accounts[0]).finalizeTokenAddressUpdate()
      ).to.be.revertedWith("Ongoing update period");

      await expect(
        helper.connect(accounts[0]).finalizeManagerUpdate()
      ).to.be.revertedWith("Ongoing update period");

      await expect(
        parametersHelper.connect(accounts[0]).finalizeTradeParamUpdate()
      ).to.be.revertedWith("Ongoing update period");

      await expect(
        parametersHelper.connect(accounts[0]).finalizeFeeListUpdate()
      ).to.be.revertedWith("Ongoing update period");

    });
  })

  describe("dispute-manager function", () => {

    it("checkEvidenceExceptBlockHash : false", async function () {
      const testTradeData = testData.getTradeData(0);
      const evidence = testData.getEvidenceData(2);

      mockDisputeManager = await setUpMockDisputeManager(mockDisputeManager, [false, false]);
      const result = await helper.connect(accounts[0]).safeCheckEvidenceExceptBlockHash(testTradeData, evidence);
      assert.equal(result, false);
    });

    it("checkEvidenceExceptBlockHash : true", async function () {
      const testTradeData = testData.getTradeData(0);
      const evidence = testData.getEvidenceData(2);

      mockDisputeManager = await setUpMockDisputeManager(mockDisputeManager, [true, true]);
      const result = await helper.connect(accounts[0]).safeCheckEvidenceExceptBlockHash(testTradeData, evidence);
      assert.equal(result, true);
    });

  })

  describe("Contract account related test", () => {
    it("newTrade call from contract account", async function () {

      const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(0)));
      testTradeData.user = testContractCall.address;

      const encodedData = helper.interface.encodeFunctionData(
        "newTrade",
        [ testTradeData.amount, testTradeData.to, testTradeData.fee, testTradeData.tokenTypeIndex, testTradeData.destCode ]
      );

      await expect(
        testContractCall.connect(accounts[0]).functionCall(
          helper.address,
          encodedData,
          testTradeData.amount,
          { value: testTradeData.amount }
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

      await accounts[DISPUTER_INDEX].sendTransaction({
        to: testContractCall.address,
        value: DISPUTE_DEPOSIT_AMOUNT,
      });

      const encodedData = helper.interface.encodeFunctionData(
        "dispute",
        [
          ETH_TOKEN_INDEX,
          DISPUTE_DEPOSIT_AMOUNT,
          userTrades[0].userAddress,
          userTrades[0].index
         ]
      );

      const latestBlock = await ethers.provider.getBlock('latest');
      const now = latestBlock.timestamp;

      await expect(
        testContractCall.connect(accounts[DISPUTER_INDEX]).functionCall(
          helper.address,
          encodedData,
          DISPUTE_DEPOSIT_AMOUNT
          // { value: DISPUTE_DEPOSIT_AMOUNT }
        )
      ).to.changeEtherBalances(
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
      assert.equal(dispute.tokenTypeIndex, ETH_TOKEN_INDEX);
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
        tokenTypeIndex: ETH_TOKEN_INDEX,
        deposit: DISPUTE_DEPOSIT_AMOUNT,
        disputedTimestamp: now
      };
      await testData.setUpTrade(testTradeData, 0, false, testTradeData.destCode);
      await testData.setUpDispute(userTrades[0], testDisputeData, DISPUTER_INDEX);
      await helper.connect(accounts[DISPUTER_INDEX]).setUpDeposit(
        ETH_TOKEN_INDEX,
        DISPUTE_DEPOSIT_AMOUNT,
        { value: DISPUTE_DEPOSIT_AMOUNT }
      );

      await bondManager.deposit(ETH_TOKEN_INDEX, bond, {value : bond});

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
      ).to.changeEtherBalances(
        [helper.address, testContractCall],
        [-DISPUTE_DEPOSIT_AMOUNT, DISPUTE_DEPOSIT_AMOUNT + expectedReceiveAmount * 2]
      )
      .to.emit(helper, "Slash")
      .withArgs(userTrades[0].userAddress, userTrades[0].index, accounts[RELAYER_INDEX].address);

      const trade = await helper.getTrade(testContractCall.address, 0);
      const expectedData = testTradeData
      expectedData.status = STATUS_SLASH_COMPLETED
      tradeAssert(expectedData, trade, false);

      const relayerBalance = await bondManager.getBond(ETH_TOKEN_INDEX);

      const expectedRemainder = bond  - expectedReceiveAmount * 2;
      assert.equal(relayerBalance.toString(), expectedRemainder)

    });
  })

  // describe("getRelayerFee : **does not work in coverage", () => {
  //   it("getRelayerFee : high", async function () {
  //     await network.provider.send("hardhat_setNextBlockBaseFeePerGas", [
  //       removeZero(ethers.utils.parseUnits("5", "gwei").toHexString())
  //     ]);

  //     await helper.connect(accounts[0]).setRelayerFeeHelper(0);
  //     const fee = await helper.relayerFeeHelper();
  //     assert.equal(fee, feeList.high);
  //   });

  //   it("getRelayerFee : low", async function () {
  //     await network.provider.send("hardhat_setNextBlockBaseFeePerGas", [
  //       removeZero(ethers.utils.parseUnits("0.1", "gwei").toHexString())
  //     ]);

  //     await helper.connect(accounts[0]).setRelayerFeeHelper(0);
  //     const fee = await helper.relayerFeeHelper();
  //     assert.equal(fee, feeList.low);
  //   });

  //   it("getRelayerFee : medium", async function () {
  //     await network.provider.send("hardhat_setNextBlockBaseFeePerGas", [
  //       removeZero(ethers.utils.parseUnits("3", "gwei").toHexString())
  //     ]);

  //     await helper.connect(accounts[0]).setRelayerFeeHelper(0);
  //     const fee = await helper.relayerFeeHelper();
  //     assert.equal(fee, feeList.medium);
  //   });
  // })
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

const removeZero =  function(hexValue) {
  if (hexValue.startsWith('0x')) {
    // Check if the hex value starts with "0x"
    const value = hexValue.slice(2);
    if (value.startsWith('0')) {
      // If the value after "0x" starts with "0", remove the leading "0"
      return '0x' + value.slice(1);
    }
  }
  return hexValue;
}
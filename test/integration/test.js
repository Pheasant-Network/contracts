const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const utils = require('../utils/utils.js');
const TestData = utils.TestData;
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const STATUS_PAID = 2;
const tradableBondRatio = 211;

const tradeThreshold = "10000000000";
const tradeMinimumAmount = "10000";
const DISPUTE_DEPOSIT_AMOUNT = 5000000000000000;

const RELAYER_INDEX = 0;

const ETH_TOKEN_INDEX = 0;
const ERC20_TOKEN_INDEX = 1;

const ETH_NETWORK_CODE = 1001;
const networkCode = 1002;
const defaultDestCode = 1003;

const polygonNetworkCode = 1003;

const feeList = {
  "high" : 1000,
  "medium" : 1000,
  "low" : 1000,
  "gasPriceThresholdHigh" : 0,
  "gasPriceThresholdLow" : 0
}

const TEST_TOKEN_ADDRESS = "0x1535F5EC4Dad68c5Aab692B61AB78375F36CdF93";
const TEST_RELAYER_ADDRESS_FOR_EVIDENCE = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const bond = String(tradeThreshold * (tradableBondRatio *2) / 100);

describe("PheasantNetworkBridgeChild.sol integration test with dispute manager", function () {

  let pheasantNetworkBridgeChild;
  let TestToken;
  let testToken;
  let accounts;
  let bridgeDisputeManager;
  let BondManager;
  let bondManager;
  let ParametersHelper;
  let parametersHelper;
  let L2Helper;
  let l2Helper;
  let PolygonHelper;
  let polygonHelper;
  let tokenAddressList;
  let testData;
  let polygonTestData;
  let oneDay = 60 * 60 * 24;
  let bondLockPeriod =  oneDay * 60; //60 days

  before(async () => {
    accounts =  await ethers.getSigners();
    TestToken = await hre.ethers.getContractFactory("TestToken");
    BondManager = await hre.ethers.getContractFactory("BondManager");
    ParametersHelper = await hre.ethers.getContractFactory("ParameterHelper");
    L2Helper = await hre.ethers.getContractFactory("contracts/L2/Helper.sol:Helper");
    PolygonHelper = await hre.ethers.getContractFactory("contracts/polygon/Helper.sol:Helper");

    // checkpoint manager for test to test without relay block hash
    TestCheckPointManager = await hre.ethers.getContractFactory(
      'TestCheckpointManager',
    );
    testCheckPointManager = await TestCheckPointManager.deploy();

    // dispute manager related contracts
    RLPDecoder = await hre.ethers.getContractFactory('SolRLPDecoder');
    rlpDecoder = await RLPDecoder.deploy();
    DecoderHelper = await hre.ethers.getContractFactory('DecoderHelper', {
      libraries: {
        SolRLPDecoder: rlpDecoder.address,
      },
    });
    decoderHelper = await DecoderHelper.deploy();

    // bridge dispute manager contract
    const BridgeDisputeManager = await hre.ethers.getContractFactory(
      'BridgeDisputeManager',
      {
        libraries: {
          SolRLPDecoder: rlpDecoder.address,
        },
      },
    );

    bridgeDisputeManager = await BridgeDisputeManager.connect(
      accounts[0],
    ).deploy(testCheckPointManager.address);

  });

  beforeEach(async () => {
    // token contract
    testToken = await TestToken.connect(accounts[0]).deploy(accounts[0].address);

    // create test utils that enable you to execute setup functions and fetch test data
    testData = new TestData(accounts, l2Helper, testToken, true);
    polygonTestData = new TestData(accounts, polygonHelper, testToken, false);
  });


  describe("L2/PheasantNetworkBridgeChild", () => {

    beforeEach(async () => {

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
            "disputeDepositAmount" : DISPUTE_DEPOSIT_AMOUNT
          },
          [networkCode, defaultDestCode],
          [networkCode, defaultDestCode],
          [],
          feeList
        );
      // set bond manager
      const helperContractAddress = ethers.utils.getContractAddress(
        {from: accounts[0].address, nonce: await accounts[0].getTransactionCount() + 1},
      )
      bondManager = await BondManager
        .connect(accounts[0])
        .deploy(
          accounts[0].address,
          helperContractAddress,
          parametersHelper.address,
          true
        );

      l2Helper = await L2Helper.deploy(
        parametersHelper.address,
        bridgeDisputeManager.address,
        bondManager.address,
        accounts[0].address
      );

      const bond = String(tradeThreshold * 3);
      await bondManager.connect(accounts[0]).deposit(ETH_TOKEN_INDEX, bond, {value : bond});
      // await bondManager.deposit(ERC20_TOKEN_INDEX, bond);
   });

    describe("acceptETHUpwardTrade", () => {
      it("acceptETHUpwardTrade", async function () {

        const testRelayerFeeData = await testData.getRelayerFeeData(0);

        // trade data "to" is the address that you can get from getTradeData of index 0
        // currently address is 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
        const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(48)));
        testTradeData.fee = testRelayerFeeData.medium;

        // this evidence generated from
        // to : "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
        // amount : 1000000000
        // from : 0x6D29Fc79Eab50b1aB0C8550EC2952896aBCf0472
        // network : goerli
        const evidence = testData.getEvidenceData(5);

        // recover user address, to relayer and value from evidence
        const recoveredAddress = await bridgeDisputeManager.connect(accounts[0]).recoverAddress(evidence.rawTx);
        const [toRelayer, value] = await bridgeDisputeManager.connect(accounts[0]).decodeToAndValueFromTxData(evidence.transaction);

        //
        const initialBalance = await ethers.provider.getBalance(recoveredAddress);

        // execute createUpwardTrade
        await l2Helper.connect(accounts[0]).acceptETHUpwardTrade(
          evidence,
          { value: value - testRelayerFeeData.medium }
        );

        // set trade data
        testTradeData.user = recoveredAddress;
        testTradeData.to = recoveredAddress;
        testTradeData.status = STATUS_PAID;

        // check asset have been moved from user
        assert.equal(
          initialBalance.add(value - testRelayerFeeData.medium).toString(),
          String(await ethers.provider.getBalance(recoveredAddress))
        );

        // check trade
        const trade = await l2Helper.getTrade(recoveredAddress, 0);
        tradeAssert(testTradeData, trade, false);
      });

      // this test case will fail when you run test coverage, so I just comment it out
      // it("acceptETHUpwardTrade using high fee", async function () {

      //   const testRelayerFeeData = await testData.getRelayerFeeData(0);

      //   // trade data "to" is the address that you can get from getTradeData of index 0
      //   // currently address is 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
      //   const testTradeData = testData.getTradeData(48);

      //   // this evidence generated from
      //   // to : "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
      //   // amount : 1000000000
      //   // from : 0x6D29Fc79Eab50b1aB0C8550EC2952896aBCf0472
      //   // network : goerli
      //   const evidence = testData.getEvidenceData(5);

      //   const [toRelayer, value] = await bridgeDisputeManager.decodeToAndValueFromTxData(evidence.transaction);

      //   await network.provider.send("hardhat_setNextBlockBaseFeePerGas", [
      //     "0x4A817C800", // 20 gwei
      //   ]);
      //   // execute createUpwardTrade
      //   await l2Helper.connect(accounts[0]).acceptETHUpwardTrade(
      //     testTradeData.tokenTypeIndex, evidence, { value: value - testRelayerFeeData.high }
      //   );

      //  const recoveredAddress = await bridgeDisputeManager.connect(accounts[0]).recoverAddress(evidence.rawTx);

      //   // check trade
      //   const trade = await l2Helper.getTrade(recoveredAddress, 0);
      //   assert.equal(trade.fee.toNumber(), testRelayerFeeData.high);
      // });

      // it("acceptETHUpwardTrade using medium fee", async function () {

      //   const testRelayerFeeData = await testData.getRelayerFeeData(0);

      //   // trade data "to" is the address that you can get from getTradeData of index 0
      //   // currently address is 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
      //   const testTradeData = testData.getTradeData(48);

      //   // this evidence generated from
      //   // to : "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
      //   // amount : 1000000000
      //   // from : 0x6D29Fc79Eab50b1aB0C8550EC2952896aBCf0472
      //   // network : goerli
      //   const evidence = testData.getEvidenceData(5);

      //   const [toRelayer, value] = await bridgeDisputeManager.connect(accounts[0]).decodeToAndValueFromTxData(evidence.transaction);

      //   await network.provider.send("hardhat_setNextBlockBaseFeePerGas", [
      //     "0x2540BE400", // 20 gwei
      //   ]);
      //   // execute createUpwardTrade
      //   await l2Helper.connect(accounts[0]).acceptETHUpwardTrade(
      //     testTradeData.tokenTypeIndex, evidence, { value: value - testRelayerFeeData.medium }
      //   );

      //  const recoveredAddress = await bridgeDisputeManager.connect(accounts[0]).recoverAddress(evidence.rawTx);

      //   // check trade
      //   const trade = await l2Helper.getTrade(recoveredAddress, 0);
      //   assert.equal(trade.fee.toNumber(), testRelayerFeeData.medium);
      // });

      it("acceptUpwardTrade : ERC20", async function() {
        // we can't test for ERC20 because we can't get Evidence in hardhat
        // getToAndValueFromTransferData() is tested in test/bridgeDisputeManager
      });

      it("acceptUpwardTrade : should revert if called other than relayer", async function () {
        const evidence = testData.getEvidenceData(5);

        await expect(
          l2Helper.connect(accounts[3]).acceptETHUpwardTrade(evidence)
        ).to.be.revertedWith("Only for relayer");
      });

      it("acceptETHUpwardTrade : should fail if the value is higher than tradeThreshold", async function () {
        // this evidence generated from the tx that the value is 1000000000000001000
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(6)));

        // update blocktimestmp in order to avoid tx expire revert
        const now = await time.latest() - 29 * 60;
        evidence.rawBlockHeader[11] = "0x"+ Number(now).toString(16);

        // execute createUpwardTrade
        await expect(
          l2Helper.connect(accounts[0]).acceptETHUpwardTrade(evidence)
        ).to.be.revertedWith("Amount too big!");
      });

      it("acceptETHUpwardTrade : should fail if the value is lower than tradeMinimumAmount", async function () {
        // this evidence generated from the tx that the value is 1000
        const evidence = testData.getEvidenceData(7);

        // execute createUpwardTrade
        await expect(
          l2Helper.connect(accounts[0]).acceptETHUpwardTrade(evidence)
        ).to.be.revertedWith("Amount too low!");
      });

      // I removed this test case because there is no incentive to trade with the evidence with invalid to address
      // it("acceptETHUpwardTrade : should fail if to (relayer) have not registered as a relayer", async function () {

      //   const testTradeData = testData.getTradeData(48);

      //   // this evidence generated from the tx that to is not relayer "0x021006653ceDF465cA40AAc1dea57Bea241cdA6F"
      //   const evidence = testData.getEvidenceData(8);

      //   // execute createUpwardTrade
      //   // await expect(
      //   //   l2Helper.connect(accounts[1]).acceptETHUpwardTrade(testTradeData.tokenTypeIndex, evidence)
      //   // ).to.be.revertedWith("Invalid Relayer");

      //   // ** unable to check this test because we cannot create the evidence from hardhat account
      // });

      it("acceptETHUpwardTrade : should fail if evidence have already used", async function () {
        // this evidence generated from the tx that the value is 1000
        const evidence = testData.getEvidenceData(5);
        const [toRelayer, value] = await bridgeDisputeManager.connect(accounts[0]).decodeToAndValueFromTxData(evidence.transaction);

        // set evidence before execute acceptUpwardTrade via helper
        await l2Helper.connect(accounts[0]).setUpIsUniqueHashedEvidenceUpwardTrade(evidence);

        // execute createUpwardTrade
        await expect(
          l2Helper.connect(accounts[0]).acceptETHUpwardTrade(evidence, { value: value })
        ).to.be.revertedWith("Not unique hashed evidence");
      });

      it("acceptETHUpwardTrade : should fail if msg.value is lower than value", async function () {

        const testRelayerFeeData = await testData.getRelayerFeeData(0);

        // fee as a argument wil be 10000000
        const testTradeData = testData.getTradeData(48);

        // this evidence generated from the tx that the value is 1000
        const evidence = testData.getEvidenceData(5);

        // execute createUpwardTrade
        await expect(
          l2Helper.connect(accounts[0]).acceptETHUpwardTrade(
            evidence, { value: 10 }
          )
        ).to.be.revertedWith("Insufficient msg.value");
      });

    });

    describe("bulkAcceptUpwardTrade", () => {
      it("bulkAcceptETHUpwardTrade", async function () {

        const testRelayerFeeData = await testData.getRelayerFeeData(0);

        // trade data "to" is the address that you can get from getTradeData of index 0
        // currently address is 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
        const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(48)));
        testTradeData.fee = testRelayerFeeData.medium;

        // recover user address, to relayer and value from evidence
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(5)));
        const recoveredAddress = await bridgeDisputeManager.connect(accounts[0]).recoverAddress(evidence.rawTx);
        const [toRelayer, value] = await bridgeDisputeManager.connect(accounts[0]).decodeToAndValueFromTxData(evidence.transaction);

        // recover user address, to relayer and value from evidence
        const evidence2 = JSON.parse(JSON.stringify(testData.getEvidenceData(9)));
        const recoveredAddress2 = await bridgeDisputeManager.connect(accounts[0]).recoverAddress(evidence2.rawTx);
        const [toRelayer2, value2] = await bridgeDisputeManager.connect(accounts[0]).decodeToAndValueFromTxData(evidence2.transaction);

        //
        const initialBalance = await ethers.provider.getBalance(recoveredAddress);
        const initialBalance2 = await ethers.provider.getBalance(recoveredAddress2);

        const amount = (value - testRelayerFeeData.medium) + (value2 - testRelayerFeeData.medium);

        // execute
        await expect(
          await l2Helper.connect(accounts[0]).bulkAcceptETHUpwardTrade(
            [evidence, evidence2],
            { value: amount }
          )
        ).to.changeEtherBalance(
          accounts[0],
          -amount
        );

        // check asset have been moved from user
        assert.equal(
          initialBalance.add(amount).toString(),
          String(await ethers.provider.getBalance(recoveredAddress))
        );

        // set trade data
        testTradeData.user = recoveredAddress;
        testTradeData.to = recoveredAddress;
        testTradeData.status = STATUS_PAID;

        // check trade
        const trade = await l2Helper.getTrade(recoveredAddress, 0);
        tradeAssert(testTradeData, trade, false);

        testTradeData.index = 1;
        testTradeData.amount = value2;
        const trade2 = await l2Helper.getTrade(recoveredAddress2, 1);
        tradeAssert(testTradeData, trade2, false);

      });

      it("bulkAcceptETHUpwardTrade : should correctly emit events", async function () {

        // trade data "to" is the address that you can get from getTradeData of index 0
        // currently address is 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
        const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(48)));

        // recover user address, to relayer and value from evidence
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(5)));
        const recoveredAddress = await bridgeDisputeManager.connect(accounts[0]).recoverAddress(evidence.rawTx);
        const [toRelayer, value] = await bridgeDisputeManager.connect(accounts[0]).decodeToAndValueFromTxData(evidence.transaction);

        // recover user address, to relayer and value from evidence
        const evidence2 = JSON.parse(JSON.stringify(testData.getEvidenceData(9)));
        const recoveredAddress2 = await bridgeDisputeManager.connect(accounts[0]).recoverAddress(evidence2.rawTx);
        const [toRelayer2, value2] = await bridgeDisputeManager.connect(accounts[0]).decodeToAndValueFromTxData(evidence2.transaction);
        // execute

        const tx = await l2Helper.connect(accounts[0]).bulkAcceptETHUpwardTrade(
          [evidence, evidence2],
          { value: value + value2 }
        );

        const events = await l2Helper.queryFilter("Accept", tx.blockHash);
        assert.equal(events.length, 2);

        assert.equal(events[0].args.relayer, toRelayer);
        assert.equal(events[0].args.userAddress, recoveredAddress);
        assert.equal(events[0].args.txHash, ethers.utils.keccak256(evidence.transaction));
        assert.equal(events[0].args.index, 0);

        assert.equal(events[1].args.relayer, toRelayer2);
        assert.equal(events[1].args.userAddress, recoveredAddress2);
        assert.equal(events[1].args.txHash, ethers.utils.keccak256(evidence2.transaction));
        assert.equal(events[1].args.index, 1);

      });

      it("bulkAcceptETHUpwardTrade : should correctly payback when the msg.value is more than the amount", async function () {

        const testRelayerFeeData = await testData.getRelayerFeeData(0);

        // trade data "to" is the address that you can get from getTradeData of index 0
        // currently address is 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
        const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(48)));
        testTradeData.fee = testRelayerFeeData.medium;

        // recover user address, to relayer and value from evidence
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(5)));
        const [toRelayer, value] = await bridgeDisputeManager.connect(accounts[0]).decodeToAndValueFromTxData(evidence.transaction);

        // recover user address, to relayer and value from evidence
        const evidence2 = JSON.parse(JSON.stringify(testData.getEvidenceData(9)));
        const [toRelayer2, value2] = await bridgeDisputeManager.connect(accounts[0]).decodeToAndValueFromTxData(evidence2.transaction);

        const amount = (value - testRelayerFeeData.medium) + (value2 - testRelayerFeeData.medium);

        // execute
        await expect(
          await l2Helper.connect(accounts[0]).bulkAcceptETHUpwardTrade(
            [evidence, evidence2],
            { value: amount + amount }
          )
        ).to.changeEtherBalance(
          accounts[0],
          -amount
        );
      });

      it("bulkAcceptETHUpwardTrade : should revert if called other than relayer", async function () {
        const evidence = testData.getEvidenceData(5);
        await expect(
          l2Helper.connect(accounts[3]).bulkAcceptETHUpwardTrade(
            [evidence, evidence]
          )
        ).to.be.revertedWith("Only for relayer");
      });

      it("bulkAcceptETHUpwardTrade : should revert if msg.value is insufficient", async function () {

        // recover user address, to relayer and value from evidence
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(5)));
        const [toRelayer, value] = await bridgeDisputeManager.connect(accounts[0]).decodeToAndValueFromTxData(evidence.transaction);

        // recover user address, to relayer and value from evidence
        const evidence2 = JSON.parse(JSON.stringify(testData.getEvidenceData(9)));
        const [toRelayer2, value2] = await bridgeDisputeManager.connect(accounts[0]).decodeToAndValueFromTxData(evidence2.transaction);

        const amount = value

        await expect(
          l2Helper.connect(accounts[0]).bulkAcceptETHUpwardTrade(
            [evidence, evidence2],
            { value: amount }
          )
        ).to.be.revertedWith("Insufficient msg.value");

      });

      it("bulkAcceptETHUpwardTrade : should not emit event if transaction failed", async function () {

        // recover user address, to relayer and value from evidence
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(5)));
        const [toRelayer, value] = await bridgeDisputeManager.connect(accounts[0]).decodeToAndValueFromTxData(evidence.transaction);

        // recover user address, to relayer and value from evidence
        const evidence2 = JSON.parse(JSON.stringify(testData.getEvidenceData(9)));
        const [toRelayer2, value2] = await bridgeDisputeManager.connect(accounts[0]).decodeToAndValueFromTxData(evidence2.transaction);

        const amount = value

        await expect(
          l2Helper.connect(accounts[0]).bulkAcceptETHUpwardTrade(
            [evidence, evidence2],
            { value: amount }
          )
        ).to.be.reverted;

        const events = await l2Helper.queryFilter("Accept");
        assert.equal(events.length, 0);
      });
    });

    describe("slashUpwardTrade", () => {
      it("** slashUpwardTrade", async function() {
        // If you want yo run this test, please delete "Can slash within a certain period" validation
        // because we cannot create correct evidence that has hardhat timestamp in hardhat test.

        // await bondManager.deposit(ETH_TOKEN_INDEX, bond, {value : bond});

        // const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(9)));
        // // recover user address, to relayer and value from evidence
        // const recoveredAddress = await bridgeDisputeManager.recoverAddress(evidence.rawTx);
        // const [toRelayer, value] = await bridgeDisputeManager.decodeToAndValueFromTxData(evidence.transaction);

        // await testCheckPointManager.connect(accounts[0]).setBlockHash(
        //   networkCode,
        //   evidence.blockNumber,
        //   evidence.blockHash
        // );

        // // set initial state
        // const disputer = accounts[1];
        // const initialUserAmount = await ethers.provider.getBalance(recoveredAddress);
        // const initialRelayerBond = await bondManager.getBond(ETH_TOKEN_INDEX);

        // const slashedAmount = await parametersHelper.getRequiredBondAmount(value);

        // // execute
        // await expect(
        //   await l2Helper.connect(accounts[1]).slashUpwardTrade(0, evidence)
        // ).to.changeEtherBalance(
        //   disputer,
        //   await l2Helper.getRequiredBondAmount(value) / 2
        // );

        // expect(await ethers.provider.getBalance(recoveredAddress)).to.equal(initialUserAmount.add(slashedAmount / 2));
        // expect(await bondManager.getBond(ETH_TOKEN_INDEX)).to.equal(
        //   initialRelayerBond.sub(slashedAmount)
        // );

     });

      it("slashUpwardTrade : ERC20", async function() {
        // we can't test for ERC20 because we can't get Evidence in hardhat
      });

      it("slashUpwardTrade : Should revert if submitted evidence is not unique", async function () {

        const evidence = testData.getEvidenceData(5);
        // setup hashed evidence before execute
        await l2Helper.setUpIsUniqueHashedEvidenceUpwardTrade(evidence);

        await expect(
          l2Helper.connect(accounts[1]).slashUpwardTrade(0, evidence)
        ).to.be.revertedWith(
          "Not unique hashed evidence"
        );
      });

      it("slashUpwardTrade : Should revert if called too early", async function () {

        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(5)));

        const now = await time.latest();
        evidence.rawBlockHeader[11] = "0x"+ Number(now).toString(16);

        await expect(
          l2Helper.connect(accounts[1]).slashUpwardTrade(0, evidence)
        ).to.be.revertedWith(
          "Not yet available for slashing"
        );
      });

      it("slashUpwardTrade : Should revert if amount is exceed trade threshold amount", async function () {
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(6)));
        const block = await ethers.provider.getBlock("latest");
        evidence.rawBlockHeader[11] = "0x"+ Number(block.timestamp).toString(16);
        await ethers.provider.send('evm_increaseTime', [60 * 60]);
        await ethers.provider.send('evm_mine');

        await expect(
          l2Helper.connect(accounts[1]).slashUpwardTrade(0, evidence)
        ).to.be.revertedWith(
          "Amount too big!"
        );
      });

      it("slashUpwardTrade : Should revert if amount is below minimum trade amount", async function () {

        const evidence = JSON.parse(JSON.stringify(
          testData.getEvidenceData(7)
        ));

        const block = await ethers.provider.getBlock("latest");
        evidence.rawBlockHeader[11] = "0x"+ Number(block.timestamp - 60 * 60).toString(16);

        await expect(
          l2Helper.connect(accounts[1]).slashUpwardTrade(0, evidence)
        ).to.be.revertedWith(
          "Amount too low!"
        );
      });

      it("slashUpwardTrade : Should revert if dest id is unavailable", async function () {

        const evidence = JSON.parse(JSON.stringify(
          testData.getEvidenceData(5)
        ));

        const block = await ethers.provider.getBlock("latest");
        evidence.rawBlockHeader[11] = "0x"+ Number(block.timestamp - 60 * 60).toString(16);

        await expect(
          l2Helper.connect(accounts[1]).slashUpwardTrade(0, evidence)
        ).to.be.revertedWith(
          "Invalid network id"
        );
      });

      it("slashUpwardTrade : Should revert if evidence is invalid", async function() {
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(13)));

        // make evidence invalid by changing
        const now = await time.latest() - 60 * 60;
        evidence.rawBlockHeader[11] = "0x"+ Number(now).toString(16);

        await testCheckPointManager.connect(accounts[0]).setBlockHash(
          networkCode,
          evidence.blockNumber,
          evidence.blockHash
        );

        await expect(
          l2Helper.connect(accounts[1]).slashUpwardTrade(0, evidence)
        ).to.be.revertedWith(
          "Invalid evidence"
        );
      });

    });


    describe("safeCheckEvidenceExceptBlockHash", () => {
      it("safeCheckEvidenceExceptBlockHash : Should return false if checkEvidenceExceptBlockHash reverted", async function() {
        const testTradeData = testData.getTradeData(0);
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(2)));

        evidence.transaction = "0x";

        const result = await l2Helper.connect(accounts[0]).safeCheckEvidenceExceptBlockHash(testTradeData, evidence);
        assert.equal(result, false);
      });

      //【L2】
      // Ethereum [1001] - L2[1002] : ETH
      // L2 [1002] - Ethereum[1001] : ETH
      // Ethereum [1001] - L2 [1002] : ERC20
      // L2 [1002] - Ethereum [1001] : ERC20
      // L2[1002] - L2[1003] : ETH
      // L2[1002] - L2[1003] : ERC20
      // L2 [1002] - polygon[1003] : ETH
      // L2 [1002] - polygon[1003] : ERC20

      it("safeCheckEvidenceExceptBlockHash : Ethereum [1001] → L2[1002] & ETH", async function() {
        const destCode = 1002;
        const testTradeData = testData.getTradeData(50);
        testTradeData.destCode = destCode;
        testTradeData.relayer = TEST_RELAYER_ADDRESS_FOR_EVIDENCE;
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(13)));

        const result = await l2Helper.connect(accounts[0]).safeCheckEvidenceExceptBlockHash(testTradeData, evidence);
        assert.equal(result, true);
      });

      it("safeCheckEvidenceExceptBlockHash : L2[1002] → Ethereum[1001] & ETH", async function() {
        const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(51)));
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(10)));
        const result = await l2Helper.connect(accounts[0]).safeCheckEvidenceExceptBlockHash(testTradeData, evidence);
        assert.equal(result, true);
      });

      it("safeCheckEvidenceExceptBlockHash : Ethereum [1001] → L2[1002] & ERC20", async function() {
        const destCode = 1002;
        const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(52)));
        testTradeData.destCode = destCode;
        testTradeData.relayer = TEST_RELAYER_ADDRESS_FOR_EVIDENCE;
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(15)));

        await parametersHelper.addTokenAddressHelper([ETH_NETWORK_CODE], [ERC20_TOKEN_INDEX], [TEST_TOKEN_ADDRESS]);
        const result = await l2Helper.connect(accounts[0]).safeCheckEvidenceExceptBlockHash(testTradeData, evidence);
        assert.equal(result, true);
      });

      it("safeCheckEvidenceExceptBlockHash : L2[1002] → Ethereum [1001] & ERC20", async function() {
        const destCode = 1001
        const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(52)));
        testTradeData.destCode = destCode;
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(15)));

        await parametersHelper.addTokenAddressHelper([destCode], [ERC20_TOKEN_INDEX], [TEST_TOKEN_ADDRESS]);
        const result = await l2Helper.connect(accounts[0]).safeCheckEvidenceExceptBlockHash(testTradeData, evidence);
        assert.equal(result, true);
      });

      it("safeCheckEvidenceExceptBlockHash : L2[1002] → L2[1003]: ETH", async function() {
        const destCode = 1003;
        const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(51)));
        testTradeData.destCode = destCode;
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(14)));

        const result = await l2Helper.connect(accounts[0]).safeCheckEvidenceExceptBlockHash(testTradeData, evidence);
        assert.equal(result, true);
      });

      it("safeCheckEvidenceExceptBlockHash : L2[1002] → L2[1003]: ERC20", async function() {
        const destCode = 1003;
        const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(52)));
        testTradeData.destCode = destCode;
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(16)));

        await parametersHelper.addTokenAddressHelper([destCode], [ERC20_TOKEN_INDEX], [TEST_TOKEN_ADDRESS]);
        const result = await l2Helper.connect(accounts[0]).safeCheckEvidenceExceptBlockHash(testTradeData, evidence);
        assert.equal(result, true);
      });

      it("safeCheckEvidenceExceptBlockHash : L2[1002] → polygon[1003]: ETH", async function() {
        const destCode = 1003;
        const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(52)));
        //
        testTradeData.tokenTypeIndex = ETH_TOKEN_INDEX;
        testTradeData.destCode = destCode;
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(16)));

        await parametersHelper.addAvailableNetworksHelper([destCode], [1]);
        // add weth token address for eth token index
        await parametersHelper.addTokenAddressHelper([destCode], [ETH_TOKEN_INDEX], [TEST_TOKEN_ADDRESS]);

        const result = await l2Helper.connect(accounts[0]).safeCheckEvidenceExceptBlockHash(testTradeData, evidence);
        assert.equal(result, true);
      });

      it("safeCheckEvidenceExceptBlockHash : L2[1002] → polygon[1003]: ERC20", async function() {
        const destCode = 1003;
        const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(52)));
        testTradeData.destCode = destCode;
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(16)));

        await parametersHelper.addTokenAddressHelper([destCode], [ERC20_TOKEN_INDEX], [TEST_TOKEN_ADDRESS]);
        const result = await l2Helper.connect(accounts[0]).safeCheckEvidenceExceptBlockHash(testTradeData, evidence);
        assert.equal(result, true);
      });

    });

    describe("getToAndValueFromTransferData", () => {
      it("getToAndValueFromTransferData : tokenTypeIndex is 0", async function() {
        const tokenTypeIndex = 0;
        const transferData = testData.getTransferTxData(4);

        const [to, value] = await l2Helper.connect(accounts[0]).getToAndValueFromTransferDataHelper(
          tokenTypeIndex, transferData.transaction
        );
        assert.equal(to, ethers.utils.getAddress(transferData.to));
        assert.equal(value, transferData.amount);
      })

      it("getToAndValueFromTransferData : tokenTypeIndex is 1", async function() {
        const transferData = testData.getTransferTxData(6);

        await parametersHelper.addTokenAddressHelper(
          [ETH_NETWORK_CODE], [ERC20_TOKEN_INDEX], [transferData.tokenAddress]
        );

        const [to, value] = await l2Helper.connect(accounts[0]).getToAndValueFromTransferDataHelper(
          ERC20_TOKEN_INDEX, transferData.transaction
        );
        assert.equal(to, ethers.utils.getAddress(transferData.to));
        assert.equal(value, transferData.amount);
      })

      it("getToAndValueFromTransferData : tokenTypeIndex is 1 : should revert if token address invalid", async function() {
        const tokenTypeIndex = 1;
        const transferData = testData.getTransferTxData(6);

        await expect(
          l2Helper.connect(accounts[0]).getToAndValueFromTransferDataHelper(
            tokenTypeIndex, transferData.transaction
          )
        ).to.be.revertedWith("Invalid token address");
      })
    })
  });

  describe("polygon/PheasantNetworkBridgeChild", () => {

    beforeEach(async () => {

      tokenAddressList = [
        testToken.address
      ]

      parametersHelper = await ParametersHelper
        .connect(accounts[RELAYER_INDEX])
        .deploy(
          tokenAddressList,
          accounts[RELAYER_INDEX].address,
          {
            "tradeThreshold" : tradeThreshold.toString(),
            "tradeMinimumAmount" : tradeMinimumAmount,
            "networkCode" : polygonNetworkCode,
            "tradableBondRatio" : tradableBondRatio,
            "disputeDepositAmount" : DISPUTE_DEPOSIT_AMOUNT
          },
          [polygonNetworkCode, networkCode],
          [polygonNetworkCode, networkCode],
          [polygonNetworkCode],
          feeList
        );

        // set bond manager
      const helperContractAddress = ethers.utils.getContractAddress(
        {from: accounts[0].address, nonce: await accounts[0].getTransactionCount() + 1},
      )

      bondManager = await BondManager
        .connect(accounts[0])
        .deploy(
          accounts[0].address,
          helperContractAddress,
          parametersHelper.address,
          true
        );

      polygonHelper = await PolygonHelper.deploy(
        parametersHelper.address,
        bridgeDisputeManager.address,
        bondManager.address,
        accounts[0].address
      );

      // set polygon helper address to bridge dispute manager
      await testToken.connect(accounts[RELAYER_INDEX]).approve(polygonHelper.address, "10000000000000000000000");
      await testToken.connect(accounts[RELAYER_INDEX]).approve(bondManager.address, "10000000000000000000000");

      const bond = String(tradeThreshold * 3);
      await bondManager.connect(accounts[0]).deposit(ETH_TOKEN_INDEX, bond, {value : bond});
      // await bondManager.deposit(ERC20_TOKEN_INDEX, bond);
    });

    describe("acceptUpwardTrade", () => {
      it("acceptETHUpwardTrade", async function () {
        const testRelayerFeeData = await JSON.parse(JSON.stringify(polygonTestData.getRelayerFeeData(0)));

        // trade data "to" is the address that you can get from getTradeData of index 0
        // currently address is 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
        const testTradeData = polygonTestData.getTradeData(48);
        testTradeData.fee = testRelayerFeeData.medium;

        // this evidence generated from
        // to : "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
        // amount : 1000000000
        // from : 0x6D29Fc79Eab50b1aB0C8550EC2952896aBCf0472
        // network : goerli
        const evidence = polygonTestData.getEvidenceData(5);

        // recover user address, to relayer and value from evidence
        const recoveredAddress = await bridgeDisputeManager.connect(accounts[RELAYER_INDEX]).recoverAddress(evidence.rawTx);
        const [toRelayer, value] = await bridgeDisputeManager.connect(accounts[RELAYER_INDEX]).decodeToAndValueFromTxData(evidence.transaction);

        const initialBalance = await testToken.balanceOf(recoveredAddress);

        // execute createUpwardTrade
        await polygonHelper.connect(accounts[RELAYER_INDEX]).acceptETHUpwardTrade(evidence);
        relayerBalance = await testToken.balanceOf(accounts[RELAYER_INDEX].address);

        // set trade date
        testTradeData.user = recoveredAddress;
        testTradeData.to = recoveredAddress;
        testTradeData.status = STATUS_PAID;

        // check asset have been moved from user
        assert.equal(
          initialBalance.add(value - testTradeData.fee).toString(),
          String(await testToken.balanceOf(recoveredAddress))
        );

        // check trade
        const trade = await polygonHelper.getTrade(recoveredAddress, 0);
        tradeAssert(testTradeData, trade, false);
      });

      it("acceptETHUpwardTrade : should fail if the value is higher than tradeThreshold", async function () {

        // this evidence generated from the tx that the value is 1000000000000001000
        const evidence = JSON.parse(JSON.stringify(
          testData.getEvidenceData(6)
        ));

        // update blocktimestmp in order to avoid tx expire revert
        const now = await time.latest() - 29 * 60;
        evidence.rawBlockHeader[11] = "0x"+ Number(now).toString(16);

        // execute createUpwardTrade
        await expect(
          polygonHelper.connect(accounts[0]).acceptETHUpwardTrade(evidence)
        ).to.be.revertedWith("Amount too big!");
      });

      it("acceptETHUpwardTrade : should fail if the value is lower than tradeMinimumAmount", async function () {

        // this evidence generated from the tx that the value is 1000
        const evidence = polygonTestData.getEvidenceData(7);

        // execute createUpwardTrade
        await expect(
          polygonHelper.connect(accounts[0]).acceptETHUpwardTrade(evidence)
        ).to.be.revertedWith("Amount too low!");
      });

      it("acceptETHUpwardTrade : should fail if msg.sender is not relayer", async function () {
        // this evidence generated from the tx that the value is 1000
        const evidence = polygonTestData.getEvidenceData(5);

        // execute createUpwardTrade
        await expect(
          polygonHelper.connect(accounts[1]).acceptETHUpwardTrade(evidence)
        ).to.be.revertedWith("Only for relayer");
      });

      // it("acceptETHUpwardTrade : should fail if to (relayer) have not registered as a relayer", async function () {

      //   // this evidence generated from the tx that to is not relayer "0x021006653ceDF465cA40AAc1dea57Bea241cdA6F"
      //   const evidence = polygonTestData.getEvidenceData(8);

      //   // execute createUpwardTrade
      //   // await expect(
      //   //   polygonHelper.connect(accounts[1]).acceptETHUpwardTrade(testTradeData.fee, testTradeData.tokenTypeIndex, evidence)
      //   // ).to.be.revertedWith("Invalid Relayer");

      //   // ** unable to check this test because we cannot create the evidence from hardhat account
      // });

      /*it("acceptETHUpwardTrade : should fail if the fee is different from fee setting", async function () {

        const testRelayerFeeData = await polygonTestData.getRelayerFeeData(4);

        // fee as a argument wil be 10000000
        const testTradeData = polygonTestData.getTradeData(48);

        // this evidence generated from the tx that the value is 1000
        const evidence = polygonTestData.getEvidenceData(5);

        // execute createUpwardTrade
        await expect(
          polygonHelper.connect(accounts[0]).acceptETHUpwardTrade(testTradeData.tokenTypeIndex, evidence)
        ).to.be.revertedWith("Fee doesn't fit!");
      });*/

      it("acceptETHUpwardTrade : should fail if evidence have already used", async function () {
        // this evidence generated from the tx that the value is 1000
        const evidence = polygonTestData.getEvidenceData(5);

        // set evidence before execute acceptUpwardTrade via helper
        await polygonHelper.setUpIsUniqueHashedEvidenceUpwardTrade(evidence);

        // execute createUpwardTrade
        await expect(
          polygonHelper.connect(accounts[0]).acceptETHUpwardTrade(evidence)
        ).to.be.revertedWith("Not unique hashed evidence");
      });

      it("acceptETHUpwardTrade : should fail if allowance is insufficient", async function () {

        // this evidence generated from the tx that the value is 1000
        const evidence = polygonTestData.getEvidenceData(5);
        await polygonHelper.resetIsUniqueHashedEvidenceUpwardTrade(evidence);

        // decrease allowance
        await testToken.connect(accounts[0]).approve(polygonHelper.address, "0");
        // await testToken.connect(accounts[0]).decreaseAllowance(polygonHelper.address, "0");

        // execute createUpwardTrade
        await expect(
          polygonHelper.connect(accounts[0]).acceptETHUpwardTrade(evidence)
        ).to.be.revertedWith("TRANSFER_FROM_FAILED");
      });

      it("acceptETHUpwardTrade : should fail if relayer's balance is insufficient", async function () {
        // this evidence generated from the tx that the value is 1000
        const evidence = polygonTestData.getEvidenceData(5);
        await polygonHelper.resetIsUniqueHashedEvidenceUpwardTrade(evidence);

        // decrease transfer
        await testToken.connect(accounts[0]).transfer(
          accounts[1].address,
          await testToken.balanceOf(accounts[0].address)
        );

        // execute createUpwardTrade
        await expect(
          polygonHelper.connect(accounts[0]).acceptETHUpwardTrade(evidence)
        ).to.be.revertedWith("TRANSFER_FROM_FAILED");
      });
    });

    describe("bulkAcceptUpwardTrade", () => {
      it("bulkAcceptETHUpwardTrade", async function () {

        const testRelayerFeeData = await polygonTestData.getRelayerFeeData(0);

        // trade data "to" is the address that you can get from getTradeData of index 0
        // currently address is 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
        const testTradeData = JSON.parse(JSON.stringify(polygonTestData.getTradeData(48)));
        testTradeData.fee = testRelayerFeeData.medium;

        // recover user address, to relayer and value from evidence
        const evidence = JSON.parse(JSON.stringify(polygonTestData.getEvidenceData(5)));
        const recoveredAddress = await bridgeDisputeManager.connect(accounts[0]).recoverAddress(evidence.rawTx);
        const [toRelayer, value] = await bridgeDisputeManager.connect(accounts[0]).decodeToAndValueFromTxData(evidence.transaction);

        // recover user address, to relayer and value from evidence
        const evidence2 = JSON.parse(JSON.stringify(polygonTestData.getEvidenceData(9)));
        const recoveredAddress2 = await bridgeDisputeManager.connect(accounts[0]).recoverAddress(evidence2.rawTx);
        const [toRelayer2, value2] = await bridgeDisputeManager.connect(accounts[0]).decodeToAndValueFromTxData(evidence2.transaction);

        //
        const initialBalance = await testToken.balanceOf(recoveredAddress);

        const amount = value.sub(testRelayerFeeData.medium).add(value2).sub( testRelayerFeeData.medium);


        // execute
        await expect(
          await polygonHelper.connect(accounts[0]).bulkAcceptETHUpwardTrade(
            [evidence, evidence2]
          )
        ).to.changeTokenBalance(
          testToken,
          accounts[0],
          -amount
        );

        // check asset have been moved from user
        assert.equal(
          initialBalance.add(amount).toString(),
          String(await testToken.balanceOf(recoveredAddress))
        );

        // set trade data
        testTradeData.user = recoveredAddress;
        testTradeData.to = recoveredAddress;
        testTradeData.status = STATUS_PAID;

        // check trade
        const trade = await polygonHelper.getTrade(recoveredAddress, 0);
        tradeAssert(testTradeData, trade, false);

        testTradeData.index = 1;
        testTradeData.amount = value2;
        const trade2 = await polygonHelper.getTrade(recoveredAddress2, 1);
        tradeAssert(testTradeData, trade2, false);

      });
    });

    describe("slashUpwardTrade", () => {
      it("**slashUpwardTrade", async function() {
        // If you want yo run this test, please delete "Can slash within a certain period" validation
        // because we cannot create correct evidence that has hardhat timestamp in hardhat test.

        // const evidence = JSON.parse(JSON.stringify(polygonTestData.getEvidenceData(9)));
        // // recover user address, to relayer and value from evidence
        // const recoveredAddress = await bridgeDisputeManager.recoverAddress(evidence.rawTx);
        // const [toRelayer, value] = await bridgeDisputeManager.decodeToAndValueFromTxData(evidence.transaction);

        // // increase time
        // await hre.ethers.provider.send("evm_increaseTime", [60 * 60]);
        // await hre.ethers.provider.send("evm_mine");

        // await testCheckPointManager.connect(accounts[0]).setBlockHash(
        //   networkCode,
        //   evidene.blockNumber,
        //   evidence.blockHash
        // );

        // const disputer = accounts[1];
        // const initialUserAmount = await testToken.balanceOf(recoveredAddress);
        // const initialRelayerBond = await bondManager.getBond(ETH_TOKEN_INDEX);

        // const slashedAmount = await parametersHelper.getRequiredBondAmount(value);

        // // execute
        // await expect(
        //   await polygonHelper.connect(disputer).slashUpwardTrade(0, evidence)
        // ).to.changeTokenBalance(
        //   testToken,
        //   disputer,
        //   await parametersHelper.getRequiredBondAmount(value) / 2
        // );

        // expect(await testToken.balanceOf(recoveredAddress)).to.equal(initialUserAmount + slashedAmount / 2);
        // expect(await bondManager.getBond(ETH_TOKEN_INDEX)).to.equal(
        //   initialRelayerBond.sub(slashedAmount)
        // );

      });

      it("slashUpwardTrade : Should revert if submitted evidence is not unique", async function () {

        const evidence = polygonTestData.getEvidenceData(5);
        // setup hashed evidence before execute
        await polygonHelper.setUpIsUniqueHashedEvidenceUpwardTrade(evidence);

        await expect(
          polygonHelper.connect(accounts[1]).slashUpwardTrade(0, evidence)
        ).to.be.revertedWith(
          "Not unique hashed evidence"
        );
      });

      it("slashUpwardTrade : Should revert if called too early", async function () {

        const evidence = JSON.parse(JSON.stringify(polygonTestData.getEvidenceData(5)));

        const now = await time.latest();
        evidence.rawBlockHeader[11] = "0x"+ Number(now).toString(16);

        await expect(
          polygonHelper.connect(accounts[1]).slashUpwardTrade(0, evidence)
        ).to.be.revertedWith(
          "Not yet available for slashing"
        );
      });

      it("slashUpwardTrade : Should revert if amount is exceed trade threshold amount", async function () {

        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(6)));
        const block = await ethers.provider.getBlock("latest");
        evidence.rawBlockHeader[11] = "0x"+ Number(block.timestamp).toString(16);
        await ethers.provider.send('evm_increaseTime', [60 * 60]);
        await ethers.provider.send('evm_mine');

        await expect(
          polygonHelper.connect(accounts[1]).slashUpwardTrade(0, evidence)
        ).to.be.revertedWith(
          "Amount too big!"
        );
      });

      it("slashUpwardTrade : Should revert if amount is below minimum trade amount", async function () {

        const evidence = JSON.parse(JSON.stringify(
          testData.getEvidenceData(7)
        ));

        const block = await ethers.provider.getBlock("latest");
        evidence.rawBlockHeader[11] = "0x"+ Number(block.timestamp - 60 * 60).toString(16);

        await expect(
          polygonHelper.connect(accounts[1]).slashUpwardTrade(0, evidence)
        ).to.be.revertedWith(
          "Amount too low!"
        );
      });

      it("slashUpwardTrade : Should revert if dest id is unavailable", async function () {

        const evidence = JSON.parse(JSON.stringify(
          testData.getEvidenceData(5)
        ));

        const block = await ethers.provider.getBlock("latest");
        evidence.rawBlockHeader[11] = "0x"+ Number(block.timestamp - 60 * 60).toString(16);

        await expect(
          polygonHelper.connect(accounts[1]).slashUpwardTrade(0, evidence)
        ).to.be.revertedWith(
          "Invalid network id"
        );
      });

      it("slashUpwardTrade : Should revert if evidence is invalid", async function() {

        const evidence = JSON.parse(JSON.stringify(polygonTestData.getEvidenceData(14)));

        // make evidence invalid by changing
        const now = await time.latest() - 60 * 60;
        evidence.rawBlockHeader[11] = "0x"+ Number(now).toString(16);

        await testCheckPointManager.connect(accounts[0]).setBlockHash(
          polygonNetworkCode,
          evidence.blockNumber,
          evidence.blockHash
        );

        await expect(
          polygonHelper.connect(accounts[1]).slashUpwardTrade(0, evidence)
        ).to.be.revertedWith(
          "Invalid evidence"
        );
      });

    });

    describe("safeCheckEvidenceExceptBlockHash", () => {
      // 【Polygon】
      // Ethereum [1001] - polygon [1003] : ETH
      // polygon [1003] - ethereum [1001] : ETH
      // Ethereum [1001] - polygon [1003] : ERC20
      // polygon [1003] - ethereum [1001] : ERC20
      // polygon [1003] - L2 [1002] : ETH
      // polygon [1003] - L2 [1002] : ERC20

      it("safeCheckEvidenceExceptBlockHash : Ethereum [1001] → Polygon[1003] & ETH", async function() {
        const destCode = 1003;
        const testTradeData = testData.getTradeData(53);
        testTradeData.destCode = destCode;
        testTradeData.relayer = TEST_RELAYER_ADDRESS_FOR_EVIDENCE;
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(14)));

        const result = await polygonHelper.connect(accounts[0]).safeCheckEvidenceExceptBlockHash(testTradeData, evidence);
        assert.equal(result, true);
      });

      it("safeCheckEvidenceExceptBlockHash : Polygon[1003] → Ethereum [1001] & ETH", async function() {
        const destCode = 1001;
        const testTradeData = testData.getTradeData(51);
        testTradeData.destCode = destCode;
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(14)));

        const result = await polygonHelper.connect(accounts[0]).safeCheckEvidenceExceptBlockHash(testTradeData, evidence);
        assert.equal(result, true);
      });

      it("safeCheckEvidenceExceptBlockHash : Ethereum [1001] → polygon[1003] & ERC20", async function() {
        const destCode = 1003;
        const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(54)));
        testTradeData.destCode = destCode;
        testTradeData.relayer = TEST_RELAYER_ADDRESS_FOR_EVIDENCE;
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(16)));

        await parametersHelper.addTokenAddressHelper([ETH_NETWORK_CODE], [ERC20_TOKEN_INDEX], [TEST_TOKEN_ADDRESS])

        const result = await polygonHelper.connect(accounts[0]).safeCheckEvidenceExceptBlockHash(testTradeData, evidence);
        assert.equal(result, true);
      });

      it("safeCheckEvidenceExceptBlockHash : polygon[1003] → Ethereum [1001] & ERC20", async function() {
        const destCode = 1001
        const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(52)));
        testTradeData.destCode = destCode;
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(16)));

        await parametersHelper.addTokenAddressHelper([destCode], [ERC20_TOKEN_INDEX], [TEST_TOKEN_ADDRESS]);
        const result = await polygonHelper.connect(accounts[0]).safeCheckEvidenceExceptBlockHash(testTradeData, evidence);
        assert.equal(result, true);
      });

      it("safeCheckEvidenceExceptBlockHash : polygon[1003] → L2 [1002] & ETH", async function() {
        const destCode = 1002
        const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(51)));
        testTradeData.destCode = destCode;
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(13)));

        const result = await polygonHelper.connect(accounts[0]).safeCheckEvidenceExceptBlockHash(testTradeData, evidence);
        assert.equal(result, true);
      });

      it("safeCheckEvidenceExceptBlockHash : polygon[1003] → L2 [1002] & ERC20", async function() {
        const destCode = 1002
        const testTradeData = JSON.parse(JSON.stringify(testData.getTradeData(52)));
        testTradeData.destCode = destCode;
        testTradeData.relayer = TEST_RELAYER_ADDRESS_FOR_EVIDENCE;
        const evidence = JSON.parse(JSON.stringify(testData.getEvidenceData(15)));

        await parametersHelper.addTokenAddressHelper([destCode], [ERC20_TOKEN_INDEX], [TEST_TOKEN_ADDRESS]);
        const result = await polygonHelper.connect(accounts[0]).safeCheckEvidenceExceptBlockHash(testTradeData, evidence);
        assert.equal(result, true);
      });

    });
  });

});


const tradeAssert = function(rawExpectedData, rawAcutualData, isTimeStampCheck) {
  const expect = Object.fromEntries(
    Object.entries(rawExpectedData)
    .map(([ key, val ]) => [ key, String(val) ])
  );

  const acutual = Object.fromEntries(
    Object.entries(rawAcutualData)
    .map(([ key, val ]) => [ key, String(val) ])
  );

  assert.equal(expect.index, acutual.index);
  assert.equal(expect.user, acutual.user);
  assert.equal(expect.tokenTypeIndex, acutual.tokenTypeIndex);
  assert.equal(expect.amount, acutual.amount);
  assert.equal(expect.to, acutual.to);
  assert.equal(expect.relayer, acutual.relayer);
  assert.equal(expect.status, acutual.status);
  assert.equal(expect.fee, acutual.fee);

  if(isTimeStampCheck) {
    assert.equal(expect.timestamp, acutual.timestamp);
  }
}


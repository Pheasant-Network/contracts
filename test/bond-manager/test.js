const { expect, assert } = require("chai");
const { ethers } = require("hardhat");

describe("Bond Manager", function () {

  let accounts
  let ownerAddress
  let bridge
  let bondManager
  let testToken

  const tradableBondRatio = 200;

  const RELAYER_INDEX = 0;

  const ETH_TOKEN_INDEX = 0;
  const ERC20_TOKEN_INDEX = 1;

  const networkCode = 1001;
  const defaultDestCode = 1002;

  const updatePeriod = 60 * 60 * 3;

  const tradeThreshold = "1000000000000000000";
  const tradeMinimumAmount = "10000";
  const DISPUTE_DEPOSIT_AMOUNT = 5000000000000000;

  const feeList = {
    "high" : 1500,
    "medium" : 1000,
    "low" : 500,
    "gasPriceThresholdHigh" : ethers.utils.parseUnits("4", "gwei"),
    "gasPriceThresholdLow" : ethers.utils.parseUnits("2", "gwei")
  }

  before(async () => {
    accounts =  await ethers.getSigners();
    ParametersHelper = await hre.ethers.getContractFactory("ParameterHelper");
  });

  beforeEach(async () => {

    ownerAddress = accounts[0].address;
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

    const Helper = await hre.ethers.getContractFactory("contracts/L2/Helper.sol:Helper");
    bridge = await Helper.deploy(
      parametersHelper.address,
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      accounts[RELAYER_INDEX].address
    );

    const BondManager = await hre.ethers.getContractFactory("BondManager");
    bondManager = await BondManager.connect(accounts[RELAYER_INDEX]).deploy(
      ownerAddress,
      bridge.address,
      parametersHelper.address,
      true
    );

    const TestToken = await hre.ethers.getContractFactory("TestToken");
    testToken = await TestToken.connect(accounts[RELAYER_INDEX]).deploy(accounts[RELAYER_INDEX].address);
    await testToken.approve(bondManager.address, "1000000000000000000000000000");

    await parametersHelper.addTokenAddressHelper([networkCode], [ERC20_TOKEN_INDEX], [testToken.address]);
  });


  describe("deployment", () => {
    it("should set the owner correctly", async () => {
      expect(await bondManager.owner()).to.equal(ownerAddress);
    });

    it("should set the bridge correctly", async () => {
      expect(await bondManager.bridgeContract()).to.equal(bridge.address);
    });

    it("should set tokenAddress correctly", async () => {
      expect(await parametersHelper.tokenAddress(networkCode, ETH_TOKEN_INDEX)).to.equal(ethers.constants.AddressZero);

      const tokenAddress = await parametersHelper.tokenAddress(networkCode, ERC20_TOKEN_INDEX);
      expect(tokenAddress).to.equal(testToken.address);
    });

    it("should set isNative", async () => {
      expect(await bondManager.isNative(ETH_TOKEN_INDEX)).to.equal(true);
    });
  });

  // describe("addTokenAddress", () => {
  //   it("should add token addresses correctly", async function () {
  //     const tokenAddress = await bondManager.tokenAddress(1);
  //     expect(tokenAddress).to.equal(testToken.address);
  //   });

  //   it("should revert if token index is already set", async function () {
  //     // Call the function with invalid parameters
  //     await expect(
  //       bondManager.connect(accounts[0]).addTokenAddress(1, testToken.address)
  //     ).to.be.revertedWith("Token address already exists");

  //     // Check if the function has not set the tokenAddress
  //     const tokenAddress = await bondManager.tokenAddress(1);
  //     expect(tokenAddress).to.equal(testToken.address);
  //   });

  //   it("should revert if set assress as token index 0", async function () {
  //     // Call the function with invalid parameters
  //     await expect(
  //       bondManager.connect(accounts[0]).addTokenAddress(0, testToken.address)
  //     ).to.be.revertedWith("Cannot use tokenIndex 0");

  //     // Check if the function has not set the tokenAddress
  //     const tokenAddress = await bondManager.tokenAddress(0);
  //     expect(tokenAddress).to.equal("0x0000000000000000000000000000000000000000");
  //   });

  //   it("should revert if not called by the owner", async function () {
  //     // Call the function with invalid parameters
  //     await expect(
  //       bondManager.connect(accounts[1]).addTokenAddress(2, testToken.address)
  //     ).to.be.revertedWith("Ownable: caller is not the owner");

  //     // Check if the function has not set the tokenAddress
  //     const tokenAddress = await bondManager.tokenAddress(2);
  //     expect(tokenAddress).to.equal("0x0000000000000000000000000000000000000000");
  //   });


  // });

  // describe("updateBondUser", () => {

  //   it("should update the bondManager", async function () {
  //     // Call the function with valid parameters
  //     const newBondManager = accounts[1].address;
  //     await bondManager.updateBondUser(newBondManager);

  //     // Check if the bondManager variable has been updated
  //     const bondManagerAddress = await bondManager.bridge();
  //     expect(bondManagerAddress).to.equal(newBondManager);
  //   });

  //   it("should revert if not called by the owner", async function () {
  //     // Call the function with invalid parameters
  //     await expect(
  //       bondManager.connect(accounts[1]).updateBondUser(accounts[1].address)
  //     ).to.be.revertedWith("Ownable: caller is not the owner");

  //     // Check if the bondManager variable has not been updated
  //     const bondManagerAddress = await bondManager.bridge();
  //     expect(bondManagerAddress).to.equal(ownerAddress);
  //   });
  // });

  describe("deposit", () => {
    it("should deposit ETH correctly", async function () {
      // Call the function with valid parameters
      const tokenIndex = 0;
      const amount = "10000";
      await expect(
        bondManager.deposit(tokenIndex, amount, { value: amount })
      ).to.changeEtherBalances(
        [accounts[0], bondManager], [-amount, amount]
      )
      .to.emit(bondManager, "BondDeposited")
      .withArgs(accounts[0].address, tokenIndex, amount);

      // Check if the bonds and ETH balance have been updated correctly
      const bonds = await bondManager.getBond(tokenIndex);
      expect(bonds).to.equal(amount);
    });

    it("should deposit ERC20 tokens correctly", async function () {
      // Call the function with valid parameters
      const tokenIndex = 1;
      const amount = "10000";

      await expect(
        bondManager.deposit(tokenIndex, amount)
      ).to.changeTokenBalances(
        testToken,
        [accounts[0], bondManager],
        [-amount, amount]
      )
      .to.emit(bondManager, "BondDeposited")
      .withArgs(accounts[0].address, tokenIndex, amount);

      // Check if the bonds and ERC20 token balance have been updated correctly
      const bonds = await bondManager.getBond(tokenIndex);
      expect(bonds).to.equal(amount);
    });

    it("should revert if amount is 0", async function () {
      const tokenIndex = 0;
      const amount = "0";
      await expect(
        bondManager.deposit(tokenIndex, amount)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("should revert with insufficient ETH balance", async function () {
      // Call the function with insufficient ETH balance
      const tokenIndex = 0;
      const amount = "10000";
      await expect(
        bondManager.deposit(tokenIndex, amount)
      ).to.be.revertedWith("Insufficient ETH balance");
    });

    it("should revert with insufficient ERC20 balance", async function () {
      // Call the function with insufficient ERC20 balance
      await testToken.connect(accounts[0]).transfer(
        accounts[3].address,
        await testToken.balanceOf(accounts[0].address)
      );

      const tokenIndex = 1;
      const amount = "10000";

      await expect(
        bondManager.deposit(tokenIndex, amount)
      ).to.be.revertedWith("TRANSFER_FROM_FAILED");
    });

    it("should revert with invalid token index", async function () {
      // Call the function with invalid token index
      const tokenIndex = 2;
      const amount = "10000";
      await expect(
        bondManager.deposit(tokenIndex, amount)
      ).to.be.revertedWith("Invalid token index");
    });

    it("should revert if not called by the owner", async function () {
      await expect(
        bondManager.connect(accounts[1]).deposit(1, 1)
      ).to.be.revertedWith("UNAUTHORIZED");
    });

    it('should revert if tokenIndex is invalid', async function () {
      const tokenIndex = 3;
      await expect(
        bondManager.connect(accounts[0]).deposit(tokenIndex, 10)
      ).to.be.revertedWith('Invalid token index');
    })
  });

  describe("executeWithdrawBond", () => {
    it('should execute the withdraw bond function correctly', async function () {
      const tokenIndex = 0;
      const amount = ethers.utils.parseEther("10");
      const withdrawalAmount = ethers.utils.parseEther("3");
      await bondManager.deposit(tokenIndex, amount, { value: amount });

      const initialBondAmount = await bondManager.getBond(tokenIndex);

      // Check if the BondWithdrawExecuted event is emitted with the correct arguments
      await expect(
        bondManager
          .connect(accounts[0])
          .executeWithdrawBond(tokenIndex, withdrawalAmount)
      )
      .to.emit(bondManager, "BondWithdrawExecuted")
      .withArgs(tokenIndex, withdrawalAmount);


      const updatedBondAmount = await bondManager.getBond(tokenIndex);
      expect(updatedBondAmount).to.equal(initialBondAmount.sub(withdrawalAmount));

      // Test if the bondWithdrawal struct is set correctly
      const bondWithdrawal = await bondManager.bondWithdrawal(tokenIndex);
      expect(bondWithdrawal.tokenIndex).to.equal(tokenIndex);
      expect(bondWithdrawal.withdrawalAmount).to.equal(withdrawalAmount);
    });

    it("should revert if not called by the owner", async function () {
      await expect(
        bondManager.connect(accounts[1]).executeWithdrawBond(1, 1)
      ).to.be.revertedWith("UNAUTHORIZED");
    });

    it('should revert if tokenIndex is invalid', async function () {
      const tokenIndex = 3;
      await expect(
        bondManager.connect(accounts[0]).executeWithdrawBond(tokenIndex, 10)
      ).to.be.revertedWith('Invalid token index');
    })

    it('should revert if withdrawal amount is greater than bond amount', async function () {
      const tokenIndex = 0;
      const amount = ethers.utils.parseEther("10");
      const withdrawalAmount = ethers.utils.parseEther("11");
      await bondManager.deposit(tokenIndex, amount, { value: amount });

      await expect(
        bondManager.connect(accounts[0]).executeWithdrawBond(tokenIndex, withdrawalAmount)
      ).to.be.revertedWith('Insufficient bond balance to withdraw');
    })
  });

  describe("finalizeWithdrawalBond", () => {
    it('should finalize the withdrawal ETH bond correctly', async function () {
      const tokenIndex = 0;
      const amount = "10000";
      const withdrawalAmount = "100";
      await bondManager.deposit(tokenIndex, amount, { value: amount });

      const initialBondAmount = await bondManager.getBond(tokenIndex);

      // Test if the bond amount is decreased by the given amount
      await bondManager.connect(accounts[0]).executeWithdrawBond(tokenIndex, withdrawalAmount);
      const executedBondAmount = await bondManager.getBond(tokenIndex);
      expect(executedBondAmount).to.equal(initialBondAmount.sub(withdrawalAmount));

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await expect(
        bondManager.finalizeWithdrawalBond(tokenIndex)
      ).to.changeEtherBalances(
        [accounts[0], bondManager],
        [withdrawalAmount, -withdrawalAmount]
      )
      .to.emit(bondManager, "BondWithdrawFinalized")
      .withArgs(tokenIndex, withdrawalAmount);

      // Test bond amount after withdrawal
      const finalizedBondAmount = await bondManager.getBond(tokenIndex);
      expect(finalizedBondAmount).to.equal(initialBondAmount.sub(withdrawalAmount));
      expect(finalizedBondAmount).to.equal(executedBondAmount);

      // Test if the bondWithdrawal struct is set correctly
      const bondWithdrawal = await bondManager.bondWithdrawal(tokenIndex);
      expect(bondWithdrawal.executeAfter).to.equal(0);
      expect(bondWithdrawal.tokenIndex).to.equal(0);
      expect(bondWithdrawal.withdrawalAmount).to.equal(0);


    });

    it('should finalize the withdrawal ERC20 bond correctly', async function () {
      const tokenIndex = 1;
      const amount = "10000";
      const withdrawalAmount = "100";
      await bondManager.deposit(tokenIndex, amount);

      // Test if the bond amount is decreased by the given amount
      await bondManager.connect(accounts[0]).executeWithdrawBond(tokenIndex, withdrawalAmount);

      await ethers.provider.send('evm_increaseTime', [updatePeriod]);
      await ethers.provider.send('evm_mine');

      await expect(() =>
        bondManager.finalizeWithdrawalBond(tokenIndex)
      ).to.changeTokenBalances(
        testToken,
        [accounts[0], bondManager],
        [withdrawalAmount, -withdrawalAmount]
      );
    });

    it("should revert if called with in ongoing period", async function () {
      const tokenIndex = 0;
      const amount = "10000";
      const withdrawalAmount = "100";
      await bondManager.deposit(tokenIndex, amount, { value: amount });

      // Test if the bond amount is decreased by the given amount
      await bondManager.connect(accounts[0]).executeWithdrawBond(tokenIndex, withdrawalAmount);

      await ethers.provider.send('evm_increaseTime', [60 * 60]);
      await ethers.provider.send('evm_mine');

      await expect(
        bondManager.connect(accounts[0]).finalizeWithdrawalBond(tokenIndex)
      ).to.be.revertedWith("Ongoing update period");
    });

    it("should revert if called with in ongoing period with initial value", async function () {
      const tokenIndex = 0;
      const amount = "10000";
      const withdrawalAmount = "100";
      await bondManager.deposit(tokenIndex, amount, { value: amount });

      await expect(
        bondManager.connect(accounts[0]).finalizeWithdrawalBond(tokenIndex)
      ).to.be.revertedWith("Ongoing update period");
    });
  });

  describe("slash", () => {
    it('should slash the ETH bond correctly', async function () {
      const tokenIndex = 0;
      const amount = "10000";
      const slashAmount = "100";
      await bondManager.deposit(tokenIndex, amount, { value: amount });

      // Test if the bond amount is decreased by the given amount
      await expect(
        // bondManager.connect(accounts[0]).slash(tokenIndex, slashAmount)
        bridge.slashForBondManagerTest(bondManager.address, tokenIndex, slashAmount)
      ).to.changeEtherBalances(
        [bridge, bondManager],
        [slashAmount, -slashAmount]
      )
      .to.emit(bondManager, "BondSlashed")
      .withArgs(tokenIndex, slashAmount);

      const updatedBondAmount = await bondManager.getBond(tokenIndex);
      expect(updatedBondAmount).to.equal(amount - slashAmount);
    });

    it('should slash the ERC20 bond correctly', async function () {
      const tokenIndex = 1;
      const amount = "10000";
      const slashAmount = "100";
      await bondManager.deposit(tokenIndex, amount);

      // Test if the bond amount is decreased by the given amount
      await expect(
        // bondManager.connect(accounts[0]).slash(tokenIndex, slashAmount)
        bridge.slashForBondManagerTest(bondManager.address, tokenIndex, slashAmount)
      ).to.changeTokenBalances(
        testToken,
        [bridge, bondManager],
        [slashAmount, -slashAmount]
      )
      .to.emit(bondManager, "BondSlashed")
      .withArgs(tokenIndex, slashAmount);

      const updatedBondAmount = await bondManager.getBond(tokenIndex);
      expect(updatedBondAmount).to.equal(amount - slashAmount);
    });

    it('should only be executed by the bond manager', async function () {
      await expect(
        bondManager.connect(accounts[3]).slash(0, 10)
      ).to.be.revertedWith('Caller is not the bridge contract');
    });

    it('should revert if tokenIndex is invalid', async function () {
      const tokenIndex = 3;
      await expect(
        // bondManager.connect(accounts[0]).slash(tokenIndex, 10)
        bridge.slashForBondManagerTest(bondManager.address, tokenIndex, 10)
      ).to.be.revertedWith("Invalid token index");
    })
  });

});



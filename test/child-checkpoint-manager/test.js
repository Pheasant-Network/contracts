const { expect, assert } = require("chai");
const { ethers } = require("hardhat");

describe("ChildCheckpointManager", function () {

  let accounts;
  let testCheckpointManager;
  let polygonChildCheckpointManager;
  let optimismChildCheckpointManager;
  let arbitrumChildCheckpointManager;

  const updatePeriod = 60 * 60 * 3

  before(async () => {
    accounts =  await ethers.getSigners();
  });

  beforeEach(async () => {

    const TestCheckpointManager = await hre.ethers.getContractFactory("TestCheckpointManager");

    testCheckpointManager = await TestCheckpointManager
      .connect(accounts[0])
      .deploy();

    const PolygonChildCheckpointManager = await hre.ethers.getContractFactory("PolygonChildCheckpointManager");

    polygonChildCheckpointManager = await PolygonChildCheckpointManager
      .connect(accounts[0])
      .deploy(
        accounts[0].address,
        accounts[0].address,
        accounts[0].address,
      );

    const OptimismChildCheckpointManager = await hre.ethers.getContractFactory("OptimismChildCheckpointManager");

    optimismChildCheckpointManager = await OptimismChildCheckpointManager
      .connect(accounts[0])
      .deploy(
        testCheckpointManager.address,
        accounts[0].address,
        testCheckpointManager.address
      );

    const ArbitrumChildCheckpointManager = await hre.ethers.getContractFactory("ArbitrumChildCheckpointManager");

    arbitrumChildCheckpointManager = await ArbitrumChildCheckpointManager
      .connect(accounts[0])
      .deploy(
        testCheckpointManager.address,
        accounts[0].address
      );
  });

  describe("PolygonChildCheckpointManager", () => {

    describe("deployment", () => {

    });

    describe("update function", () => {

      it("executeRootCheckpointManagerUpdate", async function () {
        const newRootCheckpointManager = accounts[1].address;
        const block = await ethers.provider.getBlock('latest');
        const blockTimestamp = block.timestamp

        await polygonChildCheckpointManager.connect(accounts[0]).executeRootCheckpointManagerUpdate(newRootCheckpointManager);

        const { executeAfter, newRootCheckpointManager: rootCheckpointManager }
          = await polygonChildCheckpointManager.connect(accounts[0]).rootCheckpointManagerUpdate();

        assert.equal(rootCheckpointManager, newRootCheckpointManager);
        assert.equal(executeAfter, blockTimestamp + updatePeriod + 1);
      });

      it("executeRootCheckpointManagerUpdate should revert when called other than owner", async function () {
        await expect(
          polygonChildCheckpointManager.connect(accounts[1]).executeRootCheckpointManagerUpdate(accounts[1].address)
        ).to.be.revertedWith("UNAUTHORIZED");
      });

      it("executeRootCheckpointManagerUpdate should revert when called with 0x0", async function () {
        await expect(
          polygonChildCheckpointManager.connect(accounts[0]).executeRootCheckpointManagerUpdate(ethers.constants.AddressZero)
        ).to.be.revertedWith("PolygonChildCheckpointManager: INVALID_ROOT_CHECKPOINT_MANAGER");
      });

      it("finalizeUpdateRootCheckpointManager", async function () {
        const newRootCheckpointManager = accounts[1].address;

        await polygonChildCheckpointManager.connect(accounts[0]).executeRootCheckpointManagerUpdate(newRootCheckpointManager);

        await ethers.provider.send('evm_increaseTime', [updatePeriod]);
        await ethers.provider.send('evm_mine');

        await polygonChildCheckpointManager.connect(accounts[0]).finalizeUpdateRootCheckpointManager();

        const rootCheckpointManager = await polygonChildCheckpointManager.fxRootTunnel()
        assert.equal(rootCheckpointManager, newRootCheckpointManager);
      });

      it("finalizeUpdateRootCheckpointManager should revert if called within update period", async function () {
        const newRootCheckpointManager = accounts[1].address;

        await polygonChildCheckpointManager.connect(accounts[0]).executeRootCheckpointManagerUpdate(newRootCheckpointManager);

        await ethers.provider.send('evm_increaseTime', [60 * 60 * 2]);
        await ethers.provider.send('evm_mine');

        await expect(
          polygonChildCheckpointManager.connect(accounts[0]).finalizeUpdateRootCheckpointManager()
        ).to.be.revertedWith("Ongoing update period");
      });

    });

    describe("ProcessMessageFromRoot", () => {
      it("_processMessageFromRoot", async () => {
        const destCode = 1001;
        const blockNumber = 100;
        const blockHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("blockHash"));

        const message = getEncodedData(destCode, blockNumber, blockHash);
        await polygonChildCheckpointManager.processMessageFromRoot(
          0,
          accounts[0].address,
          message
        );

        assert.equal(
          await polygonChildCheckpointManager.getBlockHash(destCode, blockNumber),
          blockHash
        );
      });

      it("_processMessageFromRoot should revert if called other than checkpoint manager", async () => {
        await expect(
          polygonChildCheckpointManager.connect(accounts[2]).processMessageFromRoot(
            0,
            accounts[0].address,
            "0x"
          )
        ).to.be.revertedWith("FxBaseChildTunnel: INVALID_SENDER");
      });

      it("_processMessageFromRoot should revert if blockhash is 0x..", async () => {
        const destCode = 1001;
        const blockNumber = 100;
        const blockHash = ethers.constants.HashZero;

        const message = getEncodedData(destCode, blockNumber, blockHash);
        await expect(
          polygonChildCheckpointManager.processMessageFromRoot(
            0,
            accounts[0].address,
            message
          )
        ).to.be.revertedWith("PolygonChildCheckpointManager: INVALID_BLOCKHASH");
      });
    });
  })

  describe("OptimismChildCheckpointManager", () => {

    describe("deployment", () => {
      it("should revert if checkpoint manager is 0x0", async () => {
        const OptimismChildCheckpointManager = await hre.ethers.getContractFactory("OptimismChildCheckpointManager");

        await expect(
          OptimismChildCheckpointManager
            .connect(accounts[0])
            .deploy(
              ethers.constants.AddressZero,
              accounts[0].address,
              ethers.constants.AddressZero
            )
        ).to.be.revertedWith("CoreChildCheckpointManager: INVALID_ROOT_CHECKPOINT_MANAGER");
      });

      it("should revert if l2CrossDomainMessenger is 0x0", async () => {
        const OptimismChildCheckpointManager = await hre.ethers.getContractFactory("OptimismChildCheckpointManager");

        await expect(
          OptimismChildCheckpointManager
            .connect(accounts[0])
            .deploy(
              testCheckpointManager.address,
              accounts[0].address,
              ethers.constants.AddressZero
            )
        ).to.be.revertedWith("OptimismChildCheckpointManager: INVALID_L2_CROSS_DOMAIN_MESSENGER");
      });
    });

    describe("update function", () => {

      it("executeRootCheckpointManagerUpdate", async function () {
        const newRootCheckpointManager = accounts[1].address;
        const block = await ethers.provider.getBlock('latest');
        const blockTimestamp = block.timestamp

        await optimismChildCheckpointManager.connect(accounts[0]).executeRootCheckpointManagerUpdate(newRootCheckpointManager);

        const { executeAfter, newRootCheckpointManager: rootCheckpointManager }
          = await optimismChildCheckpointManager.connect(accounts[0]).rootCheckpointManagerUpdate();

        assert.equal(rootCheckpointManager, newRootCheckpointManager);
        assert.equal(executeAfter, blockTimestamp + updatePeriod + 1);
      });

      it("executeRootCheckpointManagerUpdate sould revert when called other than owner", async function () {
        await expect(
          optimismChildCheckpointManager.connect(accounts[1]).executeRootCheckpointManagerUpdate(accounts[1].address)
        ).to.be.revertedWith("UNAUTHORIZED");
      });

      it("executeRootCheckpointManagerUpdate should revert when called with 0x0", async function () {
        await expect(
          optimismChildCheckpointManager.connect(accounts[0]).executeRootCheckpointManagerUpdate(ethers.constants.AddressZero)
        ).to.be.revertedWith("CoreChildCheckpointManager: INVALID_ROOT_CHECKPOINT_MANAGER");
      });

      it("finalizeUpdateRootCheckpointManager", async function () {
        const newRootCheckpointManager = accounts[1].address;

        await optimismChildCheckpointManager.connect(accounts[0]).executeRootCheckpointManagerUpdate(newRootCheckpointManager);

        await ethers.provider.send('evm_increaseTime', [updatePeriod]);
        await ethers.provider.send('evm_mine');

        await optimismChildCheckpointManager.connect(accounts[0]).finalizeUpdateRootCheckpointManager();

        const rootCheckpointManager = await optimismChildCheckpointManager.rootCheckpointManager()
        assert.equal(rootCheckpointManager, newRootCheckpointManager);
      });

      it("finalizeUpdateRootCheckpointManager should revert if called within update period", async function () {
        const newRootCheckpointManager = accounts[1].address;

        await optimismChildCheckpointManager.connect(accounts[0]).executeRootCheckpointManagerUpdate(newRootCheckpointManager);

        await ethers.provider.send('evm_increaseTime', [60 * 60 * 2]);
        await ethers.provider.send('evm_mine');

        await expect(
          optimismChildCheckpointManager.connect(accounts[0]).finalizeUpdateRootCheckpointManager()
        ).to.be.revertedWith("Ongoing update period");
      });

    });

    describe("ProcessMessageFromRoot", () => {
      it("_processMessageFromRoot", async () => {
        const destCode = 1001;
        const blockNumber = 100;
        const blockHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("blockHash"));

        const message = getFunctionData(destCode, blockNumber, blockHash);
        await testCheckpointManager.functionCall(
          optimismChildCheckpointManager.address,
          message,
          0
        );

        assert.equal(
          await optimismChildCheckpointManager.getBlockHash(destCode, blockNumber),
          blockHash
        );
      });

      it("_processMessageFromRoot should revert if called other than checkpoint manager", async () => {
        await expect(
          optimismChildCheckpointManager._processMessageFromRoot("0x")
        ).to.be.revertedWith("CrossDomainMessage: INVALID_SENDER_FROM_ROOT");
      });

      it("_processMessageFromRoot should revert if blockhash is 0x..", async () => {
        const destCode = 1001;
        const blockNumber = 100;
        const blockHash = ethers.constants.HashZero;

        const message = getFunctionData(destCode, blockNumber, blockHash);

        await expect(
          testCheckpointManager.functionCall(
            optimismChildCheckpointManager.address,
            message,
            0
          )
        ).to.be.revertedWith("OptimismChildCheckpointManager: INVALID_BLOCKHASH");
      });
    });
  })

  describe("ArbitrumChildCheckpointManager", () => {

    describe("deployment", () => {
      it("should revert if root checkpoint manager is 0x0", async () => {
        const ArbitrumChildCheckpointManager = await ethers.getContractFactory("ArbitrumChildCheckpointManager");

        await expect(
          ArbitrumChildCheckpointManager.deploy(ethers.constants.AddressZero, accounts[0].address)
        ).to.be.revertedWith("CoreChildCheckpointManager: INVALID_ROOT_CHECKPOINT_MANAGER");
      });
    });

    describe("update function", () => {

      it("executeRootCheckpointManagerUpdate", async function () {
        const newRootCheckpointManager = accounts[1].address;
        const block = await ethers.provider.getBlock('latest');
        const blockTimestamp = block.timestamp

        await arbitrumChildCheckpointManager.connect(accounts[0]).executeRootCheckpointManagerUpdate(newRootCheckpointManager);

        const { executeAfter, newRootCheckpointManager: rootCheckpointManager }
          = await arbitrumChildCheckpointManager.connect(accounts[0]).rootCheckpointManagerUpdate();

        assert.equal(rootCheckpointManager, newRootCheckpointManager);
        assert.equal(executeAfter, blockTimestamp + updatePeriod + 1);
      });

      it("executeRootCheckpointManagerUpdate should revert when called other than owner", async function () {
        await expect(
          arbitrumChildCheckpointManager.connect(accounts[1]).executeRootCheckpointManagerUpdate(accounts[1].address)
        ).to.be.revertedWith("UNAUTHORIZED");
      });

      it("executeRootCheckpointManagerUpdate should revert when called with 0x0", async function () {
        await expect(
          arbitrumChildCheckpointManager.connect(accounts[0]).executeRootCheckpointManagerUpdate(ethers.constants.AddressZero)
        ).to.be.revertedWith("CoreChildCheckpointManager: INVALID_ROOT_CHECKPOINT_MANAGER");
      });

      it("finalizeUpdateRootCheckpointManager", async function () {
        const newRootCheckpointManager = accounts[1].address;

        await arbitrumChildCheckpointManager.connect(accounts[0]).executeRootCheckpointManagerUpdate(newRootCheckpointManager);

        await ethers.provider.send('evm_increaseTime', [updatePeriod]);
        await ethers.provider.send('evm_mine');

        await arbitrumChildCheckpointManager.connect(accounts[0]).finalizeUpdateRootCheckpointManager();

        const rootCheckpointManager = await arbitrumChildCheckpointManager.rootCheckpointManager()
        assert.equal(rootCheckpointManager, newRootCheckpointManager);
      });

      it("finalizeUpdateRootCheckpointManager should revert if called within update period", async function () {
        const newRootCheckpointManager = accounts[1].address;

        await arbitrumChildCheckpointManager.connect(accounts[0]).executeRootCheckpointManagerUpdate(newRootCheckpointManager);

        await ethers.provider.send('evm_increaseTime', [60 * 60 * 2]);
        await ethers.provider.send('evm_mine');

        await expect(
          arbitrumChildCheckpointManager.connect(accounts[0]).finalizeUpdateRootCheckpointManager()
        ).to.be.revertedWith("Ongoing update period");
      });

    });

    describe("ProcessMessageFromRoot", () => {
      // arbitrum does not support address aliasing test in hardhat
    });
  })

});

const getEncodedData = (destCode, blockNumber, blockHash) => {
  const RECEIVE_BLOCK_INFO = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ReceiveBlockInfo"));

  const abi = new ethers.utils.AbiCoder();
  const encodedData = abi.encode(
    ["bytes32", "bytes"],
    [
      RECEIVE_BLOCK_INFO,
      abi.encode(
        ["uint256", "uint256", "bytes32"],
        [destCode, blockNumber, blockHash]
      )
    ]
  );
  return encodedData;
}

const getFunctionData = (destCode, blockNumber, blockHash) => {
  const encodedData = getEncodedData(destCode, blockNumber, blockHash);

  const iface = new ethers.utils.Interface([
    "function _processMessageFromRoot(bytes _data)"
  ]);
  const functionData = iface.encodeFunctionData("_processMessageFromRoot", [encodedData]);
  return functionData;
}

/* global describe it before ethers */

const {
  getSelectors,
  FacetCutAction,
  removeSelectors,
  findAddressPositionInFacets
} = require('../../scripts/libraries/diamond.js')

const { deployDiamond } = require('../../scripts/deployDiamond.js')

const { assert, expect } = require('chai')

describe('DiamondTest', async function () {
  let diamondAddress
  let diamondCutFacet
  let diamondLoupeFacet
  let ownershipFacet
  let tx
  let receipt
  let result
  const addresses = []

  let destCode = 1002
  let accounts
  let arbitrumRootCheckpointManager
  let inbox

  let optimismRootCheckpointManager
  let l1CrossDomainMessenger

  let polygonRootCheckpointManager
  let fxRoot

  before(async function () {
    diamondAddress = await deployDiamond()
    diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', diamondAddress)
    diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamondAddress)
    ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress)

    accounts = await ethers.getSigners();
    const TestCheckpointManager = await ethers.getContractFactory('TestCheckpointManager');
    testCheckpointManager = await TestCheckpointManager.deploy();
    await testCheckpointManager.deployed();
  })

  describe('Test from diamond-1-hardhat', async function () {
    it('should have three facets -- call to facetAddresses function', async () => {
      for (const address of await diamondLoupeFacet.facetAddresses()) {
        addresses.push(address)
      }

      assert.equal(addresses.length, 3)
    })

    it('facets should have the right function selectors -- call to facetFunctionSelectors function', async () => {
      let selectors = getSelectors(diamondCutFacet)
      result = await diamondLoupeFacet.facetFunctionSelectors(addresses[0])
      assert.sameMembers(result, selectors)
      selectors = getSelectors(diamondLoupeFacet)
      result = await diamondLoupeFacet.facetFunctionSelectors(addresses[1])
      assert.sameMembers(result, selectors)
      selectors = getSelectors(ownershipFacet)
      result = await diamondLoupeFacet.facetFunctionSelectors(addresses[2])
      assert.sameMembers(result, selectors)
    })

    it('selectors should be associated to facets correctly -- multiple calls to facetAddress function', async () => {
      assert.equal(
        addresses[0],
        await diamondLoupeFacet.facetAddress('0x1f931c1c')
      )
      assert.equal(
        addresses[1],
        await diamondLoupeFacet.facetAddress('0xcdffacc6')
      )
      assert.equal(
        addresses[1],
        await diamondLoupeFacet.facetAddress('0x01ffc9a7')
      )
      assert.equal(
        addresses[2],
        await diamondLoupeFacet.facetAddress('0xf2fde38b')
      )
    })

    it('should add test1 functions', async () => {
      const Test1Facet = await ethers.getContractFactory('Test1Facet')
      const test1Facet = await Test1Facet.deploy()
      await test1Facet.deployed()
      addresses.push(test1Facet.address)
      const selectors = getSelectors(test1Facet).remove(['supportsInterface(bytes4)'])
      tx = await diamondCutFacet.diamondCut(
        [{
          facetAddress: test1Facet.address,
          action: FacetCutAction.Add,
          functionSelectors: selectors
        }],
        ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
      receipt = await tx.wait()
      if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
      }
      result = await diamondLoupeFacet.facetFunctionSelectors(test1Facet.address)
      assert.sameMembers(result, selectors)
    })

    it('should test function call', async () => {
      const test1Facet = await ethers.getContractAt('Test1Facet', diamondAddress)
      await test1Facet.test1Func10()
    })

    it('should replace supportsInterface function', async () => {
      const Test1Facet = await ethers.getContractFactory('Test1Facet')
      const selectors = getSelectors(Test1Facet).get(['supportsInterface(bytes4)'])
      const testFacetAddress = addresses[3]
      tx = await diamondCutFacet.diamondCut(
        [{
          facetAddress: testFacetAddress,
          action: FacetCutAction.Replace,
          functionSelectors: selectors
        }],
        ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
      receipt = await tx.wait()
      if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
      }
      result = await diamondLoupeFacet.facetFunctionSelectors(testFacetAddress)
      assert.sameMembers(result, getSelectors(Test1Facet))
    })

    it('should add test2 functions', async () => {
      const Test2Facet = await ethers.getContractFactory('Test2Facet')
      const test2Facet = await Test2Facet.deploy()
      await test2Facet.deployed()
      addresses.push(test2Facet.address)
      const selectors = getSelectors(test2Facet)
      tx = await diamondCutFacet.diamondCut(
        [{
          facetAddress: test2Facet.address,
          action: FacetCutAction.Add,
          functionSelectors: selectors
        }],
        ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
      receipt = await tx.wait()
      if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
      }
      result = await diamondLoupeFacet.facetFunctionSelectors(test2Facet.address)
      assert.sameMembers(result, selectors)
    })

    it('should remove some test2 functions', async () => {
      const test2Facet = await ethers.getContractAt('Test2Facet', diamondAddress)
      const functionsToKeep = ['test2Func1()', 'test2Func5()', 'test2Func6()', 'test2Func19()', 'test2Func20()']
      const selectors = getSelectors(test2Facet).remove(functionsToKeep)
      tx = await diamondCutFacet.diamondCut(
        [{
          facetAddress: ethers.constants.AddressZero,
          action: FacetCutAction.Remove,
          functionSelectors: selectors
        }],
        ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
      receipt = await tx.wait()
      if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
      }
      result = await diamondLoupeFacet.facetFunctionSelectors(addresses[4])
      assert.sameMembers(result, getSelectors(test2Facet).get(functionsToKeep))
    })

    it('should remove some test1 functions', async () => {
      const test1Facet = await ethers.getContractAt('Test1Facet', diamondAddress)
      const functionsToKeep = ['test1Func2()', 'test1Func11()', 'test1Func12()']
      const selectors = getSelectors(test1Facet).remove(functionsToKeep)
      tx = await diamondCutFacet.diamondCut(
        [{
          facetAddress: ethers.constants.AddressZero,
          action: FacetCutAction.Remove,
          functionSelectors: selectors
        }],
        ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
      receipt = await tx.wait()
      if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
      }
      result = await diamondLoupeFacet.facetFunctionSelectors(addresses[3])
      assert.sameMembers(result, getSelectors(test1Facet).get(functionsToKeep))
    })

    it('remove all functions and facets accept \'diamondCut\' and \'facets\'', async () => {
      let selectors = []
      let facets = await diamondLoupeFacet.facets()
      for (let i = 0; i < facets.length; i++) {
        selectors.push(...facets[i].functionSelectors)
      }
      selectors = removeSelectors(selectors, ['facets()', 'diamondCut(tuple(address,uint8,bytes4[])[],address,bytes)'])
      tx = await diamondCutFacet.diamondCut(
        [{
          facetAddress: ethers.constants.AddressZero,
          action: FacetCutAction.Remove,
          functionSelectors: selectors
        }],
        ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
      receipt = await tx.wait()
      if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
      }
      facets = await diamondLoupeFacet.facets()
      assert.equal(facets.length, 2)
      assert.equal(facets[0][0], addresses[0])
      assert.sameMembers(facets[0][1], ['0x1f931c1c'])
      assert.equal(facets[1][0], addresses[1])
      assert.sameMembers(facets[1][1], ['0x7a0ed627'])
    })

    it('add most functions and facets', async () => {
      const diamondLoupeFacetSelectors = getSelectors(diamondLoupeFacet).remove(['supportsInterface(bytes4)'])
      const Test1Facet = await ethers.getContractFactory('Test1Facet')
      const Test2Facet = await ethers.getContractFactory('Test2Facet')
      // Any number of functions from any number of facets can be added/replaced/removed in a
      // single transaction
      const cut = [
        {
          facetAddress: addresses[1],
          action: FacetCutAction.Add,
          functionSelectors: diamondLoupeFacetSelectors.remove(['facets()'])
        },
        {
          facetAddress: addresses[2],
          action: FacetCutAction.Add,
          functionSelectors: getSelectors(ownershipFacet)
        },
        {
          facetAddress: addresses[3],
          action: FacetCutAction.Add,
          functionSelectors: getSelectors(Test1Facet)
        },
        {
          facetAddress: addresses[4],
          action: FacetCutAction.Add,
          functionSelectors: getSelectors(Test2Facet)
        }
      ]
      tx = await diamondCutFacet.diamondCut(cut, ethers.constants.AddressZero, '0x', { gasLimit: 8000000 })
      receipt = await tx.wait()
      if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
      }
      const facets = await diamondLoupeFacet.facets()
      const facetAddresses = await diamondLoupeFacet.facetAddresses()
      assert.equal(facetAddresses.length, 5)
      assert.equal(facets.length, 5)
      assert.sameMembers(facetAddresses, addresses)
      assert.equal(facets[0][0], facetAddresses[0], 'first facet')
      assert.equal(facets[1][0], facetAddresses[1], 'second facet')
      assert.equal(facets[2][0], facetAddresses[2], 'third facet')
      assert.equal(facets[3][0], facetAddresses[3], 'fourth facet')
      assert.equal(facets[4][0], facetAddresses[4], 'fifth facet')
      assert.sameMembers(facets[findAddressPositionInFacets(addresses[0], facets)][1], getSelectors(diamondCutFacet))
      assert.sameMembers(facets[findAddressPositionInFacets(addresses[1], facets)][1], diamondLoupeFacetSelectors)
      assert.sameMembers(facets[findAddressPositionInFacets(addresses[2], facets)][1], getSelectors(ownershipFacet))
      assert.sameMembers(facets[findAddressPositionInFacets(addresses[3], facets)][1], getSelectors(Test1Facet))
      assert.sameMembers(facets[findAddressPositionInFacets(addresses[4], facets)][1], getSelectors(Test2Facet))
    })
  });

  describe('diamondCut', () => {
    it("should revert if diamondCut is called by non-owner", async () => {

      const ArbitrumRootCheckpointManager = await ethers.getContractFactory('ArbitrumRootCheckpointManager')
      arbitrumRootCheckpointManager = await ArbitrumRootCheckpointManager.deploy()
      await arbitrumRootCheckpointManager.deployed()

      let initCall = arbitrumRootCheckpointManager.interface.encodeFunctionData(
        "arbitrumInit",
        [accounts[0].address, testCheckpointManager.address] // childCheckpointManager, inbox(use test contract as inbox)
      );
      const selectors = getSelectors(arbitrumRootCheckpointManager);

      await expect(
        diamondCutFacet.connect(accounts[2]).diamondCut(
          [{
            facetAddress: arbitrumRootCheckpointManager.address,
            action: FacetCutAction.Add,
            functionSelectors: selectors
          }],
          arbitrumRootCheckpointManager.address, initCall, { gasLimit: 800000 }
        )
      ).to.be.revertedWithCustomError(
        diamondCutFacet,
        'NotContractOwner'
      )
    });
  });

  describe('ArbitrumRootCheckpointManager', () => {
    before(async () => {
      inbox = testCheckpointManager.address;

      const ArbitrumRootCheckpointManager = await ethers.getContractFactory('ArbitrumRootCheckpointManager')
      arbitrumRootCheckpointManager = await ArbitrumRootCheckpointManager.deploy()
      await arbitrumRootCheckpointManager.deployed()

      addresses.push(arbitrumRootCheckpointManager.address);

      let initCall = arbitrumRootCheckpointManager.interface.encodeFunctionData(
        "arbitrumInit",
        [accounts[0].address, testCheckpointManager.address] // childCheckpointManager, inbox(use test contract as inbox)
      );

      const selectors = getSelectors(arbitrumRootCheckpointManager);
      tx = await diamondCutFacet.diamondCut(
        [{
          facetAddress: arbitrumRootCheckpointManager.address,
          action: FacetCutAction.Add,
          functionSelectors: selectors
        }],
        arbitrumRootCheckpointManager.address,
        initCall,
        { gasLimit: 800000 }
      );

      if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
      }
    });

    describe('arbitrumInit', () => {
      it('should revert if childCheckpointManager is zero address', async () => {
        const ArbitrumRootCheckpointManager = await ethers.getContractFactory('ArbitrumRootCheckpointManager')
        const tempArbitrumRootCheckpointManager = await ArbitrumRootCheckpointManager.deploy()
        await tempArbitrumRootCheckpointManager.deployed()

        await expect(
          tempArbitrumRootCheckpointManager.arbitrumInit(
            ethers.constants.AddressZero,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith(
          'ArbitrumRootCheckpointManager: INVALID_CHILD_CHECKPOINT_MANAGER'
        );
      });

      it('should revert if inbox is zero address', async () => {
        const ArbitrumRootCheckpointManager = await ethers.getContractFactory('ArbitrumRootCheckpointManager')
        const tempArbitrumRootCheckpointManager = await ArbitrumRootCheckpointManager.deploy()
        await tempArbitrumRootCheckpointManager.deployed()

        await expect(
          tempArbitrumRootCheckpointManager.arbitrumInit(
            accounts[0].address, ethers.constants.AddressZero // childCheckpointManager, inbox(use test contract as inbox)
          )
        ).to.be.revertedWith(
          'ArbitrumRootCheckpointManager: INVALID_INBOX'
        )
      });
    });

    it('should have correct function selectors', async () => {
      result = await diamondLoupeFacet.facetFunctionSelectors(arbitrumRootCheckpointManager.address);
      assert.sameMembers(result, getSelectors(arbitrumRootCheckpointManager));
    });

    it('should have correct childCheckpointManager and inbox address', async () => {
      const childCheckpointManager = accounts[0].address;

      diamond = await ethers.getContractAt('ArbitrumRootCheckpointManager', diamondAddress);

      const state = await diamond.getArbitrumState();
      assert.equal(await state[0], childCheckpointManager);
      assert.equal(await state[1], inbox);
    });

    it('should sendBlockInfo', async () => {

      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const message = await testCheckpointManager.getMessage(destCode, blockNumber, block.hash);
      const maxGas = 100;
      const gasPriceBid = 10;

      diamond = await ethers.getContractAt('ArbitrumRootCheckpointManager', diamondAddress);

      expect(
        await diamond.arbitrumSendBlockInfo(
          destCode,
          blockNumber,
          maxGas,
          gasPriceBid,
          { value: 100000 }
        )
      ).to.emit(diamond, 'BlockInfoSent')
        .withArgs(blockNumber);

      const data = await testCheckpointManager.createRetryableTicketData();
      const savedBlockhash = await diamond.getArbitrumBlockhash(blockNumber);

      assert.equal(savedBlockhash, block.hash);
      assert.equal(data.to, accounts[0].address);
      // assert.equal(
      //   data.maxSubmissionCost,
      //   await testCheckpointManager.calculateRetryableSubmissionFee(message.length/2 - 1, 0)
      // );
      assert.equal(data.excessFeeRefundAddress, accounts[0].address);
      assert.equal(data.callValueRefundAddress, accounts[0].address);
      assert.equal(data.gasLimit, maxGas);
      assert.equal(data.maxFeePerGas, gasPriceBid);
      assert.equal(data.data, message);
    })
  });

  describe('OptimismChildCheckpointManager', () => {
    before(async () => {
      l1CrossDomainMessenger = testCheckpointManager.address;

      const OptimismRootCheckpointManager = await ethers.getContractFactory('OptimismRootCheckpointManager')
      optimismRootCheckpointManager = await OptimismRootCheckpointManager.deploy()
      await optimismRootCheckpointManager.deployed()

      addresses.push(optimismRootCheckpointManager.address);

      let initCall = optimismRootCheckpointManager.interface.encodeFunctionData(
        "optimismInit",
        [accounts[0].address, l1CrossDomainMessenger] // childCheckpointManager, l1CrossDomainMessenger(use test contract as l1CrossDomainMessenger)
      );

      const selectors = getSelectors(optimismRootCheckpointManager);
      tx = await diamondCutFacet.diamondCut(
        [{
          facetAddress: optimismRootCheckpointManager.address,
          action: FacetCutAction.Add,
          functionSelectors: selectors
        }],
        optimismRootCheckpointManager.address,
        initCall,
        { gasLimit: 800000 }
      );

      if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
      }
    });

    describe('optimismInit', () => {
      it('should revert if childCheckpointManager is zero address', async () => {
        const OptimismRootCheckpointManager = await ethers.getContractFactory('OptimismRootCheckpointManager')
        const tempOptimismRootCheckpointManager = await OptimismRootCheckpointManager.deploy()
        await tempOptimismRootCheckpointManager.deployed()

        await expect(
          tempOptimismRootCheckpointManager.optimismInit(
            ethers.constants.AddressZero,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith(
          'OptimismRootCheckpointManager: INVALID_CHILD_CHECKPOINT_MANAGER'
        );
      });

      it('should revert if l1CrossDomainMessenger is zero address', async () => {
        const OptimismRootCheckpointManager = await ethers.getContractFactory('OptimismRootCheckpointManager')
        const tempOptimismRootCheckpointManager = await OptimismRootCheckpointManager.deploy()
        await tempOptimismRootCheckpointManager.deployed()

        await expect(
          tempOptimismRootCheckpointManager.optimismInit(
            accounts[0].address, ethers.constants.AddressZero // childCheckpointManager, l1CrossDomainMessenger(use test contract as l1CrossDomainMessenger)
          )
        ).to.be.revertedWith(
          'OptimismRootCheckpointManager: INVALID_L1_CROSS_DOMAIN_MESSENGER'
        )
      });
    });

    it('should have correct function selectors', async () => {
      result = await diamondLoupeFacet.facetFunctionSelectors(optimismRootCheckpointManager.address);
      assert.sameMembers(result, getSelectors(optimismRootCheckpointManager));
    });

    it('should have correct childCheckpointManager and l1CrossDomainMessenger address', async () => {
      const childCheckpointManager = accounts[0].address;

      const diamond = await ethers.getContractAt('OptimismRootCheckpointManager', diamondAddress);

      const state = await diamond.getOptimismState();
      assert.equal(await state[0], childCheckpointManager);
      assert.equal(await state[1], l1CrossDomainMessenger);
    });

    it('should sendBlockInfo', async () => {

      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const message = await testCheckpointManager.getMessage(destCode, blockNumber, block.hash);
      const gasLimit = 100;

      const diamond = await ethers.getContractAt('OptimismRootCheckpointManager', diamondAddress);

      expect(
        await diamond.optimismSendBlockInfo(
          destCode,
          blockNumber,
          gasLimit
        )
      ).to.emit(diamond, 'BlockInfoSent')
        .withArgs(blockNumber);

      const data = await testCheckpointManager.sendMessageData();
      const savedBlockhash = await diamond.getOptimismBlockhash(blockNumber);

      assert.equal(savedBlockhash, block.hash);
      assert.equal(data.childCheckpointManager, accounts[0].address);
      assert.equal(data.message, message);
      assert.equal(data.gasLimit, gasLimit);
    })

  });

  describe('PolygonChildCheckpointManager', () => {
    before(async () => {
      fxRoot = testCheckpointManager.address;

      const PolygonRootCheckpointManager = await ethers.getContractFactory('PolygonRootCheckpointManager')
      polygonRootCheckpointManager = await PolygonRootCheckpointManager.deploy()
      await polygonRootCheckpointManager.deployed()

      addresses.push(polygonRootCheckpointManager.address);

      let initCall = polygonRootCheckpointManager.interface.encodeFunctionData(
        "polygonInit",
        [accounts[0].address, fxRoot] // childCheckpointManager, fxRoot(use test contract as fxRoot)
      );

      const selectors = getSelectors(polygonRootCheckpointManager);
      tx = await diamondCutFacet.diamondCut(
        [{
          facetAddress: polygonRootCheckpointManager.address,
          action: FacetCutAction.Add,
          functionSelectors: selectors
        }],
        polygonRootCheckpointManager.address,
        initCall,
        { gasLimit: 800000 }
      );

      if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
      }
    });

    describe('polygonInit', () => {
      it('should revert if childCheckpointManager is zero address', async () => {
        const PolygonRootCheckpointManager = await ethers.getContractFactory('PolygonRootCheckpointManager')
        const tempPolygonRootCheckpointManager = await PolygonRootCheckpointManager.deploy()
        await tempPolygonRootCheckpointManager.deployed()

        await expect(
          tempPolygonRootCheckpointManager.polygonInit(
            ethers.constants.AddressZero,
            fxRoot
          )
        ).to.be.revertedWith("PolygonRootCheckpointManager: INVALID_CHILD_CHECKPOINT_MANAGER");

      });

      it('should revert if fxRoot is zero address', async () => {
        const PolygonRootCheckpointManager = await ethers.getContractFactory('PolygonRootCheckpointManager')
        const tempPolygonRootCheckpointManager = await PolygonRootCheckpointManager.deploy()
        await tempPolygonRootCheckpointManager.deployed()

        await expect(
          tempPolygonRootCheckpointManager.polygonInit(
            accounts[0].address,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("PolygonRootCheckpointManager: INVALID_FX_ROOT");
      });
    });

    it('should have correct function selectors', async () => {
      result = await diamondLoupeFacet.facetFunctionSelectors(polygonRootCheckpointManager.address);
      assert.sameMembers(result, getSelectors(polygonRootCheckpointManager));
    });

    it('should have correct childCheckpointManager and fxRoot address', async () => {
      const childCheckpointManager = accounts[0].address;

      const diamond = await ethers.getContractAt('PolygonRootCheckpointManager', diamondAddress);

      const state = await diamond.getPolygonState();
      assert.equal(await state[0], childCheckpointManager);
      assert.equal(await state[1], fxRoot);
    });

    it('should sendBlockInfo', async () => {
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const message = await testCheckpointManager.getPolygonMessage(destCode, blockNumber, block.hash);

      const diamond = await ethers.getContractAt('PolygonRootCheckpointManager', diamondAddress);

      expect(
        await diamond.polygonSendBlockInfo(
          destCode,
          blockNumber
        )
      ).to.emit(diamond, 'BlockInfoSent')
        .withArgs(blockNumber);

      const data = await testCheckpointManager.sendMessageToChildData();
      const savedBlockhash = await diamond.getPolygonBlockhash(blockNumber);

      assert.equal(savedBlockhash, block.hash);
      assert.equal(data.childCheckpointManager, accounts[0].address);
      assert.equal(data.message, message);
    })

  });
})

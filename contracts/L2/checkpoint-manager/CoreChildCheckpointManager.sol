//SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "solmate/src/auth/Owned.sol";

contract CoreChildCheckpointManager is Owned {

  address public rootCheckpointManager;
  bytes32 constant RECEIVE_BLOCK_INFO = keccak256("ReceiveBlockInfo");
  uint256 constant UPDATE_PERIOD = 3 hours;

  mapping(uint256 => mapping(uint256 => bytes32)) internal blockHashs;

  struct RootCheckpointManagerUpdate {
      uint64 executeAfter;
      address newRootCheckpointManager;
  }
  RootCheckpointManagerUpdate public rootCheckpointManagerUpdate;

  constructor(
    address _rootCheckpointManager, 
    address _newOwner
  ) Owned(_newOwner) {
    require(_rootCheckpointManager != address(0x0), "CoreChildCheckpointManager: INVALID_ROOT_CHECKPOINT_MANAGER");
    rootCheckpointManager = _rootCheckpointManager;
  }

  function getBlockHash(uint256 _destCode, uint256 _blockNumber) external view returns (bytes32) {
      return blockHashs[_destCode][_blockNumber];
  }

  function executeRootCheckpointManagerUpdate(address _newRootCheckpointManager) external onlyOwner {
      require(_newRootCheckpointManager != address(0x0), "CoreChildCheckpointManager: INVALID_ROOT_CHECKPOINT_MANAGER");
      rootCheckpointManagerUpdate = RootCheckpointManagerUpdate(uint64(block.timestamp + UPDATE_PERIOD), _newRootCheckpointManager);
  }

  function finalizeUpdateRootCheckpointManager() external {
      require(uint64(block.timestamp) > rootCheckpointManagerUpdate.executeAfter &&  rootCheckpointManagerUpdate.executeAfter != 0, "Ongoing update period");
      rootCheckpointManager = rootCheckpointManagerUpdate.newRootCheckpointManager;
      delete rootCheckpointManagerUpdate;
  }
}
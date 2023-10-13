// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "solmate/src/auth/Owned.sol";
import {FxBaseChildTunnel} from "../fx-portal/contracts/tunnel/FxBaseChildTunnel.sol";

contract PolygonChildCheckpointManager is FxBaseChildTunnel, Owned {
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
        address _newOwner, 
        address _fxChild
    ) Owned(_newOwner) FxBaseChildTunnel(_fxChild) {
        fxRootTunnel = _rootCheckpointManager;
    }

    function _processMessageFromRoot(
        uint256, /* stateId */
        address sender,
        bytes memory data
    ) internal override validateSender(sender) {
        // decode incoming data
        (bytes32 syncType, bytes memory syncData) = abi.decode(data, (bytes32, bytes));

        if (syncType == RECEIVE_BLOCK_INFO) {
            (uint256 destCode, uint256 blockNumber, bytes32 blockHash) = abi.decode(syncData, (uint256, uint256, bytes32));
            require(blockHash != bytes32(0), "PolygonChildCheckpointManager: INVALID_BLOCKHASH");
            blockHashs[destCode][blockNumber] = blockHash;
        } else {
            revert("FxBaseChildTunnel: INVALID_SYNC_TYPE");
        }
    }

    function executeRootCheckpointManagerUpdate(address _newRootCheckpointManager) external onlyOwner {
        require(_newRootCheckpointManager != address(0x0), "PolygonChildCheckpointManager: INVALID_ROOT_CHECKPOINT_MANAGER");
        rootCheckpointManagerUpdate = RootCheckpointManagerUpdate(uint64(block.timestamp + UPDATE_PERIOD), _newRootCheckpointManager);
    }

    function finalizeUpdateRootCheckpointManager() external {
        require(uint64(block.timestamp) > rootCheckpointManagerUpdate.executeAfter, "Ongoing update period");
        fxRootTunnel = rootCheckpointManagerUpdate.newRootCheckpointManager;
    }

    function getBlockHash(uint256 _destCode, uint256 _blockNumber) external view returns (bytes32) {
        return blockHashs[_destCode][_blockNumber];
    }
}

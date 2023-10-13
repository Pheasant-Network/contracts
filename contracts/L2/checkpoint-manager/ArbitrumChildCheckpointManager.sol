//SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "./CoreChildCheckpointManager.sol";
import "@arbitrum/nitro-contracts/src/libraries/AddressAliasHelper.sol";

contract ArbitrumChildCheckpointManager is CoreChildCheckpointManager {
    constructor (address _rootCheckpointManager, address _newOwner) CoreChildCheckpointManager(_rootCheckpointManager, _newOwner) {}

    function _processMessageFromRoot(
        bytes memory data
    ) external validateSender(msg.sender) {
        // decode incoming data
        (bytes32 syncType, bytes memory syncData) = abi.decode(data, (bytes32, bytes));

        if (syncType == RECEIVE_BLOCK_INFO) {
            (uint256 destCode, uint256 blockNumber, bytes32 blockHash) = abi.decode(syncData, (uint256, uint256, bytes32));
            require(blockHash != bytes32(0), "ArbitrumChildCheckpointManager: INVALID_BLOCKHASH");
            blockHashs[destCode][blockNumber] = blockHash;
        } else {
            revert("ArbitrumChildCheckpointManager: INVALID_SYNC_TYPE");
        }
    }

    modifier validateSender(address _sender) {
        require(_sender == AddressAliasHelper.applyL1ToL2Alias(rootCheckpointManager), "ArbitrumInboxContract: INVALID_SENDER_FROM_ROOT");
        _;
    }
}
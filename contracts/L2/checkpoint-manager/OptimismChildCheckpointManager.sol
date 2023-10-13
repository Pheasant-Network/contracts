// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "./CoreChildCheckpointManager.sol";
import { ICrossDomainMessenger } from "@eth-optimism/contracts/libraries/bridge/ICrossDomainMessenger.sol";

contract OptimismChildCheckpointManager is CoreChildCheckpointManager {

    address public l2CrossDomainMessenger;

    constructor (address _rootCheckpointManager, address _newOwner, address _l2CrossDomainMessenger) CoreChildCheckpointManager(_rootCheckpointManager, _newOwner) {
        require(_l2CrossDomainMessenger != address(0x0), "OptimismChildCheckpointManager: INVALID_L2_CROSS_DOMAIN_MESSENGER");
        l2CrossDomainMessenger = _l2CrossDomainMessenger;
    }

    function _processMessageFromRoot(
        bytes memory data
    ) external validateSender() {
        // decode incoming data
        (bytes32 syncType, bytes memory syncData) = abi.decode(data, (bytes32, bytes));

        if (syncType == RECEIVE_BLOCK_INFO) {
            (uint256 destCode, uint256 blockNumber, bytes32 blockHash) = abi.decode(syncData, (uint256, uint256, bytes32));
            require(blockHash != bytes32(0), "OptimismChildCheckpointManager: INVALID_BLOCKHASH");
            blockHashs[destCode][blockNumber] = blockHash;
        } else {
            revert("CrossDomainMessage: INVALID_SYNC_TYPE");
        }
    }

    modifier validateSender() {
        require(
            msg.sender == l2CrossDomainMessenger
            && ICrossDomainMessenger(l2CrossDomainMessenger).xDomainMessageSender() == rootCheckpointManager,
            "CrossDomainMessage: INVALID_SENDER_FROM_ROOT"
        );
        _;
    }
}
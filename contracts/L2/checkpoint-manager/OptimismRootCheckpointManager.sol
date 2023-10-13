// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { ICrossDomainMessenger } from "@eth-optimism/contracts/libraries/bridge/ICrossDomainMessenger.sol";

contract OptimismRootCheckpointManager {

    struct OptimismState {
        address childCheckpointManager;
        address l1CrossDomainMessenger;
        mapping(uint256 => bytes32) blockhashes;
    }
    event SendBlockInfo(uint256 indexed blocknumber);
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.standard.optimismRootCheckpointManager.storage");
    bytes32 constant RECEIVE_BLOCK_INFO = keccak256("ReceiveBlockInfo");

    function diamondStorage() internal pure returns (OptimismState storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    function getOptimismState() external view returns (address, address) {
        OptimismState storage state = diamondStorage();
        return (state.childCheckpointManager, state.l1CrossDomainMessenger);
    }

    function getOptimismBlockhash(uint256 _blockNumber) external view returns (bytes32) {
        OptimismState storage state = diamondStorage();
        return (state.blockhashes[_blockNumber]);
    }

    function optimismInit(address _childCheckpointManager, address _l1CrossDomainMessenger) external {
        require(_childCheckpointManager != address(0x0), "OptimismRootCheckpointManager: INVALID_CHILD_CHECKPOINT_MANAGER");
        require(_l1CrossDomainMessenger != address(0x0), "OptimismRootCheckpointManager: INVALID_L1_CROSS_DOMAIN_MESSENGER");
        OptimismState storage state = diamondStorage();
        require(state.childCheckpointManager == address(0x0), "OptimismRootCheckpointManager: CHILD_ALREADY_SET");
        state.childCheckpointManager = _childCheckpointManager;
        state.l1CrossDomainMessenger = _l1CrossDomainMessenger;
    }

    function optimismSendBlockInfo(
        uint256 _destCode,
        uint256 _blockNumber,
        uint32 _gasLimit
    ) external {
        OptimismState storage state = diamondStorage();

        bytes32 blockHash;
        if (state.blockhashes[_blockNumber] == 0) {
            blockHash = blockhash(_blockNumber);
            state.blockhashes[_blockNumber] = blockHash;
        } else {
            blockHash = state.blockhashes[_blockNumber];
        }

        bytes memory message = abi.encodeWithSignature("_processMessageFromRoot(bytes)",
            abi.encode(
                RECEIVE_BLOCK_INFO,
                abi.encode(_destCode, _blockNumber,blockhash(_blockNumber))
            )
        );

        ICrossDomainMessenger(state.l1CrossDomainMessenger).sendMessage(
            state.childCheckpointManager,
            message,
            _gasLimit
        );

        emit SendBlockInfo(_blockNumber);
    }
}

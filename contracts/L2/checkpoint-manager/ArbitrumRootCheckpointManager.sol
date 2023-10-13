//SPDX-Licence-Identifier: MIT
pragma solidity 0.8.18;

import "@arbitrum/nitro-contracts/src/bridge/IInbox.sol";

contract ArbitrumRootCheckpointManager {

    struct ArbitrumState {
        address childCheckpointManager;
        address inbox;
        mapping(uint256 => bytes32) blockhashes;
    }

    event SendBlockInfo(uint256 indexed blocknumber);
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.standard.arbitrumRootCheckpointManager.storage");
	bytes32 constant RECEIVE_BLOCK_INFO = keccak256("ReceiveBlockInfo");

    function diamondStorage() internal pure returns (ArbitrumState storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    function getArbitrumState() external view returns (address, address) {
        ArbitrumState storage state = diamondStorage();
        return (state.childCheckpointManager, state.inbox);
    }

    function getArbitrumBlockhash(uint256 _blockNumber) external view returns (bytes32) {
        ArbitrumState storage state = diamondStorage();
        return (state.blockhashes[_blockNumber]);
    }

    function arbitrumInit(address _childCheckpointManager, address _inbox) external {
        require(_childCheckpointManager != address(0x0), "ArbitrumRootCheckpointManager: INVALID_CHILD_CHECKPOINT_MANAGER");
        require(_inbox != address(0x0), "ArbitrumRootCheckpointManager: INVALID_INBOX");

        ArbitrumState storage state = diamondStorage();
        require(state.childCheckpointManager == address(0x0), "ArbitrumRootCheckpointManager: CHILD_ALREADY_SET");
        state.childCheckpointManager = _childCheckpointManager;
        state.inbox = _inbox;
    }

    function arbitrumSendBlockInfo(
        uint256 _destCode,
        uint256 _blockNumber,
        uint256 maxGas,
        uint256 gasPriceBid
    ) external payable returns (uint256) {
        ArbitrumState storage state = diamondStorage();

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
                abi.encode(_destCode, _blockNumber, blockHash)
            )
        );
        uint256 submissionFee = IInbox(state.inbox).calculateRetryableSubmissionFee(message.length, 0);
        uint256 ticketID = IInbox(state.inbox).createRetryableTicket{ value: msg.value }(
            state.childCheckpointManager,
            0,
            submissionFee,
            msg.sender,
            msg.sender,
            maxGas,
            gasPriceBid,
            message
        );
        emit SendBlockInfo(_blockNumber);
        return ticketID;
    }
}
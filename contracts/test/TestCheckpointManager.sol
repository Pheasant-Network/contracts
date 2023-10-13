// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "./TestContractCall.sol";

contract TestCheckpointManager is TestContractCall {
    bytes32 constant RECEIVE_BLOCK_INFO = keccak256("ReceiveBlockInfo");

    mapping(uint256 => mapping(uint256 => bytes32)) public blockHashs;

    function getBlockHash(uint256 _destCode, uint256 _blockNumber) external view returns (bytes32) {
        return blockHashs[_destCode][_blockNumber];
    }

    function setBlockHash(uint256 _networkCode, uint256 _blockNumber, bytes32 _blockHash) public {
        blockHashs[_networkCode][_blockNumber] = _blockHash;
    }

    function getMessage(
        uint256 _destCode,
        uint256 _blockNumber,
        bytes32 _blockHash
    ) public view returns (bytes memory) {
        bytes memory message;
        message = abi.encodeWithSignature("_processMessageFromRoot(bytes)",
            abi.encode(
                RECEIVE_BLOCK_INFO,
                abi.encode(_destCode, _blockNumber, _blockHash)
            )
        );
        return message;
    }

    function getPolygonMessage(
        uint256 _destCode,
        uint256 _blockNumber,
        bytes32 _blockHash
    ) public view returns (bytes memory) {
        bytes memory message;
        message = abi.encode(
            RECEIVE_BLOCK_INFO,
            abi.encode(_destCode, _blockNumber, _blockHash)
        );
        return message;
    }

    /******** For arbitrum root checkpoint manager test ********/
    struct CreateRetryableTicketData {
        address to;
        uint256 l2CallValue;
        uint256 maxSubmissionCost;
        address excessFeeRefundAddress;
        address callValueRefundAddress;
        uint256 gasLimit;
        uint256 maxFeePerGas;
        bytes data;
    }
    CreateRetryableTicketData public createRetryableTicketData;

    function calculateRetryableSubmissionFee(uint256 dataLength, uint256 baseFee) public pure returns (uint256) {
        return dataLength;
    }

    function createRetryableTicket(
        address to,
        uint256 l2CallValue,
        uint256 maxSubmissionCost,
        address excessFeeRefundAddress,
        address callValueRefundAddress,
        uint256 gasLimit,
        uint256 maxFeePerGas,
        bytes calldata data
    ) public payable returns (uint256) {
        createRetryableTicketData = CreateRetryableTicketData(
            to,
            l2CallValue,
            maxSubmissionCost,
            excessFeeRefundAddress,
            callValueRefundAddress,
            gasLimit,
            maxFeePerGas,
            data
        );
        return maxSubmissionCost;
    }

    /******** For optimism root checkpoint manager test ********/
    struct SendMessageData {
        address childCheckpointManager;
        bytes message;
        uint256 gasLimit;
    }
    SendMessageData public sendMessageData;

    function sendMessage(
        address _childCheckpointManager,
        bytes memory _message,
        uint32 _gasLimit
    ) public {
        sendMessageData = SendMessageData(_childCheckpointManager, _message, _gasLimit);
    }

    /******** For optimism child checkpoint manager test ********/
    function xDomainMessageSender() public returns (address) {
        return address(this);
    }

    /******** For polygon root checkpoint manager test ********/
    struct SendMessageToChildData {
        address childCheckpointManager;
        bytes message;
    }
    SendMessageToChildData public sendMessageToChildData;

    function sendMessageToChild(
        address _childCheckpointManager,
        bytes memory _message
    ) public {
        sendMessageToChildData = SendMessageToChildData(_childCheckpointManager, _message);
    }
}

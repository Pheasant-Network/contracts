// SPDX-License-Identifier: MIT

import { Types } from "../libraries/types/Types.sol";

/**
 * @title IBridgeDisputeManager
 */

interface IBridgeDisputeManager {
    function verifyBlockHeader(bytes32 blockHash, bytes[] calldata blockHeaderRaw) external pure returns (bool);

    function verifyProof(
        bytes32 txHash,
        bytes[] memory proof,
        bytes memory bytesRoot,
        uint8[] memory path
    ) external pure returns (bool);

    function verifyRawTx(bytes memory transaction, bytes[] calldata txRaw) external pure returns (bool);

    function verifyBlockHash(bytes32 _blockHash, uint256 _destCode, uint256 _blockNumber) external view returns (bool);

    function checkTransferTx(bytes calldata transaction, address recipient, uint256 amount, uint256 networkCode) external pure returns (bool);

    function checkERC20TransferTx(bytes calldata transaction, address tokenAddress, address recipient, uint256 amount, uint256 networkCode) external pure returns (bool);

    function verifyReceipt(bytes calldata txReceipt) external pure returns (bool);

    function recoverAddress(bytes[] calldata txRaw) external pure returns(address);

    function decodeToAndValueFromTxData(bytes calldata transaction) external pure returns (address, uint256);

    function decodeToAndValueFromERC20TxData(bytes calldata transaction) external pure returns (address, address, uint256);

    function checkDestNetworkCode(uint256 _amount, uint256 destNetworkCode) external pure returns(bool);

    // function isValidEvidence(Types.Trade memory _trade, Types.Evidence calldata _evidence) external view returns (bool);

    function checkEvidenceExceptBlockHash(
        bool _isNativeTokenCheck,
        uint256 _tradeAmount,
        uint256 _networkCheckCode,
        address _receiver,
        address _tokenAddress,
        Types.Evidence calldata _evidence
    ) external view returns (bool);

    // function safeCheckEvidenceExceptBlockHash(
    //     Types.Trade memory _trade,
    //     Types.Evidence calldata _evidence
    // ) external view returns (bool);
}
// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;
import { SolRLPDecoder } from "./utils/SolRLPDecoder.sol";
import { RLPEncode } from "./utils/RLPEncode.sol";
import { Types } from "../libraries/types/Types.sol";
import { BytesLib } from "solidity-bytes-utils/contracts/BytesLib.sol";
import { Lib_DefaultValues } from "../libraries/constants/Lib_DefaultValues.sol";

contract TemporaryDisputeManager {

    function verifyBlockHash(bytes32 _blockHash, uint256 _destCode, uint256 _blockNumber) public view returns (bool){
        return true;
    }

    /******** Constant ********/
    uint256 constant BLOCKHEADER_TRANSACTIONROOT_INDEX = 4;
    uint256 constant BLOCKHEADER_RECEIPTROOT_INDEX = 5;
    uint256 constant TRANSACTION_TO_INDEX = 5;
    uint256 constant TRANSACTION_VALUE_INDEX = 6;
    uint256 constant TRANSACTION_DATA_INDEX = 7;
    uint256 constant ACCESSLIST = 8;
    bytes constant TX_TYPE2 = hex"02";
    bytes constant ERC20_TRANSFER_METHOD_ID = hex"a9059cbb";
    bytes constant STATUS_TRUE = hex"01";

    /******** Functions for slash ********/
    /**
     * @dev Verifies the block header.
     * @param _isNativeTokenCheck True if the token is native token, false otherwise.
     * @param _tradeAmount The amount of trade.
     * @param _networkCheckCode The network code of trade.
     * @param _receiver The receiver of the trade.
     * @param _tokenAddress The token address of the trade.
     * @param _evidence The evidence struct containing transaction data, proof, and block header.
     * @return True if the evidence is valid, false otherwise.
     */
    function checkEvidenceExceptBlockHash(
        bool _isNativeTokenCheck,
        uint256 _tradeAmount,
        uint256 _networkCheckCode,
        address _receiver,
        address _tokenAddress,
        Types.Evidence calldata _evidence
    ) public view returns (bool) {
        bool isValidTx = false;

        if(_isNativeTokenCheck) {
            isValidTx = checkTransferTx(_evidence.transaction, _receiver, _tradeAmount, _networkCheckCode);
        } else {
            isValidTx = checkERC20TransferTx(_evidence.transaction, _tokenAddress, _receiver, _tradeAmount, _networkCheckCode)
                && verifyReceipt(_evidence.txReceipt)
                && verifyProof(keccak256(_evidence.txReceipt), _evidence.txReceiptProof, _evidence.rawBlockHeader[BLOCKHEADER_RECEIPTROOT_INDEX], _evidence.path);
        }

        return isValidTx
            && verifyBlockHeader(_evidence.blockHash, _evidence.rawBlockHeader)
            && verifyProof(keccak256(_evidence.transaction), _evidence.txProof, _evidence.rawBlockHeader[BLOCKHEADER_TRANSACTIONROOT_INDEX], _evidence.path)
            && verifyRawTx(_evidence.transaction, _evidence.rawTx);
    }

    /******** Public pure functions to support slash ********/
    /**
     * @dev Check the given transaction has correct recipient and amount.
     * @param transaction The encoded transaction data.
     * @param recipient The recipient of the transaction.
     * @param amount The amount of the transaction.
     * @return True if the given transaction is has correct recipient and about, false otherwise.
     */
    function checkTransferTx(
        bytes calldata transaction,
        address recipient,
        uint256 amount,
        uint256 destNetworkCode
    ) public pure returns (bool) {
        (address to, uint256 value) = decodeToAndValueFromTxData(transaction);
        // Check dest network id, if upward trade
        bool isNetworkCodeValid = destNetworkCode == 0 || checkDestNetworkCode(value, destNetworkCode);

        return isNetworkCodeValid && to == recipient && value >= amount;
    }

    /**
     * @dev Check the given transaction has correct recipient and amount.
     * @param transaction The encoded transaction data.
     * @param tokenAddress The address of the token.
     * @param recipient The recipient of the transaction.
     * @param amount The amount of the transaction.
     * @param destNetworkCode The network code of the destination chain for upward trade. For non upward trade it should be 0.
     * @return True if the given transaction is has correct recipient and amount, false otherwise.
     */
    function checkERC20TransferTx(
        bytes calldata transaction,
        address tokenAddress,
        address recipient,
        uint256 amount,
        uint256 destNetworkCode
    ) public pure returns (bool) {
        bytes[] memory decodedTx = decodeNode(transaction[1:]);
        bytes memory to = decodedTx[TRANSACTION_TO_INDEX];
        bytes memory data = decodedTx[TRANSACTION_DATA_INDEX];

        // the first 4 bytes is methodId for ERC20 transfer
        bytes memory methodId = BytesLib.slice(data, 0, 4);
        (address toInData, uint256 valueInData) = extractToAndValueFromInputData(data);

        // Check dest network id, if upward trade
        bool isNetworkCodeValid = destNetworkCode == 0 || checkDestNetworkCode(valueInData, destNetworkCode);

        return isNetworkCodeValid
            && BytesLib.toAddress(to, 0) == tokenAddress
            && BytesLib.equal(methodId, ERC20_TRANSFER_METHOD_ID)
            && toInData == recipient
            && valueInData >= amount;
    }

    /**
     * @dev Check the given amount has correct network code. Network code is the last 4 digits of the amount.
     * @param _amount The amount of the trade.
     * @param _destNetworkCode The network code of the destination chain.
     * @return True if the given amount is has correct network code, false otherwise.
     */
    function checkDestNetworkCode(uint256 _amount, uint256 _destNetworkCode) public pure returns(bool) {
        return _amount % 10000 == _destNetworkCode;
    }

    /**
     * @dev Verifies the transaction is succeed or not
     * @param txReceipt The encoded transaction receipt.
     * @return True if the transaction receipt is valid, false otherwise.
     */
    function verifyReceipt(bytes calldata txReceipt) public pure returns (bool) {
        bytes[] memory decodedReceipt = decodeNode(txReceipt[1:]);
        bytes memory status = decodedReceipt[0];
        return BytesLib.equal(status, STATUS_TRUE);
    }

    /**
     * @dev Verifies the block header using its blockhash and the raw data of the header.
     * @param blockHash The specific block hash.
     * @param blockHeaderRaw The raw data of the block header.
     * @return True if the hash of the raw header data matches the given hash, false otherwise.
     */
    function verifyBlockHeader(bytes32  blockHash, bytes[] calldata blockHeaderRaw) public pure returns (bool){
        return blockHash == keccak256(rlpEncode(blockHeaderRaw, false));
    }


    function verifyProof(bytes32 txHash, bytes[] memory proof, bytes memory bytesRoot, uint8[] memory path) public pure returns (bool){
        bytes32 root;
        bytes memory tmpRoot = bytesRoot;
        assembly {
            root := mload(add(tmpRoot, 32))
        }

        uint256 length = proof.length;
        uint256 pathIndex = 0;
        bytes32 next;
        bytes memory encodedResult;
        if(root != keccak256(proof[0])) return false; // Invalid Tx Root
        for(uint256 i = 0; i < length; i++) {
            bytes[] memory result = decodeNode(proof[i]);
            if(i != 0) {
                if (keccak256(proof[i]) != next) return false; // Invalid Proof
            }
            if(result.length == 17) {
                if(i == length - 1) {
                    encodedResult = result[16];
                } else {
                    next = bytes32(result[path[pathIndex]]);
                    pathIndex++;
                }
            }else if(result.length == 2) {
                uint8[] memory nibble = bufferToNibble(result[0]);
                uint256 offset = 0;
                if (nibble[0] > 1) {
                    if(nibble[0] == 2) {
                        offset = 2;
                    }else if(nibble[0] == 3) {
                        offset = 1;
                    }
                    encodedResult = result[1];
                } else {
                    if(nibble[0] == 0) {
                        offset = 2;
                    }else if(nibble[0] == 1) {
                        offset = 1;
                    }
                    next = bytes32(result[1]);
                }
                for(uint256 j = offset; j < nibble.length; j++) {
                    if(path[pathIndex] != nibble[j]) return false; //Invalid Path
                    pathIndex++;
                }
            } else {
                revert();
            }
        }

        return txHash == keccak256(encodedResult);
    }

    /**
     * @dev Verifies the transaction and raw transaction.
     * @param transaction The transaction data to verify.
     * @param txRaw The raw transaction to verify.
     * @return True if the hashed tansaction matches the hashed and composed raw transaction.
     */
    function verifyRawTx(bytes memory transaction, bytes[] calldata txRaw) public pure returns(bool){
        return keccak256(transaction) == keccak256(composeTx(txRaw));
    }

    /******** Functions to decode ********/
    /**
     * @dev Recover the address of the signer from the raw transaction.
     * @param txRaw The raw transaction to recover the address.
     * @return The address of the signer.
     */
    function recoverAddress(bytes[] calldata txRaw) public pure returns(address) {

        uint256 length = txRaw.length - 3;
        bytes[] memory unsignedRawTx = new bytes[](length);
        for(uint256 i = 0; i < length; i++) {
            unsignedRawTx[i] = txRaw[i];
        }
        bytes memory composedUnsignedTx = composeTx(unsignedRawTx);
        bytes32 message = keccak256(composedUnsignedTx);

        bytes32 r;
        bytes memory tmpR = txRaw[10];
        assembly {
            r := mload(add(tmpR, 32))
        }

        bytes32 s;
        bytes memory tmpS = txRaw[11];
        assembly {
            s := mload(add(tmpS, 32))
        }

        uint8 v = 0;
        if(keccak256(txRaw[9]) == keccak256(hex"01")) {
            v = 28;
        } else {
            v = 27;
        }

        return ecrecover(message, v, r, s);
    }

    /**
     * @dev Decode to and value the transaction data.
     * @param transaction The transaction data to decode.
     * @return To and value in transaction data.
     */
    function decodeToAndValueFromTxData(bytes calldata transaction) public pure returns (address, uint256) {
        bytes[] memory decodedTx = decodeNode(transaction[1:]);
        bytes memory to = decodedTx[TRANSACTION_TO_INDEX];
        bytes memory value = decodedTx[TRANSACTION_VALUE_INDEX];
        bytes memory prefix = new bytes(32 - value.length);
        return (BytesLib.toAddress(to, 0), BytesLib.toUint256(bytes.concat(prefix, value), 0));
    }

    /**
     * @dev Decode to and value from the input data in transaction.
     * @param transaction The input data to decode.
     * @return TokenAddress, toAddress and value in input data.
     */
    function decodeToAndValueFromERC20TxData(bytes calldata transaction) public pure returns (address, address, uint256) {
        bytes[] memory decodedTx = decodeNode(transaction[1:]);
        bytes memory to = decodedTx[TRANSACTION_TO_INDEX];
        bytes memory data = decodedTx[TRANSACTION_DATA_INDEX];
        (address toInData, uint256 valueInData) = extractToAndValueFromInputData(data);
        return (BytesLib.toAddress(to, 0), toInData, valueInData);
    }

    /**
     * @dev Extract to and value from the input data.
     * @param data The input data to extract.
     * @return To and value in input data.
     */
    function extractToAndValueFromInputData(bytes memory data) internal pure returns (address, uint256) {
        // the next 32bytes after 4bytes (methodId) are to of ERC20 transfer
        address toInData = BytesLib.toAddress(BytesLib.slice(data, 4, 32), 12);
        // the next 32bytes after 36bytes (4bytes + 32bytes) are amount of
        uint256 valueInData = BytesLib.toUint256(BytesLib.slice(data, 36, 32), 0);
        return (toInData, valueInData);
    }

    /******** Utils ********/
    /**
     * @dev Compose transaction date to rlp encoded data.
     * @param item Array of tx data to compose.
     * @return ELP encoded data with tx type 2 prefix.
     */
    function composeTx(bytes[] memory item) internal pure returns(bytes memory){
        bytes memory encodedTx = rlpEncode(item, true);
        return bytes.concat(TX_TYPE2, encodedTx);
    }

    /**
     * @dev Encode the input data using Recursive Length Prefix encoding
     * @param item The input data to be encoded
     * @param isTxEncode Whether or not the encoding transaction data
     * @return Return the RLP-encoded data
     */
    function rlpEncode(bytes[] memory item, bool isTxEncode) internal pure returns(bytes memory){
        uint256 length = item.length;
        bytes memory result;
        for(uint256 i = 0; i < length ;i++) {
            if(i == ACCESSLIST && isTxEncode) {
                result = bytes.concat(result, hex"c0"); //empty accessList
            } else {
                result = bytes.concat(result, RLPEncode.encodeBytes(item[i]));
            }
        }
        bytes memory prefix = RLPEncode.encodeLength(result.length, 192);
        return bytes.concat(prefix, result);
    }

    /**
     * @dev Convert a byte array to an array of nibbles
     * @param buffer The byte array to be converted
     * @return nibbles The converted nibble array
     */
    function bufferToNibble(bytes memory buffer) internal pure returns(uint8[] memory){
        uint256 size = buffer.length;
        uint8[] memory nibbles = new uint8[](size * 2);
        for(uint256 i = 0;  i < buffer.length; i++ ){
            uint256 q = i * 2;
            nibbles[q] = uint8(buffer[i] >> 4);
            ++q;
            bytes1 tmp = buffer[i] << 4;
            nibbles[q] = uint8(tmp >> 4);
        }
        return nibbles;
    }

    /**
     * @dev Decode an REL encoded data.
     * @param item The byte data to be decode.
     * @return An array of decoded bytes.
     */
    function decodeNode(bytes memory item) internal pure returns (bytes[] memory ){
        return SolRLPDecoder.decode(item);
    }


}

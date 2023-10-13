// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { Types } from "../types/Types.sol";

/**
 * @title Lib_BridgeUtils
 */

library Lib_BridgeUtils {
  /**
    * @notice Hashing evidence
    * @param _evidence Evidence oBject
    * @return Hashed evidence
    */
  function hashEvidence(Types.Evidence calldata _evidence) internal pure returns (bytes32) {
        return keccak256(bytes.concat(
            encodeBlockEvidence(_evidence),
            encodeTxEvidence(_evidence)
      ));
  }

  /**
    * @notice Encoding block evidence
    * @param _evidence Evidence object
    * @return encoded block evidence
    */
  function encodeBlockEvidence(Types.Evidence calldata _evidence) internal pure returns (bytes memory) {
      return abi.encodePacked(
          _evidence.blockNumber,
          _evidence.blockHash,
          encodeBytesArray(_evidence.rawBlockHeader)
      );
  }

  /**
    * @notice Encoding transaction evidence
    * @param _evidence Evidence object
    * @return encoded transaction evidence
    */
  function encodeTxEvidence(Types.Evidence calldata _evidence) internal pure returns (bytes memory) {
      return abi.encodePacked(
          encodeBytesArray(_evidence.txReceiptProof),
          encodeBytesArray(_evidence.txProof),
          _evidence.transaction,
          encodeUint8Array(_evidence.path),
          _evidence.txReceipt,
          encodeBytesArray(_evidence.rawTx)
      );
  }

  /**
    * @notice Encoding array of byte
    * @param _array Array of byte
    * @return encoded byte array
    */
  function encodeBytesArray(bytes[] memory _array) internal pure returns(bytes memory encoded) {
      for (uint i = 0; i < _array.length; i++) {
          encoded = bytes.concat(
              encoded, abi.encodePacked(_array[i])
          );
      }
  }

  /**
    * @notice Encoding array of uint8
    * @param _array Array of uint
    * @return encoded uint8 array
    */
  function encodeUint8Array(uint8[] memory _array) internal pure returns(bytes memory encoded) {
      for (uint i = 0; i < _array.length; i++) {
          encoded = bytes.concat(
              encoded, abi.encodePacked(_array[i])
          );
      }
  }

  /**
    * @notice Convert byte to uint32
    * @param _bytes Byte to convert
    * @param _start Index of start byte
    * @return uint32 data
    */
  function toUint32(bytes memory _bytes, uint256 _start) internal pure returns (uint32) {
      require(_bytes.length >= _start + 4, "toUint32_outOfBounds");
      uint32 tempUint;

      assembly {
          tempUint := mload(add(add(_bytes, 0x4), _start))
      }

      return tempUint;
  }
}
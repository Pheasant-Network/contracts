// SPDX-License-Identifier: MIT
// This file is a modified version of RLPEncode.sol:
// https://github.com/bakaoh/solidity-rlp-encode/blob/b30b82792678ce345ded7ddbc11bad8e91f95b29/contracts/RLPEncode.sol
//
// MODIFICATIONS
// 1. Chenged solidity version to 0.8.9 from >=0.4.0 < 0.6.0
// 2. Removed the following functions:
//    - encodeList
//    - encodeString
//    - encodeAddress
//    - encodeUint
//    - encodeInt
//    - encodeBool
//    - toBinary
//    - memcpy
//    - flatten
// 3. Make encodeLength() internal
// 4. Directly use BytesLib.concat() instead of concat() in original file

pragma solidity 0.8.18;

import { BytesLib } from "solidity-bytes-utils/contracts/BytesLib.sol";

/**
 * @title RLPEncode
 * @dev A simple RLP encoding library.
 * @author Bakaoh
 */
library RLPEncode {
    /*
     * Internal functions
     */

    /**
     * @dev RLP encodes a byte string.
     * @param self The byte string to encode.
     * @return The RLP encoded string in bytes.
     */
    function encodeBytes(bytes memory self) internal pure returns (bytes memory) {
        bytes memory encoded;
        if (self.length == 1 && uint8(self[0]) < 128) {
            encoded = self;
        } else {
            encoded = BytesLib.concat(encodeLength(self.length, 128), self);
        }
        return encoded;
    }

    /*
     * Private functions
     */
    /**
     * @dev Encode the first byte, followed by the `len` in binary form if `length` is more than 55.
     * @param len The length of the string or the payload.
     * @param offset 128 if item is string, 192 if item is list.
     * @return RLP encoded bytes.
     */
    function encodeLength(uint len, uint offset) internal pure returns (bytes memory) {
        bytes memory encoded;
        if (len < 56) {
            encoded = new bytes(1);
            encoded[0] = bytes32(len + offset)[31];
        } else {
            uint lenLen;
            uint i = 1;
            while (len / i != 0) {
                lenLen++;
                i *= 256;
            }

            encoded = new bytes(lenLen + 1);
            encoded[0] = bytes32(lenLen + offset + 55)[31];
            for(i = 1; i <= lenLen; i++) {
                encoded[i] = bytes32((len / (256**(lenLen-i))) % 256)[31];
            }
        }
        return encoded;
    }
}
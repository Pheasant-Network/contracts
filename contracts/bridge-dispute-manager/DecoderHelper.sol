// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;
pragma experimental ABIEncoderV2;
import "./utils/SolRLPDecoder.sol";

contract DecoderHelper {

    function decode(bytes calldata input) public pure returns (bytes[] memory) {
        return SolRLPDecoder.decode(input);
    }

}

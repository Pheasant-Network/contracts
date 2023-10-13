// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;
pragma abicoder v2;
import "./RLPReader.sol";

library SolRLPDecoder {
    using RLPReader for RLPReader.RLPItem;
    using RLPReader for bytes;

    function decode(bytes calldata input) public pure returns (bytes[] memory) {
        RLPReader.RLPItem memory item = input.toRlpItem();

        if (RLPReader.isList(item)) {
            RLPReader.RLPItem[] memory list = item.toList();
            uint256 listLength = list.length;
            bytes[] memory data = new bytes[](listLength);
            for (uint256 i = 0; i < listLength; i++) {
                data[i] = list[i].toBytes();
            }
            return data;
        } else {
            bytes[] memory data = new bytes[](1);
            data[0] = item.toBytes();
            return data;
        }
    }
}

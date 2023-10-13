// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;
import "./BridgeDisputeManager.sol";

contract DisputeHelper is BridgeDisputeManager {
    constructor(address _checkPointManager) BridgeDisputeManager(_checkPointManager) {}

    function helperBufferToNibble(bytes memory buffer) public pure returns(uint8[] memory){
        return super.bufferToNibble(buffer);
    }

    function helperComposeTx(bytes[] memory item) public pure returns(bytes memory){
        return super.composeTx(item);
    }

    function helperRlpEncode(bytes[] memory item, bool isTxEncode) public pure returns(bytes memory){
        return super.rlpEncode(item, isTxEncode);
    }
}

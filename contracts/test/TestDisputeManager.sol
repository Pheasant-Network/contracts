// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { Types } from "../libraries/types/Types.sol";

contract TestDisputeManager {

    function checkEvidenceExceptBlockHash(
        bool _isNativeTokenCheck,
        uint256 _tradeAmount,
        uint256 _networkCheckCode,
        address _receiver,
        address _tokenAddress,
        Types.Evidence calldata _evidence
    ) public view returns (bool) {
        return true;
    }


    function verifyBlockHash(bytes32 _blockHash, uint256 _destCode, uint256 _blockNumber) external view returns (bool) {
        return true;
    }

    function recoverAddress(bytes[] calldata txRaw) public pure returns(address) {
       address hardhatDefaultAddress = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
       return hardhatDefaultAddress;
    }

}

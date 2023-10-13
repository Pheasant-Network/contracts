// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;
/**
 * @title IBridgeDisputeManager
 */

interface IBondManager {
    function getBond(uint8 _tokenIndex) external view returns (uint256);
    function slash(uint8 _tokenIndex, uint256 _amount) external payable;
}
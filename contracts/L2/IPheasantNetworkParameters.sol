// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { Types } from "../libraries/types/Types.sol";

interface IPheasantNetworkParameters {
    function networkCode() external view returns (uint256);
    function relayer() external view returns (address);
    function withdrawalBlockPeriod() external view returns (uint256);
    function tradableBondRatio() external view returns (uint256);
    function defencePeriod() external view returns (uint256);
    function disputablePeriod() external view returns (uint256);
    function withdrawalPeriod() external view returns (uint256);
    function tokenAddress(uint256 _networkCode, uint8 _tokenTypeIndex) external view returns (address);
    function tradeThreshold(uint8 _tokenTypeIndex) external view returns(uint256);
    function tradeMinimumAmount(uint8 _tokenTypeIndex) external view returns (uint256);
    function availableNetwork(uint256 _networkCode) external view returns (uint256);
    function slashableNetwork(uint256 _networkCode) external view returns (uint256);
    function nativeIsNotETH(uint256 _destCode) external view returns (uint256);
    function disputeDepositAmount(uint8 _tokenTypeIndex) external view returns (uint256);
    function getRelayerFee(uint8 _tokenTypeIndex) external view returns (uint256);
    function getRequiredBondAmount(uint256 _amount) external view returns (uint256);
}
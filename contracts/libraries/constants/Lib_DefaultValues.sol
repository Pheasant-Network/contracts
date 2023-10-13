// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

/**
 * @title Lib_DefaultValues
 */

library Lib_DefaultValues {
  uint8 constant ETH_TOKEN_INDEX = 0;
  uint256 constant ETH_NETWORK_CODE = 1001;

  uint8 constant STATUS_START = 0;
  uint8 constant STATUS_PAID = 2;
  uint8 constant STATUS_DISPUTE = 3;
  uint8 constant STATUS_SLASHED = 4;
  uint8 constant STATUS_PROVED = 5; 
  uint8 constant STATUS_SLASH_COMPLETED = 6;
  uint8 constant STATUS_CANCEL = 99;

  bytes constant TRANSFER_METHOD_ID = bytes(hex"a9059cbb");

  uint256 constant CANCELABLE_PERIOD = 2 hours;
  uint256 constant UPWARD_SLASH_START = 30 minutes;
  uint256 constant SLASHABLE_PERIOD = 14 days;
  uint256 constant UPDATE_PERIOD = 3 hours;

  uint256 constant BLOCKHEADER_TIMESTAMP_INDEX = 11;
}
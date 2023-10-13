// SPDX-License-Identifier: MIT
// This file is a modified version of RLPEncode.sol:
// https://github.com/mudgen/diamond-1-hardhat/tree/10a001c8f0d9e8b71e7e2fd8b5829da8a18f9a57/contracts
//
// MODIFICATIONS
// 1. Chenged solidity version to 0.8.18 from ^0.8.0

pragma solidity 0.8.18;

/******************************************************************************\
* Author: Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
* EIP-2535 Diamonds: https://eips.ethereum.org/EIPS/eip-2535
*
* Implementation of a diamond.
/******************************************************************************/

import { LibDiamond } from "../libraries/LibDiamond.sol";

error AddressAndCalldataLengthDoNotMatch(uint256 _addressesLength, uint256 _calldataLength);


// This Solidity library is deployed because it contains an external function.
// This is deployed as a Solidity library instead of as regular contract because deployed Solidity libraries
// cannot be deleted. If this was a contract then someone could call multiInit directly on the contract
// with a regular external function call in order to delegatecall (via LibDiamond.initializeDiamondCut)
// to a function that executes self destruct.

library DiamondMultiInit {

    // This function is provided in the third parameter of the `diamondCut` function.
    // The `diamondCut` function executes this function to execute multiple initializer functions for a single upgrade.

    function multiInit(address[] calldata _addresses, bytes[] calldata _calldata) external {
        if(_addresses.length != _calldata.length) {
            revert AddressAndCalldataLengthDoNotMatch(_addresses.length, _calldata.length);
        }
        for(uint i; i < _addresses.length; i++) {
            LibDiamond.initializeDiamondCut(_addresses[i], _calldata[i]);
        }
    }
}

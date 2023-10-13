// SPDX-License-Identifier: MIT
// This file is a modified version of RLPEncode.sol:
// https://github.com/mudgen/diamond-1-hardhat/tree/10a001c8f0d9e8b71e7e2fd8b5829da8a18f9a57/contracts
//
// MODIFICATIONS
// 1. Chenged solidity version to 0.8.18 from ^0.8.0

pragma solidity 0.8.18;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { IERC173 } from "../interfaces/IERC173.sol";

contract OwnershipFacet is IERC173 {
    function transferOwnership(address _newOwner) external override {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.setContractOwner(_newOwner);
    }

    function owner() external override view returns (address owner_) {
        owner_ = LibDiamond.contractOwner();
    }
}

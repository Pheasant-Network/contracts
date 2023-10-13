// SPDX-License-Identifier: MIT
// This file is a modified version of RLPEncode.sol:
// https://github.com/0xPolygon/fx-portal/tree/99cbdc89eec0674f7c8b6d3549acb148812f9285/contracts
//
// MODIFICATIONS
// 1. Chenged solidity version to 0.8.18 from ^0.8.0

pragma solidity 0.8.18;

interface IStateSender {
    function syncState(address receiver, bytes calldata data) external;
}

interface IFxStateSender {
    function sendMessageToChild(address _receiver, bytes calldata _data) external;
}

/**
 * @title FxRoot root contract for fx-portal
 */
contract FxRoot is IFxStateSender {
    IStateSender public stateSender;
    address public fxChild;

    constructor(address _stateSender) {
        stateSender = IStateSender(_stateSender);
    }

    function setFxChild(address _fxChild) public {
        require(fxChild == address(0x0));
        fxChild = _fxChild;
    }

    function sendMessageToChild(address _receiver, bytes calldata _data) public override {
        bytes memory data = abi.encode(msg.sender, _receiver, _data);
        stateSender.syncState(fxChild, data);
    }
}

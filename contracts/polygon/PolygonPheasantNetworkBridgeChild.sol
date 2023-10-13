// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "../L2/PheasantNetworkBridgeChild.sol";
import "solmate/src/utils/SafeTransferLib.sol";
import "solmate/src/tokens/ERC20.sol";

/**
 * @title PolygonPheasantNetworkBridgeChild
 * @dev PolygonPheasantNetworkBridgeChild is core contract inherited from PheasantNetworkBridgeChild for polygon.
 * It executes and manages bridge transaction.
 */
contract PolygonPheasantNetworkBridgeChild is PheasantNetworkBridgeChild {

    constructor(
        address _params,
        address _disputeManager,
        address _bondManager,
        address _newOwner
    ) PheasantNetworkBridgeChild(
        _params,
        _disputeManager,
        _bondManager,
        _newOwner
    ) {}

    function tokenValidation(uint256 _amount) internal override {}

    function tokenReceive(uint8 _tokenTypeIndex, uint256 _amount) internal override(PheasantNetworkBridgeChild) {
        token = ERC20(params.tokenAddress(params.networkCode(), _tokenTypeIndex));
        SafeTransferLib.safeTransferFrom(token, msg.sender, address(this), _amount);
    }

    function tokenTransfer(uint8 _tokenTypeIndex, address _to, uint256 _amount) internal override(PheasantNetworkBridgeChild) {
        token = ERC20(params.tokenAddress(params.networkCode(), _tokenTypeIndex));
        SafeTransferLib.safeTransfer(token, _to, _amount);
    }

    function tokenTransferFrom(uint8 _tokenTypeIndex, address _to, uint256 _amount) internal override(PheasantNetworkBridgeChild) {
        token = ERC20(params.tokenAddress(params.networkCode(), _tokenTypeIndex));
        SafeTransferLib.safeTransferFrom(token, msg.sender, _to, _amount);
    }

}

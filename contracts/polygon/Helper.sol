// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "./PolygonPheasantNetworkBridgeChild.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "hardhat/console.sol";

contract Helper is PolygonPheasantNetworkBridgeChild {

    using SafeMath for uint256;

    constructor(
        address _params,
        address _disputeManager,
        address _bondManager,
        address _newOwner
    ) PolygonPheasantNetworkBridgeChild(
        _params,
        _disputeManager,
        _bondManager,
        _newOwner
    ) {}

    function setUpTrade(
        address sender,
        uint256 index,
        address user,
        uint8 tokenTypeIndex,
        uint256 amount,
        uint256 timestamp,
        address to,
        address relayer,
        uint8 status,
        uint256 fee,
        uint256 destCode
    ) public {
        Types.Trade[] storage senderTrades = trades[sender];
        senderTrades.push(Types.Trade(
            index,
            user,
            tokenTypeIndex,
            amount,
            timestamp,
            to,
            relayer,
            status,
            fee,
            destCode
        ));

        userTradeList.push(Types.UserTrade(sender, senderTrades.length - 1));
    }

    function setUpDeposit(uint8 tokenTypeIndex, uint256 amount) public payable {
        tokenReceive(tokenTypeIndex, amount);
    }

    function setUpHashedEvidence(
        address user,
        uint256 index,
        Types.Evidence calldata evidence
    ) public {
        hashedEvidences[user][index] = Lib_BridgeUtils.hashEvidence(evidence);
    }

    function helperHashEvidence(Types.Evidence calldata evidence) public pure returns (bytes32){
        return Lib_BridgeUtils.hashEvidence(evidence);
    }

    function helperWithdraw(
        address user,
        uint256 index,
        bytes32 txHash,
        bytes32 hashedEvidence
    ) public {
        super.withdraw(user, index, txHash, hashedEvidence);
    }

    function setUpIsUniqueHashedEvidence(
        Types.Evidence calldata evidence
    ) public {
        bytes32 hashedEvidence = Lib_BridgeUtils.hashEvidence(evidence);
        isUniqueHashedEvidence[hashedEvidence] = 1;
    }

    function setUpIsUniqueHashedEvidenceUpwardTrade(
        Types.Evidence calldata evidence
    ) public {
        bytes32 hashedEvidence = Lib_BridgeUtils.hashEvidence(evidence);
        isUniqueHashedEvidenceUpwardTrade[hashedEvidence] = 1;
    }

    function resetIsUniqueHashedEvidenceUpwardTrade(
        Types.Evidence calldata evidence
    ) public {
        bytes32 hashedEvidence = Lib_BridgeUtils.hashEvidence(evidence);
        isUniqueHashedEvidenceUpwardTrade[hashedEvidence] = 0;
    }

    function getIsUniqueHashedEvidence(
        Types.Evidence calldata evidence
    ) public view returns (uint256){
        bytes32 hashedEvidence = Lib_BridgeUtils.hashEvidence(evidence);
        return isUniqueHashedEvidence[hashedEvidence];
    }

    function getDisputeManagerAddress() public view returns (address) {
        return address(disputeManager);
    }

    function getBondManagerAddress() public view returns (address) {
        return address(bondManager);
    }

    function setUpDispute(
        Types.UserTrade calldata _userTrade,
        Types.Dispute calldata _dispute
    ) public {
        disputes[_userTrade.userAddress][_userTrade.index] = _dispute;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "./PheasantNetworkParameters.sol";

contract ParameterHelper is PheasantNetworkParameters {

  constructor(
    address[] memory _tokenAddressList,
    address _newOwner,
    Types.TradeParam memory _tradeParam,
    uint256[] memory _availableNetwork,
    uint256[] memory _slashableNetwork,
    uint256[] memory _nativeIsNotETHNetworkCode,
    Types.FeeList memory _feeList
  ) PheasantNetworkParameters(
    _tokenAddressList,
    _newOwner,
    _tradeParam,
    _availableNetwork,
    _slashableNetwork,
    _nativeIsNotETHNetworkCode,
    _feeList
  ) {}

    function addTokenAddressHelper(uint256[] memory _networkCode, uint8[] memory _tokenIndex,  address[] memory _address) public {
        for (uint8 i = 0; i < _networkCode.length; i++) {
            tokenAddress[_networkCode[i]][_tokenIndex[i]] = _address[i];
        }
    }

    function addAvailableNetworksHelper(uint256[] memory _networkCodes, uint256[] memory _nativeIsNotETHNetworkCodes) public {
        for (uint8 i = 0; i < _networkCodes.length; i++) {
            availableNetwork[_networkCodes[i]] = uint(Bool.TRUE);
            nativeIsNotETH[_networkCodes[i]] = _nativeIsNotETHNetworkCodes[i];
        }
    }

    function updateTradableAmountHelper(uint8 _tokenIndex, uint256 _newTradeMinimumAmount, uint256 _newTradeThreshold) public {
        tradeMinimumAmount[_tokenIndex] = _newTradeMinimumAmount;
        tradeThreshold[_tokenIndex] = _newTradeThreshold;
    }

    function feeListUpdateHelper(uint8 _tokenTypeIndex, Types.FeeList calldata _newFeeList) public {
        feeList[_tokenTypeIndex] = _newFeeList;
    }

    uint256 public relayerFeeHelper;
    function setRelayerFeeHelper(uint8 _tokenTypeIndex) public {
        relayerFeeHelper = getRelayerFee(_tokenTypeIndex);
    }

    uint256 public gasFee;
    function setGasFeeHelper() public {
        gasFee = tx.gasprice;
    }

    function setUpDisputeDepositThresholdAmount(uint8 _tokenTypeIndex, uint256 _amount) public {
        disputeDepositAmount[_tokenTypeIndex] = _amount;
    }

}
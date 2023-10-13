// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { Types } from "../libraries/types/Types.sol";
import { Lib_DefaultValues } from "../libraries/constants/Lib_DefaultValues.sol";
import { IPheasantNetworkParameters } from "./IPheasantNetworkParameters.sol";

/**
 * @title PheasantNetworkParameters
 * @notice This contract defines parameters that is used in Pheasant Network.
 */
contract PheasantNetworkParameters is IPheasantNetworkParameters {

    constructor(
        address[] memory _tokenAddressList, // For L2 contract, this sould be 0x00...00
        address _newOwner,
        Types.TradeParam memory _tradeParam,
        uint256[] memory _availableNetwork,
        uint256[] memory _slashableNetwork,
        uint256[] memory _nativeIsNotETHNetworkCode,
        Types.FeeList memory _feeList
    ) {
        tokenAddress[_tradeParam.networkCode][Lib_DefaultValues.ETH_TOKEN_INDEX] = _tokenAddressList[Lib_DefaultValues.ETH_TOKEN_INDEX];
        tradeThreshold[Lib_DefaultValues.ETH_TOKEN_INDEX] = _tradeParam.tradeThreshold;
        tradeMinimumAmount[Lib_DefaultValues.ETH_TOKEN_INDEX] = _tradeParam.tradeMinimumAmount;
        tradableBondRatio = _tradeParam.tradableBondRatio;
        disputeDepositAmount[Lib_DefaultValues.ETH_TOKEN_INDEX] = _tradeParam.disputeDepositAmount;
        relayer = _newOwner;
        networkCode = _tradeParam.networkCode;
        availableNetwork[Lib_DefaultValues.ETH_NETWORK_CODE] = uint(Bool.TRUE);
        for (uint8 i = 0; i < _availableNetwork.length; i++) {
            availableNetwork[_availableNetwork[i]] = uint(Bool.TRUE);
        }
        for (uint8 i = 0; i < _slashableNetwork.length; i++) {
            slashableNetwork[_slashableNetwork[i]] = uint(Bool.TRUE);
        }
        for (uint8 i = 0; i < _nativeIsNotETHNetworkCode.length; i++) {
            nativeIsNotETH[_nativeIsNotETHNetworkCode[i]] = uint(Bool.TRUE);
        }
        feeList[0] = _feeList;
    }

    /*************
     * Variables *
     *************/
    uint256 public networkCode;
    address public relayer;
    uint256 public withdrawalBlockPeriod = 150;
    uint256 public tradableBondRatio;
    uint256 public defencePeriod = 3 hours;
    uint256 public disputablePeriod = 30 minutes;
    uint256 public withdrawalPeriod = 300 minutes;
    Types.TokenAddressUpdate public tokenAddressUpdate;
    Types.TradeParamUpdate public tradeParamUpdate;
    Types.NetworkSettingUpdate public networkSettingUpdate;
    Types.FeeListUpdate public feeListUpdate;
    Types.ManagerUpdate public managerUpdate;

    /************
     * Mappings *
     ************/
    mapping(uint256 => mapping(uint8 => address)) public tokenAddress; // networkCode => tokenTypeIndex => tokenAddress
    mapping(uint8 => uint256) public tradeThreshold; // tokenTypeIndex => tradeThreshold
    mapping(uint8 => uint256) public tradeMinimumAmount; // tokenTypeIndex => tradeMinimumAmount
    mapping(uint256 => uint256) public availableNetwork;
    mapping(uint256 => uint256) public slashableNetwork;
    mapping(uint256 => uint256) public nativeIsNotETH; // destCode => nativeIsNotETH
    mapping(uint8 => Types.FeeList) public feeList; // tokenTypeIndex => feeList
    mapping(uint8 => uint256) public disputeDepositAmount;

    /********
     * Enum *
     ********/
    enum Bool { FALSE, TRUE, UNKNOWN }
    enum TradeParamOperation { TRADE_THRESHOLD, TRADE_MINIMUM_AMOUNT, WITHDRAWAL_BLOCK_PERIOD, TRADABLE_BOND_RATIO, DISPUTE_DEPOSIT_AMOUNT, DEFENCE_PERIOD, DISPUTABLE_PERIOD, WITHDRAWAL_PERIOD }
    enum NetworkSettingOperation { ADD_AVAILABLE_NETWORK, TOGGLE_AVAILABLE_NETWORK, ADD_SLASHABLE_NETWORK }
    enum ManagerOperation { DISPUTE_MANAGER, BOND_MANAGER }

    /**********
     * Events *
     **********/
    event TokenAddressUpdate(bool isFinalized, uint256[] networkCodes, uint8[] tokenTypeIndices, address[] tokenAddresses);
    event TradeParamUpdate(bool isFinalized, uint8 operation, uint8 tokenTypeIndex, uint256 newValue);
    event NetworkSettingUpdate(bool isFinalized, uint8[] operations, uint256[] networkCodes, bool[] nativeIsNotETHs);
    event FeeListUpdate(bool isFinalized, uint8 tokenTypeIndex, Types.FeeList);
    event ManagerUpdate(bool isFinalized, uint8 operation, address newAddresses);

    /*************************
     * Only Relayer : update *
     *************************/

    /**
     * @notice Update token address
     * @param _networkCodes Array of networkCode to update token address
     * @param _tokenTypeIndices Array of token type index to update token address
     * @param _tokenAddresses Array of token address to update
     * @dev Only relayer can execute this function
     */
    function executeTokenAddressUpdate(uint256[] memory _networkCodes, uint8[] memory _tokenTypeIndices, address[] memory _tokenAddresses) external onlyRelayer {
        require(_networkCodes.length == _tokenTypeIndices.length, "Invalid length of array");
        require(_networkCodes.length == _tokenAddresses.length, "Invalid length of array");
        tokenAddressUpdate = Types.TokenAddressUpdate(uint64(block.timestamp + Lib_DefaultValues.UPDATE_PERIOD), _networkCodes, _tokenTypeIndices, _tokenAddresses);
        emit TokenAddressUpdate(false, _networkCodes, _tokenTypeIndices, _tokenAddresses);
    }

    /**
     * @notice Finalize token address update
     * @dev Only relayer can execute this function
     */
    function finalizeTokenAddressUpdate() external onlyWaitingPeriodOver(tokenAddressUpdate.executeAfter) {
        for (uint256 i = 0; i < tokenAddressUpdate.networkCodes.length; i++) {
            require(
                tokenAddress[tokenAddressUpdate.networkCodes[i]][tokenAddressUpdate.tokenTypeIndices[i]] == address(0),
                "Token address already exists"
            );
            tokenAddress[tokenAddressUpdate.networkCodes[i]][tokenAddressUpdate.tokenTypeIndices[i]] = tokenAddressUpdate.tokenAddresses[i];
        }
        emit TokenAddressUpdate(true, tokenAddressUpdate.networkCodes, tokenAddressUpdate.tokenTypeIndices, tokenAddressUpdate.tokenAddresses);
        delete tokenAddressUpdate;
    }

    /**
     * @notice Request to update trade threshold amount
     * @dev Only relayer can execute this function
     * @param _operation Update trade param operation. 0:tradeThresold, 1:tradeMinimumAMount, 2:withdrawalBlockPeriod, 3:tradableBondRatio, 4: disputeDepositAmount, 5: defencePeriod, 6: disputablePeriod, 7: withdrawalPeriod
     * @param _tokenTypeIndex Token type index. for operation 2, 3, 5, 6, and 7, this value is ignored
     * @param _newValue New value of trade param
     */
    function executeTradeParamUpdate(uint8 _operation, uint8 _tokenTypeIndex, uint256 _newValue) external validateTokenIndex(networkCode, _tokenTypeIndex) onlyRelayer {
        tradeParamUpdate = Types.TradeParamUpdate(uint64(block.timestamp + Lib_DefaultValues.UPDATE_PERIOD), _operation, _tokenTypeIndex, _newValue);
        emit TradeParamUpdate(false, _operation, _tokenTypeIndex, _newValue);
    }

    /**
     * @notice Update trade threshold amount
     */
    function finalizeTradeParamUpdate() external onlyWaitingPeriodOver(tradeParamUpdate.executeAfter) {
        uint8 tokenTypeIndex = tradeParamUpdate.tokenTypeIndex;
        uint8 operation = tradeParamUpdate.operation;
        if (operation == uint(TradeParamOperation.TRADE_THRESHOLD)) {
            tradeThreshold[tokenTypeIndex] = tradeParamUpdate.newValue;
        } else if (operation == uint(TradeParamOperation.TRADE_MINIMUM_AMOUNT)) {
            tradeMinimumAmount[tokenTypeIndex] = tradeParamUpdate.newValue;
        } else if (operation == uint(TradeParamOperation.WITHDRAWAL_BLOCK_PERIOD)) {
            withdrawalBlockPeriod = tradeParamUpdate.newValue;
        } else if (operation == uint(TradeParamOperation.TRADABLE_BOND_RATIO)) {
            if (tradeParamUpdate.newValue <= 100) return;
            tradableBondRatio = tradeParamUpdate.newValue;
        } else if (operation == uint(TradeParamOperation.DISPUTE_DEPOSIT_AMOUNT)) {
            disputeDepositAmount[tokenTypeIndex] = tradeParamUpdate.newValue;
        } else if (operation == uint(TradeParamOperation.DEFENCE_PERIOD)) {
            defencePeriod = tradeParamUpdate.newValue;
        } else if (operation == uint(TradeParamOperation.DISPUTABLE_PERIOD)) {
            disputablePeriod = tradeParamUpdate.newValue;
        } else if (operation == uint(TradeParamOperation.WITHDRAWAL_PERIOD)) {
            withdrawalPeriod = tradeParamUpdate.newValue;
        }
        emit TradeParamUpdate(true, operation, tokenTypeIndex, tradeParamUpdate.newValue);
        delete tradeParamUpdate;
    }

    /**
     * @notice Update network setting
     * @param _operations Update operation. 0:add avaiableNetwork, 1: remove avaiableNetwork, 2: add slashableNetwork
     * @param _networkCodes Array of networkCode to update setting
     * @param _nativeIsNotETH Array of nativeIsNotETH to update setting, this value is only for operation 0
     * @dev Only relayer can execute this function.
     */
    function executeNetworkSettingUpdate(uint8[] memory _operations, uint256[] memory _networkCodes, bool[] memory _nativeIsNotETH) external onlyRelayer {
        require(
            _operations.length == _networkCodes.length && _operations.length == _nativeIsNotETH.length,
            "Invalid length of array"
        );
        networkSettingUpdate = Types.NetworkSettingUpdate(uint64(block.timestamp + Lib_DefaultValues.UPDATE_PERIOD), _operations, _networkCodes, _nativeIsNotETH);
        emit NetworkSettingUpdate(false, _operations, _networkCodes, _nativeIsNotETH);
    }

    /**
     * @notice Update network Setting
     */
    function finalizeNetworkSettingUpdate() external onlyWaitingPeriodOver(networkSettingUpdate.executeAfter) {
        for (uint256 i = 0; i < networkSettingUpdate.operations.length; i++) {
            uint8 operation = networkSettingUpdate.operations[i];
            if (operation == uint(NetworkSettingOperation.ADD_AVAILABLE_NETWORK)) {
                require(availableNetwork[networkSettingUpdate.networkCodes[i]] == uint(Bool.FALSE), "Network is already available");
                availableNetwork[networkSettingUpdate.networkCodes[i]] = uint(Bool.TRUE);
                if (networkSettingUpdate.nativeIsNotETH[i]) {
                    nativeIsNotETH[networkSettingUpdate.networkCodes[i]] = uint(Bool.TRUE);
                }
            } else if (operation == uint(NetworkSettingOperation.TOGGLE_AVAILABLE_NETWORK)) {
                if(availableNetwork[networkSettingUpdate.networkCodes[i]] == uint(Bool.TRUE)) {
                    availableNetwork[networkSettingUpdate.networkCodes[i]] = uint(Bool.UNKNOWN);
                } else if (availableNetwork[networkSettingUpdate.networkCodes[i]] == uint(Bool.UNKNOWN)) {
                    availableNetwork[networkSettingUpdate.networkCodes[i]] = uint(Bool.TRUE);
                }
            } else if (operation == uint(NetworkSettingOperation.ADD_SLASHABLE_NETWORK)) {
                slashableNetwork[networkSettingUpdate.networkCodes[i]] = uint(Bool.TRUE);
            }
        }
        emit NetworkSettingUpdate(true, networkSettingUpdate.operations, networkSettingUpdate.networkCodes, networkSettingUpdate.nativeIsNotETH);
        delete networkSettingUpdate;
    }

    /**
     * @notice Request to update fee list
     * @dev Only relayer can execute this function
     * @param _tokenTypeIndex Token type index
     * @param _newFeeList Set fee list
     */
    function executeFeeListUpdate(uint8 _tokenTypeIndex, Types.FeeList calldata _newFeeList) external onlyRelayer {
        feeListUpdate = Types.FeeListUpdate(uint64(block.timestamp + Lib_DefaultValues.UPDATE_PERIOD), _tokenTypeIndex, _newFeeList);
        emit FeeListUpdate(false, _tokenTypeIndex, _newFeeList);
    }

    /**
     * @notice Update trade threshold amount
     */
    function finalizeFeeListUpdate() external onlyWaitingPeriodOver(feeListUpdate.executeAfter) {
        feeList[feeListUpdate.tokenTypeIndex] = feeListUpdate.newFeeList;
        emit FeeListUpdate(true, feeListUpdate.tokenTypeIndex, feeListUpdate.newFeeList);
        delete feeListUpdate;
    }

    /*****************************
     * View Functions : Contract *
     *****************************/

    /**
     * @notice Get the current fee for the relayer
     * @dev This function returns the next fee depending on gas price.
     *      Use in transaction. If not used in a transaction, tx.gasprice is always returned as 0.
     * @param _tokenTypeIndex Token type index
     * @return The current fee for the relayer
     */
    function getRelayerFee(uint8 _tokenTypeIndex) public view returns (uint256) {
        if(tx.gasprice > feeList[_tokenTypeIndex].gasPriceThresholdHigh) {
            return  feeList[_tokenTypeIndex].high;
        } else if (tx.gasprice < feeList[_tokenTypeIndex].gasPriceThresholdLow) {
            return  feeList[_tokenTypeIndex].low;
        } else {
            return  feeList[_tokenTypeIndex].medium;
        }
    }

    /**
     * @notice Get required bond for trade
     * @dev This function returns the required bond amount.
     * @param _amount Asset amount
     * @return Required amount for trade
     */
    function getRequiredBondAmount(uint256 _amount) external view returns (uint256) {
        return _amount * tradableBondRatio / 100;
    }

    /**
     * @notice Get NetworkSettingUpdate struct
     * @return NetworkSettingUpdate struct
     */
    function getNetworkSettingUpdate() external view returns (Types.NetworkSettingUpdate memory) {
        return networkSettingUpdate;
    }

    /**
     * @notice Get TokenAddressUpdate struct
     * @return TokenAddressUpdate struct
     */
    function getTokenAddressUpdate() external view returns (Types.TokenAddressUpdate memory) {
        return tokenAddressUpdate;
    }

    /************
     * Modifier *
     ************/

    /**
     * @dev throws if called by any account other than the relayer
     */
    modifier onlyRelayer() {
        require(relayer == msg.sender, "Only for relayer");
        _;
    }

    /**
     * @notice Check if the given token index is valid
     * @param destCode Destination network code
     * @param _tokenIndex Token index to check
     */
    modifier validateTokenIndex(uint256 destCode, uint8 _tokenIndex) {
        require(_tokenIndex == Lib_DefaultValues.ETH_TOKEN_INDEX || tokenAddress[destCode][_tokenIndex] != address(0), "Invalid token index");
        _;
    }

    /**
     * @notice Check if certain period is over
     * @param _executeAfter Timestamp of period end
     */
    modifier onlyWaitingPeriodOver(uint256 _executeAfter) {
        require(uint64(block.timestamp) > _executeAfter && _executeAfter != 0, "Ongoing update period");
        _;
    }
}

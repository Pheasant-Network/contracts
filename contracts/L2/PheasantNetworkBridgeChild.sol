// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "solmate/src/utils/SafeTransferLib.sol";
import "solmate/src/tokens/ERC20.sol";
import "solmate/src/auth/Owned.sol";
import { IBridgeDisputeManager } from "../bridge-dispute-manager/IBridgeDisputeManager.sol";
import { IBondManager } from "../bond-manager/IBondManager.sol";
import { Lib_BridgeUtils } from "../libraries/bridge/Lib_BridgeUtils.sol";
import { Types } from "../libraries/types/Types.sol";
import { Lib_DefaultValues } from "../libraries/constants/Lib_DefaultValues.sol";
import { IPheasantNetworkParameters } from "./IPheasantNetworkParameters.sol";

/**
 * @title PheasantNetworkBridgeChild
 * @dev Pheasant Network Bridge Child contract is core contract of Pheasant Network.
 * It executes and manages bridge transaction.
 */
contract PheasantNetworkBridgeChild is Owned {

    constructor(
        address _params,
        address _disputeManager,
        address _bondManager,
        address _newOwner
    ) Owned(_newOwner) {
        params = IPheasantNetworkParameters(_params);
        disputeManager = IBridgeDisputeManager(_disputeManager);
        bondManager = IBondManager(_bondManager);
        networkCode = params.networkCode();
        relayer = _newOwner;
    }

    /*************
     * Variables *
     *************/
    uint256 public networkCode;
    address public relayer;
    bool internal isActive = true;
    ERC20 internal token;
    Types.UserTrade[] public userTradeList;
    IPheasantNetworkParameters internal params;
    IBridgeDisputeManager internal disputeManager;
    IBondManager internal bondManager;
    Types.ManagerUpdate public managerUpdate;

    /************
     * Mappings *
     ************/
    mapping(address => Types.Trade[]) internal trades;
    mapping(address => mapping(uint256 => bytes32)) public hashedEvidences;
    mapping(address => mapping(uint256 => bytes32)) public destTxHashes;
    mapping(bytes32 => uint256) public isUniqueHashedEvidence;
    mapping(bytes32 => uint256) public isUniqueHashedEvidenceUpwardTrade;
    mapping(address => mapping(uint256 => Types.Dispute)) public disputes;

    /********
     * Enum *
     ********/
    enum Bool { FALSE, TRUE, UNKNOWN }
    enum ManagerOperation { DISPUTE_MANAGER, BOND_MANAGER, PARAMETERS }

    /**********
     * Events *
     **********/
    event NewTrade(address indexed userAddress, uint256 index);
    event Withdraw(address indexed userAddress, bytes32 indexed txHash, uint256 index);
    event Accept(address indexed userAddress, bytes32 indexed txHash, uint256 index);
    event Dispute(address indexed userAddress, uint256 indexed index, uint256 disputedTime);
    event Defence(address indexed userAddress, uint256 indexed index, uint8 status);
    event Slash(address indexed userAddress, uint256 indexed index, address relayer);
    event Cancel(address indexed userAddress, uint256 index, string reason);
    event ManagerUpdate(bool isFinalized, uint8 operation, address newAddresses);

    /******************************
     * External functions : Trade *
     ******************************/

    /**
     * @notice Create new downward(Layer2 →　Layer1) trade
     * @param _amount Trade amount
     * @param _to Recipient address
     * @param _fee Fee to the relayer
     * @param _tokenTypeIndex Token type index
     * @param _destCode Destination network code
     */
    function newTrade(
        uint256 _amount,
        address _to,
        uint256 _fee,
        uint8 _tokenTypeIndex,
        uint256 _destCode
    ) external payable validateTokenIndex(_destCode, _tokenTypeIndex) onlyActiveContract {
        require(networkCode != _destCode && params.availableNetwork(_destCode) == uint(Bool.TRUE), "Unavailable dest code");
        require(_amount <= params.tradeThreshold(_tokenTypeIndex), "Exceed exchangeable limit!");
        require(_amount >= params.tradeMinimumAmount(_tokenTypeIndex), "Amount too low!");
        require(_fee < _amount, "Fee is too high!"); // this might be deleted

        uint256 tradeIndex = trades[msg.sender].length;
        trades[msg.sender].push(
            Types.Trade(
                tradeIndex,
                msg.sender,
                _tokenTypeIndex,
                _amount,
                block.timestamp,
                _to,
                address(0x0),
                Lib_DefaultValues.STATUS_START,
                _fee,
                _destCode
            )
        );
        userTradeList.push(Types.UserTrade(msg.sender, tradeIndex));
        emit NewTrade(msg.sender, tradeIndex);

        tokenReceive(_tokenTypeIndex, _amount);
    }

    /**
     * @notice Cancel specific trade
     * @param _index User trade index
     */
    function cancelTrade(uint256 _index) external {
        Types.Trade memory trade = getTrade(msg.sender, _index);
        require(trade.status == Lib_DefaultValues.STATUS_START, "Only for START status");
        require(trade.timestamp + Lib_DefaultValues.CANCELABLE_PERIOD < block.timestamp, "After cancel period");
        trade.status = Lib_DefaultValues.STATUS_CANCEL;
        trades[msg.sender][_index] = trade;
        tokenTransfer(trade.tokenTypeIndex, trade.user, trade.amount);

        emit Cancel(msg.sender, _index, "");
    }

    /**
     * @notice Dispute when someone realize malicious acts by the relayer
     * @param _tokenTypeIndex Token type index
     * @param _amount Amount of asset deposited for dispute
     * @param _userAddress User address
     * @param _index User trade index
     */
    function dispute(
        uint8 _tokenTypeIndex,
        uint256 _amount,
        address _userAddress,
        uint256 _index
    ) external payable onlyActiveContract validateTokenIndex(networkCode, _tokenTypeIndex) {
        Types.Trade memory trade = getTrade(_userAddress, _index);
        require(trade.status == Lib_DefaultValues.STATUS_PAID, "Only for PAID status");
        require(params.slashableNetwork(trade.destCode) == uint(Bool.TRUE), "Unavailable dest code");
        require(block.timestamp - trade.timestamp < params.disputablePeriod(), "Not in disputable period");
        require(_amount >= params.disputeDepositAmount(_tokenTypeIndex), "Amount too low!");
        require(_tokenTypeIndex == trade.tokenTypeIndex, "Invalid tokenTypeIndex");
        tokenReceive(_tokenTypeIndex, _amount);

        disputes[_userAddress][_index] = Types.Dispute(
            msg.sender,
            _tokenTypeIndex,
            _amount,
            block.timestamp
        );
        trade.status = Lib_DefaultValues.STATUS_DISPUTE;
        trades[_userAddress][_index] = trade;
        emit Dispute(_userAddress, _index, block.timestamp);
    }

    /**
     * @notice Defence process by the relayer to prove their evidence validity
     * @param _userAddress User address
     * @param _index User trade index
     * @param _evidence Evidence object to be proved
     */
    function defence(
        address _userAddress,
        uint256 _index,
        Types.Evidence calldata _evidence
    ) external onlyRelayer {
        Types.Trade memory trade = getTrade(_userAddress, _index);
        Types.Dispute memory dispute = disputes[_userAddress][_index];
        require(trade.status == Lib_DefaultValues.STATUS_DISPUTE, "Only for DISPUTE status");
        require(hashedEvidences[_userAddress][_index] == Lib_BridgeUtils.hashEvidence(_evidence), "Wrong evidence!");
        require(destTxHashes[_userAddress][_index] == keccak256(_evidence.transaction), "Wrong tx hash!");

        if (isValidEvidence(trade, _evidence)) {
            trade.status = Lib_DefaultValues.STATUS_PROVED;
            trades[_userAddress][_index] = trade;
            uint256 depositAmount = dispute.deposit;
            dispute.deposit = 0;
            disputes[_userAddress][_index] = dispute;
            tokenTransfer(dispute.tokenTypeIndex, relayer, depositAmount);
        } else {
            trade.status = Lib_DefaultValues.STATUS_SLASHED;
            trades[_userAddress][_index] = trade;
        }
        emit Defence(_userAddress, _index, trade.status);
    }

    /**
     * @notice Slash when the relayer failed prove their evidence or passed defencePeriod without defence process
     * @param _userAddress User address
     * @param _index User trade index
     */
    function slash(
        address _userAddress,
        uint256 _index
    ) external onlyActiveContract {
        Types.Dispute memory dispute = disputes[_userAddress][_index];
        require(dispute.disputer == msg.sender, "Only for disputer");
        Types.Trade memory trade = getTrade(_userAddress, _index);
        require(
            trade.status == Lib_DefaultValues.STATUS_DISPUTE
            || trade.status == Lib_DefaultValues.STATUS_SLASHED,
            "Only for disputed trade"
        );
        if (block.timestamp > dispute.disputedTimestamp + params.defencePeriod()) {
            trade.status = Lib_DefaultValues.STATUS_SLASHED;
        }
        trades[_userAddress][_index] = trade;
        uint256 depositAmount = dispute.deposit;
        dispute.deposit = 0;
        disputes[_userAddress][_index] = dispute;
        tokenTransfer(dispute.tokenTypeIndex, msg.sender, depositAmount);
        withdrawAssetFromSlashedTrade(_userAddress, _index);
        emit Slash(_userAddress, _index, trade.relayer);
    }

    /**
     * @notice Slash upward trade and send asset to user and disputer
     * @param _tokenTypeIndex Token type index
     * @param _evidence Evidence object to slash
     */
    function slashUpwardTrade(
        uint8 _tokenTypeIndex,
        Types.Evidence calldata _evidence
    ) external validateTokenIndex(networkCode, _tokenTypeIndex) onlyActiveContract {
        // check hashed evidence is unique
        bytes32 hashedEvidence = Lib_BridgeUtils.hashEvidence(_evidence);
        require(isUniqueHashedEvidenceUpwardTrade[hashedEvidence] == uint(Bool.FALSE), "Not unique hashed evidence");

        // Check if the current block timestamp is after the UPWARD_SLASH_START and within the SLASHABLE_PERIOD
        uint256 txTimestamp = Lib_BridgeUtils.toUint32(_evidence.rawBlockHeader[Lib_DefaultValues.BLOCKHEADER_TIMESTAMP_INDEX], 0);
        require(block.timestamp - txTimestamp > Lib_DefaultValues.UPWARD_SLASH_START, "Not yet available for slashing");
        require(block.timestamp - txTimestamp < Lib_DefaultValues.SLASHABLE_PERIOD, "Out of slashable period");

        // recover relayer and amount. relayer is "to" and amount is "value" in transaction data
        address toRelayer;
        uint256 amount;
        (toRelayer, amount) = getToAndValueFromTransferData(_tokenTypeIndex, _evidence.transaction);

        // toRelayer, amount and dest validation
        require(toRelayer == relayer, "Wrong relayer address");
        require(amount <= params.tradeThreshold(_tokenTypeIndex), "Amount too big!");
        require(amount >= params.tradeMinimumAmount(_tokenTypeIndex), "Amount too low!");
        require(disputeManager.checkDestNetworkCode(amount, networkCode), "Invalid network id");

        // revoder signed user address
        address recoveredUser = disputeManager.recoverAddress(_evidence.rawTx);

        // create trade from evidence
        uint256 tradeLength = trades[recoveredUser].length;
        Types.Trade memory trade = Types.Trade(
            tradeLength,
            recoveredUser,
            _tokenTypeIndex,
            amount,
            block.timestamp,
            recoveredUser,
            toRelayer,
            Lib_DefaultValues.STATUS_SLASHED,
            0, //zero fee
            networkCode // set networkCode for trade from L1
        );

        // For upward trade, dispter can slash if isValidEvidence returns true
        require(isValidEvidence(trade, _evidence), "Invalid evidence");

        // update trade list
        trades[recoveredUser].push(trade);
        userTradeList.push(Types.UserTrade(recoveredUser, tradeLength));

        // update hashed evidence
        isUniqueHashedEvidenceUpwardTrade[hashedEvidence] = uint(Bool.TRUE);

        emit Slash(recoveredUser, tradeLength, trade.relayer);

        // slash bond
        withdrawAssetFromSlashedTrade(recoveredUser, tradeLength);
    }

    /************************
     * Only Relayer : trade *
     ************************/

    /**
     * @notice Withdraw asset and submit evidence of send asset on L1
     * @param _user Address of user
     * @param _index Index of trade from user's trade history
     * @param _txHash tx hash of the asset sending in dest chain
     * @param _hashedEvidence Hash of evidence object
     */
    function withdraw(
        address _user,
        uint256 _index,
        bytes32 _txHash,
        bytes32 _hashedEvidence
    ) public onlyRelayer {
        Types.Trade memory trade = getTrade(_user, _index);
        require(bondManager.getBond(trade.tokenTypeIndex) >= params.getRequiredBondAmount(params.tradeThreshold(trade.tokenTypeIndex)), "Insufficient bond amount for trade");
        require(trade.status == Lib_DefaultValues.STATUS_START, "Only for START trade");
        require(block.timestamp - trade.timestamp < params.withdrawalPeriod(), "Only for withdrawal period");

        trade.status = Lib_DefaultValues.STATUS_PAID;
        trades[_user][_index] = trade;

        // Check if evidence is unique
        require(isUniqueHashedEvidence[_hashedEvidence] == uint(Bool.FALSE), "Not unique hashed evidence");
        isUniqueHashedEvidence[_hashedEvidence] = uint(Bool.TRUE);
        hashedEvidences[_user][_index] = _hashedEvidence;
        destTxHashes[_user][_index] = _txHash;

        emit Withdraw(_user, _txHash, _index);

        tokenTransfer(trade.tokenTypeIndex, msg.sender, trade.amount);
    }

    /**
     * @notice Withdraw multiple trade at one transaction
     * @param _userTrades Array of UserTrade object
     * @param _txHashes Array of tx hash
     * @param _hashedEvidences Array of hashed evidence
     * @dev Only relayer depositing avaiable bond can execute this function.
     */
    function bulkWithdraw(Types.UserTrade[] calldata _userTrades, bytes32[] calldata _txHashes, bytes32[] calldata _hashedEvidences) external onlyRelayer {
        for (uint256 i = 0; i < _userTrades.length; i++) {
            withdraw(_userTrades[i].userAddress, _userTrades[i].index, _txHashes[i], _hashedEvidences[i]);
        }
    }

    /**
     * @notice Cancel specific trade by relayer, e.g. when fees are too low or relayer cannot process the trade
     * @param user Address of the user who initiated the trade
     * @param _index User trade index
     * @param _reason Reason for cancelling the trade
     */
    function cancelTradeByRelayer(address user, uint256 _index, string memory _reason) external onlyRelayer {
        require(bytes(_reason).length <= 100, "Too long reason");
        Types.Trade memory trade = getTrade(user, _index);
        require(trade.status == Lib_DefaultValues.STATUS_START, "Only for START status");
        trade.status = Lib_DefaultValues.STATUS_CANCEL;
        trades[user][_index] = trade;
        tokenTransfer(trade.tokenTypeIndex, trade.user, trade.amount);
        emit Cancel(msg.sender, _index, _reason);
    }

    /**
     * @notice Accept upward (Layer1 to Layer2) trade
     * @param _evidence The evidence of the transaction
     */
    function acceptETHUpwardTrade(Types.Evidence calldata _evidence) public payable onlyRelayer {
        (address recoveredUser, uint256 tradeAmount, uint256 tradeIndex) = createTradeAndCheckEvidence(Lib_DefaultValues.ETH_TOKEN_INDEX, _evidence);
        tokenValidation(tradeAmount);
        tokenTransferFrom(Lib_DefaultValues.ETH_TOKEN_INDEX, recoveredUser, tradeAmount);

        emit Accept(recoveredUser, keccak256(_evidence.transaction), tradeIndex);
    }

    function acceptERC20UpwardTrade(uint8 _tokenTypeIndex, Types.Evidence calldata _evidence) public payable onlyRelayer {
        require(_tokenTypeIndex != Lib_DefaultValues.ETH_TOKEN_INDEX, "ETH_TOKEN_INDEX is not allowed");
        (address recoveredUser, uint256 tradeAmount, uint256 tradeIndex) = createTradeAndCheckEvidence(_tokenTypeIndex, _evidence);
        tokenTransferFrom(_tokenTypeIndex, recoveredUser, tradeAmount);

        emit Accept(recoveredUser, keccak256(_evidence.transaction), tradeIndex);
    }

    /**
     * @notice Accept multiple upward (Layer1 to Layer2) trade
     * @param _evidences Array of evidence object
     */
    function bulkAcceptETHUpwardTrade(Types.Evidence[] calldata _evidences) external payable onlyRelayer {
        uint256 tradeLength = _evidences.length;
        uint256 totalTradeAmount = 0;
        address[] memory users = new address[](tradeLength);
        uint256[] memory amounts = new uint256[](tradeLength);

        for (uint256 i = 0; i < tradeLength; i++) {
            (address recoveredUser, uint256 tradeAmount, uint256 tradeIndex) = createTradeAndCheckEvidence(Lib_DefaultValues.ETH_TOKEN_INDEX, _evidences[i]);
            totalTradeAmount += tradeAmount;
            users[i] = recoveredUser;
            amounts[i] = tradeAmount;
            // to save gas, emit Accept event here, otherwise need to store tradeIndex only for event
            emit Accept(recoveredUser, keccak256(_evidences[i].transaction), tradeIndex);
        }

        // Validation for total trade amount
        tokenValidation(totalTradeAmount);

        for (uint256 i = 0; i < tradeLength; i++) {
            tokenTransferFrom(Lib_DefaultValues.ETH_TOKEN_INDEX, users[i], amounts[i]);
        }
    }

    function bulkAcceptERC20UpwardTrade(uint8[] memory _tokenTypeIndices, Types.Evidence[] calldata _evidences) external payable onlyRelayer {
        for (uint256 i = 0; i < _evidences.length; i++) {
            acceptERC20UpwardTrade(_tokenTypeIndices[i], _evidences[i]);
        }
    }

    /**
     * @notice Update manager contract
     * @dev Only relayer can execute this function
     * @param _operation Update operation. 0:disputeManager, 1:bondManager, 2:param
     * @param _newManager New manager contract address
     */
    function executeManagerUpdate(uint8 _operation, address _newManager) external onlyRelayer {
        managerUpdate = Types.ManagerUpdate(uint64(block.timestamp + Lib_DefaultValues.UPDATE_PERIOD), _operation, _newManager);
        emit ManagerUpdate(false, _operation, _newManager);
    }

    /**
     * @notice Update manager contract
     */
    function finalizeManagerUpdate() external onlyWaitingPeriodOver(managerUpdate.executeAfter) {
        uint8 operation = managerUpdate.operation;
        if (operation == uint(ManagerOperation.DISPUTE_MANAGER)) {
            disputeManager = IBridgeDisputeManager(managerUpdate.newManager);
        } else if (operation == uint(ManagerOperation.BOND_MANAGER)) {
            bondManager = IBondManager(managerUpdate.newManager);
        } else if (operation == uint(ManagerOperation.PARAMETERS)) {
            params = IPheasantNetworkParameters(managerUpdate.newManager);
        }
        emit ManagerUpdate(true, operation, managerUpdate.newManager);
        delete managerUpdate;
    }

    /**********************
     * internal functions *
     **********************/
    function createTradeAndCheckEvidence(
        uint8 _tokenTypeIndex,
        Types.Evidence calldata _evidence
    ) internal validateTokenIndex(networkCode, _tokenTypeIndex) returns (address, uint256, uint256) {
        // recover relayer and amount. relayer is "to" and amount is "value" in transaction data
        address toRelayer;
        uint256 amount;
        (toRelayer, amount) = getToAndValueFromTransferData(_tokenTypeIndex, _evidence.transaction);

        // amount validation
        require(amount <= params.tradeThreshold(_tokenTypeIndex), "Amount too big!");
        require(amount >= params.tradeMinimumAmount(_tokenTypeIndex), "Amount too low!");

        uint256 fee = params.getRelayerFee(_tokenTypeIndex);

        // recover signed address from rawTx included in evidence
        address recoveredUser = disputeManager.recoverAddress(_evidence.rawTx);

        uint256 tradeIndex = trades[recoveredUser].length;
        trades[recoveredUser].push(
            Types.Trade(
                tradeIndex,
                recoveredUser,
                _tokenTypeIndex,
                amount,
                block.timestamp,
                recoveredUser,
                toRelayer,
                Lib_DefaultValues.STATUS_PAID,
                fee,
                networkCode // set networkCode for trade from L1
            )
        );
        userTradeList.push(Types.UserTrade(recoveredUser, tradeIndex));

        // Check if submitted evidence is unique
        bytes32 hashedEvidence = Lib_BridgeUtils.hashEvidence(_evidence);
        require(isUniqueHashedEvidenceUpwardTrade[hashedEvidence] == uint(Bool.FALSE), "Not unique hashed evidence");
        isUniqueHashedEvidenceUpwardTrade[hashedEvidence] = uint(Bool.TRUE);

        uint256 tradeAmount = amount - fee;

        return (recoveredUser, tradeAmount, tradeIndex);
    }

    /******************************
     * internal virtual functions *
     ******************************/

    function tokenValidation(uint256 _amount) internal virtual {
        require(msg.value >= _amount, "Insufficient msg.value");
        // send back excess ether
        if (msg.value > _amount) {
            SafeTransferLib.safeTransferETH(msg.sender, msg.value - _amount);
        }
    }

    /**
     * @notice Receive token from user
     * @dev The caller of this function may be executed as both a payable and not payable function.
      This function is also intended to be overridden by PolygonPheasantNetworkBridgeChild.sol for Polygon to switch processing.
     * @param _tokenTypeIndex Token type index
     * @param _amount Amount of token
     */
    function tokenReceive(uint8 _tokenTypeIndex, uint256 _amount) internal virtual {
        if(_tokenTypeIndex == Lib_DefaultValues.ETH_TOKEN_INDEX) {
            require(msg.value == _amount, "Insufficient msg.value");
        } else {
            token = ERC20(params.tokenAddress(networkCode, _tokenTypeIndex));
            SafeTransferLib.safeTransferFrom(token, msg.sender, address(this), _amount);
        }
    }

    /**
     * @notice Transfer token to user
     * @param _tokenTypeIndex Token type index
     * @param _to Address of user
     * @param _amount Amount of token
     */
    function tokenTransfer(uint8 _tokenTypeIndex, address _to, uint256 _amount) internal virtual {
        if (_tokenTypeIndex == Lib_DefaultValues.ETH_TOKEN_INDEX) {
            SafeTransferLib.safeTransferETH(_to, _amount);
        } else {
            token = ERC20(params.tokenAddress(networkCode, _tokenTypeIndex));
            SafeTransferLib.safeTransfer(token, _to, _amount);
        }
    }

    /**
     * @notice Transfer token from user
     * @dev Must execute the tokenValidation() beforehand as this function haven't been implemented value validation.
     * @param _tokenTypeIndex Token type index
     * @param _to Address of user
     * @param _amount Amount of token
     */
    function tokenTransferFrom(uint8 _tokenTypeIndex, address _to, uint256 _amount) internal virtual {
        if (_tokenTypeIndex == Lib_DefaultValues.ETH_TOKEN_INDEX) {
            SafeTransferLib.safeTransferETH(_to, _amount);
        } else {
            token = ERC20(params.tokenAddress(networkCode, _tokenTypeIndex));
            SafeTransferLib.safeTransferFrom(token, msg.sender, _to, _amount);
        }
    }

    /**
     * @notice Withdraw slashed asset
     * @dev This function can be overridden for future updates when a new bond system is implemented
     * @param _user Address of trade user
     * @param _index index of suspicious trade from user's trade history
     */
    function withdrawAssetFromSlashedTrade(address _user, uint256 _index) internal virtual {
        Types.Trade memory trade = getTrade(_user, _index);
        require(trade.status == Lib_DefaultValues.STATUS_SLASHED, "Not yet slashed");

        uint256 slashableBond = params.getRequiredBondAmount(trade.amount);
        bondManager.slash(trade.tokenTypeIndex, slashableBond);

        trade.status = Lib_DefaultValues.STATUS_SLASH_COMPLETED;
        trades[_user][_index] = trade;

        tokenTransfer(trade.tokenTypeIndex, msg.sender, slashableBond / 2);
        tokenTransfer(trade.tokenTypeIndex, _user, slashableBond / 2);
    }

    /*************************
     * Only Owner : Contract *
     *************************/

    /**
     * @notice Toggles the contract's active state.
     * Allows the contract owner to deactivate the contract when a critical issue is discovered
     * or when updating the contract.
     */
    function toggleContractActive() onlyOwner external {
        isActive = !isActive;
    }

    /*****************************
     * View Functions : Contract *
     *****************************/

    /**
     * @notice Check if the contract is active
     * @return True if the contcact is active, otherwise false
     */
    function getContractStatus() external view returns (bool) {
        return isActive;
    }


    /**************************
     * View Functions : Trade *
     **************************/
    /**
     * @notice Get specific user trade
     * @param _user Address of user
     * @param _index Index of trade from user's trade history
     * @return Trade object
     */
    function getTrade(address _user, uint256 _index) public view returns (Types.Trade memory) {
        require(trades[_user].length >= _index + 1, "No Trade Exists");
        return trades[_user][_index];
    }

    /**
     * @notice Get user trade list
     * @return Length of UserTrade object
     */
    function getUserTradeListLength() external view returns (uint256) {
        return userTradeList.length;
    }

    /**
     * @notice Get user trade list by index
     * @param _startIndex Start index of user trade list
     * @param _endIndex End index of user trade list
     * @return Array of UserTrade object
     */
    function getUserTradeListByIndex(uint256 _startIndex, uint256 _endIndex) external view returns (Types.UserTrade[] memory) {
        require(userTradeList.length > _endIndex, "End Index Out of Bounds");
        require(_startIndex <= _endIndex, "Invalid Range");

        uint256 length = _endIndex - _startIndex + 1;
        Types.UserTrade[] memory result = new Types.UserTrade[](length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = userTradeList[_startIndex + i];
        }
        return result;
    }

    /**
     * @notice Get array of trade from array of UserTrade
     * @param _userTrades Array of user UserTrade object
     * @return Array of Trade object
     */
    function getTrades(Types.UserTrade[] memory _userTrades) external view returns (Types.Trade[] memory) {
        uint256 length = _userTrades.length;
        Types.Trade[] memory tradeList = new Types.Trade[](length);

        for (uint256 i = 0; i < length; i++) {
            tradeList[i] = getTrade(_userTrades[i].userAddress, _userTrades[i].index);
        }

        return tradeList;
    }

    /**
     * @notice Returns the number of trades for a specific address
     * @param _address The address to query
     * @return The number of trades for the given address
     */
    function getTradeLength(address _address) external view returns (uint256) {
        return trades[_address].length;
    }

    /**
     * @notice Get trade list of specific user
     * @param _address The address to query
     * @param _start Start index of user trade list
     * @param _end End index of user trade list
     * @return Array of Trade object
     */
    function getTradeList(address _address, uint256 _start, uint256 _end) external view returns (Types.Trade[] memory) {
        uint256 totalTrades = trades[_address].length;
        // If _start and _end are 0, return the last 100 trades or less
        if (_start == 0 && _end == 0) {
            _start = totalTrades > 100 ? totalTrades - 100 : 0;
            _end = totalTrades - 1;
        }

        uint256 length = _end - _start + 1;
        Types.Trade[] memory result = new Types.Trade[](length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = trades[_address][_start + i];
        }
        return result;
    }

    /**
     * @notice Decode to and value from transaction data
     * @param _tokenTypeIndex Token type index
     * @param _transaction Transaction data
     * @return to Address of receiver
     */
    function getToAndValueFromTransferData(uint8 _tokenTypeIndex, bytes calldata _transaction) internal view returns (address, uint256) {
        if (_tokenTypeIndex == Lib_DefaultValues.ETH_TOKEN_INDEX) {
            return disputeManager.decodeToAndValueFromTxData(_transaction);
        } else {
            (address toAddress, address toRelayer, uint256 amount)
                = disputeManager.decodeToAndValueFromERC20TxData(_transaction);
            require(toAddress == params.tokenAddress(Lib_DefaultValues.ETH_NETWORK_CODE, _tokenTypeIndex), "Invalid token address");
            return (toRelayer, amount);
        }
    }

    /*******************************
     * View Functions : Validation *
     *******************************/

    /**
     * @notice Check if submitted evidence is valid
     * @param _trade Trade object to check
     * @param _evidence Evidence object to check
     * @return True if the evidence is valid
     */
    function isValidEvidence(Types.Trade memory _trade, Types.Evidence calldata _evidence) public view returns (bool) {
        return safeCheckEvidenceExceptBlockHash(_trade, _evidence)
          && disputeManager.verifyBlockHash(_evidence.blockHash, _trade.destCode, _evidence.blockNumber);
    }

    /**
     * @notice Check if sumbmitted blockhash is valid compare to relayed blockhash
     * @param _trade Trade object to check
     * @param _evidence Evidence object to check
     * @return True if the blockhash is valid
     */
    function safeCheckEvidenceExceptBlockHash(Types.Trade memory _trade, Types.Evidence calldata _evidence) public view returns (bool) {
        bool isValidTx = false;

        uint256 destCode = _trade.destCode;
        uint8 tokenTypeIndex = _trade.tokenTypeIndex;
        bool isETHTrade = (tokenTypeIndex == Lib_DefaultValues.ETH_TOKEN_INDEX);
        bool isUpward = (destCode == networkCode);
        uint256 targetNetworkCode = isUpward ? Lib_DefaultValues.ETH_NETWORK_CODE : destCode;

        try disputeManager.checkEvidenceExceptBlockHash(
            (params.nativeIsNotETH(targetNetworkCode) == uint(Bool.FALSE)) && (isETHTrade), // isNativeTokenCheck
            _trade.amount - _trade.fee, // trade amount
            isUpward ? networkCode : 0, // networkCheckCode
            isUpward ? _trade.relayer : _trade.to, // receiver
            params.tokenAddress(targetNetworkCode, tokenTypeIndex), // tokenAddress
            _evidence
        ) returns (bool result) {
            isValidTx = result;
        } catch {
            isValidTx = false; // if error, return false
        }

        return isValidTx;
    }

    /************
     * Modifier *
     ************/

    /**
     * @notice Throw if the contract is in active
     */
    modifier onlyActiveContract() {
        require(isActive, "Unavailable bridge");
        _;
    }

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
        require(_tokenIndex == Lib_DefaultValues.ETH_TOKEN_INDEX || params.tokenAddress(destCode, _tokenIndex) != address(0), "Invalid token index");
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

    receive() external payable {}
}

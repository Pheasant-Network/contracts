// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "solmate/src/tokens/ERC20.sol";
import "solmate/src/utils/SafeTransferLib.sol";
import "solmate/src/auth/Owned.sol";
import "../L2/IPheasantNetworkParameters.sol";

/**
 * @title BondManager
 * @notice This contract manages bonds and allows bond user to slash.
 */
contract BondManager is Owned {

    /******** Variables ********/
  	uint256 constant UPDATE_PERIOD = 3 hours;

    mapping(uint8 => uint256) private bonds; // tokenIndex => amount
	mapping(uint8 => bool) public isNative; // tokenIndex => isNative
    mapping(uint8 => BondWithdrawal) public bondWithdrawal; // tokenIndex => BondWithdrawal

    uint256 public networkCode;
    address public bridgeContract;
    ERC20 internal token;
    IPheasantNetworkParameters public params;

    /******** Struct ********/
    struct BondWithdrawal {
		uint64 executeAfter;
        uint8 tokenIndex;
        uint256 withdrawalAmount;
    }

    /******** Events ********/
    event BondDeposited(address indexed depositor, uint8 indexed tokenIndex, uint256 amount);
    event BondWithdrawExecuted(uint8 indexed tokenIndex, uint256 amount);
    event BondWithdrawFinalized(uint8 indexed tokenIndex, uint256 amount);
    event BondSlashed(uint8 indexed tokenIndex, uint256 amount);

    /******** Constructor ********/
	constructor(
        address _newOwner,
        address _bridgeContract,
        address _params,
        bool _setNativeToken
    ) Owned(_newOwner) {
		if(_setNativeToken) { isNative[0] = true; }
        bridgeContract = _bridgeContract;
        params = IPheasantNetworkParameters(_params);
        networkCode = params.networkCode();
	}

    /******** External function ********/
    function getBond(uint8 _tokenIndex) external view returns (uint256) {
        return bonds[_tokenIndex] - bondWithdrawal[_tokenIndex].withdrawalAmount;
    }

    /******** Only owner function ********/

    /**
    * @notice Deposit bond
    * @param _tokenIndex The token index
    * @param _amount The amount of bond
    */
    function deposit(uint8 _tokenIndex, uint256 _amount) external payable validateTokenIndex(_tokenIndex) onlyOwner {
        require(_amount > 0, "Amount must be greater than 0");
        if (isNative[_tokenIndex]) {
            require(msg.value == _amount, "Insufficient ETH balance");
        } else {
            token = ERC20(params.tokenAddress(networkCode, _tokenIndex));
            SafeTransferLib.safeTransferFrom(token, msg.sender, address(this), _amount);
        }
        bonds[_tokenIndex] += _amount;
        emit BondDeposited(msg.sender, _tokenIndex, _amount);
    }

    /**
    * @notice Withdraw bond
    * @param _tokenIndex The token index
    * @param _amount The amount of bond
    */
    function executeWithdrawBond(uint8 _tokenIndex, uint256 _amount) external onlyOwner validateTokenIndex(_tokenIndex) {
        require(bonds[_tokenIndex] >= _amount, "Insufficient bond balance to withdraw");
        bondWithdrawal[_tokenIndex] = BondWithdrawal(
            uint64(block.timestamp + UPDATE_PERIOD), _tokenIndex, _amount
        );
        emit BondWithdrawExecuted(_tokenIndex, _amount);
    }

    /**
    * @notice Finalize withdraw bond
    */
    function finalizeWithdrawalBond(uint8 _tokenIndex) external {
        BondWithdrawal memory withdrawal = bondWithdrawal[_tokenIndex];
        require(uint64(block.timestamp) > withdrawal.executeAfter && withdrawal.executeAfter != 0, "Ongoing update period");
        uint256 _amount = withdrawal.withdrawalAmount;
        bonds[_tokenIndex] -= _amount;
        delete bondWithdrawal[_tokenIndex];

        if (isNative[_tokenIndex]) {
            SafeTransferLib.safeTransferETH(owner, _amount);
        } else {
            token = ERC20(params.tokenAddress(networkCode, _tokenIndex));
            SafeTransferLib.safeTransfer(token, owner, _amount);
        }
        emit BondWithdrawFinalized(_tokenIndex, _amount);
    }

    /******** Only bond manager function ********/

    /**
    * @notice Slash bond
    * @param _tokenIndex The token index
    * @param _amount The amount of bond
    */
    function slash(uint8 _tokenIndex, uint256 _amount) external onlyBridge validateTokenIndex(_tokenIndex) {
        bonds[_tokenIndex] -= _amount;
        delete bondWithdrawal[_tokenIndex];
        if (isNative[_tokenIndex]) {
            SafeTransferLib.safeTransferETH(msg.sender, _amount);
        } else {
            token = ERC20(params.tokenAddress(networkCode, _tokenIndex));
            SafeTransferLib.safeTransfer(token, msg.sender, _amount);
        }
        emit BondSlashed(_tokenIndex, _amount);
    }

    /******** Modifier ********/
    // Validate token index
	modifier validateTokenIndex(uint8 _tokenIndex) {
		require(
            (isNative[0] && _tokenIndex == 0) || params.tokenAddress(networkCode, _tokenIndex) != address(0),
            "Invalid token index"
        );
		_;
	}

    // Check if the caller is the bond user
	modifier onlyBridge() {
		require(msg.sender == bridgeContract, "Caller is not the bridge contract");
		_;
	}
}
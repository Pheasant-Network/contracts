// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

contract TestContractCall {
    function functionCall(
        address target,
        bytes memory data,
        uint256 value
    ) public payable returns (bytes memory) {
        require(address(this).balance >= value, "Address: insufficient balance for call");
        require(isContract(target), "Address: call to non-contract");

        (bool success, bytes memory returndata) = target.call{value: value}(data);

        if (success) {
            return returndata;
        } else {
            // Look for revert reason and bubble it up if present
            if (returndata.length > 0) {
                // The easiest way to bubble the revert reason is using memory via assembly

                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert("Address: low-level call failed");
            }
        }
    }

    /**
     * @dev Returns true if `account` is a contract.
     * @dev Forked from https://github.com/OpenZeppelin/openzeppelin-contracts/blob/4961a51cc736c7d4aa9bd2e11e4cbbaff73efee9/contracts/utils/Context.sol
     * Modifications:
     * 1. Change solidity version to 0.8.11
     *
     * [IMPORTANT]
     * ====
     * It is unsafe to assume that an address for which this function returns
     * false is an externally-owned account (EOA) and not a contract.
     *
     * Among others, `isContract` will return false for the following
     * types of addresses:
     *
     *  - an externally-owned account
     *  - a contract in construction
     *  - an address where a contract will be created
     *  - an address where a contract lived, but was destroyed
     * ====
     */
    function isContract(address account) internal view returns (bool) {
        // This method relies on extcodesize, which returns 0 for contracts in
        // construction, since the code is only stored at the end of the
        // constructor execution.

        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

    receive() external payable {}
}
// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

interface IFxStateSender {
    function sendMessageToChild(address _receiver, bytes calldata _data) external;
}

contract PolygonRootCheckpointManager {

    struct PolygonState {
        address childCheckpointManager;
        address fxRoot;
        mapping(uint256 => bytes32) blockhashes;
    }
    event SendBlockInfo(uint256 indexed blocknumber);
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.standard.polygonRootCheckpointManager.storage");
	bytes32 constant RECEIVE_BLOCK_INFO = keccak256("ReceiveBlockInfo");

    function diamondStorage() internal pure returns (PolygonState storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    function getPolygonState() external view returns (address, address) {
        PolygonState storage state = diamondStorage();
        return (state.childCheckpointManager, state.fxRoot);
    }

    function getPolygonBlockhash(uint256 _blockNumber) external view returns (bytes32) {
        PolygonState storage state = diamondStorage();
        return (state.blockhashes[_blockNumber]);
    }

    function polygonInit(address _childCheckpointManager, address _fxRoot) external {
        require(_childCheckpointManager != address(0x0), "PolygonRootCheckpointManager: INVALID_CHILD_CHECKPOINT_MANAGER");
        require(_fxRoot != address(0x0), "PolygonRootCheckpointManager: INVALID_FX_ROOT");

        PolygonState storage state = diamondStorage();
        require(state.childCheckpointManager == address(0x0), "PolygonRootCheckpointManager: CHILD_ALREADY_SET");
        state.childCheckpointManager = _childCheckpointManager;
        state.fxRoot = _fxRoot;
    }

    function polygonSendBlockInfo(uint256 _destCode, uint256 _blockNumber) external {
        PolygonState storage state = diamondStorage();

        bytes32 blockHash;
        if (state.blockhashes[_blockNumber] == 0) {
            blockHash = blockhash(_blockNumber);
            state.blockhashes[_blockNumber] = blockHash;
        } else {
            blockHash = state.blockhashes[_blockNumber];
        }

        bytes memory message = abi.encode(RECEIVE_BLOCK_INFO, abi.encode(_destCode, _blockNumber, blockhash(_blockNumber)));

        IFxStateSender(state.fxRoot).sendMessageToChild(state.childCheckpointManager, message);

        emit SendBlockInfo(_blockNumber);
    }

}

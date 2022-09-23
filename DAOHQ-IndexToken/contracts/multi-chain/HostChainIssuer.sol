//Issuance: Receives side chain purchase funds, bridges to side chain
//Mints representative side chain token for host chain index
//Redemption: burns representative token, alerts sidechain manager of burn

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../exchange/MinimalSwap.sol";
import { WETH9 } from "../exchange/MinimalSwap.sol";

interface ITokenBridge{
    function completeTransfer(bytes memory encodedVm) external;
    function transferTokens(
        address token,
        uint256 amount,
        uint16 recipientChain,
        bytes32 recipient,
        uint256 arbiterFee,
        uint32 nonce
    ) external payable returns (uint64 sequence);

    function wrapAndTransferETH(
        uint16 recipientChain,
        bytes32 recipient,
        uint256 arbiterFee,
        uint32 nonce
    ) external payable returns (uint64 sequence);

    function completeTransferAndUnwrapETH(bytes memory encodedVm) external ;
}

contract HostChainIssuer is ERC1155, MinimalSwap {

    uint32 nonce = 0;
    address issuanceNode;
    address manager;
    address wPool;
    ITokenBridge bridge = ITokenBridge(0x3ee18B2214AFF97000D974cf647E7C347E8fa585);

    mapping(uint16 => address) sideChainManagers;
    
    event Deposit(uint256 amtWETH, uint16 chainId, uint64 seq);

    event Withdraw(uint256 amt, uint256 chainId, address toUser);

    constructor(string memory uri,
     address _manager,
     address _pool, address _WETH)ERC1155(uri)MinimalSwap(_WETH){
        manager = _manager;
        wPool = _pool;
    }

    //Issuance
    //potential est amount of returned tokens and mint. Cleanup at full tx completion
    //1. index Calls this
    function depositWETH(uint256 amtWETH, uint16 chainId) external returns(uint64){
       WETH.transferFrom(msg.sender,address(this), amtWETH);
       WETH.approve(address(bridge), amtWETH);
       nonce += 1;
       uint64 seq = bridge.transferTokens(address(WETH),
        amtWETH, chainId, bytes32(uint256(uint160(sideChainManagers[chainId])) << 96), 0, nonce);
       emit Deposit(amtWETH, chainId, seq);
       return seq;
    }

    //2. When funds received on l2, backend calls this
    function notifyBridgeCompletion(uint256 toIssue, uint256 chainId, address indexToken) external{
        require(msg.sender == manager, "restricted");
        _mint(indexToken, chainId, toIssue, "");
    }

    //Redemption
    //1. Index submits 1155 w/ id. Triggers withdrawl
    function withdrawFunds(uint256 amtToken, uint256 id, address toUser) external{
        require(msg.sender == issuanceNode);
        require(balanceOf(msg.sender, id) > amtToken);
        _burn(msg.sender, id, amtToken);
        emit Withdraw(amtToken, id, toUser);
    }

    //2. complete tx
    function completeWithdrawl(bytes memory encodedVm, address to) external {
        bridge.completeTransfer(encodedVm);
        address poolTok = _getPoolToken(wPool);
        _rawPoolSwap(wPool, WETH9(poolTok).balanceOf(address(this)), address(this), false);
        uint256 preBal = address(this).balance;
        WETH.withdraw(WETH.balanceOf(address(this)));
        (bool sent, ) = payable(to).call{value: address(this).balance - preBal}("");
        require(sent, "Failed to Transfer");
    }  

}
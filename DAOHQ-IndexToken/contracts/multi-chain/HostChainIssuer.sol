//Issuance: Receives side chain purchase funds, bridges to side chain
//Mints representative side chain token for host chain index
//Redemption: burns representative token, alerts sidechain manager of burn

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

interface IERC20{
    function transferFrom(address from, address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external; 
}

interface ITokenBridge{
    function transferTokens(
    address token,
    uint256 amount,
    uint16 recipientChain,
    bytes32 recipient,
    uint256 arbiterFee,
    uint32 nonce
    ) external payable returns (uint64 sequence);
}

contract HostChainIssuer is ERC1155 {

    uint32 nonce = 0;
    address indexToken;
    address issuanceNode;
    address manager;
    ITokenBridge bridge = ITokenBridge(0x3ee18B2214AFF97000D974cf647E7C347E8fa585);
    IERC20 WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    mapping(uint16 => address) sideChainManagers;
    
    event Deposit(uint256 amtWETH, uint16 chainId, uint64 seq);

    event Withdraw(uint256 amt, uint256 chainId, address toUser);

    constructor(string memory uri, address onChainIndex, address _manager)ERC1155(uri){
        indexToken = onChainIndex;
        manager = _manager;
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
    function notifyBridgeCompletion(uint256 toIssue, uint256 chainId) external{
        require(msg.sender == manager, "restricted");
        _mint(indexToken, chainId,toIssue, "");
    }

    //Redemption
    //1. Index submits 1155 w/ id. Triggers withdrawl
    function withdrawFunds(uint256 amtToken, uint256 id, address toUser) external{
        require(msg.sender == issuanceNode);
        require(balanceOf(msg.sender, id) > amtToken);
        _burn(msg.sender, id, amtToken);
        emit Withdraw(amtToken, id, toUser);
    } 

}
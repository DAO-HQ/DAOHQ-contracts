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

interface IHyphenBridge{
    function depositErc20(
        uint256 toChainId,
        address tokenAddress,
        address receiver,
        uint256 amount,
        string calldata tag
    ) public
}

contract HostChainIssuer is ERC1155, MinimalSwap {

    uint32 nonce = 0;
    address manager;
    address wPool;
    ITokenBridge bridge = ITokenBridge(0x932930cAA4068e47C786c60370358161569BD3D8);

    mapping(uint16 => address) sideChainManagers;
    
    event Deposit(uint256 amtWETH, uint16 chainId, uint64 seq);

    event Withdraw(uint256 amt, uint256 chainId, address toUser, address hostContract);

    event WithdrawComplete(uint256 amount, address to);

    constructor(string memory uri,
     address _manager,
     address _pool, address _WETH)ERC1155(uri)MinimalSwap(_WETH){
        manager = _manager;
        wPool = _pool;
    }

    modifier onlyManager(){
        require(msg.sender == manager);
        _;
    }

    //Issuance
    //potential est amount of returned tokens and mint. Cleanup at full tx completion
    //1. index Calls this
    function depositWETH(uint256 amtWETH, uint16 chainId) external returns(uint64){
       WETH.transferFrom(msg.sender, address(this), amtWETH);
       WETH.approve(address(bridge), amtWETH);
       nonce += 1;
       //TODO: check that amount bridged > min 
       uint64 seq = bridge.transferTokens(address(WETH),
        amtWETH, chainId, bytes32(uint256(uint160(sideChainManagers[chainId]))), 0, nonce);
       emit Deposit(amtWETH, chainId, seq);
       return seq;
    }

    //2. When funds received on l2, backend calls this
    function notifyBridgeCompletion(uint256 toIssue, uint256 chainId, address indexToken, address issuanceNode) external onlyManager{
        _setApprovalForAll(indexToken, issuanceNode, true);
        _mint(indexToken, chainId, toIssue, "");
    }

    //Redemption
    //1. Index submits 1155 w/ id. Triggers withdrawl
    function withdrawFunds(uint256 amtToken, uint256 id, address toUser) external{
        require(balanceOf(msg.sender, id) >= amtToken, "Insufficient balance of ERC1155");
        _burn(msg.sender, id, amtToken);
        emit Withdraw(amtToken, id, toUser, address(this));
    }

    //2. complete tx
    //This can be removed w/ hyphen bridge
    function completeWithdrawl(bytes memory encodedVm, address to) external {
        bridge.completeTransfer(encodedVm);
        //TODO: uncomment for prod
        //address poolTok = _getPoolToken(wPool);
        //_rawPoolSwap(wPool, WETH9(poolTok).balanceOf(address(this)), address(this), false);
        uint256 preBal = address(this).balance;
        WETH.withdraw(WETH.balanceOf(address(this)));
        uint256 postBal = address(this).balance;
        emit WithdrawComplete(postBal - preBal, to);
        (bool sent, ) = payable(to).call{value: postBal - preBal}("");
        require(sent, "Failed to Transfer");
    }

    function addSideChain(uint16 chainId, address scManager) external onlyManager{
        sideChainManagers[chainId] = scManager;
    }

    function editSwapPool(address newPool) external onlyManager{
        wPool = newPool;
    }

    function updateBridge(address newBridge) external onlyManager{
        bridge = ITokenBridge(newBridge);
    }  
    
    receive() external payable {}

    fallback() external payable{}
}
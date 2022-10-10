//Issuance: Receives side chain purchase funds, bridges to side chain
//Mints representative side chain token for host chain index
//Redemption: burns representative token, alerts sidechain manager of burn

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../exchange/MinimalSwap.sol";
import { WETH9 } from "../exchange/MinimalSwap.sol";

interface IHyphenBridge{

    function tokenManager() external view returns(IHyphenManager);

    function depositErc20(
        uint256 toChainId,
        address tokenAddress,
        address receiver,
        uint256 amount,
        string calldata tag
    ) external;

    function depositNative(
        address receiver,
        uint256 toChainId,
        string calldata tag
    ) external payable; 
}

interface IHyphenManager{

    struct TokenConfig {
        uint256 min;
        uint256 max;
    }
    struct TokenInfo {
        uint256 transferOverhead;
        bool supportedToken;
        uint256 equilibriumFee; // Percentage fee Represented in basis points
        uint256 maxFee; // Percentage fee Represented in basis points
        TokenConfig tokenConfig;
    }

    function getTokensInfo(address tokenAddress) external view returns (TokenInfo memory);
}

contract HostChainIssuerV1 is ERC1155, MinimalSwap {

    address manager;
    address approvedIssuer;
    IHyphenBridge bridge;   

    mapping(uint256 => address) sideChainManagers;
    
    event Deposit(uint256 amtWETH, uint256 chainId);

    event Withdraw(uint256 amt, uint256 chainId, address toUser, address hostContract);

    event WithdrawComplete(uint256 amount, address to);

    // ADD NAME VAR
    constructor(string memory uri,
     address _manager,
     address _WETH,
     address _bridge,
     address _approvedIssuer)ERC1155(uri)MinimalSwap(_WETH){
        manager = _manager;
        bridge = IHyphenBridge(_bridge);
        approvedIssuer = _approvedIssuer;
     }

    modifier onlyManager(){
        require(msg.sender == manager);
        _;
    }

    //Issuance
    //potential est amount of returned tokens and mint. Cleanup at full tx completion
    //1. index Calls this
    function depositWETH(uint256 amtWETH, uint256 chainId) external {
        require(msg.sender == approvedIssuer);
        require(amtWETH >=
         bridge.tokenManager()
        .getTokensInfo(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE).tokenConfig.min,
        "External Value too Low");

        WETH.transferFrom(msg.sender, address(this), amtWETH);
        WETH.withdraw(amtWETH);

        bridge.depositNative{value: amtWETH}(sideChainManagers[chainId], chainId, "DAOHQ");
        emit Deposit(amtWETH, chainId);
    }

    //2. When funds received on l2, backend calls this
    function notifyBridgeCompletion(uint256 toIssue, uint256 chainId, address indexToken) external onlyManager{
        _setApprovalForAll(indexToken, approvedIssuer, true);
        _mint(indexToken, chainId, toIssue, "");
    }

    //Redemption
    //1. Index submits 1155 w/ id. Triggers withdrawl
    function withdrawFunds(uint256 amtToken, uint256 id, address toUser) external{
        require(balanceOf(msg.sender, id) >= amtToken, "Insufficient balance of ERC1155");
        _burn(msg.sender, id, amtToken);
        emit Withdraw(amtToken, id, toUser, address(this));
    }

    function addSideChain(uint256 chainId, address scManager) external onlyManager{
        sideChainManagers[chainId] = scManager;
    }

    function updateIssuer(address newIssuer) external onlyManager{
        approvedIssuer = newIssuer;
    }

    function updateBridge(address newBridge) external onlyManager{
        bridge = IHyphenBridge(newBridge);
    }  
    
    function updateUri(string memory uri) external onlyManager{
        _setURI(uri);
    }

    receive() external payable {}

    fallback() external payable{}
}
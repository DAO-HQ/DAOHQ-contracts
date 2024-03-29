//Issuance: Receives side chain purchase funds, bridges to side chain
//Mints representative side chain token for host chain index
//Redemption: burns representative token, alerts sidechain manager of burn

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

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

contract HostChainIssuerBeta is ERC1155{

    string  public name;
    address manager;
    address approvedIssuer;
    IHyphenBridge bridge;   

    mapping(uint256 => address) sideChainManagers;
    mapping(uint256 => uint256) private _pendingWETH;

    event Deposit(uint256 amtWETH, uint256 chainId);

    event Withdraw(uint256 amt, uint256 chainId, address toUser, address hostContract);

    constructor(string memory uri,
     string memory _name,
     address _manager,
     address _bridge,
     address _approvedIssuer)ERC1155(uri){
        manager = _manager;
        bridge = IHyphenBridge(_bridge);
        approvedIssuer = _approvedIssuer;
        name = _name;
     }

    modifier onlyManager(){
        require(msg.sender == manager, "restricted");
        _;
    }

    //Issuance
    //potential est amount of returned tokens and mint. Cleanup at full tx completion
    //1. index Calls this
    function depositWETH(uint256 chainId) external payable {
        require(msg.sender == approvedIssuer, "Caller must be Issuer");
        require(msg.value >=
         bridge.tokenManager()
        .getTokensInfo(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE).tokenConfig.min,
        "External Value too Low");

        bridge.depositNative{value: msg.value}(sideChainManagers[chainId], chainId, "DAOHQ");
        _pendingWETH[chainId] += msg.value;
        emit Deposit(msg.value, chainId);
    }

    //2. When funds received on l2, backend calls this
    function notifyBridgeCompletion(uint256 toIssue, uint256 chainId, uint256 spent, address indexToken)
     external onlyManager{
        _pendingWETH[chainId] -= spent;
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

    function getPendingWeth(uint256 chainId) external view returns(uint256){
        return _pendingWETH[chainId];
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
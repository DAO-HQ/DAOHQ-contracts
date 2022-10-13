pragma solidity ^0.8.0;
import "../exchange/MinimalSwap.sol";
import { IUniswapV2Pair, WETH9 } from "../exchange/MinimalSwap.sol";

interface IIssuanceManager{
    function issueForExactETH(address indexToken, uint minQty, address to, uint256[] memory externalValues, bytes memory sigs) external payable;
    function redeem(address indexToken, uint qty, address to) external;
    function getIndexValue(address indexToken, uint256[] memory externalValues, bytes memory sig) external view returns(uint256);
}

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

contract SideChainManagerV1 is MinimalSwap{
    
    IHyphenBridge bridge;
    address wPool;
    address manager;
    
    event Issued(uint256 amtIssue, uint256 amtSpent);

    event Redemption(uint256 amtRedeemed, address to, uint16 chainId);

    constructor(address _bridge,
     address _wPool,
     address _WETH) MinimalSwap(_WETH){
        bridge = IHyphenBridge(_bridge);
        wPool = _wPool;
        manager = msg.sender;
    }

    modifier onlyManager(){
        require(msg.sender == manager, "restricted");
        _;
    }

    function _getPoolTokenBal() private returns(uint256){
        return WETH9(_getPoolToken(wPool)).balanceOf(address(this));
    }
 
    //prod flow: get WETH, swaped for WNative, unwrap, issue
    function completeBridge(address indexToken, address issueNode) external onlyManager{

        uint256 amountIn =  _getPoolTokenBal();
        require(amountIn > 0, "Transfer Not Complete");
        _rawPoolSwap(wPool, amountIn, address(this), address(this), false);

        uint256 w_bal = WETH.balanceOf(address(this));
        WETH.withdraw(w_bal);
        uint256 indexPrebal = WETH9(indexToken).balanceOf(address(this));

        IIssuanceManager(issueNode)
        .issueForExactETH{value: w_bal}(indexToken, 1000, address(this), new uint256[](0), new bytes(0));

        emit Issued(WETH9(indexToken).balanceOf(address(this)) - indexPrebal, w_bal);
    }

    //prod flow: Receive Native, Wrap, swap for WETH, bridge
    //NOTE: w/ hyphen receiver can be user, ie no need for ETH completion
    function redeem(uint256 amtRedeem, address to, address indexToken, address issueNode) external onlyManager{
        require(WETH9(indexToken).balanceOf(address(this)) >= amtRedeem, "Insufficient Balance");
        IIssuanceManager(issueNode).redeem(indexToken, amtRedeem, address(this));

        uint256 nativeBal = address(this).balance;
        WETH.deposit{value: nativeBal}();

        _rawPoolSwap(wPool, nativeBal, address(this), address(this), true);

        uint256 hostBal = _getPoolTokenBal(); 
        address hostToken = _getPoolToken(wPool);
        require(hostBal >=
         bridge.tokenManager()
        .getTokensInfo(hostToken).tokenConfig.min,
        "External Value too Low");

        WETH9(hostToken).approve(address(bridge), hostBal);
        bridge.depositErc20(1, hostToken, to, hostBal, "DAOHQ");

        emit Redemption(amtRedeem, to, 1);
    }

    function getIndexTokenPrice(address indexToken, address issueNode) external view returns(uint256){
        uint256 nativeValue = IIssuanceManager(issueNode).getIndexValue(indexToken, new uint256[](0), "");
        uint256 convertVal = _getAmountOut(wPool, nativeValue, true) * 10**5;
        return convertVal / WETH9(indexToken).totalSupply();
    } 

    function updateBridge(address newBridge) external onlyManager{
        bridge = IHyphenBridge(newBridge);
    } 

    receive() external payable {}

    fallback() external payable{}

}
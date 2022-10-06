// Issuance: receives purchase funds, call issuance on sidechain token,
// receives index token deposit and triggers withdraw on host chain
// Redemption: upon burn of Host chain token, unlocks these tokens and redeems for funds
//bridges funds back to host chain

pragma solidity ^0.8.0;
import "../exchange/MinimalSwap.sol";
import { IUniswapV2Pair, WETH9 } from "../exchange/MinimalSwap.sol";
import { IHyphenBridge, IHyphenManager } from "./HostChainIssuer.sol";

interface IIssuanceManager{
    function issueForExactETH(address indexToken, uint minQty, address to, uint256[] memory externalValues, bytes[] memory sigs) external payable;
    function redeem(address indexToken, uint qty, address to) external;
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
        require(msg.sender == manager);
        _;
    }

    function _getPoolTokenBal() private returns(uint256){
        return WETH9(_getPoolToken(wPool)).balanceOf(address(this));
    }
 
    //prod flow: get WETH, swaped for WNative, unwrap, issue
    function completeBridge(address indexToken, address issueNode) external onlyManager{

        uint256 amountIn =  _getPoolTokenBal();
        require(amountIn > 0, "Transfer Not Complete");
        _rawPoolSwap(wPool, amountIn, address(this), false);

        uint256 w_bal = WETH.balanceOf(address(this));
        WETH.withdraw(w_bal);
        uint256 indexPrebal = WETH9(indexToken).balanceOf(address(this));

        IIssuanceManager(issueNode)
        .issueForExactETH{value: w_bal}(indexToken, 1000, address(this), new uint256[](0), new bytes[](0));

        emit Issued(WETH9(indexToken).balanceOf(address(this)) - indexPrebal, w_bal);
    }

    //prod flow: Receive Native, Wrap, swap for WETH, bridge
    //NOTE: w/ hyphen receiver can be user, ie no need for ETH completion
    function redeem(uint256 amtRedeem, address to, address indexToken, address issueNode) external onlyManager{
        require(WETH9(indexToken).balanceOf(address(this)) >= amtRedeem);
        IIssuanceManager(issueNode).redeem(indexToken, amtRedeem, address(this));

        uint256 nativeBal = address(this).balance;
        WETH.deposit{value: nativeBal}();

        _rawPoolSwap(wPool, nativeBal, address(this), true);

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

    function updateBridge(address newBridge) external onlyManager{
        bridge = IHyphenBridge(newBridge);
    } 

    receive() external payable {}

    fallback() external payable{}

}
// Issuance: receives purchase funds, call issuance on sidechain token,
// receives index token deposit and triggers withdraw on host chain
// Redemption: upon burn of Host chain token, unlocks these tokens and redeems for funds
//bridges funds back to host chain

pragma solidity ^0.8.0;
import "../exchange/MinimalSwap.sol";
import { IUniswapV2Pair, WETH9 } from "../exchange/MinimalSwap.sol";
import { ITokenBridge } from "./HostChainIssuer.sol";

interface IIssuanceManager{
    function issueForExactETH(address indexToken, uint minQty, address to) external payable;
    function redeem(address indexToken, uint qty, address to) external;
}

contract SideChainManager is MinimalSwap{
    ITokenBridge bridge;
    //IIssuanceManager issueNode;
    address wPool;
    //address indexToken;
    uint32 private nonce = 0;
    event Issued(uint256 amtIssue, uint256 amtSpent);

    event Redemption(uint256 amtRedeemed, uint64 seq, address to);

    constructor(address _bridge,
     address _wPool,
     address _WETH) MinimalSwap(_WETH){
        bridge = ITokenBridge(_bridge);
        wPool = _wPool;
        //issueNode = IIssuanceManager(_issueNode);
        //indexToken = _indexToken;
    }

    function completeBridge(bytes memory encodedVm, address indexToken, address issueNode) external {
        bridge.completeTransfer(encodedVm);
        //TODO: Uncomment for prod
        //uint256 amountIn = WETH9(_getPoolToken(wPool)).balanceOf(address(this));
        //_rawPoolSwap(wPool, amountIn, address(this), false);

        uint256 w_bal = WETH.balanceOf(address(this));
        WETH.withdraw(w_bal);
        uint256 indexPrebal = WETH9(indexToken).balanceOf(address(this));
        IIssuanceManager(issueNode).issueForExactETH{value: w_bal}(indexToken, 1000, address(this));
        emit Issued(WETH9(indexToken).balanceOf(address(this)) - indexPrebal, w_bal);
    }

    function redeem(uint256 amtRedeem, uint16 chainId, address to, address indexToken, address issueNode) external returns(uint64){
        require(WETH9(indexToken).balanceOf(address(this)) >= amtRedeem);
        uint256 preBal = address(this).balance;
        IIssuanceManager(issueNode).redeem(indexToken, amtRedeem, address(this));
        
        WETH.deposit{value: address(this).balance - preBal}();
        _rawPoolSwap(wPool, address(this).balance - preBal, address(this), true);
        address poolTok = _getPoolToken(wPool);
        nonce += 1;
        uint64 seq = bridge.transferTokens(poolTok, WETH9(poolTok).balanceOf(address(this)), chainId, bytes32(uint256(uint160(indexToken)) << 96), 0, nonce);
        emit Redemption(amtRedeem, seq, to);
        return seq;
    }

}
// Issuance: receives purchase funds, call issuance on sidechain token,
// receives index token deposit and triggers withdraw on host chain
// Redemption: upon burn of Host chain token, unlocks these tokens and redeems for funds
//bridges funds back to host chain

//For local test cases
pragma solidity ^0.8.0;
import "../exchange/MinimalSwap.sol";
import { IUniswapV2Pair, WETH9 } from "../exchange/MinimalSwap.sol";
import { ITokenBridge } from "./HostChainIssuer_test.sol";

interface IIssuanceManager{
    function issueForExactETH(address indexToken, uint minQty, address to, uint256[] memory externalValues, bytes[] memory sigs) external payable;
    function redeem(address indexToken, uint qty, address to) external;
}

contract SideChainManager is MinimalSwap{
    
    ITokenBridge bridge;
    address wPool;
    uint32 private nonce = 0;
    
    event Issued(uint256 amtIssue, uint256 amtSpent);

    event Redemption(uint256 amtRedeemed, uint64 seq, address to, uint16 chainId);

    constructor(address _bridge,
     address _wPool,
     address _WETH) MinimalSwap(_WETH){
        bridge = ITokenBridge(_bridge);
        wPool = _wPool;
    }

    //prod flow: get WETH, swaped for WNative, unwrap, issue
    function completeBridge(bytes memory encodedVm, address indexToken, address issueNode) external {
        bridge.completeTransfer(encodedVm);
        //TODO: Uncomment for prod
        //uint256 amountIn = WETH9(_getPoolToken(wPool)).balanceOf(address(this));
        //_rawPoolSwap(wPool, amountIn, address(this), false);

        uint256 w_bal = WETH.balanceOf(address(this));
        WETH.withdraw(w_bal);
        uint256 indexPrebal = WETH9(indexToken).balanceOf(address(this));
        IIssuanceManager(issueNode).issueForExactETH{value: w_bal}(indexToken, 1000, address(this), new uint256[](0), new bytes[](0));
        emit Issued(WETH9(indexToken).balanceOf(address(this)) - indexPrebal, w_bal);
    }

    //prod flow: Receive Native, Wrap, swap for WETH, bridge
    //NOTE: w/ hyphen receiver can be user, ie no need for ETH completion
    function redeem(uint256 amtRedeem, uint16 chainId, address to, address hostContract, address indexToken, address issueNode) external returns(uint64){
        require(WETH9(indexToken).balanceOf(address(this)) >= amtRedeem);
        uint256 preBal = address(this).balance;
        IIssuanceManager(issueNode).redeem(indexToken, amtRedeem, address(this));
        
        WETH.deposit{value: address(this).balance - preBal}();
        //TODO: Uncomment prod
        //_rawPoolSwap(wPool, address(this).balance - preBal, address(this), true);
        //address poolTok = _getPoolToken(wPool);
        nonce += 1;
        //Which token will we transfer?
        uint256 w_bal = WETH.balanceOf(address(this));
        WETH.approve(address(bridge), w_bal);
        uint64 seq = bridge.transferTokens(address(WETH), w_bal, chainId, bytes32(uint256(uint160(hostContract))), 0, nonce);
        emit Redemption(amtRedeem, seq, to, chainId);
        return seq;
    }

    receive() external payable {}

    fallback() external payable{}

}
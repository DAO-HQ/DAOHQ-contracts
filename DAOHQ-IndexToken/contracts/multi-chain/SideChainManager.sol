// Issuance: receives purchase funds, call issuance on sidechain token,
// receives index token deposit and triggers withdraw on host chain
// Redemption: upon burn of Host chain token, unlocks these tokens and redeems for funds
//bridges funds back to host chain

pragma solidity ^0.8.0;

interface ITokenBridge { 
    function completeTransfer(bytes memory encodedVm) external;
    function transferTokens(
    address token,
    uint256 amount,
    uint16 recipientChain,
    bytes32 recipient,
    uint256 arbiterFee,
    uint32 nonce
    ) external payable returns (uint64 sequence);
}

interface IUniswapV2Pair { 
    function factory() external view returns (address);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
}

interface WETH9{
    function deposit() external payable;
    function withdraw(uint wad) external;
    function balanceOf(address account) external returns(uint256);
    function approve(address to, uint256 amount) external;
    function transferFrom(address from, address to, uint256 wad) external;
    function transfer(address to, uint256 amount) external;
}

interface IIssuanceManager{
    function issueForExactETH(address indexToken, uint minQty, address to) external payable;
    function redeem(address indexToken, uint qty, address to) external;
}

contract SideChainManager {
    ITokenBridge bridge;
    WETH9 WETH;
    IIssuanceManager issueNode;
    address wPool;
    address indexToken;

    event Issued(uint256 amtIssue, uint256 amtSpent);

    constructor(address _bridge, address _wPool, address _issueNode, address _indexToken, address _WETH){
        bridge = ITokenBridge(_bridge);
        wPool = _wPool;
        issueNode = IIssuanceManager(_issueNode);
        indexToken = _indexToken;
        WETH = WETH9(_WETH);
    }

    function _getAmountOut(address pool, uint256 amountIn) private view returns(uint256){
        IUniswapV2Pair pair = IUniswapV2Pair(pool);
        (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
        (reserve0, reserve1) = pair.token0() == address(WETH) ? (reserve1, reserve0): (reserve0, reserve1);
        uint256 aInFee = amountIn * 997;
        uint256 numerator =  aInFee * reserve1;
        uint256 denominator = (reserve0 * 1000) + aInFee;
        return numerator/denominator;
    }

    function _rawPoolSwap(address poolAddr, address to) private returns(uint256) {
        IUniswapV2Pair pool = IUniswapV2Pair(poolAddr);
        (address token0, address token1) = (pool.token0(), pool.token1());
        WETH9 tokenIn = token0 == address(WETH) ? WETH9(token1) : WETH9(token0);
        uint256 amountIn = tokenIn.balanceOf(address(this));
        uint256 amountOut = _getAmountOut(poolAddr, amountIn);
        (uint256 amount0out, uint256 amount1out) = address(tokenIn) == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
        tokenIn.transfer(poolAddr, amountIn);
        pool.swap(amount0out, amount1out, to, new bytes(0));
        return amountOut;
    }

    function completeBridge(bytes memory encodedVm) external {
        bridge.completeTransfer(encodedVm);
        
        _rawPoolSwap(wPool, address(this));

        uint256 w_bal = WETH.balanceOf(address(this));
        WETH.withdraw(w_bal);
        uint256 indexPrebal = WETH9(indexToken).balanceOf(address(this));
        issueNode.issueForExactETH{value: w_bal}(indexToken, 0, address(this));
        emit Issued(WETH9(indexToken).balanceOf(address(this)) - indexPreBal, w_bal);
    }

}
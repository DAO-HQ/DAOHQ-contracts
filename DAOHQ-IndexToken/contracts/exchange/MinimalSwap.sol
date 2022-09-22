pragma solidity ^0.8.0;

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

contract MinimalSwap{
    
    WETH9 WETH;

    constructor(address _WETH){
        WETH = WETH9(_WETH);
    }

    function _getAmountOut(address pool, uint256 amountIn, bool fromWETH) internal view returns(uint256){
        IUniswapV2Pair pair = IUniswapV2Pair(pool);
        (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
        (reserve0, reserve1) = pair.token0() == address(WETH) 
        ? fromWETH ? (reserve0, reserve1) : (reserve1, reserve0)
        : fromWETH ? (reserve1, reserve0) : (reserve0, reserve1);
        uint256 aInFee = amountIn * 997;
        uint256 numerator =  aInFee * reserve1;
        uint256 denominator = (reserve0 * 1000) + aInFee;
        return numerator/denominator;
    }

    function _rawPoolSwap(address poolAddr, uint256 amountIn, address to, bool fromWETH) internal returns(uint256) {
        uint256 amountOut = _getAmountOut(poolAddr, amountIn, fromWETH);
        IUniswapV2Pair pool = IUniswapV2Pair(poolAddr);
        (address token0, address token1) = (pool.token0(), pool.token1());
        WETH9 tokenIn = fromWETH ? WETH : token0 == address(WETH) ? WETH9(token1) : WETH9(token0);
        (uint256 amount0out, uint256 amount1out) = address(tokenIn) == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
        tokenIn.transfer(poolAddr, amountIn);
        pool.swap(amount0out, amount1out, to, new bytes(0));
        return amountOut;
    }

    function _getPoolToken(address pool) internal view returns(address token){
        (address token0, address token1) = (IUniswapV2Pair(pool).token0(), IUniswapV2Pair(pool).token0());
        token = token0 == address(WETH) ? token0 : token1;
    }
}
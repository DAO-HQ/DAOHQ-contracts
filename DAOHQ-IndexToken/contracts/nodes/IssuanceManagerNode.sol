// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
//import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../IToken.sol";

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

contract IssuanceManager{

    uint256 private constant PRECISION = 10 ** 12;
    WETH9 private constant WETH = WETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    event ErrorSwap(address token, uint256 value, uint256 share, uint256 cumulativeShare);
    event Redemtion(uint256 WETHBal, uint256 fundsReceived, uint256 expectedOut);
    event valueData(uint preval, uint postval, uint totalSupply);

    constructor() {
    }

    function _getAmountOut(address pool, uint256 amountIn, bool fromWETH) private view returns(uint256){
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

    function _rawPoolSwap(address poolAddr, uint256 amountIn, address to, bool fromWETH) private returns(uint256) {
        uint256 amountOut = _getAmountOut(poolAddr, amountIn, fromWETH);
        IUniswapV2Pair pool = IUniswapV2Pair(poolAddr);
        (address token0, address token1) = (pool.token0(), pool.token1());
        WETH9 tokenIn = fromWETH ? WETH : token0 == address(WETH) ? WETH9(token1) : WETH9(token0);
        (uint256 amount0out, uint256 amount1out) = address(tokenIn) == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
        tokenIn.transfer(poolAddr, amountIn);
        pool.swap(amount0out, amount1out, to, new bytes(0));
        return amountOut;
    }

    function _executeswap(address component, uint256 cumulativeShare, uint256 msgVal, IToken indexToken) private returns(uint256 amountOut) {
        uint256 share = indexToken.getShare(component);
        uint256 value = (msgVal * share) / cumulativeShare;

        return _rawPoolSwap(component, value, address(indexToken), true);
    }

    function _getPoolToken(address pool) private view returns(address token){
        (address token0, address token1) = (IUniswapV2Pair(pool).token0(), IUniswapV2Pair(pool).token0());
        token = token0 == address(WETH) ? token0 : token1;
    }

    function _executeSwaptoETH(address pool, uint256 indexQty, IToken indexToken) private returns(uint256 amountOut){
        address token = _getPoolToken(pool);
        uint256 amountIn = IERC20(token).balanceOf(address(indexToken));
        // 0 index qty signals an exit
        if(indexQty > 0){
            // % of supply/ownership of index * balance of given token 
            amountIn = (indexQty * amountIn) / indexToken.totalSupply();
        }

        indexToken.approveComponent(token, address(this), amountIn);
        IERC20(token).transferFrom(address(indexToken), address(this), amountIn);

        amountOut = _rawPoolSwap(pool, amountIn, address(this), false);
    }

    function _swapEthForAll(IToken indexToken, uint256 ethVal, address[] memory components) private {
        uint256 cumulativeShare = indexToken.getCumulativeShare();
        WETH.deposit{value: msg.value}();
        //Buy each component
        for(uint i = 0; i<components.length; i++){
            _executeswap(components[i], cumulativeShare, ethVal, indexToken/*, paths[i]*/);
        }
    }

    function _valueSet(IToken indexToken, address[] memory components) private view returns (uint256 wethValue){
        wethValue = 0;
        for (uint i = 0; i < components.length; i++){
            uint256 bal = IERC20(_getPoolToken(components[i])).balanceOf(address(indexToken));
            wethValue += _getAmountOut(components[i], bal, false);
        }
    }

    function _exit(address component, IToken indexToken) private returns (uint256 amountOut){
        return _executeSwaptoETH(component, 0, indexToken);
    }

    function seedNewSet(IToken indexToken, uint minQty, address to) external payable {
        require(indexToken.totalSupply() == 0, "Token Already seeded");
        uint256 outputTokens = (msg.value * 10 ** 18) / indexToken.basePrice();
        require(outputTokens >= minQty, "Insuffiecient return amount");
        _swapEthForAll(indexToken, msg.value, indexToken.getComponents());
        indexToken.mint(to, (outputTokens / PRECISION) * PRECISION);
    }

    function issueForExactETH(IToken indexToken, uint minQty, address to ) external payable {
        uint256 preSupply = indexToken.totalSupply();
        address[] memory components = indexToken.getComponents();
        uint256 preValue = _valueSet(indexToken, components);
        _swapEthForAll(indexToken, msg.value, components);
        uint256 outputTokens = ((((preSupply * _valueSet(indexToken, components)) / preValue) - preSupply) / PRECISION) * PRECISION; 
        require(outputTokens >= minQty, "Insuffiecient return amount");
        emit valueData(preValue, _valueSet(indexToken, components), preSupply);
        indexToken.mint(to, outputTokens);
    }

    function redeem(IToken indexToken, uint qty, address to) external {
        require(indexToken.balanceOf(to) >= qty, "User does not have sufficeint balance");
        
        address[] memory components = indexToken.getComponents();
        uint256 funds = 0;
        for(uint i = 0; i<components.length; i++){
            funds += _executeSwaptoETH(components[i], qty, indexToken /*, paths[i]*/);
        }
        //require(expectedOut == funds, "incorrect redemption amount");
        //emit Redemtion(WETH.balanceOf(address(this)), funds, expectedOut);
        WETH.withdraw(funds);
        indexToken.burn(to, qty);
        (bool sent, ) = payable(to).call{value: funds}("");
        require(sent, "Failed to Transfer");
    }

    function getTokenQty(IToken indexToken, uint index) external view returns(uint256){
        address component = _getPoolToken(indexToken.getComponents()[index]);
        uint256 balance = IERC20(component).balanceOf(address(indexToken));
        return balance;
    }

    function rebalanceExitedFunds(IToken indexToken, address[] memory exitedPositions) external {
        uint preBalance = WETH.balanceOf(address(this));
        {
            for(uint i = 0; i < exitedPositions.length; i++){
                address component = exitedPositions[i];
                require(indexToken.getShare(component) == 0, "position not exited");
                _exit(component, indexToken);
                require(IERC20(component).balanceOf(address(indexToken)) == 0 &&
                IERC20(component).balanceOf(address(this)) == 0, "Token not exited properly");
            }
        }
        uint postBalance = WETH.balanceOf(address(this));
        _swapEthForAll(indexToken, postBalance - preBalance, indexToken.getComponents());
    }
    //Value + new value * 997?
    function getAmountOut(IToken indexToken, uint256 ethIn) external view returns(uint256){
        address[] memory components = indexToken.getComponents(); 
        uint256 cumulativeShare = indexToken.getCumulativeShare();
        uint256 postValue = 0;
        for(uint i = 0; i < components.length; i++){
            uint256 bal = IERC20(_getPoolToken(components[i])).balanceOf(address(indexToken)) + 
                _getAmountOut(components[i],
                 (ethIn * indexToken.getShare(components[i])) / cumulativeShare,
                 true);
            
            postValue += _getAmountOut(components[i], bal, false);
        }
        uint256 preSupply = indexToken.totalSupply();
        return ((((preSupply * postValue) / _valueSet(indexToken, components)) - preSupply) / PRECISION) * PRECISION; 
    }

    function getIndexValue(IToken indexToken) external view returns(uint256){
        return _valueSet(indexToken, indexToken.getComponents());
    }

    receive() external payable {}

    fallback() external payable{}
}
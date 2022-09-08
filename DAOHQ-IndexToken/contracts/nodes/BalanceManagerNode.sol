pragma solidity ^0.8.0;

interface IERC20{ 
    function balanceOf(address account) external view returns (uint256);
}
interface IUniswapV2Router02{
    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
    external
    payable
    returns (uint[] memory amounts);

    function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
    external
    returns (uint[] memory amounts);
}

contract BalanceManagerNode { 
    address private manager;
    address private immutable indexToken;
    address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    
    constructor(address _indexToken){
        indexToken = _indexToken;
        manager = msg.sender;
    }

    function _exit(address component) private {
        uint256 currBal = IERC20(component).balanceOf(indexToken);
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = component;
    }
}
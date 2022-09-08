// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../IToken.sol";
import "../exchange/HqSwap.sol";

interface IUniswapV2Router02{
    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
    external
    payable
    returns (uint[] memory amounts);

    function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
    external
    returns (uint[] memory amounts);
}

contract IssuanceManager is DaoHqRouter{

    uint256 startPrice; //in wei
    IToken public indexToken;
    //comment out for prod
    IUniswapV2Router02 UniswapRouter = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    constructor(address _indexToken, uint256 _startPrice) {
        indexToken = IToken(_indexToken);
        startPrice = _startPrice;
    }

    /*function _executeswap(address component, uint256 cumulativeShare, bytes32[] calldata paths) private {
        uint256 share = indexToken.getShare(component);

        uint256 amountOut = hqswap(IERC20(address(0)), value, 0, paths);

        indexToken.updateHoldings(component, amountOut, true);

        IERC20(component).transfer(address(indexToken), amountOut);
    }

    function _executeSwaptoETH(address component, uint256 indexQty, bytes32[] calldata paths) private returns(uint256 amountOut){
        // % of supply/ownership of index * balance of given token 
        uint256 amountIn = (indexQty/indexToken.totalSupply()) * IERC20(component).balanceOf(address(indexToken));
        
        indexToken.approve(address(this), amountIn);
        amountOut = hqswap(IERC20(component), amountIn, 0, paths);

        indexToken.updateHoldings(component, amountOut, false);
    }*/

    function _executeswap(address component, uint256 cumulativeShare, uint256 msgVal) private returns(uint256[] memory amountOut) {
        uint256 share = indexToken.getShare(component);
        uint256 value = (msgVal * share) / cumulativeShare;

        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = component;

        amountOut = UniswapRouter.swapExactETHForTokens{value: value}(1, path, address(indexToken), block.timestamp);   
    }

    function _executeSwaptoETH(address component, uint256 indexQty) private returns(uint256 amountOut){

        uint256 amountIn = IERC20(component).balanceOf(address(indexToken));
        // 0 index qty signals an exit
        if(indexQty > 0){
            // % of supply/ownership of index * balance of given token 
            amountIn = (indexQty * amountIn) / indexToken.totalSupply();
        }

        //NOTE: multiple approval resolves with dhq router
        indexToken.approveComponent(component, address(this), amountIn);
        IERC20(component).transferFrom(address(indexToken), address(this), amountIn);
        IERC20(component).approve(address(UniswapRouter), amountIn);

        address[] memory path = new address[](2);
        path[0] = component;
        path[1] = WETH;

        amountOut = UniswapRouter.swapExactTokensForETH(amountIn, 0, path, address(this), block.timestamp)[1];
    }

    function _swapEthForAll(uint256 ethVal) private {
        (address[] memory components, uint256 cumulativeShare) = _getComponentsShare();
        //Buy each component
        for(uint i = 0; i<components.length; i++){
            _executeswap(components[i], cumulativeShare, msg.value/*, paths[i]*/);
        }
    }

    function _exit(address component) private returns (uint256 amountOut){
        return _executeSwaptoETH(component, 0);
    }

    function _getComponentsShare() private view returns(address[] memory components, uint256 cumulativeShare){
        components = indexToken.getComponents();
        cumulativeShare = indexToken.getCumulativeShare();
    }

    function issue(uint qty, address to /*, bytes32[][] calldata paths*/) external payable {
        //TODO: update valuation strategy
        require(msg.value * qty >= startPrice * qty, "Not enough eth");

        _swapEthForAll(msg.value);

        indexToken.mint(to, qty);
    }

    function redeem(uint qty, address to /*, bytes32[][] calldata paths*/) external {
        require(indexToken.balanceOf(to) >= qty, "User does not have sufficeint balance");
        
        (address[] memory components, uint256 cumulativeShare) = _getComponentsShare();
        uint256 funds = 0;
        for(uint i = 0; i<components.length; i++){
            funds += _executeSwaptoETH(components[i], qty /*, paths[i]*/);
        }
        indexToken.burn(to, qty);
        (bool sent, ) = payable(to).call{value: funds}("");
        require(sent, "Failed to Transfer");
    }

    function rebalanceExitedFunds(address[] memory exitedPositions) external {
        uint preBalance = address(this).balance;
        {
            for(uint i = 0; i < exitedPositions.length; i++){
                address component = exitedPositions[i];
                require(indexToken.getShare(component) == 0, "position not exited");
                _exit(component);
                require(IERC20(component).balanceOf(address(indexToken)) == 0 &&
                IERC20(component).balanceOf(address(this)) == 0, "Token not exited properly");
            }
        }

        uint postBalance = address(this).balance;
        _swapEthForAll(postBalance - preBalance);
    }

    receive() external payable {}

    fallback() external payable{}
    //rebalance function sell all potitions where new share < old to == new share size. Buy all positions where new > old share w/ funds from prior
    //Add receive
}
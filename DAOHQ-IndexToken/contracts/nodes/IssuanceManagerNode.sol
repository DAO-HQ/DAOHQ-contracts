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

    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
}

interface ImanagementFeeNode{
    function getFeesPending(IToken indexToken) external view returns(uint256[] memory);
}

contract IssuanceManager is DaoHqRouter{

    uint256 startPrice; //in wei ETH
    //comment out for prod
    IUniswapV2Router02 UniswapRouter = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    ImanagementFeeNode feeNode;
    address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;


    constructor(uint256 _startPrice, address feeManager) {
        startPrice = _startPrice;
        feeNode = ImanagementFeeNode(feeManager);
    }

    function _executeswap(address component, uint256 cumulativeShare, uint256 msgVal, IToken indexToken) private returns(uint256[] memory amountOut) {
        uint256 share = indexToken.getShare(component);
        uint256 value = (msgVal * share) / cumulativeShare;

        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = component;

        amountOut = UniswapRouter.swapExactETHForTokens{value: value}(1, path, address(indexToken), block.timestamp);   
    }

    function _executeSwaptoETH(address component, uint256 indexQty, IToken indexToken) private returns(uint256 amountOut){

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

    function _swapEthForAll(IToken indexToken, uint256 ethVal) private {
        (address[] memory components, uint256 cumulativeShare) = _getComponentsShare(indexToken);
        //Buy each component
        for(uint i = 0; i<components.length; i++){
            _executeswap(components[i], cumulativeShare, ethVal, indexToken/*, paths[i]*/);
        }
    }

    function _exit(address component, IToken indexToken) private returns (uint256 amountOut){
        return _executeSwaptoETH(component, 0, indexToken);
    }

    function _getComponentsShare(IToken indexToken) private view returns(address[] memory components, uint256 cumulativeShare){
        components = indexToken.getComponents();
        cumulativeShare = indexToken.getCumulativeShare();
    }

    function issueForExactETH(IToken indexToken, uint minQty, address to /*, bytes32[][] calldata paths*/) external payable {
        uint256 preSupply = indexToken.totalSupply();
        uint256 preValue = valueSet(indexToken);
        uint256 outputTokens = (msg.value * preSupply) / preValue;
        require(outputTokens >= minQty, "Insuffiecient return amount");

        _swapEthForAll(indexToken, msg.value);
        require((preValue + (preSupply + outputTokens))/preSupply == valueSet(indexToken), "set misbalanced");
        indexToken.mint(to, outputTokens);
    }

    function redeem(IToken indexToken, uint qty, address to /*, bytes32[][] calldata paths*/) external {
        require(indexToken.balanceOf(to) >= qty, "User does not have sufficeint balance");
        uint expectedOut = (qty * valueSet(indexToken)) / indexToken.totalSupply();
        (address[] memory components, ) = _getComponentsShare(indexToken);
        uint256 funds = 0;
        for(uint i = 0; i<components.length; i++){
            funds += _executeSwaptoETH(components[i], qty, indexToken /*, paths[i]*/);
        }
        require(expectedOut == funds, "incorrect redemption amount");

        indexToken.burn(to, qty);
        (bool sent, ) = payable(to).call{value: funds}("");
        require(sent, "Failed to Transfer");
    }

    function rebalanceExitedFunds(IToken indexToken, address[] memory exitedPositions) external {
        uint preBalance = address(this).balance;
        {
            for(uint i = 0; i < exitedPositions.length; i++){
                address component = exitedPositions[i];
                require(indexToken.getShare(component) == 0, "position not exited");
                _exit(component, indexToken);
                require(IERC20(component).balanceOf(address(indexToken)) == 0 &&
                IERC20(component).balanceOf(address(this)) == 0, "Token not exited properly");
            }
        }

        uint postBalance = address(this).balance;
        _swapEthForAll(indexToken, postBalance - preBalance);
    }
    
    function valueSet(IToken indexToken) public view returns (uint256 wethValue){
        wethValue = 0;
        address[] memory components = indexToken.getComponents();
        uint256[] memory pendingFees = feeNode.getFeesPending(indexToken);
        for (uint i = 0; i < components.length; i++){
            uint256 bal = IERC20(components[i]).balanceOf(address(indexToken));
            bal -= pendingFees[i];
            address[] memory path = new address[](2);
            path[0] = components[i];
            path[1] = WETH;
            wethValue += UniswapRouter.getAmountsOut(bal, path)[1];
        }
    }

    receive() external payable {}

    fallback() external payable{}
}
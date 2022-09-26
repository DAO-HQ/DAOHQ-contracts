// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
//import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../IToken.sol";
import "../exchange/MinimalSwap.sol";
import { IUniswapV2Pair, WETH9 } from "../exchange/MinimalSwap.sol";

interface IHostChainManager{
    function depositWETH(uint256 amtWETH, uint16 chainId) external returns(uint64);
    function withdrawFunds(uint256 amtToken, uint256 id, address toUser, address issuanceNode) external;
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;

}

contract IssuanceManager is MinimalSwap{

    uint256 private constant PRECISION = 10 ** 12;
    event ErrorSwap(address token, uint256 value, uint256 share, uint256 cumulativeShare);
    event Redemtion(uint256 WETHBal, uint256 fundsReceived, uint256 expectedOut);
    event valueData(uint preval, uint postval, uint totalSupply);

    constructor(address _WETH) MinimalSwap(_WETH){
    }

    function _executeswap(address component, uint256 cumulativeShare, uint256 msgVal, IToken indexToken) private returns(uint256 amountOut) {
        uint256 share = indexToken.getShare(component);
        uint256 value = (msgVal * share) / cumulativeShare;

        return _rawPoolSwap(component, value, address(indexToken), true);
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

    function _executeExternalSwaptoETH(IToken indexToken, IToken.externalPosition memory position, uint256 qty, address to) private {
        uint256 amountIn = IHostChainManager(position.externalContract).balanceOf(address(indexToken), uint256(position.id));
        if(qty > 0){
            amountIn = (qty * amountIn) / indexToken.totalSupply();
        }
        IHostChainManager(position.externalContract).safeTransferFrom(address(indexToken), address(this), uint256(position.id), amountIn, "");
        IHostChainManager(position.externalContract).withdrawFunds(amountIn, uint256(position.id), to, address(this));
    }
    
    function _swapEthForAll(IToken indexToken, uint256 ethVal, address[] memory components) private {
        uint256 cumulativeShare = indexToken.getCumulativeShare();
        WETH.deposit{value: msg.value}();
        //Buy each component
        for(uint i = 0; i<components.length; i++){
            _executeswap(components[i], cumulativeShare, ethVal, indexToken/*, paths[i]*/);
        }
        IToken.externalPosition[] memory _externals = indexToken.getExternalComponents();
        //TODO: Alot of batching here will save gas
        for(uint i =0; i < _externals.length; i++){
            IToken.externalPosition memory position = _externals[i];
            uint256 share = _getExternalShare(indexToken,  position.externalContract, position.id);
            uint256 value = (ethVal * share) / cumulativeShare;
            WETH.approve(position.externalContract, value);
            IHostChainManager(position.externalContract).depositWETH(value, position.id);
        }
    }

    function _getExternalShare(IToken indexToken, address contractAddress, uint256 id) private view returns (uint256){
        address uid = address(uint160(uint256(keccak256(abi.encode(contractAddress, id)))));
        return indexToken.getShare(uid);
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

        IToken.externalPosition[] memory _externals = indexToken.getExternalComponents();
        //TODO: Alot of batching here will save gas
        for(uint i =0; i < _externals.length; i++){
            _executeExternalSwaptoETH(indexToken, _externals[i], qty, to);
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

    function rebalanceExitedFunds(IToken indexToken, address[] memory exitedPositions, uint256[] memory replacementIndex) external {
        //sells out of exited positions and buys selected index(typically the token that replaced it)
        uint preBalance = WETH.balanceOf(address(this));
        address[] memory components = indexToken.getComponents();
        for(uint i = 0; i < exitedPositions.length; i++){
            address component = exitedPositions[i];
            require(indexToken.getShare(component) == 0, "position not exited");
            uint256 amountWOut= _exit(component, indexToken);
            IERC20 token = IERC20(_getPoolToken(component));
            require(token.balanceOf(address(indexToken)) == 0 &&
            token.balanceOf(address(this)) == 0, "Token not exited properly");
            _rawPoolSwap(components[replacementIndex[i]], amountWOut, address(indexToken), true);
        }
        if(WETH.balanceOf(address(this)) - preBalance > 0){
            _swapEthForAll(indexToken, WETH.balanceOf(address(this)) - preBalance, indexToken.getComponents());
        }
    }

    function getIndexValue(IToken indexToken) external view returns(uint256){
        return _valueSet(indexToken, indexToken.getComponents());
    }

    receive() external payable {}

    fallback() external payable{}
}
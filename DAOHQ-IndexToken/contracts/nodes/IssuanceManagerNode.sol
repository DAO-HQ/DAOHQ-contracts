// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
//import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../IToken.sol";
import "../exchange/MinimalSwap.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IHostChainManager{
    function getPendingWeth(uint256 id) external view returns(uint256);
    function depositWETH(uint256 chainId) external payable;
    function withdrawFunds(uint256 amtToken, uint256 id, address toUser) external;
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data) external;
}

contract IssuanceManager is MinimalSwap, ERC1155Holder, ReentrancyGuard{
    using ECDSA for bytes32;

    uint256 private constant PRECISION = 10 ** 12;
    address private externalSigner;
    uint256 private scMin;

    constructor(address _WETH, uint256 _scMin) MinimalSwap(_WETH){
        externalSigner = msg.sender;
        scMin = _scMin;
    }

    function _executeswap(address component, uint256 cumulativeShare, uint256 msgVal, IToken indexToken)
     private returns(uint256 amountOut) {
        uint256 share = indexToken.getShare(component);
        uint256 value = (msgVal * share) / cumulativeShare;

        return _rawPoolSwap(component, value, address(indexToken), address(this), true);
    }

    function _executeSwaptoETH(address pool, uint256 indexQty, IToken indexToken)
     private returns(uint256 amountOut){
        address token = _getPoolToken(pool);
        uint256 amountIn = IERC20(token).balanceOf(address(indexToken));
        // 0 index qty signals an exit
        if(indexQty > 0){
            // % of supply/ownership of index * balance of given token 
            amountIn = (indexQty * amountIn) / indexToken.totalSupply();
        }

        indexToken.approveComponent(token, address(this), amountIn);
        //IERC20(token).transferFrom(address(indexToken), address(this), amountIn);

        amountOut = _rawPoolSwap(pool, amountIn, address(this), address(indexToken), false);
    }

    function _executeExternalSwaptoETH(IToken indexToken, IToken.externalPosition memory position, uint256 qty, address to)
     private {
        uint256 amountIn = IHostChainManager(position.externalContract).balanceOf(address(indexToken), uint256(position.id));
        if(qty > 0){
            amountIn = (qty * amountIn) / indexToken.totalSupply();
        }
        IHostChainManager(position.externalContract).safeTransferFrom(address(indexToken), address(this), uint256(position.id), amountIn, "");
        IHostChainManager(position.externalContract).withdrawFunds(amountIn, uint256(position.id), to);
    }
    
    function _swapEthForAll(IToken indexToken, uint256 ethVal,
        address[] memory components, IToken.externalPosition[] memory _externals)
        private returns(uint256){

        uint256 cumulativeShare = indexToken.getCumulativeShare();
        uint256 externalWeth = 0;
        //TODO: Alot of batching here can save gas
        for(uint i =0; i < _externals.length; i++){
            IToken.externalPosition memory position = _externals[i];
            uint256 share = _getExternalShare(indexToken,  position.externalContract, position.id);
            uint256 val = (ethVal * share) / cumulativeShare;
            require(val >= scMin, "Insufficient side chain bridge amount, add additional value");
            IHostChainManager(position.externalContract).depositWETH{value: val}(position.id);
            externalWeth += val;
        }

        WETH.deposit{value: msg.value - externalWeth}();
        //Buy each component
        for(uint i = 0; i<components.length; i++){
            _executeswap(components[i], cumulativeShare, ethVal, indexToken);
        }
        externalWeth = externalWeth > 0 ? (externalWeth * 995) / 1000 : externalWeth;
        return externalWeth;
    }

    function _getExternalShare(IToken indexToken, address contractAddress, uint256 id) private view returns (uint256){
        address uid = address(uint160(uint256(keccak256(abi.encode(contractAddress, id)))));
        return indexToken.getShare(uid);
    }

    function _valueSet(IToken indexToken, address[] memory components,
     IToken.externalPosition[] memory _externals, uint256[] memory externalValues)
     private view returns (uint256 wethValue){
        wethValue = 0;
        for (uint i = 0; i < components.length; i++){
            uint256 bal = IERC20(_getPoolToken(components[i])).balanceOf(address(indexToken));
            wethValue += _getAmountOut(components[i], bal, false);
        }
        for(uint i = 0; i < _externals.length; i++){
            uint256 bal = IHostChainManager(_externals[i].externalContract).balanceOf(address(indexToken), _externals[i].id);
            uint256 pendingbal = IHostChainManager(_externals[i].externalContract).getPendingWeth(_externals[i].id);
            bal = bal > 0 ? ((bal * externalValues[i]) / 10**5) : bal;
            pendingbal = pendingbal > 0 ? (pendingbal * 995) / 1000 : pendingbal;
            wethValue += bal + pendingbal;
        }
    }

    function _exit(address component, IToken indexToken) private returns (uint256 amountOut){
        return _executeSwaptoETH(component, 0, indexToken);
    }

    function _validateExternalData(uint256[] memory externalValues, bytes memory sigs) private view{
        if(externalValues.length > 0){
            bytes32 _hash = keccak256(abi.encodePacked(externalValues)).toEthSignedMessageHash();
            address _signer = _hash.recover(sigs);
            require(_signer == externalSigner, "Invalid External Data");
        }
    }

    function seedNewSet(IToken indexToken, uint minQty, address to) external payable {
        require(indexToken.totalSupply() == 0, "Token Already seeded");
        uint256 outputTokens = (msg.value * 10 ** 18) / indexToken.basePrice();
        require(outputTokens >= minQty, "Insuffiecient return amount");
        IToken.externalPosition[] memory _externals = indexToken.getExternalComponents();
        _swapEthForAll(indexToken, msg.value, indexToken.getComponents(), _externals);
        indexToken.mint(to, (outputTokens / PRECISION) * PRECISION);
    }

    function issueForExactETH(IToken indexToken, uint minQty, address to,
     uint256[] memory externalValues, bytes memory sigs) external payable {
        _validateExternalData(externalValues, sigs);
        //tradeoff for stack too deep 
        //uint256 preSupply = indexToken.totalSupply();
        address[] memory components = indexToken.getComponents();
        IToken.externalPosition[] memory _externals = indexToken.getExternalComponents();
        uint256 preValue = _valueSet(indexToken, components, _externals, externalValues);
        uint256 wethExt = _swapEthForAll(indexToken, msg.value, components, _externals);
        uint256 outputTokens =
         ((((indexToken.totalSupply() * ( wethExt + _valueSet(indexToken, components, _externals, externalValues)))
         / preValue) - indexToken.totalSupply()) / PRECISION) * PRECISION; 
        require(outputTokens >= minQty, "Insuffiecient return amount");
        indexToken.mint(to, outputTokens);
    }

    function redeem(IToken indexToken, uint qty, address to) external nonReentrant{
        //NOTE: This function must only be called with verified qtys avail for bridging on side chains
        //Risk loss of funds if not checked
        require(indexToken.balanceOf(to) >= qty, "User does not have sufficeint balance");
        
        address[] memory components = indexToken.getComponents();
        uint256 funds = 0;
        for(uint i = 0; i<components.length; i++){
            funds += _executeSwaptoETH(components[i], qty, indexToken);
        }
        IToken.externalPosition[] memory _externals = indexToken.getExternalComponents();
        //TODO: batching here will save gas
        for(uint i =0; i < _externals.length; i++){
            _executeExternalSwaptoETH(indexToken, _externals[i], qty, to);
        }
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

    function rebalanceExitedFunds(IToken indexToken, address[] memory exitedPositions, uint256[] memory replacementIndex)
     external {
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
            _rawPoolSwap(components[replacementIndex[i]], amountWOut, address(indexToken), address(this), true);
        }
        if(WETH.balanceOf(address(this)) - preBalance > 0){
            IToken.externalPosition[] memory _externals = indexToken.getExternalComponents();
            _swapEthForAll(indexToken, WETH.balanceOf(address(this)) - preBalance, indexToken.getComponents(), _externals);
        }
    }

    function getIndexValue(IToken indexToken, uint256[] memory externalValues, bytes memory sigs)
     external view returns(uint256){
        _validateExternalData(externalValues, sigs);
        IToken.externalPosition[] memory _externals = indexToken.getExternalComponents();
        return _valueSet(indexToken, indexToken.getComponents(), _externals, externalValues);
    }

    function updateSigner(address newSigner) external{
        require(msg.sender == externalSigner);
        externalSigner = newSigner;
    }

    function updateBridgeMin(uint256 newScMin) external {
        require(msg.sender == externalSigner);
        scMin = newScMin;
    }

    receive() external payable {}

    fallback() external payable{}
}
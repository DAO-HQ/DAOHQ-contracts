pragma solidity ^0.8.0;
import "../IToken.sol";

contract ManagementFeeNode {

    uint256 managementFee; // Percent of Set accruing to manager annually (1% = 100, 100% = 100000)
    address manager;
    uint256 lastFeeCollected;
    //1 year and fee denom
    uint256 private constant ONE_YEAR_IN_SECONDS = 3.154 * 10**11 ;

    constructor(address _manager, uint256 fee){
        manager = _manager;
        managementFee = fee;
        lastFeeCollected = block.timestamp;
    }

    modifier onlyManager(){
        require(msg.sender == manager);
        _;
    }

    function _getAccruedFee(address token, address indexToken, uint256 numerator) private view returns(uint256){
        uint256 balance = IToken(token).balanceOf(indexToken);
        return (balance * numerator) / ONE_YEAR_IN_SECONDS;
    }

    function _numerator() private view returns(uint256){
        return (block.timestamp - lastFeeCollected) * managementFee;
    }

    function skimFees(IToken indexToken, address to) external onlyManager{
        uint256 numerator =  _numerator();
        address[] memory components = indexToken.getComponents();
        for(uint i = 0; i < components.length; i++){
            uint256 feesAccrued = _getAccruedFee(components[i], address(indexToken), numerator);
            indexToken.approveComponent(components[i],address(this), feesAccrued);
            indexToken.transferFrom(address(indexToken), to, feesAccrued);
        }
        lastFeeCollected = block.timestamp;
    }

    function getFeesPending(IToken indexToken) external view returns(uint256[] memory){
        uint256 numerator = _numerator();
        address[] memory components = indexToken.getComponents();
        uint256[] memory pendingFees = new uint256[](components.length);
        for(uint256 i = 0; i < components.length; i++){
            pendingFees[i] = (_getAccruedFee(components[i], address(indexToken), numerator));
        }
        return pendingFees;
    }
}
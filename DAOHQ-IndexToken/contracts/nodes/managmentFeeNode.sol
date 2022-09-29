pragma solidity ^0.8.0;
import "../IToken.sol";
import { IUniswapV2Pair } from "./IssuanceManagerNode.sol";

contract ManagementFeeNode {

    uint256 managementFee; // Percent of Set accruing to manager annually (1% = 100, 100% = 10000)
    address manager;
    uint256 lastFeeCollected;
    //1 year and fee denom
    uint256 private constant ONE_YEAR_SCALER= 3.154 * 10**11 ;

    constructor(address _manager, uint256 fee){
        manager = _manager;
        managementFee = fee;
        lastFeeCollected = block.timestamp;
    }

    modifier onlyManager(){
        require(msg.sender == manager);
        _;
    }

    function calcFeeSupplyInflation(IToken indexToken) public view returns(uint256){
        uint256 numerator = (block.timestamp - lastFeeCollected) * managementFee;
        return (indexToken.totalSupply() * numerator) / (ONE_YEAR_SCALER - numerator);
    }

    function accrueFee(IToken indexToken, address to) external onlyManager{
        indexToken.mint(
        to,
        calcFeeSupplyInflation(indexToken)
        );
        lastFeeCollected = block.timestamp;
    }

    function updateTransferFee(IToken indexToken, uint256 newFee) external onlyManager{
        indexToken.updateTransferFee(newFee);
    }

    function editFeeWallet(IToken indexToken, address newWallet) external onlyManager{
        indexToken.editFeeWallet(newWallet);
    }
}
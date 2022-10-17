pragma solidity ^0.8.0;
import "../IToken.sol";
import { IUniswapV2Pair } from "./IssuanceManagerNode.sol";

contract ManagementFeeNode {

    uint256 managementFee; // Percent of Set accruing to manager annually (1% = 100, 100% = 10000)
    address manager;
    mapping(address => uint256) private lastFeeCollected;
    //1 year and fee denom
    uint256 private constant ONE_YEAR_SCALER= 3.154 * 10**11 ;

    constructor(address _manager, uint256 fee, address initialToken){
        manager = _manager;
        managementFee = fee;
        lastFeeCollected[initialToken] = block.timestamp;
    }

    modifier onlyManager(){
        require(msg.sender == manager);
        _;
    }

    function calcFeeSupplyInflation(IToken indexToken) public view returns(uint256){
        uint256 numerator = (block.timestamp - lastFeeCollected[address(indexToken)]) * managementFee;
        return (indexToken.totalSupply() * numerator) / (ONE_YEAR_SCALER - numerator);
    }

    function accrueFee(IToken indexToken, address to) external onlyManager{
        require(lastFeeCollected[address(indexToken)] > 0, "Token not under managerment");
        indexToken.mint(
        to,
        calcFeeSupplyInflation(indexToken)
        );
        lastFeeCollected[address(indexToken)] = block.timestamp;
    }

    function addToken(address token) external onlyManager {
        require(lastFeeCollected[token] == 0, "already created");
        lastFeeCollected[token] = block.timestamp;
    }

    function updateMgmtFee(uint256 newFee) external onlyManager{
        managementFee = newFee;
    }

    function updateTransferFee(IToken indexToken, uint256 newFee) external onlyManager{
        indexToken.updateTransferFee(newFee);
    }

    function editFeeWallet(IToken indexToken, address newWallet) external onlyManager{
        indexToken.editFeeWallet(newWallet);
    }

    function editManager(address newManager) external onlyManager{
        manager = newManager;
    }
}
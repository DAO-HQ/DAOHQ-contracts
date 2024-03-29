pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IToken is IERC20{
    
    struct externalPosition{
        address externalContract;
        uint256 id;
    }

    function burn(address _account, uint256 _amount) external;

    function mint(address _account, uint256 _quantity) external;

    function approveComponent(address _token, address _spender, uint256 _amount) external;

    function getComponents() external view returns(address[] memory);

    function getExternalComponents() external view returns(externalPosition[] memory);

    function getShare(address _component) external view returns(uint);

    function editComponent(address _component, uint256 _amount) external;

    function getCumulativeShare() external view returns(uint256);

    function basePrice() external view returns(uint256);

    function addNode(address _node) external;

    function updateTransferFee(uint256 newFee) external;
    
    function editFeeWallet(address newWallet) external;
}
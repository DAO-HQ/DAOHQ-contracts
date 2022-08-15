pragma solidity >=0.4.22 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDAOHQERC20 is IERC20{
    function updateMintAuthority(address _mintAuthority, bool isAdd) external;
    function updateVault(address newVault) external;
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function burnFrom(address account, uint256 amount) external; 
}
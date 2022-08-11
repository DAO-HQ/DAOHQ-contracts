// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
//import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./DAOHQERC20.sol";

contract DAOHQERC20Factory{
    uint256 private fee;
    address public owner;

    mapping(address => address[]) public tokenDeployments;

    constructor(uint256 initFee){
       fee = initFee;
       owner = msg.sender;
    }

    function createToken(
        string memory name,
        string memory symbol,
        address vault,
        uint256 initSupply,
        bool isMintable,
        bool isBurnable) external{
        DAOHQERC20 token = new DAOHQERC20(name, symbol,
            initSupply, fee, vault, isMintable, isBurnable);

        tokenDeployments[msg.sender].push(address(token));
        token.transferOwnership(msg.sender);
    }

    modifier onlyOwner(){
        require(msg.sender == owner, "Restricted function");
        _;
    }

    function withdrawProceeds(address token, address to) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(to, bal);
    }

    function transferFactory(address newOwner) external onlyOwner{
        owner = newOwner;
    }

    function changeFee(uint256 newFee) external onlyOwner{
        fee = newFee;
    }

}
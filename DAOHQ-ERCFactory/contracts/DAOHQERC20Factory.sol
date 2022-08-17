// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
//import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./DAOHQERC20.sol";

contract DAOHQERC20Factory{
    uint256 public fee;
    address public owner;

    mapping(address => DAOHQERC20[]) public tokenDeployments;

    constructor(uint256 initFee){
       fee = initFee;
       owner = msg.sender;
    }

    function createToken(
        string memory name,
        string memory symbol,
        address vault,
        uint256 initSupply,
        uint256 cap,
        bool isMintable,
        bool isBurnable) external returns(address){
        DAOHQERC20 token = new DAOHQERC20(name, symbol,
            initSupply, fee, cap, vault, isMintable, isBurnable);

        tokenDeployments[msg.sender].push(token);
        token.transferOwnership(msg.sender);
        return address(token);
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

    function getTokenDetails(address creator, string memory name) external view
    returns(string memory, address, uint256, uint256, address) {
        DAOHQERC20[] memory tokens = tokenDeployments[creator];
        DAOHQERC20 token;
        for(uint i; i < tokens.length; i++){
            if(keccak256(abi.encodePacked(tokens[i].name())) == keccak256(abi.encodePacked(name))){
                token = tokens[i];
                break;
            }
        } 
        return (token.symbol(), token.vault(), token.totalSupply(), token.cap(), address(token));
    }

}
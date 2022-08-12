// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DAOHQERC20 is ERC20, ERC20Burnable, Ownable{
  address public vault;
  uint256 public immutable cap;
  bool private  mintable;
  bool private immutable burnable;
  mapping(address => bool) public mintAuthority;

  constructor(
    string memory _name,
    string memory _symbol,
    uint256 initSupply,
    uint256 fee,
    uint256 _cap,
    address _vault,
    bool _mintable,
    bool _burnable
  ) ERC20(_name, _symbol) {
    mintable = true;
    vault = _vault;
    cap = _cap;
    uint256 feeAmount = (initSupply * fee) / 10000;
    _mint(owner(), feeAmount);
    _mint(_vault, initSupply);
    mintable = _mintable;
    burnable = _burnable;
    mintAuthority[vault] = true;
  }

  modifier isMintAuth(){
    require(mintAuthority[msg.sender], "not Mint authorized");
    _;
  }

  function transferOwnership(address newOwner) public override(Ownable){
    address oldOwner = owner();
    super.transferOwnership(newOwner);
    mintAuthority[oldOwner] = false;
    mintAuthority[newOwner] = true;
    vault = oldOwner == vault  ? newOwner : vault;
  }

  function updateMintAuthority(address _mintAuthority, bool isAdd) external onlyOwner{ 
    mintAuthority[_mintAuthority] = isAdd ? true : false;
  }
  
  function updateVault(address newVault) external onlyOwner{
    mintAuthority[vault] = false;
    mintAuthority[newVault] = true;
    vault = newVault;
  }

  function _mint(address to, uint256 amount) internal override(ERC20){
    require(mintable, "not mintable");
    if(cap > 0){
      require(totalSupply() + amount <= cap, "Token supply cap exceeded");
    }
    super._mint(to, amount);
  }

  function _burn(address account, uint256 amount) internal override(ERC20){
    require(burnable, "not burnable");
    super._burn(account, amount);
  }

  function mint(address to, uint256 amount) public isMintAuth {
      _mint(to, amount);
  }
}
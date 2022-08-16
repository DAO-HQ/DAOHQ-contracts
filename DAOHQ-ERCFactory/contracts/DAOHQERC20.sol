// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DAOHQERC20 is ERC20, ERC20Burnable, Ownable{
  address private _vault;
  uint256 private immutable _cap;
  bool private  _mintable;
  bool private immutable _burnable;
  mapping(address => bool) public mintAuthority;

  constructor(
    string memory _name,
    string memory _symbol,
    uint256 initSupply,
    uint256 fee,
    uint256 cap_,
    address vault_,
    bool mintable,
    bool burnable
  ) ERC20(_name, _symbol) {
    _mintable = true;
    _vault = vault_;
    _cap = cap_;
    uint256 feeAmount = (initSupply * fee) / 10000;
    _mint(owner(), feeAmount);
    _mint(_vault, initSupply);
    _mintable = mintable;
    _burnable = burnable;
    mintAuthority[_vault] = true;
  }

  modifier isMintAuth(){
    require(mintAuthority[msg.sender], "not Mint authorized");
    _;
  }

  function vault() external view returns(address){
    return _vault;
  }

  function cap() external view returns(uint256){
    return _cap;
  }

  function transferOwnership(address newOwner) public override(Ownable){
    address oldOwner = owner();
    super.transferOwnership(newOwner);
    mintAuthority[oldOwner] = false;
    mintAuthority[newOwner] = true;
    _vault = oldOwner == _vault  ? newOwner : _vault;
  }

  function updateMintAuthority(address _mintAuthority, bool isAdd) external onlyOwner{ 
    mintAuthority[_mintAuthority] = isAdd ? true : false;
  }
  
  function updateVault(address newVault) external onlyOwner{
    mintAuthority[_vault] = false;
    mintAuthority[newVault] = true;
    _vault = newVault;
  }

  function _mint(address to, uint256 amount) internal override(ERC20){
    require(_mintable, "not mintable");
    if(_cap > 0){
      require(totalSupply() + amount <= _cap, "Token supply cap exceeded");
    }
    super._mint(to, amount);
  }

  function _burn(address account, uint256 amount) internal override(ERC20){
    require(_burnable, "not burnable");
    super._burn(account, amount);
  }

  function mint(address to, uint256 amount) public isMintAuth {
      _mint(to, amount);
  }
}
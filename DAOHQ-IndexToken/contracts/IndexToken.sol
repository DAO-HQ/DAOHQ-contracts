pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IToken.sol";

contract IndexToken is ERC20, IToken{
    
    address feeWallet;
    //TODO: add update function?
    uint256 private constant transferFeed = 30;
    uint256 private cumulativeShare;
    address[] private components;
    mapping(address => uint256) private share;
    mapping(address => bool) public managers;
    mapping(address => bool) public nodes;

    constructor(string memory _name, string memory _symbol, address _feeWallet,
                address[] memory _components,
                uint256[] memory _shares
                ) 
                ERC20(_name, _symbol)
                {
                    components = _components;
                    for (uint i = 0; i < _components.length; i++ ){
                        cumulativeShare += _shares[i];
                        share[_components[i]] = _shares[i];
                    }
                    managers[msg.sender] = true;
                    feeWallet = _feeWallet;
                }

    modifier onlyNode(){
        require(nodes[msg.sender], "restricted node function");
        _;
    } 

    modifier onlyManager(){
        require(managers[msg.sender], "restricted manager function");
        _;
    }

    function burn(address _account, uint256 _amount) override external onlyNode{
        _burn(_account, _amount);
    }

    function mint(address _account, uint256 _quantity) override external onlyNode {
        _mint(_account, _quantity);
    }

    function approveComponent(address _token, address _spender, uint256 _amount) override external onlyNode {
        IERC20(_token).approve(_spender, _amount);
    }   

    function editComponent(address _component, uint256 _newShare) override external onlyManager{
        (uint256 i, bool exists) = _indexOf(components, _component);
        if(!exists){
            _addComponent(_component, _newShare);
        }else if (_newShare > 0){
            share[_component] = _newShare;
        }else{
            _removeComponent(_component, i);
        }
    }
    //TODO: add replace function
    function _addComponent(address _component, uint256 shares) private {
        components.push(_component);
        share[_component] = shares;
        cumulativeShare += shares;
    }

    function _removeComponent(address _component, uint256 index) private {
        delete components[index];
        cumulativeShare -= share[_component];
        share[_component] = 0;
    }

    function addNode(address _node) external onlyManager{
        nodes[_node] = true;
    }

    function getComponents() override external view returns(address[] memory){
        return components;
    }

    function getShare(address _component) override external view returns(uint){
        return share[_component]; 
    }

    function getCumulativeShare() override external view returns(uint256){
        return cumulativeShare;
    }

    function _transferFeeAmount(uint256 amount) private pure returns(uint256){
        return (amount * transferFeed)/10000;
    }

    function transfer(address to, uint256 amount)
     public virtual override(ERC20,IERC20) returns (bool) {
        address owner = _msgSender();
        uint256 feeAmount = _transferFeeAmount(amount);
        //TODO: create custom internal ERC _transfer to save gas
        _transfer(owner, feeWallet, feeAmount);
        _transfer(owner, to, amount-feeAmount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount)
     public virtual override(ERC20, IERC20) returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        uint256 feeAmount = _transferFeeAmount(amount);
        //TODO: same as transfer
        _transfer(from, feeWallet, feeAmount);
        _transfer(from, to, amount - feeAmount);
        return true;
    }

    function _indexOf(address[] memory A, address a) internal pure returns (uint256, bool) {
        uint256 length = A.length;
        for (uint256 i = 0; i < length; i++) {
            if (A[i] == a) {
                return (i, true);
            }
        }
        //return Out of bounds index if not existing
        return (length, false);
    }s
}
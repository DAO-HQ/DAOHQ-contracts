# Welcome DAOHQ-contracts

The repository is home to DAOHQ's various contracts that have been built in house.




## Development and Deployment practices and validations(For DAOHQ members)
In order to ensure security of our contracts and full understanding of their functionality the following development process should be followed:

1. A new Truffle project is created. Initial contract(s) is written according to requirements
2. Unit tests are written with Truffle-mocha framework with the following minimal requirement:
  - A description of each test
  - Each external function includes > 1 instance in unit tests
  - Each path in each function is tested at least 1 time(ex a function with `require(msg.sender == owner)1 should test both functionality and a != ownerpath)
  - At least a 1:1 unit test to contract lines of code
3. When the contracts and test have been iterated to be eligible for deployment the following validations should occur:
  1. Another member of DAOHQ should approve the list of unit tests(via descriptions)
  2. Another member of DAOHQ should analyze the contract for sanity checks and security. *It's understood that other members may need a walkthrough. This audit can occur via a call/meeting
5. Reviewing member(s) from (3) commit unit test and contract files with an `//APPROVED` comment. 
4. After findings from (3) has been addressed, contract can be deployed to mainnet(s)

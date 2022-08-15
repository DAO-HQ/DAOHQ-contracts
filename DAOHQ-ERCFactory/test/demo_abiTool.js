var fs = require('fs');
const file  = "build/contracts/IDAOHQERC20.json"
var abi = JSON.parse(fs.readFileSync(file));

const isMint = false;
const isBurn = false;

function editABI(){
if(!isMint){
   abi.abi.splice(abi.abi.findIndex(x => x.name === "mint"), 1);
   abi.ast.nodes[2].nodes.splice(abi.ast.nodes[2].nodes.findIndex(x => x.name === "updateMintAuthority"), 1);
   abi.ast.nodes[2].nodes.splice(abi.ast.nodes[2].nodes.findIndex(x => x.name === "mint"), 1);
   abi.legacyAST.nodes[2].nodes.splice(abi.ast.nodes[2].nodes.findIndex(x => x.name === "updateMintAuthority"), 1);
   abi.legacyAST.nodes[2].nodes.splice(abi.ast.nodes[2].nodes.findIndex(x => x.name === "mint"), 1);
}
if(!isBurn){
    abi.abi.splice(abi.abi.findIndex(x => x.name === "burn"), 1); 
    abi.abi.splice(abi.abi.findIndex(x => x.name === "burnFrom"), 1);
    abi.ast.nodes[2].nodes.splice(abi.ast.nodes[2].nodes.findIndex(x => x.name === "burn"), 1);
    abi.ast.nodes[2].nodes.splice(abi.ast.nodes[2].nodes.findIndex(x => x.name === "burnFrom"), 1);
    abi.legacyAST.nodes[2].nodes.splice(abi.ast.nodes[2].nodes.findIndex(x => x.name === "burn"), 1);
    abi.legacyAST.nodes[2].nodes.splice(abi.ast.nodes[2].nodes.findIndex(x => x.name === "burnFrom"), 1);
}

fs.writeFile("UpdatedAbi.json", JSON.stringify(abi, null, 4), (err) => {
    if (err) throw err;
    console.log('Data written to file');
});
}

editABI()
const hre = require("hardhat");

async function main() {
  console.log("Deploying CrowdFunding contract...");
  
  const CrowdFunding = await hre.ethers.getContractFactory("CrowdFunding");
  const crowdFunding = await CrowdFunding.deploy();

  await crowdFunding.waitForDeployment();

  const contractAddress = await crowdFunding.getAddress();
  console.log("CrowdFunding deployed to:", contractAddress);
  
  // Save contract address and ABI for frontend
  const fs = require('fs');
  const contractInfo = {
    address: contractAddress,
    network: "sepolia"
  };
  
  fs.writeFileSync('contractInfo.json', JSON.stringify(contractInfo, null, 2));
  console.log("Contract info saved to contractInfo.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
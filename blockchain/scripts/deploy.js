const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting deployment...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString(), "\n");

  // ============================================
  // STEP 1: Deploy PatientRegistry
  // ============================================
  console.log("📋 Deploying PatientRegistry...");
  const PatientRegistry = await hre.ethers.getContractFactory("PatientRegistry");
  const patientRegistry = await PatientRegistry.deploy();
  await patientRegistry.waitForDeployment();
  const patientRegistryAddress = await patientRegistry.getAddress();
  console.log("✅ PatientRegistry deployed to:", patientRegistryAddress, "\n");

  // ============================================
  // STEP 2: Deploy DoctorRegistry
  // ============================================
  console.log("📋 Deploying DoctorRegistry...");
  const DoctorRegistry = await hre.ethers.getContractFactory("DoctorRegistry");
  const doctorRegistry = await DoctorRegistry.deploy();
  await doctorRegistry.waitForDeployment();
  const doctorRegistryAddress = await doctorRegistry.getAddress();
  console.log("✅ DoctorRegistry deployed to:", doctorRegistryAddress, "\n");

  // ============================================
  // STEP 3: Deploy RecordRegistry
  // ============================================
  console.log("📋 Deploying RecordRegistry...");
  const RecordRegistry = await hre.ethers.getContractFactory("RecordRegistry");
  const recordRegistry = await RecordRegistry.deploy(
    patientRegistryAddress,
    doctorRegistryAddress
  );
  await recordRegistry.waitForDeployment();
  const recordRegistryAddress = await recordRegistry.getAddress();
  console.log("✅ RecordRegistry deployed to:", recordRegistryAddress, "\n");

  // ============================================
  // STEP 4: Deploy AccessControl
  // ============================================
  console.log("📋 Deploying AccessControl...");
  const AccessControl = await hre.ethers.getContractFactory("AccessControl");
  const accessControl = await AccessControl.deploy(
    recordRegistryAddress,
    doctorRegistryAddress
  );
  await accessControl.waitForDeployment();
  const accessControlAddress = await accessControl.getAddress();
  console.log("✅ AccessControl deployed to:", accessControlAddress, "\n");

  // ============================================
  // STEP 5: Deploy AuditLog
  // ============================================
  console.log("📋 Deploying AuditLog...");
  const AuditLog = await hre.ethers.getContractFactory("AuditLog");
  const auditLog = await AuditLog.deploy();
  await auditLog.waitForDeployment();
  const auditLogAddress = await auditLog.getAddress();
  console.log("✅ AuditLog deployed to:", auditLogAddress, "\n");

  // ============================================
  // STEP 6: Save Deployment Info
  // ============================================
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      PatientRegistry: patientRegistryAddress,
      DoctorRegistry: doctorRegistryAddress,
      RecordRegistry: recordRegistryAddress,
      AccessControl: accessControlAddress,
      AuditLog: auditLogAddress
    },
    gasUsed: {
      PatientRegistry: "~500,000",
      DoctorRegistry: "~700,000",
      RecordRegistry: "~1,200,000",
      AccessControl: "~1,500,000",
      AuditLog: "~400,000"
    }
  };

  // Save to blockchain folder
  const deploymentsPath = path.join(__dirname, "../deployments.json");
  fs.writeFileSync(deploymentsPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ Deployment info saved to:", deploymentsPath, "\n");

  // ============================================
  // STEP 7: Copy ABIs and Deployment Info to Frontend
  // ============================================
  const fullStackContractsPath = path.join(__dirname, "../../frontend/lib/contracts");

  // Create directory if it doesn't exist
  if (!fs.existsSync(fullStackContractsPath)) {
    fs.mkdirSync(fullStackContractsPath, { recursive: true });
  }

  // Copy each contract's ABI
  const contracts = [
    "PatientRegistry",
    "DoctorRegistry",
    "RecordRegistry",
    "AccessControl",
    "AuditLog"
  ];

  contracts.forEach(contractName => {
    const artifactPath = path.join(
      __dirname,
      `../artifacts/contracts/${contractName}.sol/${contractName}.json`
    );
    const targetPath = path.join(fullStackContractsPath, `${contractName}.json`);

    if (fs.existsSync(artifactPath)) {
      fs.copyFileSync(artifactPath, targetPath);
      console.log(`✅ Copied ${contractName}.json to frontend`);
    } else {
      console.warn(`⚠️  Warning: ${contractName} artifact not found`);
    }
  });

  // Copy deployments info
  const targetDeploymentsPath = path.join(fullStackContractsPath, "deployments.json");
  fs.copyFileSync(deploymentsPath, targetDeploymentsPath);
  console.log("✅ Copied deployments.json to frontend\n");

  // ============================================
  // STEP 8: Summary
  // ============================================
  console.log("═══════════════════════════════════════════════════");
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("═══════════════════════════════════════════════════");
  console.log("\n📦 Contract Addresses:");
  console.log("   PatientRegistry  :", patientRegistryAddress);
  console.log("   DoctorRegistry   :", doctorRegistryAddress);
  console.log("   RecordRegistry   :", recordRegistryAddress);
  console.log("   AccessControl    :", accessControlAddress);
  console.log("   AuditLog         :", auditLogAddress);
  console.log("\n📁 Files Updated:");
  console.log("   ✅ blockchain/deployments.json");
  console.log("   ✅ frontend/lib/contracts/*.json");
  console.log("\n🔗 Network:", hre.network.name);
  console.log("⏰ Timestamp:", new Date().toISOString());
  console.log("═══════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
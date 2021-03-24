import * as fs from 'fs'
import * as path from 'path'
import * as shell from 'shelljs'
import * as argparse from 'argparse'
import { config } from 'maci-config'
import { genAccounts, genTestAccounts } from './accounts'
const { ethers } = require('hardhat')

const abiDir = path.join(__dirname, '..', 'artifacts')
const solDir = path.join(__dirname, '..', 'contracts')

const parseArtifact = (filename: string) => {
	let filePath = 'contracts/'
	if (filename.includes('Gatekeeper')) {
		filePath += 'gatekeepers/'
		filePath += `${filename}.sol`
	}

	if (filename.includes('VoiceCredit')) {
		filePath += 'initialVoiceCreditProxy/'
		filePath += `${filename}.sol`
	}

	if (filename.includes('Verifier')) {
		filePath += 'crypto/Verifier.sol/'
	}

	if (filename.includes('AccQueue')) {
		filePath += 'trees/AccQueue.sol/'
	}

	if (filename.includes('Poll') || filename.includes('MessageAq')) {
		filePath += 'Poll.sol'
	}

	if (!filePath.includes('.sol')) {
		filePath += `${filename}.sol`
	}

	const contractArtifact = JSON.parse(
		fs.readFileSync(path.join(abiDir, filePath, `${filename}.json`)).toString()
	)

	return [ contractArtifact.abi, contractArtifact.bytecode ]
}

const PoseidonT3 = require('../artifacts/contracts/crypto/Hasher.sol/PoseidonT3.json')
const PoseidonT4 = require('../artifacts/contracts/crypto/Hasher.sol/PoseidonT4.json')
const PoseidonT5 = require('../artifacts/contracts/crypto/Hasher.sol/PoseidonT5.json')
const PoseidonT6 = require('../artifacts/contracts/crypto/Hasher.sol/PoseidonT6.json')

const [ maciContractAbi, maciContractBytes ] = parseArtifact('MACI')

const getInitialVoiceCreditProxyAbi = () => {
    const [ abi ] = parseArtifact('InitialVoiceCreditProxy.abi')
    return abi
}

const linkPoseidonLibraries = async (
    solFileToLink: string,
    poseidonT3Address,
    poseidonT4Address,
    poseidonT5Address,
    poseidonT6Address,
) => {
	const signers = await ethers.getSigners()
	const signer = signers[0]

	console.log('Linking Poseidon libraries')
	console.log(
		poseidonT3Address,
		poseidonT4Address,
		poseidonT5Address,
		poseidonT6Address,
	)

	const contractFactory = await ethers.getContractFactory(
		solFileToLink,
		{
			signer,
			libraries: {
				PoseidonT3: poseidonT3Address,
				PoseidonT4: poseidonT4Address,
				PoseidonT5: poseidonT5Address,
				PoseidonT6: poseidonT6Address,
			},
		},
	)

	return contractFactory
}

const genProvider = (
    rpcUrl: string = config.get('chain.url'),
) => {

    return new ethers.providers.JsonRpcProvider(rpcUrl)
}

export class JSONRPCDeployer {

    provider: any
    signer: any
    options: any

    constructor(privateKey: string, providerUrl: string, options?: any) {
        this.provider = new ethers.providers.JsonRpcProvider(providerUrl)
        this.signer = new ethers.Wallet(privateKey, this.provider)
        this.options = options
    }

    async deploy(abi: any, bytecode: any, ...args): Promise<any> {
		const contractInterface = new ethers.utils.Interface( abi )
        const factory = new ethers.ContractFactory(contractInterface, bytecode, this.signer)
        return await factory.deploy(...args)
    }
}

class HardhatDeployer extends JSONRPCDeployer {

    constructor(privateKey: string, port: number, options?: any) {
        const url = `http://localhost:${port}/`
        super(privateKey, url, options)
    }
}

const genJsonRpcDeployer = (
    privateKey: string,
    url: string,
) => {

    return new JSONRPCDeployer(
        privateKey,
        url,
    )
}

const genDeployer = (
    privateKey: string,
) => {
    return new HardhatDeployer(
        privateKey,
        config.get('chain.ganache.port'),
        {
            gasLimit: 10000000,
        },
    )
}

const deployVkRegistry = async (
    deployer: any,
) => {
    const [ VkRegistryAbi, VkRegistryBin ] = parseArtifact('VkRegistry')
    return await deployer.deploy(
        VkRegistryAbi,
        VkRegistryBin,
    )
}

const deployMockVerifier = async (deployer, quiet = false) => {
    log('Deploying MockVerifier', quiet)
    const [ MockVerifierAbi, MockVerifierBin ] = parseArtifact('MockVerifier')
    return await deployer.deploy(
        MockVerifierAbi,
        MockVerifierBin,
    )
}

const deployVerifier = async (deployer, quiet = false) => {
    log('Deploying Verifier', quiet)
    const [ VerifierAbi, VerifierBin ] = parseArtifact('Verifier')
    return await deployer.deploy(
        VerifierAbi,
        VerifierBin,
    )
}

const deployConstantInitialVoiceCreditProxy = async (
    deployer,
    amount: number,
    quiet = false
) => {
    log('Deploying InitialVoiceCreditProxy', quiet)
    const [ ConstantInitialVoiceCreditProxyAbi, ConstantInitialVoiceCreditProxyBin ]
        = parseArtifact('ConstantInitialVoiceCreditProxy')
    return await deployer.deploy(
        ConstantInitialVoiceCreditProxyAbi,
        ConstantInitialVoiceCreditProxyBin,
        amount.toString(),
    )
}

const deploySignupToken = async (deployer) => {
    console.log('Deploying SignUpToken')
    const [ SignupTokenAbi, SignupTokenBin ] = parseArtifact('SignUpToken')
    return await deployer.deploy(
        SignupTokenAbi,
        SignupTokenBin,
    )
}

const deploySignupTokenGatekeeper = async (
    deployer,
    signUpTokenAddress: string,
    quiet = false
) => {
    log('Deploying SignUpTokenGatekeeper', quiet)

    const [ SignUpTokenGatekeeperAbi, SignUpTokenGatekeeperBin ] = parseArtifact('SignUpTokenGatekeeper')
    const signUpTokenGatekeeperContract = await deployer.deploy(
        SignUpTokenGatekeeperAbi,
        SignUpTokenGatekeeperBin,
        signUpTokenAddress,
    )

    return signUpTokenGatekeeperContract
}

const deployFreeForAllSignUpGatekeeper = async (
    deployer,
    quiet = false
) => {
    log('Deploying FreeForAllSignUpGatekeeper', quiet)
    const [ FreeForAllSignUpGatekeeperAbi, FreeForAllSignUpGatekeeperBin ]
        = parseArtifact('FreeForAllGatekeeper')
    return await deployer.deploy(
        FreeForAllSignUpGatekeeperAbi,
        FreeForAllSignUpGatekeeperBin,
    )
}

const log = (msg: string, quiet: boolean) => {
    if (!quiet) {
        console.log(msg)
    }
}

const deployPoseidonContracts = async (deployer: any, quiet = false) => {
    log('Deploying Poseidon Contracts', quiet)
    const PoseidonT3Contract = await deployer.deploy(
        PoseidonT3.abi,
        PoseidonT3.bytecode,
    )
    await PoseidonT3Contract.deployTransaction.wait()

    const PoseidonT4Contract = await deployer.deploy(
        PoseidonT4.abi,
        PoseidonT4.bytecode,
    )
    await PoseidonT4Contract.deployTransaction.wait()

    const PoseidonT5Contract = await deployer.deploy(
        PoseidonT5.abi,
        PoseidonT5.bytecode,
    )
    await PoseidonT5Contract.deployTransaction.wait()

    const PoseidonT6Contract = await deployer.deploy(
        PoseidonT6.abi,
        PoseidonT6.bytecode,
    )
    await PoseidonT6Contract.deployTransaction.wait()

    return {
        PoseidonT3Contract,
        PoseidonT4Contract,
        PoseidonT5Contract,
        PoseidonT6Contract,
    }
}

const deployPollFactory = async (deployer, quiet = false) => {
    log('Deploying PollFactory', quiet)
    const [ PollFactoryAbi, PollFactoryBin ] = parseArtifact('PollFactory')
	
	// TODO: reduce PollFactory contract size
    return await deployer.deploy(
        PollFactoryAbi,
        PollFactoryBin,
    )
}

const deployPpt = async (deployer, mockVerifierContractAddress: string, quiet = false) => {
    log('Deploying PollProcessorAndTallyer', quiet)
    const [ PptAbi, PptBin ] = parseArtifact('PollProcessorAndTallyer')
	// TODO: reduce PollProcessorAndTallyer contract size
    return await deployer.deploy(
        PptAbi,
        PptBin,
        mockVerifierContractAddress,
    )
}

const deployMessageAqFactory = async (deployer, quiet = false) => {
    // MessageAqFactory
    log('Deploying MessageAqFactory', quiet)
    const [ MessageAqFactoryAbi, MessageAqFactoryBin ] = parseArtifact('MessageAqFactory')
	// TODO: reduce MessageAqFactory contract size
    return await deployer.deploy(
        MessageAqFactoryAbi,
        MessageAqFactoryBin,
    )
}

const deployMaci = async (
    deployer: any,
    signUpTokenGatekeeperContractAddress: string,
    initialVoiceCreditBalanceAddress: string,
    mockVerifierContractAddress: string,
    quiet = false,
) => {
    const {
        PoseidonT3Contract,
        PoseidonT4Contract,
        PoseidonT5Contract,
        PoseidonT6Contract,
    } = await deployPoseidonContracts(deployer, quiet)

    // Link Poseidon contracts to MACI
    linkPoseidonLibraries(
        'MACI.sol',
        PoseidonT3Contract.address,
        PoseidonT4Contract.address,
        PoseidonT5Contract.address,
        PoseidonT6Contract.address,
    )

    const [ MACIAbi, MACIBin ] = parseArtifact('MACI')

    const pollFactoryContract = await deployPollFactory(deployer)
    await pollFactoryContract.deployTransaction.wait()

    // PollProcessorAndTallyer
    const pptContract = await deployPpt(deployer, mockVerifierContractAddress)
    await pptContract.deployTransaction.wait()

    log('Deploying MACI', quiet)
    const maciContract = await deployer.deploy(
        MACIAbi,
        MACIBin,
        pollFactoryContract.address,
        signUpTokenGatekeeperContractAddress,
        initialVoiceCreditBalanceAddress,
    )

    await maciContract.deployTransaction.wait()

    log('Transferring PollFactory ownership to MACI', quiet)
    await (await (pollFactoryContract.transferOwnership(maciContract.address))).wait()
    const messageAqFactoryContract = await deployMessageAqFactory(deployer, quiet)
    await messageAqFactoryContract.deployTransaction.wait()

    log('Transferring MessageAqFactory ownership to PollFactory', quiet)
    await (await (messageAqFactoryContract.transferOwnership(pollFactoryContract.address))).wait()

    // VkRegistry
    const vkRegistryContract = await deployVkRegistry(deployer)
    await vkRegistryContract.deployTransaction.wait()

    log('Transferring VkRegistry ownership to MACI', quiet)
    await (await (vkRegistryContract.transferOwnership(maciContract.address))).wait()

    log('Initialising MACI', quiet)
    await (await (maciContract.init(
        vkRegistryContract.address,
        messageAqFactoryContract.address,
    ))).wait()

    const [ AccQueueQuinaryMaciAbi, AccQueueBin ] = parseArtifact('AccQueue')
    const stateAqContract = new ethers.Contract(
        await maciContract.stateAq(),
        AccQueueQuinaryMaciAbi,
        deployer.signer,
    )

    return {
        maciContract,
        vkRegistryContract,
        stateAqContract,
        pptContract,
    }
}

const writeContractAddress = (
	maciContractAddress: string,
	vkRegistryContractAddress: string,
	stateAqContractAddress: string,
	signUpTokenAddress: string,
	pptContractAddress: string,
	outputAddressFile: string
) => {
    const addresses = {
        MaciContract: maciContractAddress,
        VkRegistry: vkRegistryContractAddress,
        StateAqContract: stateAqContractAddress,
        SignUpToken: signUpTokenAddress,
        ProcessAndTallyContract: pptContractAddress,
    }

    const addressJsonPath = path.join(__dirname, '..', outputAddressFile)
    fs.writeFileSync(
        addressJsonPath,
        JSON.stringify(addresses),
    )

    console.log(addresses)
}

export {
    deployVkRegistry,
    deployMaci,
    deploySignupToken,
    deploySignupTokenGatekeeper,
    deployConstantInitialVoiceCreditProxy,
    deployFreeForAllSignUpGatekeeper,
    deployMockVerifier,
    deployVerifier,
    deployPollFactory,
    deployPpt,
    deployMessageAqFactory,
    genDeployer,
    genProvider,
    genJsonRpcDeployer,
    maciContractAbi,
    getInitialVoiceCreditProxyAbi,
    abiDir,
    solDir,
    parseArtifact,
    linkPoseidonLibraries,
    deployPoseidonContracts,
}

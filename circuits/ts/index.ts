import * as fs from 'fs'
import * as path from 'path'
import * as shelljs from 'shelljs'

import {
    stringifyBigInts,
} from 'maci-crypto'

import * as tmp from 'tmp'

const snarkjsPath = path.join(
    __dirname,
    '..',
    './node_modules/snarkjs/cli.js',
)

const genProof = (
    inputs: string[],
    rapidsnarkExePath: string,
    witnessExePath: string,
    zkeyPath: string,
    silent = true,
): any => {
    // Create tmp directory
    const tmpObj = tmp.dirSync()
    const tmpDirPath = tmpObj.name

    const inputJsonPath = path.join(tmpDirPath, 'input.json')
    const outputWtnsPath = path.join(tmpDirPath, 'output.wtns')
    const proofJsonPath = path.join(tmpDirPath, 'proof.json')
    const publicJsonPath = path.join(tmpDirPath, 'public.json')

    const jsonData = JSON.stringify(stringifyBigInts(inputs))
    fs.writeFileSync(inputJsonPath, jsonData)

    const witnessGenCmd = `${witnessExePath} ${inputJsonPath} ${outputWtnsPath}`
    shelljs.exec(witnessGenCmd, { silent })

    if (!fs.existsSync(outputWtnsPath)) {
        throw new Error('Error executing ' + witnessGenCmd)
    }

    const proofGenCmd = `${rapidsnarkExePath} ${zkeyPath} ${outputWtnsPath} ${proofJsonPath} ${publicJsonPath}`
    shelljs.exec(proofGenCmd, { silent })

    if (!fs.existsSync(proofJsonPath)) {
        throw new Error('Error executing ' + proofGenCmd)
    }

    const proof = JSON.parse(fs.readFileSync(proofJsonPath).toString())
    const publicInputs = JSON.parse(fs.readFileSync(publicJsonPath).toString())

    fs.unlinkSync(proofJsonPath)
    fs.unlinkSync(publicJsonPath)
    fs.unlinkSync(inputJsonPath)
    fs.unlinkSync(outputWtnsPath)
    tmpObj.removeCallback()

    return { proof, publicInputs }
}

const verifyProof = (
    publicInputs: any,
    proof: any,
    vk: any,
) => {
    // Create tmp directory
    const tmpObj = tmp.dirSync()
    const tmpDirPath = tmpObj.name

    const publicJsonPath = path.join(tmpDirPath, 'public.json')
    const proofJsonPath = path.join(tmpDirPath, 'proof.json')
    const vkJsonPath = path.join(tmpDirPath, 'vk.json')

    fs.writeFileSync(
        publicJsonPath,
        JSON.stringify(stringifyBigInts(publicInputs)),
    )

    fs.writeFileSync(
        proofJsonPath,
        JSON.stringify(stringifyBigInts(proof)),
    )

    fs.writeFileSync(
        vkJsonPath,
        JSON.stringify(stringifyBigInts(vk)),
    )

    const verifyCmd = `node ${snarkjsPath} g16v ${vkJsonPath} ${publicJsonPath} ${proofJsonPath}`
    const output = shelljs.exec(verifyCmd, { silent: true })
    const isValid = output.stdout && output.stdout.indexOf('OK!') > -1

    fs.unlinkSync(proofJsonPath)
    fs.unlinkSync(publicJsonPath)
    fs.unlinkSync(vkJsonPath)
    tmpObj.removeCallback()

    return isValid
}

const extractVk = (zkeyPath: string) => {
    // Create tmp directory
    const tmpObj = tmp.dirSync()
    const tmpDirPath = tmpObj.name
    const vkJsonPath = path.join(tmpDirPath, 'vk.json')

    const exportCmd = `node ${snarkjsPath} zkev ${zkeyPath} ${vkJsonPath}`
    shelljs.exec(exportCmd)

    const vk = JSON.parse(fs.readFileSync(vkJsonPath).toString())

    fs.unlinkSync(vkJsonPath)
    tmpObj.removeCallback()

    return vk
}

export {
    genProof,
    verifyProof,
    extractVk,
}

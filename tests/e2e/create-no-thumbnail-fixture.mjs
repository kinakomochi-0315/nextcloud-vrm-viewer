/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: MIT
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const GLB_MAGIC = 0x46546C67
const JSON_CHUNK_TYPE = 0x4E4F534A
const GLB_HEADER_LENGTH = 12
const CHUNK_HEADER_LENGTH = 8

/**
 * VRM 1.0のGLBからサムネイル参照だけを削除します。
 *
 * BINチャンクは変更せず、有効なVRMとしてViewerで読み込める状態を維持します。
 *
 * @param {Buffer} source 元のVRMデータ
 * @return {Buffer} サムネイル参照を削除したVRMデータ
 */
function removeVrm1ThumbnailReference(source) {
	if (source.length < GLB_HEADER_LENGTH + CHUNK_HEADER_LENGTH
		|| source.readUInt32LE(0) !== GLB_MAGIC
		|| source.readUInt32LE(4) !== 2
		|| source.readUInt32LE(8) !== source.length) {
		throw new Error('Source fixture is not a valid GLB')
	}

	const jsonLength = source.readUInt32LE(GLB_HEADER_LENGTH)
	const jsonType = source.readUInt32LE(GLB_HEADER_LENGTH + 4)
	const jsonStart = GLB_HEADER_LENGTH + CHUNK_HEADER_LENGTH
	const jsonEnd = jsonStart + jsonLength
	if (jsonType !== JSON_CHUNK_TYPE || jsonEnd > source.length) {
		throw new Error('Source fixture does not contain a valid JSON chunk')
	}

	const jsonText = source.subarray(jsonStart, jsonEnd)
		.toString('utf8')
		.replace(/\0+$/u, '')
		.trimEnd()
	const gltf = JSON.parse(jsonText)
	const meta = gltf.extensions?.VRMC_vrm?.meta
	if (!meta || !Object.hasOwn(meta, 'thumbnailImage')) {
		throw new Error('Source fixture does not contain a VRM 1.0 thumbnail reference')
	}
	delete meta.thumbnailImage

	const encodedJson = Buffer.from(JSON.stringify(gltf))
	const jsonPadding = (4 - encodedJson.length % 4) % 4
	const paddedJson = Buffer.concat([
		encodedJson,
		Buffer.alloc(jsonPadding, 0x20),
	])
	const remainingChunks = source.subarray(jsonEnd)
	const output = Buffer.alloc(
		GLB_HEADER_LENGTH + CHUNK_HEADER_LENGTH + paddedJson.length + remainingChunks.length,
	)

	output.writeUInt32LE(GLB_MAGIC, 0)
	output.writeUInt32LE(2, 4)
	output.writeUInt32LE(output.length, 8)
	output.writeUInt32LE(paddedJson.length, GLB_HEADER_LENGTH)
	output.writeUInt32LE(JSON_CHUNK_TYPE, GLB_HEADER_LENGTH + 4)
	paddedJson.copy(output, jsonStart)
	remainingChunks.copy(output, jsonStart + paddedJson.length)

	return output
}

/**
 * コマンドライン引数で指定されたfixtureを変換します。
 */
async function main() {
	const [, , sourcePath, outputPath] = process.argv
	if (!sourcePath || !outputPath) {
		throw new Error('Usage: node create-no-thumbnail-fixture.mjs SOURCE OUTPUT')
	}

	const source = await readFile(sourcePath)
	const output = removeVrm1ThumbnailReference(source)
	await mkdir(dirname(outputPath), { recursive: true })
	await writeFile(outputPath, output)
}

await main()

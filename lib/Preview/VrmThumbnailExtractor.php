<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: MIT
 */

namespace OCA\Files_VRMViewer\Preview;

/**
 * VRMのGLBデータから埋め込みサムネイルを安全に抽出します。
 */
final class VrmThumbnailExtractor {
	private const GLB_MAGIC = 0x46546C67;
	private const GLB_VERSION = 2;
	private const JSON_CHUNK_TYPE = 0x4E4F534A;
	private const BIN_CHUNK_TYPE = 0x004E4942;
	private const GLB_HEADER_LENGTH = 12;
	private const CHUNK_HEADER_LENGTH = 8;
	private const MAX_JSON_LENGTH = 32 * 1024 * 1024;
	private const MAX_IMAGE_LENGTH = 16 * 1024 * 1024;

	/**
	 * GLBに利用可能なVRMサムネイル参照が含まれるか確認します。
	 *
	 * bufferViewの画像本体は読み込まず、JSONチャンク内の参照情報だけを検証します。
	 *
	 * @param resource $stream VRMファイルの読み取りストリーム
	 * @param int $fileSize VRMファイル全体のサイズ
	 */
	public function hasThumbnail($stream, int $fileSize): bool {
		return $this->readThumbnailReferenceSafely($stream, $fileSize) !== null;
	}

	/**
	 * GLBに埋め込まれたVRMサムネイル画像を抽出します。
	 *
	 * @param resource $stream VRMファイルの読み取りストリーム
	 * @param int $fileSize VRMファイル全体のサイズ
	 * @return string|null PNGまたはJPEGのバイナリ。抽出できない場合は`null`
	 */
	public function extractThumbnail($stream, int $fileSize): ?string {
		$reference = $this->readThumbnailReferenceSafely($stream, $fileSize);
		if ($reference === null) {
			return null;
		}

		try {
			if ($reference['kind'] === 'data-uri') {
				return $this->decodeDataUri($reference['uri']);
			}

			$binaryChunk = $this->findBinaryChunk(
				$stream,
				$reference['nextChunkOffset'],
				$reference['totalLength'],
			);
			if ($binaryChunk === null
				|| !$this->isValidRange(
					$reference['byteOffset'],
					$reference['byteLength'],
					$binaryChunk['length'],
				)) {
				return null;
			}

			$imageOffset = $binaryChunk['offset'] + $reference['byteOffset'];
			$this->seek($stream, $imageOffset);

			return $this->readExactly($stream, $reference['byteLength']);
		} catch (\JsonException|\UnexpectedValueException) {
			return null;
		}
	}

	/**
	 * GLBのJSONチャンクを読み、サムネイルの格納位置を返します。
	 *
	 * @param resource $stream VRMファイルの読み取りストリーム
	 * @param int $fileSize VRMファイル全体のサイズ
	 * @return array{
	 *     kind: 'data-uri',
	 *     uri: string,
	 *     nextChunkOffset: int,
	 *     totalLength: int
	 * }|array{
	 *     kind: 'buffer-view',
	 *     byteOffset: int,
	 *     byteLength: int,
	 *     nextChunkOffset: int,
	 *     totalLength: int
	 * }|null
	 */
	private function readThumbnailReferenceSafely($stream, int $fileSize): ?array {
		try {
			return $this->readThumbnailReference($stream, $fileSize);
		} catch (\JsonException|\UnexpectedValueException) {
			return null;
		}
	}

	/**
	 * GLBヘッダーとJSONチャンクからサムネイル参照を解析します。
	 *
	 * @param resource $stream VRMファイルの読み取りストリーム
	 * @param int $fileSize VRMファイル全体のサイズ
	 * @return array{
	 *     kind: 'data-uri',
	 *     uri: string,
	 *     nextChunkOffset: int,
	 *     totalLength: int
	 * }|array{
	 *     kind: 'buffer-view',
	 *     byteOffset: int,
	 *     byteLength: int,
	 *     nextChunkOffset: int,
	 *     totalLength: int
	 * }|null
	 * @throws \JsonException JSONチャンクが不正な場合
	 * @throws \UnexpectedValueException GLB構造が不正な場合
	 */
	private function readThumbnailReference($stream, int $fileSize): ?array {
		if (!is_resource($stream) || $fileSize < self::GLB_HEADER_LENGTH) {
			throw new \UnexpectedValueException('Invalid VRM stream');
		}

		$this->seek($stream, 0);
		$header = $this->unpackUnsignedIntegers(
			$this->readExactly($stream, self::GLB_HEADER_LENGTH),
			['magic', 'version', 'length'],
		);

		if ($header['magic'] !== self::GLB_MAGIC
			|| $header['version'] !== self::GLB_VERSION
			|| $header['length'] !== $fileSize) {
			throw new \UnexpectedValueException('Invalid GLB header');
		}

		$chunkHeader = $this->unpackUnsignedIntegers(
			$this->readExactly($stream, self::CHUNK_HEADER_LENGTH),
			['length', 'type'],
		);
		if ($chunkHeader['type'] !== self::JSON_CHUNK_TYPE
			|| $chunkHeader['length'] <= 0
			|| $chunkHeader['length'] > self::MAX_JSON_LENGTH
			|| !$this->isValidRange(
				self::GLB_HEADER_LENGTH + self::CHUNK_HEADER_LENGTH,
				$chunkHeader['length'],
				$header['length'],
			)) {
			throw new \UnexpectedValueException('Invalid GLB JSON chunk');
		}

		$jsonData = rtrim(
			$this->readExactly($stream, $chunkHeader['length']),
			"\0\x20\t\r\n",
		);
		/** @var mixed $decoded */
		$decoded = json_decode($jsonData, true, flags: JSON_THROW_ON_ERROR);
		if (!is_array($decoded)) {
			throw new \UnexpectedValueException('Invalid glTF JSON root');
		}

		$imageIndex = $this->findThumbnailImageIndex($decoded);
		if ($imageIndex === null) {
			return null;
		}

		$image = $this->getIndexedArrayValue($decoded['images'] ?? null, $imageIndex);
		if ($image === null) {
			return null;
		}

		$nextChunkOffset = self::GLB_HEADER_LENGTH
			+ self::CHUNK_HEADER_LENGTH
			+ $chunkHeader['length'];
		$uri = $image['uri'] ?? null;
		$bufferViewIndex = $image['bufferView'] ?? null;

		if (is_string($uri) && !array_key_exists('bufferView', $image)) {
			if (!$this->isSupportedDataUri($uri, $image['mimeType'] ?? null)) {
				return null;
			}

			return [
				'kind' => 'data-uri',
				'uri' => $uri,
				'nextChunkOffset' => $nextChunkOffset,
				'totalLength' => $header['length'],
			];
		}

		if (!is_int($bufferViewIndex)
			|| array_key_exists('uri', $image)
			|| !$this->isSupportedMimeType($image['mimeType'] ?? null)) {
			return null;
		}

		$bufferView = $this->getIndexedArrayValue(
			$decoded['bufferViews'] ?? null,
			$bufferViewIndex,
		);
		if ($bufferView === null
			|| ($bufferView['buffer'] ?? null) !== 0
			|| !is_int($bufferView['byteLength'] ?? null)
			|| ($bufferView['byteLength'] ?? 0) <= 0
			|| ($bufferView['byteLength'] ?? 0) > self::MAX_IMAGE_LENGTH) {
			return null;
		}

		$byteOffset = $bufferView['byteOffset'] ?? 0;
		if (!is_int($byteOffset) || $byteOffset < 0) {
			return null;
		}

		return [
			'kind' => 'buffer-view',
			'byteOffset' => $byteOffset,
			'byteLength' => $bufferView['byteLength'],
			'nextChunkOffset' => $nextChunkOffset,
			'totalLength' => $header['length'],
		];
	}

	/**
	 * VRM 1.0またはVRM 0.xのメタ情報から画像インデックスを取得します。
	 *
	 * @param array<string, mixed> $gltf glTF JSON
	 */
	private function findThumbnailImageIndex(array $gltf): ?int {
		$extensions = $gltf['extensions'] ?? null;
		if (!is_array($extensions)) {
			return null;
		}

		$vrm1 = $extensions['VRMC_vrm'] ?? null;
		if (is_array($vrm1)) {
			$meta = $vrm1['meta'] ?? null;
			$imageIndex = is_array($meta) ? ($meta['thumbnailImage'] ?? null) : null;
			if (is_int($imageIndex) && $imageIndex >= 0) {
				return $imageIndex;
			}
		}

		$vrm0 = $extensions['VRM'] ?? null;
		if (!is_array($vrm0)) {
			return null;
		}

		$meta = $vrm0['meta'] ?? null;
		$textureIndex = is_array($meta) ? ($meta['texture'] ?? null) : null;
		if (!is_int($textureIndex) || $textureIndex < 0) {
			return null;
		}

		$texture = $this->getIndexedArrayValue($gltf['textures'] ?? null, $textureIndex);
		$imageIndex = $texture['source'] ?? null;

		return is_int($imageIndex) && $imageIndex >= 0 ? $imageIndex : null;
	}

	/**
	 * 配列から0始まりのインデックスに対応する連想配列を取得します。
	 *
	 * @param mixed $values 検索対象
	 * @return array<string, mixed>|null
	 */
	private function getIndexedArrayValue(mixed $values, int $index): ?array {
		if (!is_array($values) || !array_key_exists($index, $values)) {
			return null;
		}

		$value = $values[$index];

		return is_array($value) ? $value : null;
	}

	/**
	 * Data URIが対応画像形式で、画像サイズ上限を超えない可能性があるか確認します。
	 *
	 * @param mixed $declaredMimeType glTF images要素のMIMEタイプ
	 */
	private function isSupportedDataUri(string $uri, mixed $declaredMimeType): bool {
		if (preg_match(
			'/\Adata:(image\/(?:png|jpeg));base64,([A-Za-z0-9+\/]*={0,2})\z/iD',
			$uri,
			$matches,
		) !== 1) {
			return false;
		}

		$mimeType = strtolower($matches[1]);
		if ($declaredMimeType !== null
			&& (!is_string($declaredMimeType)
				|| strtolower($declaredMimeType) !== $mimeType)) {
			return false;
		}

		// Base64の展開前サイズから、巨大な画像をデコードする前に除外する。
		$payloadLength = strlen($matches[2]);
		$remainder = $payloadLength % 4;
		if ($payloadLength === 0 || $remainder === 1) {
			return false;
		}

		$paddingLength = str_ends_with($matches[2], '==')
			? 2
			: (str_ends_with($matches[2], '=') ? 1 : 0);
		if ($paddingLength > 0 && $remainder !== 0) {
			return false;
		}

		$estimatedLength = intdiv($payloadLength, 4) * 3 - $paddingLength;
		if ($paddingLength === 0) {
			$estimatedLength += match ($remainder) {
				2 => 1,
				3 => 2,
				default => 0,
			};
		}

		return $estimatedLength > 0 && $estimatedLength <= self::MAX_IMAGE_LENGTH;
	}

	/**
	 * Data URIから画像バイナリを復号します。
	 *
	 * @throws \UnexpectedValueException Data URIが不正な場合
	 */
	private function decodeDataUri(string $uri): string {
		if (preg_match(
			'/\Adata:image\/(?:png|jpeg);base64,([A-Za-z0-9+\/]*={0,2})\z/iD',
			$uri,
			$matches,
		) !== 1) {
			throw new \UnexpectedValueException('Unsupported thumbnail data URI');
		}

		$data = base64_decode($matches[1], true);
		if ($data === false || $data === '' || strlen($data) > self::MAX_IMAGE_LENGTH) {
			throw new \UnexpectedValueException('Invalid thumbnail data URI');
		}

		return $data;
	}

	/**
	 * サポート対象の画像MIMEタイプか判定します。
	 */
	private function isSupportedMimeType(mixed $mimeType): bool {
		if (!is_string($mimeType)) {
			return false;
		}

		return in_array(strtolower($mimeType), ['image/png', 'image/jpeg'], true);
	}

	/**
	 * JSONチャンク以降を走査し、GLBのBINチャンク位置を取得します。
	 *
	 * @param resource $stream VRMファイルの読み取りストリーム
	 * @return array{offset: int, length: int}|null
	 * @throws \UnexpectedValueException チャンク構造が不正な場合
	 */
	private function findBinaryChunk($stream, int $offset, int $totalLength): ?array {
		while ($offset < $totalLength) {
			if (!$this->isValidRange($offset, self::CHUNK_HEADER_LENGTH, $totalLength)) {
				throw new \UnexpectedValueException('Invalid GLB chunk header');
			}

			$this->seek($stream, $offset);
			$chunkHeader = $this->unpackUnsignedIntegers(
				$this->readExactly($stream, self::CHUNK_HEADER_LENGTH),
				['length', 'type'],
			);
			$dataOffset = $offset + self::CHUNK_HEADER_LENGTH;
			if (!$this->isValidRange($dataOffset, $chunkHeader['length'], $totalLength)) {
				throw new \UnexpectedValueException('Invalid GLB chunk range');
			}

			if ($chunkHeader['type'] === self::BIN_CHUNK_TYPE) {
				return [
					'offset' => $dataOffset,
					'length' => $chunkHeader['length'],
				];
			}

			$offset = $dataOffset + $chunkHeader['length'];
		}

		return null;
	}

	/**
	 * リトルエンディアン32bit整数を名前付き配列へ展開します。
	 *
	 * @param list<string> $names 値へ割り当てる名前
	 * @return array<string, int>
	 * @throws \UnexpectedValueException 展開に失敗した場合
	 */
	private function unpackUnsignedIntegers(string $data, array $names): array {
		$formatParts = array_map(
			static fn (string $name): string => 'V' . $name,
			$names,
		);
		$values = unpack(implode('/', $formatParts), $data);
		if ($values === false) {
			throw new \UnexpectedValueException('Could not unpack GLB integers');
		}

		/** @var array<string, int> $values */
		return $values;
	}

	/**
	 * 加算時の整数オーバーフローを避けながら範囲内か判定します。
	 */
	private function isValidRange(int $offset, int $length, int $limit): bool {
		return $offset >= 0
			&& $length >= 0
			&& $offset <= $limit
			&& $length <= $limit - $offset;
	}

	/**
	 * ストリームを指定位置へ移動します。
	 *
	 * @param resource $stream 読み取りストリーム
	 * @throws \UnexpectedValueException 移動できない場合
	 */
	private function seek($stream, int $offset): void {
		if (fseek($stream, $offset, SEEK_SET) !== 0) {
			throw new \UnexpectedValueException('Could not seek VRM stream');
		}
	}

	/**
	 * ストリームから指定バイト数を欠落なく読み取ります。
	 *
	 * @param resource $stream 読み取りストリーム
	 * @throws \UnexpectedValueException 読み取りに失敗した場合
	 */
	private function readExactly($stream, int $length): string {
		$data = '';
		while (strlen($data) < $length) {
			$chunk = fread($stream, $length - strlen($data));
			if ($chunk === false || $chunk === '') {
				throw new \UnexpectedValueException('Unexpected end of VRM stream');
			}
			$data .= $chunk;
		}

		return $data;
	}
}

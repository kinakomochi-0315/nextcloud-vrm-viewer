<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: MIT
 */

namespace OCA\Files_VRMViewer\Tests\Unit\Preview;

use OCA\Files_VRMViewer\Preview\VrmThumbnailExtractor;
use PHPUnit\Framework\TestCase;

/**
 * VRM埋め込みサムネイル抽出処理を検証します。
 */
final class VrmThumbnailExtractorTest extends TestCase {
	private const GLB_MAGIC = 0x46546C67;
	private const JSON_CHUNK_TYPE = 0x4E4F534A;
	private const BIN_CHUNK_TYPE = 0x004E4942;

	private VrmThumbnailExtractor $extractor;

	/**
	 * 各テストで利用する抽出器を初期化します。
	 */
	#[\Override]
	protected function setUp(): void {
		$this->extractor = new VrmThumbnailExtractor();
	}

	/**
	 * VRM 1.0のbufferViewサムネイルを抽出できることを確認します。
	 */
	public function testExtractsVrm1BufferViewThumbnail(): void {
		$image = "\x89PNG\r\n\x1A\nthumbnail";
		$glb = $this->createGlb([
			'extensions' => [
				'VRMC_vrm' => [
					'meta' => ['thumbnailImage' => 0],
				],
			],
			'images' => [
				['bufferView' => 0, 'mimeType' => 'image/png'],
			],
			'bufferViews' => [
				['buffer' => 0, 'byteOffset' => 0, 'byteLength' => strlen($image)],
			],
			'buffers' => [
				['byteLength' => strlen($image)],
			],
		], $image);

		$this->assertThumbnail($glb, $image);
	}

	/**
	 * VRM 0.xのtexture参照からサムネイルを抽出できることを確認します。
	 */
	public function testExtractsVrm0TextureThumbnail(): void {
		$image = "\xFF\xD8\xFF\xE0thumbnail\xFF\xD9";
		$glb = $this->createGlb([
			'extensions' => [
				'VRM' => [
					'meta' => ['texture' => 0],
				],
			],
			'textures' => [
				['source' => 0],
			],
			'images' => [
				['bufferView' => 0, 'mimeType' => 'image/jpeg'],
			],
			'bufferViews' => [
				['buffer' => 0, 'byteOffset' => 0, 'byteLength' => strlen($image)],
			],
			'buffers' => [
				['byteLength' => strlen($image)],
			],
		], $image);

		$this->assertThumbnail($glb, $image);
	}

	/**
	 * Base64 Data URIのサムネイルを抽出できることを確認します。
	 */
	public function testExtractsDataUriThumbnail(): void {
		$image = "\x89PNG\r\n\x1A\nthumbnail";
		$glb = $this->createGlb([
			'extensions' => [
				'VRMC_vrm' => [
					'meta' => ['thumbnailImage' => 0],
				],
			],
			'images' => [
				[
					'uri' => 'data:image/png;base64,'
						. rtrim(base64_encode($image), '='),
				],
			],
		]);

		$this->assertThumbnail($glb, $image);
	}

	/**
	 * サムネイル参照がないVRMを利用不可として扱うことを確認します。
	 */
	public function testRejectsVrmWithoutThumbnail(): void {
		$glb = $this->createGlb([
			'extensions' => [
				'VRMC_vrm' => [
					'meta' => [],
				],
			],
		]);

		$this->assertNoThumbnail($glb);
	}

	/**
	 * 外部画像URIをサムネイルとして利用しないことを確認します。
	 */
	public function testRejectsExternalThumbnailUri(): void {
		$glb = $this->createGlb([
			'extensions' => [
				'VRMC_vrm' => [
					'meta' => ['thumbnailImage' => 0],
				],
			],
			'images' => [
				['uri' => 'https://example.com/thumbnail.png'],
			],
		]);

		$this->assertNoThumbnail($glb);
	}

	/**
	 * GLBではない破損データを利用不可として扱うことを確認します。
	 */
	public function testRejectsBrokenGlb(): void {
		$this->assertNoThumbnail('not-a-glb');
	}

	/**
	 * BINチャンク外を参照するbufferViewから画像を読み取らないことを確認します。
	 */
	public function testRejectsOutOfRangeBufferViewWhenExtracting(): void {
		$glb = $this->createGlb([
			'extensions' => [
				'VRMC_vrm' => [
					'meta' => ['thumbnailImage' => 0],
				],
			],
			'images' => [
				['bufferView' => 0, 'mimeType' => 'image/png'],
			],
			'bufferViews' => [
				['buffer' => 0, 'byteOffset' => 8, 'byteLength' => 8],
			],
			'buffers' => [
				['byteLength' => 4],
			],
		], 'data');

		$stream = $this->createStream($glb);
		try {
			// 一覧判定ではJSONだけを見るため参照自体は検出し、抽出時に実データ範囲を拒否する。
			self::assertTrue($this->extractor->hasThumbnail($stream, strlen($glb)));
			self::assertNull($this->extractor->extractThumbnail($stream, strlen($glb)));
		} finally {
			fclose($stream);
		}
	}

	/**
	 * JSONチャンクの32 MiB上限を超える宣言を読み込まないことを確認します。
	 */
	public function testRejectsOversizedJsonChunk(): void {
		$jsonLength = 32 * 1024 * 1024 + 4;
		$totalLength = 12 + 8 + $jsonLength;
		$glbHeader = pack(
			'V5',
			self::GLB_MAGIC,
			2,
			$totalLength,
			$jsonLength,
			self::JSON_CHUNK_TYPE,
		);
		$stream = $this->createStream($glbHeader);

		try {
			self::assertFalse($this->extractor->hasThumbnail($stream, $totalLength));
			self::assertNull($this->extractor->extractThumbnail($stream, $totalLength));
		} finally {
			fclose($stream);
		}
	}

	/**
	 * 画像の16 MiB上限を超えるbufferViewを利用不可として扱うことを確認します。
	 */
	public function testRejectsOversizedImage(): void {
		$glb = $this->createGlb([
			'extensions' => [
				'VRMC_vrm' => [
					'meta' => ['thumbnailImage' => 0],
				],
			],
			'images' => [
				['bufferView' => 0, 'mimeType' => 'image/png'],
			],
			'bufferViews' => [
				['buffer' => 0, 'byteOffset' => 0, 'byteLength' => 16 * 1024 * 1024 + 1],
			],
			'buffers' => [
				['byteLength' => 4],
			],
		], 'data');

		$this->assertNoThumbnail($glb);
	}

	/**
	 * GLBを組み立てます。
	 *
	 * @param array<string, mixed> $json glTF JSON
	 * @param string $binary BINチャンクのデータ
	 */
	private function createGlb(array $json, string $binary = ''): string {
		$jsonData = json_encode($json, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
		$jsonPadding = (4 - strlen($jsonData) % 4) % 4;
		$jsonChunk = $jsonData . str_repeat(' ', $jsonPadding);

		$chunks = pack(
			'V2',
			strlen($jsonChunk),
			self::JSON_CHUNK_TYPE,
		) . $jsonChunk;

		if ($binary !== '') {
			$binaryPadding = (4 - strlen($binary) % 4) % 4;
			$binaryChunk = $binary . str_repeat("\0", $binaryPadding);
			$chunks .= pack(
				'V2',
				strlen($binaryChunk),
				self::BIN_CHUNK_TYPE,
			) . $binaryChunk;
		}

		return pack(
			'V3',
			self::GLB_MAGIC,
			2,
			12 + strlen($chunks),
		) . $chunks;
	}

	/**
	 * 文字列から読み書き可能な一時ストリームを生成します。
	 *
	 * @return resource
	 */
	private function createStream(string $data) {
		$stream = fopen('php://temp', 'w+b');
		self::assertIsResource($stream);
		fwrite($stream, $data);
		rewind($stream);

		return $stream;
	}

	/**
	 * GLBが指定画像をサムネイルとして返すことを確認します。
	 */
	private function assertThumbnail(string $glb, string $expectedImage): void {
		$stream = $this->createStream($glb);
		try {
			self::assertTrue($this->extractor->hasThumbnail($stream, strlen($glb)));
			self::assertSame(
				$expectedImage,
				$this->extractor->extractThumbnail($stream, strlen($glb)),
			);
		} finally {
			fclose($stream);
		}
	}

	/**
	 * GLBからサムネイルを取得できないことを確認します。
	 */
	private function assertNoThumbnail(string $glb): void {
		$stream = $this->createStream($glb);
		try {
			self::assertFalse($this->extractor->hasThumbnail($stream, strlen($glb)));
			self::assertNull($this->extractor->extractThumbnail($stream, strlen($glb)));
		} finally {
			fclose($stream);
		}
	}
}

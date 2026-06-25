<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: MIT
 */

namespace OCA\Files_VRMViewer\Preview;

use OCP\Files\File;
use OCP\Files\FileInfo;
use OCP\IImage;
use OCP\Image;
use OCP\Preview\IProviderV2;

/**
 * VRMに埋め込まれた画像をNextcloudのファイルプレビューとして提供します。
 */
final class VrmPreviewProvider implements IProviderV2 {
	private const MIME_TYPE_REGEX = '/\A(?:model\/vrm|application\/octet-stream)\z/';

	/**
	 * Preview Providerを初期化します。
	 *
	 * @param VrmThumbnailExtractor $extractor VRMサムネイル抽出器
	 */
	public function __construct(
		private readonly VrmThumbnailExtractor $extractor,
	) {
	}

	/**
	 * 対応するMIMEタイプの正規表現を返します。
	 */
	#[\Override]
	public function getMimeType(): string {
		return self::MIME_TYPE_REGEX;
	}

	/**
	 * ファイルに利用可能な埋め込みサムネイルがあるか確認します。
	 *
	 * @param FileInfo $file 確認対象のファイル
	 */
	#[\Override]
	public function isAvailable(FileInfo $file): bool {
		if (!$file instanceof File || !$this->supportsFile($file)) {
			return false;
		}

		$fileSize = $this->getFileSize($file);
		if ($fileSize === null) {
			return false;
		}

		try {
			$stream = $file->fopen('rb');
		} catch (\Throwable) {
			return false;
		}
		if (!is_resource($stream)) {
			return false;
		}

		try {
			return $this->extractor->hasThumbnail($stream, $fileSize);
		} finally {
			fclose($stream);
		}
	}

	/**
	 * VRMの埋め込みサムネイルを要求サイズ以内へ縮小して返します。
	 *
	 * @param File $file プレビュー対象のVRMファイル
	 * @param int $maxX サムネイルの最大幅
	 * @param int $maxY サムネイルの最大高さ
	 */
	#[\Override]
	public function getThumbnail(File $file, int $maxX, int $maxY): ?IImage {
		if (!$this->supportsFile($file)) {
			return null;
		}

		$fileSize = $this->getFileSize($file);
		if ($fileSize === null) {
			return null;
		}

		try {
			$stream = $file->fopen('rb');
		} catch (\Throwable) {
			return null;
		}
		if (!is_resource($stream)) {
			return null;
		}

		try {
			$thumbnail = $this->extractor->extractThumbnail(
				$stream,
				$fileSize,
			);
		} finally {
			fclose($stream);
		}

		if ($thumbnail === null) {
			return null;
		}

		$image = new Image();
		if ($image->loadFromData($thumbnail) === false || !$image->valid()) {
			return null;
		}

		$image->fixOrientation();
		if ($maxX > 0 && $maxY > 0) {
			$image->scaleDownToFit($maxX, $maxY);
		}

		return $image;
	}

	/**
	 * Preview Providerで処理すべきVRMファイルか判定します。
	 *
	 * `application/octet-stream`は他形式でも頻出するため、拡張子でも限定します。
	 */
	private function supportsFile(FileInfo $file): bool {
		$mimeType = strtolower($file->getMimetype());
		if ($mimeType === 'model/vrm') {
			return true;
		}

		return $mimeType === 'application/octet-stream'
			&& strtolower($file->getExtension()) === 'vrm';
	}

	/**
	 * NextcloudのファイルサイズをGLB解析用の整数へ変換します。
	 */
	private function getFileSize(FileInfo $file): ?int {
		$fileSize = $file->getSize();
		if (!is_int($fileSize) || $fileSize < 0) {
			return null;
		}

		return $fileSize;
	}
}

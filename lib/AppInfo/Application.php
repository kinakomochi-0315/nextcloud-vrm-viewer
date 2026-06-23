<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\Files_VRMViewer\AppInfo;

use OCA\Files\Event\LoadAdditionalScriptsEvent;
use OCA\Files_VRMViewer\Listener\LoadFilesScriptsListener;
use OCA\Files_VRMViewer\Preview\VrmPreviewProvider;
use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;

/**
 * VRM Viewerアプリのイベント登録を管理します。
 */
class Application extends App implements IBootstrap {
	public const APP_ID = 'files_vrmviewer';

	/**
	 * アプリケーションを初期化します。
	 */
	public function __construct() {
		parent::__construct(self::APP_ID);
	}

	/**
	 * Files画面のスクリプト読み込みイベントを登録します。
	 *
	 * @param IRegistrationContext $context アプリ登録コンテキスト
	 */
	#[\Override]
	public function register(IRegistrationContext $context): void {
		$context->registerEventListener(
			LoadAdditionalScriptsEvent::class,
			LoadFilesScriptsListener::class,
		);
		$context->registerPreviewProvider(
			VrmPreviewProvider::class,
			'/\A(?:model\/vrm|application\/octet-stream)\z/',
		);
	}

	/**
	 * 起動後に追加処理は行いません。
	 *
	 * @param IBootContext $context 起動コンテキスト
	 */
	#[\Override]
	public function boot(IBootContext $context): void {
	}
}

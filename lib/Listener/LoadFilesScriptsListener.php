<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: MIT
 */

namespace OCA\Files_VRMViewer\Listener;

use OCA\Files\Event\LoadAdditionalScriptsEvent;
use OCA\Files_VRMViewer\AppInfo\Application;
use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\Util;

/**
 * Files画面へVRM Viewerの初期化スクリプトを追加します。
 *
 * @template-implements IEventListener<LoadAdditionalScriptsEvent>
 */
class LoadFilesScriptsListener implements IEventListener {
	/**
	 * Viewer本体より先にハンドラーを登録できるよう初期化スクリプトを読み込みます。
	 *
	 * @param Event $event Files画面のスクリプト読み込みイベント
	 */
	#[\Override]
	public function handle(Event $event): void {
		if (!$event instanceof LoadAdditionalScriptsEvent) {
			return;
		}

		Util::addInitScript(Application::APP_ID, 'files_vrmviewer-init');
	}
}

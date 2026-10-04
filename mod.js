(function () {
  'use strict';
  var root = document.getElementById('mod-root');
  if (!root || !window.FesOrderSDK) return;
  var hook = window.FesOrderSDK.hookName;
  if (hook === 'registerAction') {
    root.innerHTML = '<button class="offline-status" type="button" aria-live="polite"><span class="offline-status__dot"></span><span class="offline-status__label">通信状態を確認中</span></button>';
    var button = root.querySelector('.offline-status');
    var label = root.querySelector('.offline-status__label');
    function updateStatus() {
      var online = navigator.onLine;
      button.classList.toggle('is-offline', !online);
      label.textContent = online ? 'オンライン' : 'オフライン';
      button.title = online ? '通信可能です' : 'FesFlowは会計確定を送信できません';
    }
    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    button.addEventListener('click', function () {
      alert(navigator.onLine
        ? '現在オンラインです。通常どおり会計できます。'
        : '現在オフラインです。FesFlowの現行モッドAPIでは注文の保存・同期はできません。注文内容を控え、復旧後に入力してください。');
    });
    return;
  }
  if (hook === 'registerBodyBottom') {
    root.innerHTML = '<section class="offline-panel" hidden><strong>オフライン</strong><span>通信が復旧するまで会計確定を待ち、注文内容を控えてください。</span></section>';
    var panel = root.querySelector('.offline-panel');
    function updatePanel() { panel.hidden = navigator.onLine; }
    updatePanel();
    window.addEventListener('online', updatePanel);
    window.addEventListener('offline', updatePanel);
  }
})();

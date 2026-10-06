// 点击工具栏图标时打开侧边栏（同时授予 activeTab 权限，用于截屏兜底）
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((e) => console.error(e));

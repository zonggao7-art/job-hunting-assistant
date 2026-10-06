# 第三方组件声明

本项目的自有代码以 MIT 许可证发布，但包含或依赖以下第三方组件：

## pdf.js（已打包）

- 位置：`extension/pdf.min.js`、`extension/pdf.worker.min.js`
- 版权：Copyright 2023 Mozilla Foundation
- 许可证：Apache License 2.0（完整声明保留在这两个文件开头的注释中）
- 项目主页：https://github.com/mozilla/pdf.js
- 用途：在扩展内解析用户上传的 PDF 简历

Apache-2.0 许可证全文见 https://www.apache.org/licenses/LICENSE-2.0

## 第三方服务（不随本项目分发）

- 智谱 GLM / DeepSeek / 通义千问 / Kimi / 硅基流动 等大模型 API：由使用者自行注册并按各自条款使用
- Boss直聘：本项目与 Boss直聘 官方无任何关联

## 采集器依赖（由用户自行安装，不随本项目分发）

- DrissionPage（BSD-3-Clause）、RapidOCR 等，见 `collector/0_安装依赖.bat`

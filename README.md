从 QQ(非NT版本)或 TIM 中导出的 mht 消息记录文件中提取 html 及图像的工具。

## 用法
[安装 Node.js](https://nodejs.org/en/download) 后使用

```bash
node qqmht2html.js -i mhtfile [-hnops]
```

使用内置库，无需安装依赖。

## 命令
-h 显示帮助

-i InputFileName 输入 mht 文件。（必需）

-o Directory 输出文件的目录，不指定则默认为当前目录。

-p ImageDirectoryName 输出图像的目录名(该目录将位于 -o 指定的输出目录中)，不指定则默认为 img。

-n Number  限制单个文件的最大消息数量。

-s --split  按聊天对象对输出的 html 进行分割。此时 -n 依然有效。

## 示例
`node qqmht2html.js -i chat.mht -o output -p img -n 2000 -s`

这条命令会读取 chat.mht 后将 html 文件输出到当前目录的 output 目录下， 图像文件输出到 output/img 目录下，按聊天对象对记录进行分割(如果你直接导出整个分组到 mht 文件中)，每个 html 最大 2000 条消息。
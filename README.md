# Game

可运行的移动端 Web 解谜游戏，使用无依赖的 ES Module、HTML 和 CSS 实现。

## Run

```powershell
cd game
npx vite --host 127.0.0.1
```

当前开发服务地址：`http://127.0.0.1:4175/`

## Included

- 序章长按复选框。
- 滑块行为轨迹验证。
- Number Link 路径选择。
- Masyu 视觉追踪。
- 4×4 数独识别纠错。
- Slitherlink 异常围栏：四张连续盘面还原 H、U、M、N。
- Hashiwokakero 节点互证。
- 最终“不可能的完美直线”与认证结局。

进度、振动设置和已获得的人类特征只保存在浏览器 `localStorage`，不上传轨迹或设备信息。

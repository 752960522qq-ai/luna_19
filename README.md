# 双人成鼠 · Double Trouble, Tiny World

第三人称剧情 / 射击试玩。玩家始终操作小梅，科迪由 AI 控制：他会跟随、协助射击，也会打着“帮忙”的旗号给小梅制造麻烦。基于 Three.js + Android WebView，可离线运行。当前源码版本为 **0.2.0，第一章「好心的捷径」**。

## 第一章内容

1. 主菜单：开始游戏、读取存档；已有存档时，新游戏有覆盖提示。
2. 小梅和科迪对话后，前往仓库配电台。
3. 科迪“开捷径”触发警报，玩家需要清理丧尸。
4. 取回电池后，科迪“省电”拔掉照明，引来第二批敌人。
5. 清理敌人、为出口供电，进入鼠洞完成第一章。

科迪会保持同行、绕过障碍并协助射击；他的恶作剧与关卡阶段绑定，恢复存档不会重复触发。剧情使用中文文字与对话动作，未加入配音。

## 操作

- 左摇杆移动；右侧拖动视角。
- 瞄准按钮切换瞄准；按住开火连续射击。身体 / 头部命中伤害不同。
- 换弹，拾取蓝色弹药补给与红色医疗补给；敌人靠近后攻击小梅。
- 靠近目标后点击互动按钮；对白点击「继续」。
- 暂停菜单可保存、继续或保存并返回主菜单。流程检查点和游戏中间隔自动保存。被击倒后可读取存档。
- 桌面：WASD / 方向键移动，Q 瞄准，空格开火，R 换弹，E 互动，Shift 疾跑，Esc 暂停，Enter 继续对白。

## 人物与动作

- 小梅与科迪：保留原模型、贴图、骨骼和蒙皮；包含 Idle、Run、Aim、Talk。瞄准和对话来自用户提供的 FBX；移动瞄准采用上下半身分开播放。
- 丧尸：使用用户提供的已绑定 GLB。两份额外静态 GLB 字节相同，不当作两个不同怪物重复导入。
- 待机池：`Idle_Sway`、`Idle_Lurch`，分别由两份不同的 Zombie Idle FBX 适配。
- 移动池：`Walk_Shuffle` 使用原 GLB 动作，`Walk_Heavy` 是同一动作的较慢节奏变体，不声称来自第二份独立步行动作。
- **每个丧尸生成时，只抽取一次待机动作、移动动作与步速。随后切换行为只使用这个个体已选中的动作；保存和读取均保留选择。**
- 统一显示身高，播放时约束脚底高度、消除移动动作的平面根位移。科迪和小梅使用可见的简易玩具步枪。

## 存档

使用当前应用本地存储 `double-mice.save.v1`。保存章节阶段、小梅位置 / 生命 / 弹药、科迪位置、已发生剧情、补给领取状态、存活丧尸的位置 / 生命 / 动作选择及随机种子。无效或损坏的存档会提示重新开始，不会阻止菜单进入。

## 开发与验证

```bash
python3 -m http.server 8080 --directory web
npm install
npx playwright install chromium
npm test
npm run test:textures
npm run test:browser
```

可设置 `LUNA_CHROMIUM` 指向已安装的 Chromium。浏览器测试使用 **从 Android MainActivity 直接读取的同一 CSP**，覆盖贴图、菜单、玩家移动、瞄准命中、弹药装填、剧情阶段、丧尸动作选择存档恢复、出口条件和死亡读档。测试截图默认输出到被忽略的 `build/qa`，可用 `LUNA_TEST_OUTPUT` 改变路径。

`models/base` 保存动画加工的基础模型，`models/animations` 保存本次实际使用的 FBX。Blender 4.x 中运行 `scripts/prepare_story_animations.py` 可重新生成 `web/assets` 的故事模型；`story-animation-report.json` 记录来源和帧数。原先的 `retarget.py`、`fix_grounding.py` 保留为早期移动测试的加工记录。

## Android 外壳

包名 `com.luna.movement`，显示名「双人成鼠」，源码版本 `0.2.0` / code 2。最低 Android 8 / API 26，目标 API 35；横屏，要求 OpenGL ES 3 和可用的 Android System WebView。没有 native `.so`，不依赖 32 位 CPU 运行库；全部资源随包提供，不请求网络权限。

后续需要打包时，使用 JDK 17、Android Platform 35 / Build Tools 35.0.1，运行 `scripts/build_apk.sh`。可通过 `LUNA_SDK`、`LUNA_BUILD_TOOLS`、`LUNA_JAVAC` 和 `LUNA_KEY` 指定工具及仓库外的开发签名证书。**本次只修改和验证源码，没有生成新 APK。**

所有用户提供的人物和动作资源的权利仍归各自权利人。本工程不替这些资源授予新许可。Three.js 按随附 MIT 许可使用。设备端限制见 `VALIDATION.md`。

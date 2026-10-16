import { VOICE_IDS } from "./voice-lines.js";
export const DIALOGUES = {
  intro: [
    ["may", "回海口怎么还要穿过这座仓库？这地方简直像个巨型老鼠笼。"],
    ["cody", "回海口之前，先走这条捷径。放心，小梅，我会一直帮着你的。"],
    ["may", "先找出口。还有——别再碰那些写着“危险”的按钮。"],
    ["cody", "当然。当然。我最擅长的就是安全。先去前面的配电台吧。"],
  ],
  alarm: [
    ["cody", "让我帮你开门。这个红色按钮，肯定是快捷通道！"],
    ["may", "那上面明明写着“警报测试”！"],
    ["cody", "看，门口的朋友都来迎接我们了。一起热热身？"],
    ["may", "等出去了，我再跟你算账。"],
  ],
  cleared: [
    ["may", "清净了。出口的电源还是断的。"],
    ["cody", "右边货架有备用电池。我给你看过了，绝对安全。"],
    ["may", "你越这么说，我就越不放心。"],
  ],
  blackout: [
    ["cody", "小梅，我替你省点电。把这根线拔掉就行——"],
    ["may", "科迪！你把照明也关了！"],
    ["cody", "这样丧尸就看不见你了。我是不是考虑得特别周到？"],
    ["may", "它们正在往这边跑！先把它们解决，再去给出口供电。"],
  ],
  exit: [
    ["may", "电源接上了。出口就在前面。"],
    ["cody", "你看，没有我，你哪来这么精彩的一天？"],
    ["may", "走你前面。下一次“帮忙”，我得看着你。"],
  ],
  ending: [
    ["cody", "我还找到了一条更近的路，要不要——"],
    ["may", "不要。"],
    ["cody", "……我只是想帮你。"],
    ["may", "下一章，你先把手放口袋里。"],
  ],
};
export class Dialogue {
  constructor(onEnd, audio) {
    this.audio = audio;
    this.lines = [];
    this.index = 0;
    this.onEnd = onEnd;
    this.done = null;
    document.getElementById("dialogue-next").onclick = () => this.next();
  }
  start(lines, done) {
    this.audio?.stopVoice();
    this.lines = lines;
    this.index = 0;
    this.done = done;
    document.getElementById("dialogue").hidden = false;
    this.draw();
  }
  get active() {
    return this.lines.length > 0;
  }
  get speaker() {
    return this.lines[this.index]?.[0];
  }
  draw() {
    const line = this.lines[this.index];
    this.audio?.speak(line[1], line[2] || VOICE_IDS[line[1]], line[0]);
    const portrait = document.getElementById("dialogue-portrait");
    if (portrait) portrait.src = `assets/portraits/${line[0]}.png`;
    document.getElementById("speaker").textContent =
      line[0] === "may" ? "小梅" : "科迪";
    document.getElementById("dialogue-text").textContent = line[1];
    document.getElementById("dialogue-count").textContent =
      `${this.index + 1} / ${this.lines.length}`;
    document.getElementById("dialogue").dataset.speaker = line[0];
  }
  next() {
    if (!this.active) return;
    this.audio?.stopVoice();
    this.index++;
    if (this.index < this.lines.length) this.draw();
    else {
      this.lines = [];
      document.getElementById("dialogue").hidden = true;
      const done = this.done;
      this.done = null;
      done?.();
      this.onEnd?.();
    }
  }
  clear() {
    this.audio?.stopVoice();
    this.lines = [];
    this.done = null;
    document.getElementById("dialogue").hidden = true;
  }
}

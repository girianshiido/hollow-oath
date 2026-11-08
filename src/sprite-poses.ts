export type MonsterPose = 'idle'|'attack'|'hurt';
export const PIKEMAN_FRAMES = {
  idle:{art:'foe-2',x:0,y:0},
  attack:{art:'foe-2-attack',x:6/305*100,y:8/358*100},
  hurt:{art:'foe-2-hurt',x:-3/305*100,y:3/358*100}
} as const;
const DURATION = {attack:240,hurt:190};
/** Frames share a canvas and constant scale. Overlapping strikes play in order. */
export class MonsterPoses {
  pose: MonsterPose='idle';
  private left=0;
  private queued: ('attack'|'hurt')[]=[];
  trigger(pose:'attack'|'hurt'): void {
    if(this.pose==='idle'){this.pose=pose;this.left=DURATION[pose];return;}
    if(this.queued.at(-1)!==pose){this.queued.push(pose);if(this.queued.length>2)this.queued.shift();}
  }
  tick(milliseconds:number): void {
    if(!Number.isFinite(milliseconds)||milliseconds<=0)return;
    let remaining=milliseconds;
    while(this.pose!=='idle'&&remaining>=this.left){remaining-=this.left;const next=this.queued.shift();this.pose=next??'idle';this.left=next?DURATION[next]:0;}
    if(this.pose!=='idle')this.left-=remaining;
  }
  reset(): void {this.pose='idle';this.left=0;this.queued=[];}
}
